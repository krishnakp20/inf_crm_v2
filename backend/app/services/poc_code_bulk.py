"""One-time bulk fill of MISSING POC codes on Live videos.

Metric Upload finds a video by its POC code, so a Live video without one can never be
updated by it. This module does two things, both run once on the server:

  export  -> a CSV of every Live video with no POC code (the sheet the client fills in)
  apply   -> reads that sheet back and fills the codes in

Run from the repo root on the server (stdin / stdout, so no file has to be copied into
the container):

  docker compose -f docker-compose.prod.yml --env-file backend/.env.production \\
      exec -T api python -m app.services.poc_code_bulk export > videos_without_poc.csv

  # preview: changes nothing, lists every change and every problem
  docker compose ... exec -T api python -m app.services.poc_code_bulk apply < filled.csv > preview.csv

  # apply: saves only if every row is fine (add --skip-errors to save the good rows anyway)
  docker compose ... exec -T api python -m app.services.poc_code_bulk apply --apply < filled.csv > changes.csv

Safety rules: only a card with NO POC code is ever filled (an existing code is never
overwritten); rows are matched on the unique Collab ID and, when both sides have a video
link, the link must match; a code can be used on only one card; a POC code change is not
card activity, so it never touches the dead-zone clock.
"""

import argparse
import asyncio
import csv
import io
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import CollabStage
from app.db.models.product import Product
from app.db.models.user import User
from app.db.session import AsyncSessionLocal
from app.services.collab_pipeline import effective_live_dates

EXPORT_COLUMNS = ["Collab ID", "Creator", "Instagram", "Owner", "Product", "Live Date", "Video Link", "POC Code"]
LOG_COLUMNS = ["Collab ID", "Creator", "Old POC Code", "New POC Code", "Result", "Note"]
MAX_POC_LENGTH = 60  # Collaboration.poc_code is String(60)

# Header spellings accepted in the filled sheet (case and spaces ignored).
_HEADER_ALIASES = {
    "collab id": "collab_id",
    "collab_id": "collab_id",
    "collab code": "collab_id",
    "poc code": "poc",
    "poc_code": "poc",
    "video link": "link",
    "video_link": "link",
    "reel link": "link",
}


def _blank(value: str | None) -> bool:
    return not (value or "").strip()


def _norm_link(value: str | None) -> str:
    return (value or "").strip().lower().rstrip("/")


