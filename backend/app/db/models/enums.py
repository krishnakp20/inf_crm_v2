import enum


class UserRole(str, enum.Enum):
    admin = "admin"
    advisor = "advisor"


class CreatorStage(str, enum.Enum):
    new_lead = "new_lead"
    outreach_sent = "outreach_sent"
    replied = "replied"
    negotiating = "negotiating"
    commercial_locked = "commercial_locked"
    product_sent = "product_sent"
    content_review = "content_review"
    live = "live"
    payment_pending = "payment_pending"
    paid = "paid"


class CreatorStatus(str, enum.Enum):
    priority = "priority"
    active = "active"
    review_due = "review_due"
    overdue = "overdue"
    ndr = "ndr"
    partnership = "partnership"
    none = "none"


class Priority(str, enum.Enum):
    high = "high"
    medium = "medium"
    low = "low"


class FollowUpStatus(str, enum.Enum):
    open = "open"
    done = "done"
    overdue = "overdue"


class MessageChannel(str, enum.Enum):
    call = "call"
    whatsapp = "whatsapp"
    email = "email"
    instagram_dm = "instagram_dm"
    note = "note"


class CollabStage(str, enum.Enum):
    new_lead = "new_lead"
    replied = "replied"
    negotiating = "negotiating"
    commercial_locked = "commercial_locked"
    product_sent = "product_sent"
    product_delivered = "product_delivered"
    first_draft = "first_draft"
    approved = "approved"
    live = "live"
    dead_leads = "dead_leads"


class ApprovalPriority(str, enum.Enum):
    high = "high"
    normal = "normal"


class ApprovalStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class PaymentStatus(str, enum.Enum):
    pending = "pending"
    partial_payment = "partial_payment"
    payment_done = "payment_done"
