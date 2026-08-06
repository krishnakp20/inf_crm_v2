import asyncio

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db.models.enums import UserRole
from app.db.models.user import User
from app.db.session import AsyncSessionLocal


async def bootstrap_admin() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(User).where(User.email == settings.seed_admin_email))
        if existing.scalar_one_or_none() is not None:
            print("Admin already exists, skipping.")
            return

        admin = User(
            name=settings.seed_admin_name,
            email=settings.seed_admin_email,
            password_hash=hash_password(settings.seed_admin_password),
            role=UserRole.admin,
        )
        db.add(admin)
        await db.commit()
        print(f"Created admin account: {settings.seed_admin_email}")


if __name__ == "__main__":
    asyncio.run(bootstrap_admin())