def _csv_bytes(header: list[str], rows: list[list[str]]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(header)
    writer.writerows(rows)
    return b"\xef\xbb\xbf" + buffer.getvalue().encode("utf-8")  # BOM so Excel reads it as UTF-8


# ---------------------------------------------------------------------------- export
async def export_rows(db: AsyncSession) -> list[list[str]]:
    blank_poc = or_(Collaboration.poc_code.is_(None), func.btrim(Collaboration.poc_code) == "")
    found = (
        await db.execute(
            select(Collaboration, Creator, User)
            .join(Creator, Creator.id == Collaboration.creator_id)
            .join(User, User.id == Collaboration.owner_id)
            .where(Collaboration.stage == CollabStage.live, blank_poc)
        )
    ).all()
    ids = [c.id for c, _, _ in found]
    if not ids:
        return []

    products: dict[int, list[str]] = {}
    for collab_id, name in (
        await db.execute(
            select(CollaborationProduct.collaboration_id, Product.name)
            .join(Product, Product.id == CollaborationProduct.product_id)
            .where(CollaborationProduct.collaboration_id.in_(ids))
            .order_by(CollaborationProduct.is_primary.desc(), Product.name)
        )
    ).all():
        products.setdefault(collab_id, []).append(name)
    live_dates = await effective_live_dates(db, ids)

    found.sort(key=lambda r: (r[2].name.lower(), -(live_dates.get(r[0].id) or date.min).toordinal(), r[0].collab_code))
    return [
        [
            collab.collab_code,
            creator.name,
            creator.instagram_handle,
            owner.name,
            ", ".join(products.get(collab.id, [])),
            live_dates[collab.id].isoformat() if live_dates.get(collab.id) else "",
            collab.video_link or "",
            "",  # POC Code -- the client fills this column
        ]
        for collab, creator, owner in found
    ]


# ---------------------------------------------------------------------------- apply
@dataclass
class RowResult:
    line: int
    collab_code: str
    creator: str
    old_poc: str
    new_poc: str
    status: str  # "update" | "left-blank" | "skipped" | "error"
    message: str = ""
    collab: Collaboration | None = field(default=None, repr=False)


def parse_sheet(text: str) -> list[dict]:
    reader = csv.reader(io.StringIO(text))
    header = next(reader, [])
    mapping: dict[str, int] = {}
    for index, name in enumerate(header):
        key = _HEADER_ALIASES.get(name.strip().lower())
        if key and key not in mapping:
            mapping[key] = index
    missing = [label for key, label in (("collab_id", "Collab ID"), ("poc", "POC Code")) if key not in mapping]
    if missing:
        raise ValueError(f"The sheet needs these column(s): {', '.join(missing)}. Found: {', '.join(header) or 'none'}")

    def cell(row: list[str], key: str) -> str:
        return row[mapping[key]].strip() if key in mapping and mapping[key] < len(row) else ""

    return [
        {"line": line_no, "collab_id": cell(row, "collab_id"), "poc": cell(row, "poc"), "link": cell(row, "link")}
        for line_no, row in enumerate(reader, start=2)
        if any(c.strip() for c in row)
    ]


async def plan_updates(db: AsyncSession, rows: list[dict]) -> list[RowResult]:
    """Decides, row by row, what would happen. Writes nothing."""
    wanted_ids = {r["collab_id"].lower() for r in rows if r["collab_id"]}
    cards: dict[str, tuple[Collaboration, Creator]] = {}
    if wanted_ids:
        for collab, creator in (
            await db.execute(
                select(Collaboration, Creator)
                .join(Creator, Creator.id == Collaboration.creator_id)
                .where(func.lower(Collaboration.collab_code).in_(wanted_ids))
            )
        ).all():
            cards[collab.collab_code.lower()] = (collab, creator)

    used: dict[str, str] = {}  # POC code (lower) -> card that already uses it
    for code, poc in (
        await db.execute(
            select(Collaboration.collab_code, Collaboration.poc_code).where(
                Collaboration.poc_code.is_not(None), func.btrim(Collaboration.poc_code) != ""
            )
        )
    ).all():
        used[poc.strip().lower()] = code

    code_counts = Counter(r["poc"].lower() for r in rows if r["poc"])
    seen_cards: set[str] = set()
    results: list[RowResult] = []
    for r in rows:
        key = r["collab_id"].lower()
        card = cards.get(key)
        collab, creator = card if card else (None, None)
        base = dict(
            line=r["line"],
            collab_code=r["collab_id"],
            creator=creator.name if creator else "",
            old_poc=(collab.poc_code or "").strip() if collab else "",
            new_poc=r["poc"],
            collab=collab,
        )

        def done(status: str, message: str = "") -> None:
            results.append(RowResult(status=status, message=message, **base))

        if not r["poc"]:
            done("left-blank", "No POC code on the sheet; card left as it is.")
        elif not r["collab_id"] or card is None:
            done("error", "Collab ID not found.")
        elif key in seen_cards:
            done("error", "This Collab ID appears more than once on the sheet.")
        elif not _blank(collab.poc_code):
            seen_cards.add(key)
            done("skipped", "Card already has a POC code; it is never overwritten.")
        elif len(r["poc"]) > MAX_POC_LENGTH:
            done("error", f"POC code is longer than {MAX_POC_LENGTH} characters.")
        elif code_counts[r["poc"].lower()] > 1:
            done("error", f"The code '{r['poc']}' appears {code_counts[r['poc'].lower()]} times on the sheet; each video needs its own.")
        elif r["poc"].lower() in used:
            done("error", f"The code '{r['poc']}' is already used on card {used[r['poc'].lower()]}.")
        elif r["link"] and not _blank(collab.video_link) and _norm_link(r["link"]) != _norm_link(collab.video_link):
            done("error", "The video link on the sheet does not match the link saved on this card.")
        else:
            seen_cards.add(key)
            done("update")
    return results


def _log_rows(results: list[RowResult], applied: bool) -> list[list[str]]:
    labels = {"update": "UPDATED" if applied else "WOULD UPDATE", "left-blank": "LEFT BLANK", "skipped": "SKIPPED", "error": "ERROR"}
    return [[r.collab_code, r.creator, r.old_poc, r.new_poc, labels[r.status], r.message] for r in results]


async def _main(args: argparse.Namespace) -> int:
    async with AsyncSessionLocal() as db:
        if args.command == "export":
            rows = await export_rows(db)
            sys.stdout.buffer.write(_csv_bytes(EXPORT_COLUMNS, rows))
            print(f"Exported {len(rows)} Live video(s) that have no POC code.", file=sys.stderr)
            return 0

        try:
            sheet = parse_sheet(sys.stdin.buffer.read().decode("utf-8-sig"))
        except ValueError as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 1
        results = await plan_updates(db, sheet)
        counts = Counter(r.status for r in results)
        errors = counts["error"]

        saved = False
        if args.apply:
            if errors and not args.skip_errors:
                print(f"NOTHING SAVED: {errors} row(s) have problems. Fix them, or add --skip-errors to save only the good rows.", file=sys.stderr)
            else:
                for r in results:
                    if r.status == "update" and r.collab is not None:
                        r.collab.poc_code = r.new_poc  # deliberately not touching last_activity_at
                await db.commit()
                saved = True
        else:
            await db.rollback()

        sys.stdout.buffer.write(_csv_bytes(LOG_COLUMNS, _log_rows(results, saved)))
        verb = "UPDATED" if saved else "would update"
        print(
            f"{'APPLIED' if saved else 'PREVIEW (nothing saved)'}: {counts['update']} {verb}, {counts['skipped']} skipped (already had a code), "
            f"{counts['left-blank']} left blank, {errors} with problems.",
            file=sys.stderr,
        )
        if args.apply and not saved:
            return 2
        return 0


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("export", help="CSV of Live videos with no POC code")
    apply_parser = sub.add_parser("apply", help="fill POC codes from the sheet on stdin (preview unless --apply)")
    apply_parser.add_argument("--apply", action="store_true", help="really save (default is a preview that changes nothing)")
    apply_parser.add_argument("--skip-errors", action="store_true", help="with --apply, save the good rows even if some rows have problems")
    raise SystemExit(asyncio.run(_main(parser.parse_args())))
