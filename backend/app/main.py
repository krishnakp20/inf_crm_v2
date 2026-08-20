from contextlib import asynccontextmanager

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.services.dead_zone import run_dead_zone_sweep

# Single uvicorn process, no --workers/replicas (confirmed in both
# docker-compose.yml and docker-compose.prod.yml), so an in-process
# scheduler is safe from double-run risk.
scheduler = AsyncIOScheduler(timezone="Asia/Kolkata")


@asynccontextmanager
async def lifespan(app: FastAPI):
    scheduler.add_job(
        run_dead_zone_sweep,
        CronTrigger(hour=2, minute=0, timezone="Asia/Kolkata"),
        id="dead_zone_sweep",
        replace_existing=True,
    )
    scheduler.start()
    yield
    scheduler.shutdown(wait=False)


app = FastAPI(title="Sotrue Influencer CRM API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
