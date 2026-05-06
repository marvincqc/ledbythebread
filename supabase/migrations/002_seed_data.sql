-- ============================================================
-- 002_seed_data.sql
-- Seed data: categories, admin_settings, SKUs, delivery slots,
-- and sample orders for Singapore home bakery context.
-- ============================================================

-- ---- CATEGORIES ----
INSERT INTO categories (id, name, sort_order) VALUES
  ('a1000000-0000-0000-0000-000000000001', 'Classic',     1),
  ('a1000000-0000-0000-0000-000000000002', 'Whole Wheat', 2),
  ('a1000000-0000-0000-0000-000000000003', 'Cheese',      3)
ON CONFLICT DO NOTHING;

-- ---- ADMIN SETTINGS ----
INSERT INTO admin_settings (key, value) VALUES
  ('min_order_amount', '15'),
  ('max_weeks_out',    '2')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ---- SKUS (SGD prices + Unsplash images) ----
INSERT INTO skus (id, name, description, price, category_id, image_url, is_active) VALUES
  (
    'b1000000-0000-0000-0000-000000000001',
    'Classic Pandesal',
    'Soft and fluffy classic Filipino bread roll dusted with breadcrumbs. Best enjoyed warm.',
    1.50,
    'a1000000-0000-0000-0000-000000000001',
    'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&q=80',
    true
  ),
  (
    'b1000000-0000-0000-0000-000000000002',
    'Whole Wheat Pandesal',
    'Nutritious whole wheat version with a slightly nutty flavor. A healthier choice without sacrificing taste.',
    2.00,
    'a1000000-0000-0000-0000-000000000002',
    'https://images.unsplash.com/photo-1586444248902-2f64eddc13df?w=400&q=80',
    true
  ),
  (
    'b1000000-0000-0000-0000-000000000003',
    'Cheese Pandesal',
    'Our classic pandesal filled with creamy melted cheese. A crowd favorite for all ages.',
    2.50,
    'a1000000-0000-0000-0000-000000000003',
    'https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=400&q=80',
    true
  ),
  (
    'b1000000-0000-0000-0000-000000000004',
    'Classic Dozen Bundle',
    'Get 12 classic pandesal at a special bundled price. Perfect for the whole family.',
    15.00,
    'a1000000-0000-0000-0000-000000000001',
    'https://images.unsplash.com/photo-1549931319-a545dcf3bc7b?w=400&q=80',
    true
  )
ON CONFLICT (id) DO NOTHING;

-- Update the bundle to set is_bundle and bundle_components
UPDATE skus
SET
  is_bundle = true,
  bundle_components = '[{"sku_id": "b1000000-0000-0000-0000-000000000001", "quantity": 12}]'::jsonb
WHERE id = 'b1000000-0000-0000-0000-000000000004';

-- ---- DELIVERY SLOTS (next 14 days, weekdays only — skip Sat/Sun) ----
DO $$
DECLARE
  d date;
BEGIN
  FOR d IN
    SELECT generate_series(CURRENT_DATE, CURRENT_DATE + INTERVAL '14 days', INTERVAL '1 day')::date
  LOOP
    -- Skip Saturday (DOW = 6) and Sunday (DOW = 0)
    IF EXTRACT(DOW FROM d) NOT IN (0, 6) THEN
      INSERT INTO delivery_slots (delivery_date, slot_type, max_orders, is_open)
      VALUES
        (d, 'morning', 30, true),
        (d, 'evening', 30, true)
      ON CONFLICT (delivery_date, slot_type) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;

-- ---- SAMPLE ORDERS ----
INSERT INTO orders (id, guest_info, delivery_address, delivery_date, slot_type, subtotal, status, created_at) VALUES
  (
    'c1000000-0000-0000-0000-000000000001',
    '{"name":"Li Wei","phone":"+65 9123 4567","email":"liwei@email.com"}',
    'Blk 123 Ang Mo Kio Ave 6 #05-10 Singapore 560123',
    CURRENT_DATE + 1,
    'morning',
    15.00,
    'confirmed',
    now() - interval '2 hours'
  ),
  (
    'c1000000-0000-0000-0000-000000000002',
    '{"name":"Priya Nair","phone":"+65 8234 5678","email":"priya@email.com"}',
    'Blk 45 Jurong West St 42 #12-08 Singapore 640045',
    CURRENT_DATE + 1,
    'evening',
    22.50,
    'pending',
    now() - interval '1 hour'
  ),
  (
    'c1000000-0000-0000-0000-000000000003',
    '{"name":"Ahmad Razif","phone":"+65 9345 6789","email":"ahmad@email.com"}',
    '88 Tampines Street 21 #03-15 Singapore 521088',
    CURRENT_DATE + 2,
    'morning',
    15.00,
    'preparing',
    now() - interval '3 hours'
  ),
  (
    'c1000000-0000-0000-0000-000000000004',
    '{"name":"Sarah Tan","phone":"+65 8456 7890","email":"sarah@email.com"}',
    'Blk 302 Clementi Ave 4 #08-22 Singapore 120302',
    CURRENT_DATE,
    'evening',
    30.00,
    'delivered',
    now() - interval '1 day'
  ),
  (
    'c1000000-0000-0000-0000-000000000005',
    '{"name":"James Lim","phone":"+65 9567 8901","email":"james@email.com"}',
    '10 Bayfront Ave #20-01 Singapore 018956',
    CURRENT_DATE + 3,
    'morning',
    15.00,
    'cancelled',
    now() - interval '5 hours'
  )
ON CONFLICT (id) DO NOTHING;

-- ---- SAMPLE ORDER ITEMS ----
INSERT INTO order_items (order_id, sku_id, quantity, unit_price) VALUES
  -- Order 1: Li Wei — Classic Dozen Bundle x1
  ('c1000000-0000-0000-0000-000000000001', 'b1000000-0000-0000-0000-000000000004', 1,  15.00),
  -- Order 2: Priya — Classic Pandesal x6 + Cheese Pandesal x3
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000001', 6,   1.50),
  ('c1000000-0000-0000-0000-000000000002', 'b1000000-0000-0000-0000-000000000003', 3,   2.50),
  -- Order 3: Ahmad — Classic Dozen Bundle x1
  ('c1000000-0000-0000-0000-000000000003', 'b1000000-0000-0000-0000-000000000004', 1,  15.00),
  -- Order 4: Sarah — Whole Wheat x6 + Cheese x4 + Classic x4
  ('c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000002', 6,   2.00),
  ('c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000003', 4,   2.50),
  ('c1000000-0000-0000-0000-000000000004', 'b1000000-0000-0000-0000-000000000001', 4,   1.50),
  -- Order 5: James — Classic Dozen Bundle x1
  ('c1000000-0000-0000-0000-000000000005', 'b1000000-0000-0000-0000-000000000004', 1,  15.00)
ON CONFLICT DO NOTHING;
