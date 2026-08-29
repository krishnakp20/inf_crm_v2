"""One-off UPDATE of already-imported creators/collaborations from the
client's corrected CRM sheet ("CRM Cleaned data (2).csv" or similar).

This is a different operation from import_legacy_creators.py: that script
only ever CREATES (idempotent -- skips anything already matched). This one
also corrects fields on records already imported, since the client
re-shared "the same data with correction."

Run (dry run, no DB writes -- default):
    python -m app.services.update_from_corrected_csv "path/to/corrected.csv"

Run for real:
    python -m app.services.update_from_corrected_csv "path/to/corrected.csv" --commit

Decisions this makes (confirmed with the user before writing this):
- The client's cleanup did a blanket rename "Kajal" -> "DS Kohl Pencil" in
  the Products vocabulary (intentional, a real product rebrand -- the new
  file uses a clean, standardized 17-name product list). That same
  find-replace collided with real creators actually named/handled "Kajal"
  (e.g. "Govind Kajal Dhiman" / "kajaldhiman9291" became "Govind DS Kohl
  Pencil Dhiman" / "DS Kohl Pencildhiman9291"). This script reverses that
  specific corruption in the Name/Username columns only -- confirmed via
  full-file scan that no other new product name collided with any name/
  username, so no broader reversal is needed.
- Every occurrence of a username across the file is treated as the same
  person, updated over time (never split into two people, even where two
  rows show different phone numbers for the same handle -- 29 such cases
  exist in the source data, and the user chose not to guess at a split).
  The creator's profile fields (name, phone, email, owner) are updated
  from whichever of that person's rows has the MOST RECENT video date (or
  Last Live Date if no video date parses) -- their latest known contact
  info, not just whichever row happened to import first.
- Product names are NOT diffed/mapped old-to-new -- the new file's Products
  column is authoritative per row, exactly like the original import
  treated it. For an already-existing Collaboration (matched by its
  stable video_link), its product linkage is fully REPLACED with whatever
  this row now lists (using the new, cleaner ~17-name product vocabulary),
  rather than attempting a fuzzy old-name -> new-name inference (checked:
  the co-occurrence mapping is genuinely ambiguous for several products,
  e.g. "primer" maps most-often but not deterministically to "Blurify").
- A brand-new video_link not seen before is created exactly like the
  original import (new Collaboration + products + CollabStageEvent +
  PartnershipTicket).
- Previously-skipped rows (bad/URL-shaped username now fixed) are created
  fresh, same as the original import would have.
"""

import asyncio
import csv
import re
import sys
from collections import defaultdict
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage, CreatorStage, CreatorStatus, PaymentStatus, UserRole
from app.db.models.partnership_ticket import PartnershipTicket
from app.db.models.user import User
from app.db.session import AsyncSessionLocal
from app.services.import_legacy_creators import (
    UNCATEGORIZED,
    _get_or_create_product,
    _get_or_create_user,
    _next_collab_code,
    clean_phone,
    parse_amount,
    parse_last_live_date,
    parse_short_date,
)

# The only collision found via a full-file scan: the client's blanket
# Products-vocabulary rename "Kajal" -> "DS Kohl Pencil" also hit real
# people's names/handles that happened to contain "kajal". Reversed here,
# in Name/Username only -- the Products column keeps the new name, since
# that rename is the intentional part.
KAJAL_REVERSAL = re.compile(r"ds kohl pencil", re.IGNORECASE)


def reverse_kajal_corruption(value: str) -> str:
    return KAJAL_REVERSAL.sub("kajal", value) if value else value


class UpdateSummary:
    def __init__(self) -> None:
        self.creators_created = 0
        self.creators_updated: list[str] = []
        self.creators_unchanged = 0
        self.collaborations_created = 0
        self.collaborations_products_replaced = 0
        self.collaborations_cost_updated = 0
        self.users_created: list[str] = []
        self.products_created: list[str] = []
        self.rows_skipped_no_username: list[str] = []
        self.rows_with_no_videos = 0

    def report(self) -> str:
        lines = [
            f"Creators created (new): {self.creators_created}",
            f"Creators updated (profile field changed): {len(self.creators_updated)}",
        ]
        for name in self.creators_updated:
            lines.append(f"  -> {name}")
        lines += [
            f"Creators unchanged: {self.creators_unchanged}",
            f"Collaborations created (new video): {self.collaborations_created}",
            f"Existing collaborations with product linkage replaced: {self.collaborations_products_replaced}",
            f"Existing collaborations with commercial_amount updated: {self.collaborations_cost_updated}",
            f"Rows with zero filled video links: {self.rows_with_no_videos}",
            f"New advisor users created: {len(self.users_created)}",
        ]
        if self.users_created:
            lines.append("  -> " + ", ".join(self.users_created))
        lines.append(f"New products created: {len(self.products_created)}")
        if self.products_created:
            lines.append("  -> " + ", ".join(self.products_created))
        lines.append(f"Rows skipped (blank/bad username): {len(self.rows_skipped_no_username)}")
        for name in self.rows_skipped_no_username:
            lines.append(f"  -> {name!r}")
        return "\n".join(lines)


