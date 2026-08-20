import asyncio
import random
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.models.announcement import Announcement
from app.db.models.approval_request import ApprovalRequest
from app.db.models.collab_stage_event import CollabStageEvent
from app.db.models.collaboration import Collaboration
from app.db.models.collaboration_product import CollaborationProduct
from app.db.models.creator import Creator
from app.db.models.enums import (
    ApprovalPriority,
    CollabStage,
    CreatorStage,
    CreatorStatus,
    FollowUpStatus,
    PaymentStatus,
    Priority,
    UserRole,
)
from app.db.models.follow_up import FollowUp
from app.db.models.ownership_event import OwnershipEvent
from app.db.models.product import Product
from app.db.models.stage_deadline_rule import StageDeadlineRule
from app.db.models.stage_event import StageEvent
from app.db.models.user import User
from app.db.session import AsyncSessionLocal
from app.services.collab_pipeline import COLLAB_STAGE_ORDER
from app.services.pipeline import STAGE_INDEX, STAGE_ORDER

# Matches the reference site's Settings > Stage deadlines defaults exactly.
DEFAULT_STAGE_DEADLINES = [
    (CreatorStage.outreach_sent, 2),
    (CreatorStage.replied, 2),
    (CreatorStage.negotiating, 3),
    (CreatorStage.commercial_locked, 2),
    (CreatorStage.product_sent, 4),
]

rng = random.Random(42)

CATEGORIES = [
    "Beauty", "Makeup", "Skincare", "Lifestyle", "Fashion",
    "Mom Creator", "Professional / Expert", "UGC Creator",
]

ADVISORS = ["Muskan", "Yash", "Rahul", "Nikita"]

# name, owner (advisor index), target_videos
PRODUCTS_DATA = [
    ("Strobe Cream", 0, 8),
    ("Skin Tint", 0, 6),
    ("Daily Strobe SPF 50", 1, 10),
    ("Dark Spell Kajal", 2, 8),
    ("Blurify Primer", 3, 10),
    ("Face Gel Sunscreen SPF 50", 1, 8),
    ("Cooling Body Gel SPF 50", 2, 6),
    ("Body Glow Spray", 3, 8),
]

