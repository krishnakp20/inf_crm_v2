from fastapi import APIRouter

from app.api.v1.routes import (
    announcements,
    approval_requests,
    auth,
    collaborations,
    creators,
    dashboard,
    follow_ups,
    product_targets,
    products,
    settings,
    users,
)

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(creators.router)
api_router.include_router(dashboard.router)
api_router.include_router(follow_ups.router)
api_router.include_router(announcements.router)
api_router.include_router(products.router)
api_router.include_router(product_targets.router)
api_router.include_router(collaborations.router)
api_router.include_router(settings.router)
api_router.include_router(approval_requests.router)