def _row_recency(row: dict, videos: list[tuple[datetime | None, str]]) -> datetime:
    dates = [d for d, _link in videos if d is not None]
    last_live = parse_last_live_date(row.get("Last Live Date"))
    if last_live is not None:
        dates.append(last_live)
    return max(dates) if dates else datetime.min.replace(tzinfo=timezone.utc)


async def run_update(csv_path: str, dry_run: bool = True) -> UpdateSummary:
    summary = UpdateSummary()

    async with AsyncSessionLocal() as db:
        admin = (await db.execute(select(User).where(User.role == UserRole.admin).order_by(User.id).limit(1))).scalar_one_or_none()
        if admin is None:
            raise RuntimeError("No admin user exists yet -- bootstrap one first.")
        admin_id = admin.id

        with open(csv_path, encoding="cp1252", newline="") as f:
            raw_rows = list(csv.DictReader(f))

        # Pass 1: clean + validate every row, parse its videos once.
        parsed_rows: list[dict] = []
        for row in raw_rows:
            username = reverse_kajal_corruption((row.get("Username") or "").strip()).lstrip("@").lower()
            name = reverse_kajal_corruption((row.get("Name") or "").strip())
            if not username:
                summary.rows_skipped_no_username.append(name or "(blank name too)")
                continue
            if len(username) > 60 or username.startswith("http") or "://" in username:
                summary.rows_skipped_no_username.append(f"{name!r} (Username looks like a URL, not a handle: {username[:60]}...)")
                continue

            videos: list[tuple[datetime | None, str]] = []
            for i in range(1, 7):
                link = (row.get(f"Video {i} link") or "").strip()
                if not link:
                    continue
                videos.append((parse_short_date(row.get(f"VIDEO {i} DATE")), link))
            if not videos:
                summary.rows_with_no_videos += 1

            parsed_rows.append({"row": row, "username": username, "name": name, "videos": videos})

        # Pass 2: group by username, find each person's most-recent row --
        # that row's Name/Phone/Email/Owner becomes the profile source of
        # truth (their latest known contact info, not file order).
        by_username: dict[str, list[dict]] = defaultdict(list)
        for pr in parsed_rows:
            by_username[pr["username"]].append(pr)

        most_recent_row: dict[str, dict] = {}
        for username, entries in by_username.items():
            most_recent_row[username] = max(entries, key=lambda pr: _row_recency(pr["row"], pr["videos"]))

        user_cache: dict[str, int] = {}
        product_cache: dict[str, int] = {}
        creator_cache: dict[str, int] = {}

        existing_links_result = await db.execute(
            select(Collaboration.id, Collaboration.video_link).where(Collaboration.video_link.is_not(None))
        )
        existing_collabs_by_link: dict[str, int] = {link: cid for cid, link in existing_links_result.all()}

        # Pass 3: resolve every creator profile once, using the most-recent row.
        for username, best in most_recent_row.items():
            row = best["row"]
            owner_id = await _get_or_create_user(db, user_cache, (row.get("Owner Email") or ""), admin_id, summary)  # type: ignore[arg-type]
            name = best["name"] or username
            phone = clean_phone(row.get("Number"))
            email = (row.get("Email") or "").strip() or None
            has_videos = bool(best["videos"])

            existing_creator = (
                await db.execute(select(Creator).where(func.lower(Creator.instagram_handle) == username))
            ).scalar_one_or_none()

            if existing_creator is None:
                creator = Creator(
                    name=name,
                    instagram_handle=username,
                    phone=phone,
                    email=email,
                    category=UNCATEGORIZED,
                    followers_count=0,
                    owner_id=owner_id,
                    current_stage=CreatorStage.live if has_videos else CreatorStage.new_lead,
                    status=CreatorStatus.active if has_videos else CreatorStatus.none,
                )
                db.add(creator)
                await db.flush()
                creator_cache[username] = creator.id
                summary.creators_created += 1
            else:
                changed = []
                if name and name != existing_creator.name:
                    changed.append(f"name {existing_creator.name!r}->{name!r}")
                    existing_creator.name = name
                if phone and phone != existing_creator.phone:
                    changed.append(f"phone {existing_creator.phone!r}->{phone!r}")
                    existing_creator.phone = phone
                if email and email != existing_creator.email:
                    changed.append(f"email {existing_creator.email!r}->{email!r}")
                    existing_creator.email = email
                if owner_id != existing_creator.owner_id:
                    changed.append(f"owner_id {existing_creator.owner_id}->{owner_id}")
                    existing_creator.owner_id = owner_id
                creator_cache[username] = existing_creator.id
                if changed:
                    summary.creators_updated.append(f"{username}: {', '.join(changed)}")
                else:
                    summary.creators_unchanged += 1

        # Pass 4: process every row's videos/products -- independent of
        # which row "won" the profile, each video is its own record.
        for pr in parsed_rows:
            row, username, videos = pr["row"], pr["username"], pr["videos"]
            if not videos:
                continue
            creator_id = creator_cache[username]
            owner_id = await _get_or_create_user(db, user_cache, (row.get("Owner Email") or ""), admin_id, summary)  # type: ignore[arg-type]

            product_names = [p.strip() for p in re.split(r"[\n+,]", row.get("Products") or "") if p.strip()]
            product_ids: list[int] = []
            for p in product_names:
                pid = await _get_or_create_product(db, product_cache, p, admin_id, summary)  # type: ignore[arg-type]
                if pid not in product_ids:
                    product_ids.append(pid)

            last_live_date = parse_last_live_date(row.get("Last Live Date"))
            last_cost = parse_amount(row.get("Last Cost"))
            cost_target_idx = len(videos) - 1
            if last_live_date is not None:
                for idx, (date, _link) in enumerate(videos):
                    if date is not None and date.date() == last_live_date.date():
                        cost_target_idx = idx
                        break

            for idx, (date, link) in enumerate(videos):
                existing_collab_id = existing_collabs_by_link.get(link)

                if existing_collab_id is not None:
                    # Replace product linkage wholesale -- simpler and safer
                    # than trying to diff old vs new product sets, and the
                    # new file is authoritative for this row regardless.
                    await db.execute(
                        CollaborationProduct.__table__.delete().where(
                            CollaborationProduct.collaboration_id == existing_collab_id
                        )
                    )
                    for p_idx, product_id in enumerate(product_ids):
                        db.add(
                            CollaborationProduct(
                                collaboration_id=existing_collab_id,
                                product_id=product_id,
                                is_primary=(p_idx == 0),
                                is_live_attributed=True,
                            )
                        )
                    summary.collaborations_products_replaced += 1

                    if idx == cost_target_idx and last_cost is not None:
                        collab = await db.get(Collaboration, existing_collab_id)
                        if collab is not None and collab.commercial_amount != last_cost:
                            collab.commercial_amount = last_cost
                            summary.collaborations_cost_updated += 1
                    continue

                # Brand-new video (previously-skipped row now fixed, or a
                # genuinely new link) -- create exactly like the original import.
                activity_at = date or last_live_date or datetime.now(timezone.utc)
                collab = Collaboration(
                    collab_code=await _next_collab_code(db),
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
                        note="Imported from corrected legacy CRM sheet",
                        created_at=activity_at,
                    )
                )
                db.add(PartnershipTicket(collaboration_id=collab.id))
                existing_collabs_by_link[link] = collab.id
                summary.collaborations_created += 1

        if dry_run:
            await db.rollback()
        else:
            await db.commit()

    return summary


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python -m app.services.update_from_corrected_csv <csv_path> [--commit]")
        sys.exit(1)
    path = sys.argv[1]
    commit = "--commit" in sys.argv[2:]
    result = asyncio.run(run_update(path, dry_run=not commit))
    print(f"{'DRY RUN (no changes written)' if not commit else 'COMMITTED'}")
    print(result.report())
