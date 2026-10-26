"""
EcoWatch AI — Admin bootstrap CLI.

Usage (from backend/ directory):
  python create_admin.py --name "Admin" --email admin@example.com --password "s3cr3t!"

This script creates or promotes a user to the admin role.
It is NOT exposed as an API endpoint.
"""

from __future__ import annotations

import argparse
import asyncio
import sys


async def _run(name: str, email: str, password: str) -> None:
    from app.db.base import Base
    from app.db.session import AsyncSessionLocal, engine
    import app.models  # noqa — register models

    # Ensure tables exist (idempotent)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        from app.services.auth_service import create_admin_user

        admin = await create_admin_user(db, name=name, email=email, password=password)
        print(f"✓ Admin user ready: id={admin.id}  email={admin.email}  role={admin.role}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or promote an EcoWatch AI admin user.")
    parser.add_argument("--name", required=True, help="Display name")
    parser.add_argument("--email", required=True, help="Email address (login identifier)")
    parser.add_argument("--password", required=True, help="Password (min 8 characters)")

    args = parser.parse_args()

    if len(args.password) < 8:
        print("Error: password must be at least 8 characters.", file=sys.stderr)
        sys.exit(1)

    asyncio.run(_run(args.name, args.email, args.password))


if __name__ == "__main__":
    main()
