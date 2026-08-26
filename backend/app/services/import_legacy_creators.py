"""One-off import of the client's legacy CRM spreadsheet into inf-crm-v2.

Run (dry run, no DB writes -- default):
    python -m app.services.import_legacy_creators "path/to/sheet.csv"

Run for real:
    python -m app.services.import_legacy_creators "path/to/sheet.csv" --commit

Idempotent -- safe to re-run: creators are matched by instagram_handle,
collaborations by video_link, users by email, products by name. Re-running
against the same file (or a superset of it) skips everything already
imported and only adds what's new.

Decisions this import makes (confirmed with the user before writing this):
- Each row is one *engagement*; a creator can span multiple rows (multiple
  engagements over time). Each individual video (one of up to 6 date+link
  pairs per row) becomes its own Collaboration at stage=live, matching the
  app's "one live card = one video" rule everywhere else.
- "Total Videos" is unreliable (doesn't match the actual filled video-link
  count on 28% of rows) -- the real video count is derived from which
  "Video N link" cells are actually filled in.
- Video dates ("6-Aug") have no year -- assumed 2026 throughout.
- "Creator Category" is dropped entirely (blank on 77% of rows, and a
  chaotic mix of follower-tier labels and bare follower counts on the
  rest -- it isn't the same concept as Creator.category).
- Owner Email rows that don't match an existing User are created as new
  advisor accounts (must_change_password=True, a fixed temporary password
  reported at the end so they can be redistributed).
- Products (free text, newline-separated) are auto-created in the shared
  product master when they don't match an existing product name
  (case-insensitive). All products listed in a row are attached to every
  video in that row (the sheet doesn't distinguish per-video products).
- Rows with a blank Username are skipped and reported (can't import
  without instagram_handle, our unique key).
- Phone numbers are best-effort cleaned to a 10-digit sequence; left blank
  if nothing clean is extractable.
- "Last Cost" is applied only to the most recent video's Collaboration
  (matched to "Last Live Date" when present, else the last filled video
  slot) -- there's no per-video cost breakdown in the sheet.
- A PartnershipTicket is created for every imported collaboration (all are
  stage=live), matching what transition_collab_stage does automatically
  in the interactive app, so imported videos show up in Partnership Hub's
  Overview register too.
- This writes directly to the DB, bypassing create_collaboration's
  interactive-stage-field validation (creator_reply, live_attribution,
  etc.) -- appropriate for a historical bulk backfill, same precedent as
  services/metric_upload.py.
"""

import asyncio
import csv
import re
import sys
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage, CreatorStage, CreatorStatus, PaymentStatus, UserRole
from app.db.models.partnership_ticket import PartnershipTicket
from app.db.models.product import Product
from app.db.models.user import User
from app.db.session import AsyncSessionLocal

TEMP_PASSWORD = "ChangeMe123!"
DEFAULT_YEAR = 2026
UNCATEGORIZED = "Uncategorized"

MONTH_MAP = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}


# Conservative, hand-reviewed typo/spacing/quantity-suffix corrections --
# only cases confirmed to be the same product as another name already
# present elsewhere in the sheet (not a guess at what a genuinely distinct,
# never-seen product name "probably" means). Keyed lowercase; matched
# after stripping, before product lookup/creation.
PRODUCT_ALIASES: dict[str, str] = {
    "kajall": "kajal",
    "kajal x 2": "kajal",
    "2 kajal": "kajal",
    "kajal re purchase": "kajal",
    "strobe rosegol": "strobe rosegold",
    "strobe rodegold": "strobe rosegold",
    "strobe rosegild": "strobe rosegold",
    "dailstrobe": "daily strobe",
    "blurrify": "blurify",
    "eyelienr": "eyeliner",
    "hairfullfill": "hair full fill",
    "hair fullfill": "hair full fill",
    "skintint almomnd": "skintint almond",
    "sjin tint cashew": "skin tint cashew",
    "glowdigger": "glow digger",
    "akintint almond": "skintint almond",
    "rose gold sc.": "rose gold sc",
}


def normalize_product_name(name: str) -> str:
    return PRODUCT_ALIASES.get(name.strip().lower(), name.strip())