NAMED_CREATORS = [
    # name, handle, category, stage, owner (advisor index), followers
    ("Ayesha Sharma", "ayeshaglow", "Beauty", CreatorStage.negotiating, 0, 184_000),
    ("Riya Kapoor", "riyakapoor", "Lifestyle", CreatorStage.product_sent, 0, 92_000),
    ("Priya Singh", "priyasinghmakeup", "Makeup", CreatorStage.content_review, 0, 311_000),
    ("Neha Mehta", "nehamehta", "Makeup", CreatorStage.content_review, 0, 58_000),
    ("Kritika Taneja", "kritikatalks", "Beauty", CreatorStage.payment_pending, 0, 120_000),
    ("Tanya Arora", "tanyaarora", "Beauty", CreatorStage.new_lead, 0, 88_000),
    ("Mehak Jain", "mehakjain", "Lifestyle", CreatorStage.new_lead, 0, 42_000),
    ("Aarushi Verma", "aarushiverma", "Makeup", CreatorStage.replied, 0, 216_000),
    ("Ishita Roy", "ishitaroy", "Skincare", CreatorStage.replied, 0, 73_000),
    ("Pooja Sethi", "poojasethi", "Beauty", CreatorStage.negotiating, 0, 65_000),
    ("Naina Gupta", "nainagupta", "Beauty", CreatorStage.product_sent, 0, 51_000),
    ("Kavya Shah", "kavyashah", "Lifestyle", CreatorStage.product_sent, 0, 39_000),
    ("Simran Rao", "simranreviews", "Beauty", CreatorStage.live, 0, 98_000),
]


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing_admin = await db.execute(select(User).where(User.email == settings.seed_admin_email))
        if existing_admin.scalar_one_or_none() is not None:
            print("Seed data already present, skipping.")
            return

        admin = User(
            name=settings.seed_admin_name,
            email=settings.seed_admin_email,
            password_hash=hash_password(settings.seed_admin_password),
            role=UserRole.admin,
        )
        db.add(admin)

        advisors: list[User] = []
        for name in ADVISORS:
            advisor = User(
                name=name,
                email=f"{name.lower()}@sotrue.com",
                password_hash=hash_password("advisor123"),
                role=UserRole.advisor,
            )
            db.add(advisor)
            advisors.append(advisor)

        supervisor = User(
            name="Kabir",
            email="kabir@sotrue.com",
            password_hash=hash_password("supervisor123"),
            role=UserRole.supervisor,
        )
        marketer = User(
            name="Ananya",
            email="ananya@sotrue.com",
            password_hash=hash_password("marketer123"),
            role=UserRole.marketer,
        )
        editor = User(
            name="Devansh",
            email="devansh@sotrue.com",
            password_hash=hash_password("editor123"),
            role=UserRole.editor,
        )
        db.add_all([supervisor, marketer, editor])

        await db.flush()

        # Give the demo Supervisor a team of 2 out of the 4 demo advisors, so
        # "Team" scoping has something real to show; the other 2 stay unassigned.
        for advisor in advisors[:2]:
            advisor.supervisor_id = supervisor.id

        now = datetime.now(timezone.utc)

        db.add(
            Announcement(
                title="Priority for this week",
                body="Close all overdue follow-ups and review drafts planned to go live by Friday.",
                posted_by=admin.id,
                audience="everyone",
                pinned=True,
                created_at=now,
            )
        )

        for stage, max_days in DEFAULT_STAGE_DEADLINES:
            db.add(StageDeadlineRule(stage=stage, max_days=max_days))

        creators: list[Creator] = []

        for name, handle, category, stage, advisor_idx, followers in NAMED_CREATORS:
            creator = Creator(
                name=name,
                instagram_handle=handle,
                phone=f"+91 9{rng.randint(1000000, 9999999)}",
                email=f"{handle}@creatormail.com",
                instagram_link=f"https://instagram.com/{handle}",
                category=category,
                followers_count=followers,
                owner_id=advisors[advisor_idx].id,
                current_stage=stage,
                status=CreatorStatus.active,
                created_at=now - timedelta(days=rng.randint(5, 90)),
                last_activity_at=now - timedelta(hours=rng.randint(1, 72)),
            )
            db.add(creator)
            creators.append(creator)

        first_names = [
            "Anaya", "Diya", "Meera", "Sara", "Kiara", "Anvi", "Myra", "Aadhya", "Reet", "Zara",
            "Vidhi", "Nitya", "Aria", "Amaira", "Riddhi", "Saanvi", "Ira", "Navya", "Prisha", "Jiya",
        ]
        last_names = [
            "Chopra", "Malhotra", "Bhatia", "Kapoor", "Nair", "Iyer", "Reddy", "Menon", "Bajaj", "Khanna",
        ]
        for i in range(60):
            stage = rng.choices(
                STAGE_ORDER,
                weights=[14, 12, 10, 8, 6, 6, 5, 5, 4, 3],
            )[0]
            first = rng.choice(first_names)
            last = rng.choice(last_names)
            name = f"{first} {last}"
            handle = f"{first.lower()}{last.lower()}{i}"
            creator = Creator(
                name=name,
                instagram_handle=handle,
                phone=f"+91 8{rng.randint(1000000, 9999999)}",
                category=rng.choice(CATEGORIES),
                followers_count=rng.randint(8_000, 350_000),
                owner_id=rng.choice(advisors).id,
                current_stage=stage,
                status=CreatorStatus.active,
                created_at=now - timedelta(days=rng.randint(1, 120)),
                last_activity_at=now - timedelta(hours=rng.randint(1, 240)),
            )
            db.add(creator)
            creators.append(creator)

        await db.flush()

        for i, creator in enumerate(creators):
            if i < 3 and len(advisors) > 1:
                # A couple of named creators get a realistic ownership transfer
                # in their history, matching the "Previous user" pattern shown
                # in the reference's Commercial history > Ownership history tab.
                previous_advisor = advisors[(advisors.index(next(a for a in advisors if a.id == creator.owner_id)) + 1) % len(advisors)]
                db.add(
                    OwnershipEvent(
                        creator_id=creator.id,
                        user_id=previous_advisor.id,
                        created_at=creator.created_at,
                    )
                )
                transfer_at = min(creator.created_at + timedelta(days=rng.randint(3, 15)), now - timedelta(hours=1))
                db.add(
                    OwnershipEvent(
                        creator_id=creator.id,
                        user_id=creator.owner_id,
                        created_at=transfer_at,
                    )
                )
            else:
                db.add(
                    OwnershipEvent(
                        creator_id=creator.id,
                        user_id=creator.owner_id,
                        created_at=creator.created_at,
                    )
                )

        for creator in creators:
            target_index = STAGE_INDEX[creator.current_stage]
            from_stage = STAGE_ORDER[target_index - 1] if target_index > 0 else None
            db.add(
                StageEvent(
                    creator_id=creator.id,
                    from_stage=from_stage,
                    to_stage=creator.current_stage,
                    actor_id=creator.owner_id,
                    created_at=creator.last_activity_at,
                )
            )
            if target_index >= STAGE_INDEX[CreatorStage.commercial_locked]:
                db.add(
                    StageEvent(
                        creator_id=creator.id,
                        from_stage=STAGE_ORDER[max(target_index - 2, 0)],
                        to_stage=CreatorStage.commercial_locked,
                        actor_id=creator.owner_id,
                        created_at=creator.created_at + timedelta(days=rng.randint(2, 10)),
                    )
                )

        early_stage_indices = {
            STAGE_INDEX[s]
            for s in (
                CreatorStage.new_lead,
                CreatorStage.outreach_sent,
                CreatorStage.replied,
                CreatorStage.negotiating,
                CreatorStage.product_sent,
            )
        }
        for creator in creators:
            if STAGE_INDEX[creator.current_stage] in early_stage_indices:
                due_offset = rng.choice([-2, -1, 0, 1, 2, 3])
                due_at = now + timedelta(days=due_offset, hours=rng.randint(0, 12))
                db.add(
                    FollowUp(
                        creator_id=creator.id,
                        assigned_to=creator.owner_id,
                        type="Follow up on next steps",
                        due_at=due_at,
                        priority=rng.choice(list(Priority)),
                        status=FollowUpStatus.open,
                    )
                )

        products: list[Product] = []
        for name, advisor_idx, target_videos in PRODUCTS_DATA:
            product = Product(name=name, owner_id=advisors[advisor_idx].id, target_videos=target_videos)
            db.add(product)
            products.append(product)
        await db.flush()

        collab_seed_creators = rng.sample(creators, min(30, len(creators)))
        collab_counter = 0
        all_collabs: list[Collaboration] = []
        for creator in collab_seed_creators:
            num_collabs = rng.choices([1, 2, 3], weights=[6, 3, 1])[0]
            for _ in range(num_collabs):
                collab_counter += 1
                collab_stage = rng.choices(
                    COLLAB_STAGE_ORDER,
                    weights=[16, 14, 12, 10, 9, 8, 7, 6, 13, 5],
                )[0]
                stage_idx = COLLAB_STAGE_ORDER.index(collab_stage)
                locked_idx = COLLAB_STAGE_ORDER.index(CollabStage.commercial_locked)
                negotiating_idx = COLLAB_STAGE_ORDER.index(CollabStage.negotiating)
                replied_idx = COLLAB_STAGE_ORDER.index(CollabStage.replied)

                primary_product = rng.choice(products)
                additional_product = None
                if rng.random() < 0.2:
                    remaining = [p for p in products if p.id != primary_product.id]
                    additional_product = rng.choice(remaining) if remaining else None

                created_at = creator.created_at + timedelta(days=rng.randint(0, 20))
                last_activity_at = now - timedelta(hours=rng.randint(1, 200))

                commercial_quoted = rng.randint(8_000, 22_000) if stage_idx >= negotiating_idx else None
                commercial_amount = (
                    rng.randint(6_000, commercial_quoted or 20_000) if stage_idx >= locked_idx else None
                )
                first_draft_idx = COLLAB_STAGE_ORDER.index(CollabStage.first_draft)
                live_idx = COLLAB_STAGE_ORDER.index(CollabStage.live)
                if stage_idx >= live_idx and rng.random() < 0.7:
                    payment_status = PaymentStatus.payment_done
                elif stage_idx >= first_draft_idx and rng.random() < 0.4:
                    payment_status = PaymentStatus.partial_payment
                else:
                    payment_status = PaymentStatus.pending

                collab = Collaboration(
                    collab_code=f"CLB-{now.year}-{collab_counter:04d}",
                    creator_id=creator.id,
                    owner_id=creator.owner_id,
                    stage=collab_stage,
                    priority=rng.choice(
                        [CreatorStatus.priority, CreatorStatus.active, CreatorStatus.active, CreatorStatus.none]
                    ),
                    payment_status=payment_status,
                    creator_reply="Interested, asked for more details." if stage_idx >= replied_idx else None,
                    commercial_quoted=commercial_quoted,
                    counter_quote_agent=(commercial_quoted - 2_000) if stage_idx >= negotiating_idx and rng.random() < 0.5 else None,
                    counter_quote_creator=(commercial_quoted + 1_000) if stage_idx >= negotiating_idx and rng.random() < 0.3 else None,
                    commercial_amount=commercial_amount,
                    tracking_link=(
                        f"https://track.example.com/{collab_counter}"
                        if stage_idx >= COLLAB_STAGE_ORDER.index(CollabStage.product_sent) and rng.random() < 0.6
                        else None
                    ),
                    order_id=(
                        f"ORD-{rng.randint(100000, 999999)}"
                        if stage_idx >= COLLAB_STAGE_ORDER.index(CollabStage.product_sent) and rng.random() < 0.6
                        else None
                    ),
                    views_count=rng.randint(80_000, 550_000) if collab_stage == CollabStage.live else None,
                    comments_count=rng.randint(300, 2_200) if collab_stage == CollabStage.live else None,
                    created_at=created_at,
                    last_activity_at=last_activity_at,
                )
                db.add(collab)
                await db.flush()

                is_live = collab_stage == CollabStage.live
                split_live_credit = is_live and additional_product is not None and rng.random() < 0.5
                db.add(
                    CollaborationProduct(
                        collaboration_id=collab.id,
                        product_id=primary_product.id,
                        is_primary=True,
                        is_live_attributed=is_live,
                    )
                )
                if additional_product is not None:
                    db.add(
                        CollaborationProduct(
                            collaboration_id=collab.id,
                            product_id=additional_product.id,
                            is_primary=False,
                            is_live_attributed=split_live_credit,
                        )
                    )

                db.add(
                    CollabStageEvent(
                        collaboration_id=collab.id,
                        from_stage=None,
                        to_stage=collab_stage,
                        actor_id=collab.owner_id,
                        created_at=last_activity_at,
                    )
                )
                all_collabs.append(collab)

        approval_notes = [
            "Creator quoted a higher commercial, please approve before I lock it.",
            "Requesting approval for the revised commercial and a usage-right extension.",
            "The creator has changed the opening hook. Please approve the draft direction.",
            "Final reel is live. Please approve the remaining payment release.",
        ]
        approval_seed_collabs = rng.sample(all_collabs, min(4, len(all_collabs)))
        for i, collab in enumerate(approval_seed_collabs):
            db.add(
                ApprovalRequest(
                    request_code=f"APR-{now.year}-{i + 1:04d}",
                    collaboration_id=collab.id,
                    requested_by=collab.owner_id,
                    priority=rng.choice([ApprovalPriority.high, ApprovalPriority.normal]),
                    note=approval_notes[i % len(approval_notes)],
                    created_at=now - timedelta(hours=rng.randint(1, 48)),
                )
            )

        await db.commit()
        print(
            f"Seeded: 1 admin, {len(advisors)} advisors, 1 supervisor, 1 marketer, 1 editor, "
            f"{len(creators)} creators, {len(products)} products, {collab_counter} collaborations, "
            f"{len(approval_seed_collabs)} approval requests."
        )


if __name__ == "__main__":
    asyncio.run(seed())
