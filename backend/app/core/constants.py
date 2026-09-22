"""Small cross-cutting constants that don't fit config.py (not env-driven)
or any single model/route file."""

# The fixed, seeded "Unassigned" system account (see the migration that
# creates it) that a deactivated user's leads get reassigned to when an
# admin picks "Revoke ownership" instead of archiving or reassigning to a
# specific advisor -- any active user can then claim one for themselves
# (POST /creators/{id}/claim). is_active=False on this account already
# keeps it out of every "active advisor" picker across the app and blocks
# it from ever logging in (see routes/auth.py's is_active check).
UNASSIGNED_OWNER_EMAIL = "unassigned@system.internal"
