-- One-off cleanup: remove the five dummy/demo accounts and everything they own.
--   muskan@sotrue.com, yash@sotrue.com, rahul@sotrue.com, nikita@sotrue.com,
--   verma.yash@alphanso.co
--
-- PREVIEW (changes nothing -- runs everything, prints the before/after numbers, rolls back):
--   docker compose -f docker-compose.prod.yml --env-file backend/.env.production exec -T postgres \
--     psql -U infcrm -d infcrm_v2 < deploy/remove_dummy_accounts.sql
--
-- APPLY (commits). Take a pg_dump backup first -- a commit cannot be undone:
--   docker compose -f docker-compose.prod.yml --env-file backend/.env.production exec -T postgres \
--     psql -U infcrm -d infcrm_v2 -v apply=1 < deploy/remove_dummy_accounts.sql
--
-- What it does, in one transaction (any error rolls everything back):
--   1. Products owned by these accounts -> owner becomes the admin (Product.owner_id is only
--      a required "who created the row" label; the products themselves stay, real cards use them).
--   2. A creator owned by a dummy account but with a card owned by a real user is kept and moved
--      to that real user (so no real card is lost).
--   3. Deletes the dummy accounts' cards (with Hub tickets, remarks, approvals, stage events,
--      product links) and creators (with files, follow-ups, messages, ownership/stage history).
--   4. History rows by these accounts that remain on real data (stage/ownership events, approvals,
--      remarks...) are re-attributed to the admin; their targets/campaign slots are deleted.
--   5. Deletes the accounts. Safe to run again: with no dummy accounts left it does nothing.

\set ON_ERROR_STOP on
BEGIN;

CREATE TEMP TABLE _dummy_users ON COMMIT DROP AS
SELECT id FROM users
WHERE lower(email) IN ('muskan@sotrue.com', 'yash@sotrue.com', 'rahul@sotrue.com',
                       'nikita@sotrue.com', 'verma.yash@alphanso.co');

CREATE TEMP TABLE _before ON COMMIT DROP AS
SELECT (SELECT count(*) FROM users) AS users,
       (SELECT count(*) FROM creators) AS creators,
       (SELECT count(*) FROM collaborations) AS collaborations,
       (SELECT count(*) FROM collaborations WHERE stage = 'live') AS live_cards,
       (SELECT count(*) FROM partnership_tickets) AS hub_tickets,
       (SELECT count(*) FROM products) AS products;

DO $$
DECLARE
    admin_id int;
BEGIN
    IF EXISTS (SELECT 1 FROM users WHERE id IN (SELECT id FROM _dummy_users) AND is_active) THEN
        RAISE EXCEPTION 'A dummy account is still active -- refusing to delete it. Aborting.';
    END IF;
    SELECT id INTO admin_id FROM users WHERE lower(email) = 'admin@sotrue.com' AND is_active;
    IF admin_id IS NULL AND EXISTS (SELECT 1 FROM _dummy_users) THEN
        RAISE EXCEPTION 'Active admin@sotrue.com not found -- cannot reassign products. Aborting.';
    END IF;
    RAISE NOTICE 'Dummy accounts found: %', (SELECT count(*) FROM _dummy_users);
END $$;

CREATE TEMP TABLE _admin ON COMMIT DROP AS
SELECT id FROM users WHERE lower(email) = 'admin@sotrue.com' AND is_active;

-- 1. products stay; only the hidden owner label moves to the admin
UPDATE products SET owner_id = (SELECT id FROM _admin)
WHERE owner_id IN (SELECT id FROM _dummy_users);

-- 2. keep any dummy-owned creator that has a card owned by a real user; hand it to that card's owner
UPDATE creators cr
SET owner_id = x.new_owner
FROM (
    SELECT DISTINCT ON (c.creator_id) c.creator_id, c.owner_id AS new_owner
    FROM collaborations c
    JOIN creators cr2 ON cr2.id = c.creator_id
    WHERE cr2.owner_id IN (SELECT id FROM _dummy_users)
      AND c.owner_id NOT IN (SELECT id FROM _dummy_users)
    ORDER BY c.creator_id, c.last_activity_at DESC
) x
WHERE cr.id = x.creator_id;

-- 3. what gets deleted
CREATE TEMP TABLE _del_collabs ON COMMIT DROP AS
SELECT id FROM collaborations WHERE owner_id IN (SELECT id FROM _dummy_users);

CREATE TEMP TABLE _del_creators ON COMMIT DROP AS
SELECT id FROM creators WHERE owner_id IN (SELECT id FROM _dummy_users);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM collaborations
               WHERE creator_id IN (SELECT id FROM _del_creators)
                 AND id NOT IN (SELECT id FROM _del_collabs)) THEN
        RAISE EXCEPTION 'A creator being deleted still has a real card. Aborting.';
    END IF;