def parse_short_date(raw: str | None) -> datetime | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    m = re.match(r"^(\d{1,2})-([A-Za-z]{3})$", raw)
    if not m:
        return None
    day, mon = int(m.group(1)), MONTH_MAP.get(m.group(2).lower())
    if not mon:
        return None
    try:
        return datetime(DEFAULT_YEAR, mon, day, tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_last_live_date(raw: str | None) -> datetime | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    for fmt in ("%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def clean_phone(raw: str | None) -> str | None:
    raw = (raw or "").strip()
    if not raw:
        return None
    digits = re.sub(r"\D", "", raw)
    m = re.search(r"\d{10}", digits)
    return m.group(0) if m else None


def parse_amount(raw: str | None) -> float | None:
    raw = (raw or "").strip().replace(",", "")
    if not raw:
        return None
    try:
        value = float(raw)
    except ValueError:
        return None
    return value if value > 0 else None


class ImportSummary:
    def __init__(self) -> None:
        self.creators_created = 0
        self.creators_reused = 0
        self.collaborations_created = 0
        self.collaborations_skipped_existing = 0
        self.users_created: list[str] = []
        self.products_created: list[str] = []
        self.rows_skipped_no_username: list[str] = []
        self.rows_with_no_videos = 0

    def report(self) -> str:
        lines = [
            f"Creators created: {self.creators_created}",
            f"Creators reused (already existed / seen earlier in this file): {self.creators_reused}",
            f"Collaborations created (one per video): {self.collaborations_created}",
            f"Collaborations skipped (video_link already imported): {self.collaborations_skipped_existing}",
            f"Rows with zero filled video links: {self.rows_with_no_videos}",
            f"New advisor users created: {len(self.users_created)}",
        ]
        if self.users_created:
            lines.append("  -> " + ", ".join(self.users_created))
        lines.append(f"New products created: {len(self.products_created)}")
        if self.products_created:
            lines.append("  -> " + ", ".join(self.products_created))
        lines.append(f"Rows skipped (blank username): {len(self.rows_skipped_no_username)}")
        for name in self.rows_skipped_no_username:
            lines.append(f"  -> {name!r}")
        return "\n".join(lines)


async def _get_or_create_user(db: AsyncSession, cache: dict[str, int], email: str, admin_id: int, summary: ImportSummary) -> int:
    email = (email or "").strip()
    if not email:
        return admin_id
    key = email.lower()
    if key in cache:
        return cache[key]
    existing = (await db.execute(select(User).where(func.lower(User.email) == key))).scalar_one_or_none()
    if existing is not None:
        cache[key] = existing.id
        return existing.id
    name = email.split("@")[0].replace(".", " ").replace("_", " ").title()
    user = User(
        name=name,
        email=email,
        password_hash=hash_password(TEMP_PASSWORD),
        role=UserRole.advisor,
        must_change_password=True,
    )
    db.add(user)
    await db.flush()
    cache[key] = user.id
    summary.users_created.append(email)
    return user.id


async def _get_or_create_product(db: AsyncSession, cache: dict[str, int], name: str, admin_id: int, summary: ImportSummary) -> int:
    key = name.strip().lower()
    if key in cache:
        return cache[key]
    existing = (await db.execute(select(Product).where(func.lower(Product.name) == key))).scalar_one_or_none()
    if existing is not None:
        cache[key] = existing.id
        return existing.id
    product = Product(name=name.strip(), owner_id=admin_id, target_videos=0)
    db.add(product)
    await db.flush()
    cache[key] = product.id
    summary.products_created.append(name.strip())
    return product.id


async def _next_collab_code(db: AsyncSession) -> str:
    count = (await db.execute(select(func.count(Collaboration.id)))).scalar_one()
    year = datetime.now(timezone.utc).year
    return f"CLB-{year}-{count + 1:04d}"


async def run_import(csv_path: str, dry_run: bool = True) -> ImportSummary:
    summary = ImportSummary()

    async with AsyncSessionLocal() as db:
        admin = (await db.execute(select(User).where(User.role == UserRole.admin).order_by(User.id).limit(1))).scalar_one_or_none()
        if admin is None:
            raise RuntimeError("No admin user exists yet -- bootstrap one first.")
        admin_id = admin.id

        with open(csv_path, encoding="cp1252", newline="") as f:
            rows = list(csv.DictReader(f))

        user_cache: dict[str, int] = {}
        product_cache: dict[str, int] = {}
        creator_cache: dict[str, int] = {}

        existing_links_result = await db.execute(select(Collaboration.video_link).where(Collaboration.video_link.is_not(None)))
        existing_video_links: set[str] = {row[0] for row in existing_links_result.all()}

        for row in rows:
            username = (row.get("Username") or "").strip().lstrip("@").lower()
            name = (row.get("Name") or "").strip()
            if not username:
                summary.rows_skipped_no_username.append(name or "(blank name too)")
                continue
            # A handful of rows have a full URL (often a YouTube channel link
            # with tracking params) pasted into Username instead of a plain
            # handle -- instagram_handle is String(120) and real handles are
            # under ~30 chars, so anything this long is malformed, not just
            # long. Skip and report rather than guess a truncated identifier.
            if len(username) > 60 or username.startswith("http") or "://" in username:
                summary.rows_skipped_no_username.append(f"{name!r} (Username looks like a URL, not a handle: {username[:60]}...)")
                continue

            videos: list[tuple[datetime | None, str]] = []
            for i in range(1, 7):
                link = (row.get(f"Video {i} link") or "").strip()
                if not link:
                    continue
                date = parse_short_date(row.get(f"VIDEO {i} DATE"))
                videos.append((date, link))
            if not videos:
                summary.rows_with_no_videos += 1

            # Owner and creator are resolved for EVERY valid row, video or
            # not -- a profile-only row (no delivered video yet) still needs
            # to land in Database, just without a Collaboration/Kanban card.
            owner_id = await _get_or_create_user(db, user_cache, (row.get("Owner Email") or ""), admin_id, summary)

            if username in creator_cache:
                creator_id = creator_cache[username]
                summary.creators_reused += 1
            else:
                existing_creator = (
                    await db.execute(select(Creator).where(func.lower(Creator.instagram_handle) == username))
                ).scalar_one_or_none()
                if existing_creator is not None:
                    creator_id = existing_creator.id
                    summary.creators_reused += 1
                else:
                    creator = Creator(
                        name=name or username,
                        instagram_handle=username,
                        phone=clean_phone(row.get("Number")),
                        email=(row.get("Email") or "").strip() or None,
                        category=UNCATEGORIZED,
                        followers_count=0,
                        owner_id=owner_id,
                        current_stage=CreatorStage.live if videos else CreatorStage.new_lead,
                        status=CreatorStatus.active if videos else CreatorStatus.none,
                    )
                    db.add(creator)
                    await db.flush()
                    creator_id = creator.id
                    summary.creators_created += 1
                creator_cache[username] = creator_id

            if not videos:
                continue

            # The Products cell lists multiple distinct products separated
            # inconsistently by newlines, "+", or "," (all three appear
            # throughout the sheet as plain list separators, e.g. "strobe
            # cream, kajal, primer" or "Strobe Trio + Skintint Cashew +
            # Kajal") -- split on all three rather than just newlines, or
            # every multi-product row becomes one bogus "combo" product.
            product_names = [
                normalize_product_name(p) for p in re.split(r"[\n+,]", row.get("Products") or "") if p.strip()
            ]
            product_ids: list[int] = []
            for p in product_names:
                pid = await _get_or_create_product(db, product_cache, p, admin_id, summary)
                if pid not in product_ids:  # same name twice, or two names normalizing to one product
                    product_ids.append(pid)

            last_live_date = parse_last_live_date(row.get("Last Live Date"))
            last_cost = parse_amount(row.get("Last Cost"))
            # Which video gets the row's single Last Cost value: the one whose
            # date matches Last Live Date, else the last (highest-index) video.
            cost_target_idx = len(videos) - 1
            if last_live_date is not None:
                for idx, (date, _link) in enumerate(videos):
                    if date is not None and date.date() == last_live_date.date():
                        cost_target_idx = idx
                        break

            for idx, (date, link) in enumerate(videos):
                if link in existing_video_links:
                    summary.collaborations_skipped_existing += 1
                    continue

                activity_at = date or last_live_date or datetime.now(timezone.utc)
                collab_code = await _next_collab_code(db)
                collab = Collaboration(
                    collab_code=collab_code,
                    creator_id=creator_id,
                    owner_id=owner_id,
                    stage=CollabStage.live,
                    priority=CreatorStatus.active,
                    payment_status=PaymentStatus.pending,
                    video_link=link,
                    commercial_amount=last_cost if idx == cost_target_idx else None,
                    created_at=activity_at,
                    last_activity_at=activity_at,
                )
                db.add(collab)
                await db.flush()

                for p_idx, product_id in enumerate(product_ids):
                    db.add(
                        CollaborationProduct(
                            collaboration_id=collab.id,
                            product_id=product_id,
                            is_primary=(p_idx == 0),
                            is_live_attributed=True,
                        )
                    )

                db.add(
                    CollabStageEvent(
                        collaboration_id=collab.id,
                        from_stage=None,
                        to_stage=CollabStage.live,
                        actor_id=owner_id,
                        note="Imported from legacy CRM sheet",
                        created_at=activity_at,
                    )
                )
                db.add(PartnershipTicket(collaboration_id=collab.id))

                existing_video_links.add(link)
                summary.collaborations_created += 1

        if dry_run:
            await db.rollback()
        else:
            await db.commit()

    return summary


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.services.import_legacy_creators <csv_path> [--commit]")
        sys.exit(1)
    path = sys.argv[1]
    commit = "--commit" in sys.argv[2:]
    result = asyncio.run(run_import(path, dry_run=not commit))
    print(f"{'DRY RUN (no changes written)' if not commit else 'COMMITTED'}")
    print(result.report())
