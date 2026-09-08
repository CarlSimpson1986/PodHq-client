-- Deactivates the leftover internal test SKU "Stripe Connect Live Test"
-- (£1.00) from Hove's real live /buy-credits catalog (2026-09-08 journey
-- review finding) -- a real customer can currently see and buy this on
-- production. Left over from the Stripe Connect pilot sandbox era
-- (Stage 29/58) and never deactivated once the pilot went live.
--
-- Soft-disable (enabled = false), not a delete: this item is tied to a
-- real historical purchase (Carl's own £1 test transaction, later
-- refunded during the 2026-09-05 wargaming session) via catalog_item_id
-- on a credits row -- deleting the catalog_items row would orphan that
-- reference. Setting enabled = false is what getCreditPackages() already
-- filters on (src/lib/data/catalog.ts), so this alone removes it from
-- the customer-facing page without touching history. Reversible: flip
-- back to true if this was ever needed again.

-- Run this first to confirm you're targeting the right row:
select id, item_id, gym, type, name, label, price_gbp, enabled
from catalog_items
where gym = 'Hove' and name = 'Stripe Connect Live Test';

-- Then run this:
update catalog_items
set enabled = false, updated_at = now()
where gym = 'Hove' and name = 'Stripe Connect Live Test';
