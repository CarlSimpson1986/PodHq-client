-- Read-only (2026-09-08) — member 123 (the old seeded dev/demo test
-- member) no longer exists in `members` (FK violation confirmed trying to
-- seed decline-test data against it) — find whichever member id is now
-- the real local dev test account.

select id, name, gym, auth_user_id
from members
where name ilike '%carl%' or name ilike '%test%'
order by id;
