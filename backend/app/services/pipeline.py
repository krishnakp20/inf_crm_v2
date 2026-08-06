from app.db.models.enums import CreatorStage

STAGE_ORDER: list[CreatorStage] = [
    CreatorStage.new_lead,
    CreatorStage.outreach_sent,
    CreatorStage.replied,
    CreatorStage.negotiating,
    CreatorStage.commercial_locked,
    CreatorStage.product_sent,
    CreatorStage.content_review,
    CreatorStage.live,
    CreatorStage.payment_pending,
    CreatorStage.paid,
]

STAGE_INDEX = {stage: i for i, stage in enumerate(STAGE_ORDER)}

STAGE_LABELS: dict[CreatorStage, str] = {
    CreatorStage.new_lead: "New leads",
    CreatorStage.outreach_sent: "Outreach sent",
    CreatorStage.replied: "Replied",
    CreatorStage.negotiating: "Negotiation",
    CreatorStage.commercial_locked: "Commercial locked",
    CreatorStage.product_sent: "Product sent",
    CreatorStage.content_review: "Content workflow",
    CreatorStage.live: "Approved / Live",
    CreatorStage.payment_pending: "Payment",
    CreatorStage.paid: "Paid",
}

# Settings' "Stage deadlines" panel configures aging thresholds for these 5
# early lead stages (verified live: Outreach sent, Replied, Negotiating,
# Locked, Product sent). Content live onward has no deadline -- it's the
# terminal/completed state for lead aging purposes.
CONFIGURABLE_DEADLINE_STAGES: list[CreatorStage] = [
    CreatorStage.outreach_sent,
    CreatorStage.replied,
    CreatorStage.negotiating,
    CreatorStage.commercial_locked,
    CreatorStage.product_sent,
]

DEADLINE_STAGE_LABELS: dict[CreatorStage, str] = {
    CreatorStage.outreach_sent: "Outreach sent",
    CreatorStage.replied: "Replied",
    CreatorStage.negotiating: "Negotiating",
    CreatorStage.commercial_locked: "Locked",
    CreatorStage.product_sent: "Product sent",
}
