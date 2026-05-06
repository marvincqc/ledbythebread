-- ============================================================
-- 002_seed_data.sql
-- Seed data: categories, admin_settings, sample SKUs
-- ============================================================

-- ---- CATEGORIES ----
INSERT INTO categories (id, name, sort_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Classic',    1),
  ('a1000000-0000-0000-0000-000000000002', 'Whole Wheat', 2),
  ('a1000000-0000-0000-0000-000000000003', 'Cheese',     3)
ON CONFLICT DO NOTHING;

-- ---- ADMIN SETTINGS ----
INSERT INTO admin_settings (key, value) VALUES
  ('min_order_amount', '150'),
  ('max_weeks_out',    '2')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ---- SAMPLE SKUS ----
INSERT INTO skus (id, name, description, price, category_id, is_active) VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'Classic Pandesal',
    'Soft and fluffy classic Filipino bread roll dusted with breadcrumbs. Best enjoyed warm.',
    12.00,
    'a1000000-0000-0000-0000-000000000001',
    true
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'Whole Wheat Pandesal',
    'Nutritious whole wheat version with a slightly nutty flavor. A healthier choice without sacrificing taste.',
    15.00,
    'a1000000-0000-0000-0000-000000000002',
    true
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'Cheese Pandesal',
    'Our classic pandesal filled with creamy melted cheese. A crowd favorite for all ages.',
    20.00,
    'a1000000-0000-0000-0000-000000000003',
    true
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'Classic Dozen Bundle',
    'Get 12 classic pandesal at a special bundled price. Perfect for the whole family.',
    130.00,
    'a1000000-0000-0000-0000-000000000001',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Update the bundle to set is_bundle and bundle_components
UPDATE skus
SET
  is_bundle = true,
  bundle_components = '[{"sku_id": "b1000000-0000-0000-0000-000000000001", "quantity": 12}]'::jsonb
WHERE id = 'b1000000-0000-0000-0000-000000000004';

-- ---- SAMPLE DELIVERY SLOTS (next 14 days) ----
-- This generates slots for today through the next 14 days
-- In production the app or a cron job would keep these rolling
DO $$
DECLARE
  d date;
BEGIN
  FOR d IN
    SELECT generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', INTERVAL '1 day')::date
  LOOP
    INSERT INTO delivery_slots (delivery_date, slot_type, max_orders, is_open)
    VALUES
      (d, 'morning', 30, true),
      (d, 'evening', 30, true)
    ON CONFLICT (delivery_date, slot_type) DO NOTHING;
  END LOOP;
END;
$$;