END $$;

DELETE FROM partnership_remarks WHERE ticket_id IN
    (SELECT id FROM partnership_tickets WHERE collaboration_id IN (SELECT id FROM _del_collabs));
DELETE FROM partnership_tickets WHERE collaboration_id IN (SELECT id FROM _del_collabs);
DELETE FROM approval_requests WHERE collaboration_id IN (SELECT id FROM _del_collabs);
DELETE FROM collab_stage_events WHERE collaboration_id IN (SELECT id FROM _del_collabs);
DELETE FROM collaboration_products WHERE collaboration_id IN (SELECT id FROM _del_collabs);
DELETE FROM collaboration_video_links WHERE collaboration_id IN (SELECT id FROM _del_collabs);
DELETE FROM collaborations WHERE id IN (SELECT id FROM _del_collabs);

DELETE FROM creator_files WHERE creator_id IN (SELECT id FROM _del_creators);
DELETE FROM follow_ups WHERE creator_id IN (SELECT id FROM _del_creators);
DELETE FROM messages WHERE creator_id IN (SELECT id FROM _del_creators);
DELETE FROM ownership_events WHERE creator_id IN (SELECT id FROM _del_creators);
DELETE FROM stage_events WHERE creator_id IN (SELECT id FROM _del_creators);
DELETE FROM creators WHERE id IN (SELECT id FROM _del_creators);

-- 4. history by these accounts that remains on real data: keep it, attribute it to the admin
UPDATE collab_stage_events SET actor_id = (SELECT id FROM _admin) WHERE actor_id IN (SELECT id FROM _dummy_users);
UPDATE stage_events SET actor_id = (SELECT id FROM _admin) WHERE actor_id IN (SELECT id FROM _dummy_users);
UPDATE ownership_events SET actor_id = (SELECT id FROM _admin) WHERE actor_id IN (SELECT id FROM _dummy_users);
UPDATE ownership_events SET user_id = (SELECT id FROM _admin) WHERE user_id IN (SELECT id FROM _dummy_users);
UPDATE approval_requests SET requested_by = (SELECT id FROM _admin) WHERE requested_by IN (SELECT id FROM _dummy_users);
UPDATE approval_requests SET resolved_by = (SELECT id FROM _admin) WHERE resolved_by IN (SELECT id FROM _dummy_users);
UPDATE partnership_remarks SET author_id = (SELECT id FROM _admin) WHERE author_id IN (SELECT id FROM _dummy_users);
UPDATE creator_files SET uploaded_by = (SELECT id FROM _admin) WHERE uploaded_by IN (SELECT id FROM _dummy_users);
UPDATE follow_ups SET assigned_to = (SELECT id FROM _admin) WHERE assigned_to IN (SELECT id FROM _dummy_users);
UPDATE messages SET author_id = (SELECT id FROM _admin) WHERE author_id IN (SELECT id FROM _dummy_users);
UPDATE metric_imports SET uploaded_by = (SELECT id FROM _admin) WHERE uploaded_by IN (SELECT id FROM _dummy_users);
UPDATE announcements SET posted_by = (SELECT id FROM _admin) WHERE posted_by IN (SELECT id FROM _dummy_users);
UPDATE campaigns SET created_by = (SELECT id FROM _admin) WHERE created_by IN (SELECT id FROM _dummy_users);
DELETE FROM campaign_participants WHERE user_id IN (SELECT id FROM _dummy_users);
DELETE FROM product_targets WHERE user_id IN (SELECT id FROM _dummy_users);
UPDATE users SET supervisor_id = NULL WHERE supervisor_id IN (SELECT id FROM _dummy_users);

-- 5. the accounts themselves (fails -- and rolls everything back -- if anything still points at them)
DELETE FROM users WHERE id IN (SELECT id FROM _dummy_users);

-- Before / after
SELECT 'BEFORE' AS state, * FROM _before
UNION ALL
SELECT 'AFTER',
       (SELECT count(*) FROM users),
       (SELECT count(*) FROM creators),
       (SELECT count(*) FROM collaborations),
       (SELECT count(*) FROM collaborations WHERE stage = 'live'),
       (SELECT count(*) FROM partnership_tickets),
       (SELECT count(*) FROM products);

\if :{?apply}
    \echo '>>> APPLY: committing.'
    COMMIT;
\else
    \echo '>>> PREVIEW ONLY: rolled back, nothing was changed. Re-run with -v apply=1 to commit.'
    ROLLBACK;
\endif
