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
