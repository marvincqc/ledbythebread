-- ============================================================
-- 001_initial_schema.sql
-- Full schema for Led by the Bread pandesal pre-order system
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id        uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role      text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer', 'admin')),
  full_name text,
  phone     text,
  address   text
);

-- ============================================================
-- CATEGORIES
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name       text NOT NULL,
  sort_order int  NOT NULL DEFAULT 0
);

-- ============================================================
-- SKUS
-- ============================================================
CREATE TABLE IF NOT EXISTS skus (
  id                uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name              text        NOT NULL,
  description       text,
  image_url         text,
  price             numeric(10,2) NOT NULL,
  category_id       uuid        REFERENCES categories(id) ON DELETE SET NULL,
  is_bundle         boolean     NOT NULL DEFAULT false,
  bundle_components jsonb,
  is_active         boolean     NOT NULL DEFAULT true,
  metadata          jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- DELIVERY SLOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_slots (
  id               uuid    PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_date    date    NOT NULL,
  slot_type        text    NOT NULL CHECK (slot_type IN ('morning', 'evening')),
  max_orders       int     NOT NULL DEFAULT 20,
  current_orders   int     NOT NULL DEFAULT 0,
  is_open          boolean NOT NULL DEFAULT true,
  cut_off_override timestamptz,
  UNIQUE (delivery_date, slot_type)
);

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id               uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id      uuid          REFERENCES profiles(id) ON DELETE SET NULL,
  guest_info       jsonb,
  delivery_address text,
  lat              double precision,
  lng              double precision,
  delivery_date    date          NOT NULL,
  slot_type        text          NOT NULL CHECK (slot_type IN ('morning', 'evening')),
  subtotal         numeric(10,2) NOT NULL,
  status           text          NOT NULL DEFAULT 'pending'
                   CHECK (status IN (
                     'pending','confirmed','preparing','ready',
                     'out_for_delivery','delivered','paid','cancelled','refunded'
                   )),
  created_at       timestamptz   NOT NULL DEFAULT now()
);

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id         uuid          PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id   uuid          NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  sku_id     uuid          NOT NULL REFERENCES skus(id) ON DELETE RESTRICT,
  quantity   int           NOT NULL CHECK (quantity > 0),
  unit_price numeric(10,2) NOT NULL
);

-- ============================================================
-- ADMIN SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  key   text PRIMARY KEY,
  value text NOT NULL
);

-- ============================================================
-- SLOT OVERRIDES
-- ============================================================
CREATE TABLE IF NOT EXISTS slot_overrides (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_date date NOT NULL,
  slot_type     text NOT NULL CHECK (slot_type IN ('morning', 'evening')),
  override_type text NOT NULL CHECK (override_type IN ('close', 'open', 'custom_cut_off')),
  custom_data   jsonb
);

-- ============================================================
-- FUNCTION: get_slot_cutoff
-- morning slot: cut-off = day before at 18:00 (6 PM) PHT
-- evening slot: cut-off = same day at 11:00 AM PHT
-- PHT = UTC+8, so store in UTC
-- ============================================================
CREATE OR REPLACE FUNCTION get_slot_cutoff(
  p_delivery_date date,
  p_slot_type     text,
  p_cut_off_override timestamptz DEFAULT NULL
) RETURNS timestamptz
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF p_cut_off_override IS NOT NULL THEN
    RETURN p_cut_off_override;
  END IF;

  IF p_slot_type = 'morning' THEN
    -- Day before 6 PM PHT = day before 10:00 AM UTC
    RETURN (p_delivery_date - INTERVAL '1 day')::date + TIME '10:00:00' AT TIME ZONE 'UTC';
  ELSE
    -- Same day 11 AM PHT = same day 03:00 AM UTC
    RETURN p_delivery_date::date + TIME '03:00:00' AT TIME ZONE 'UTC';
  END IF;
END;
$$;

-- ============================================================
-- FUNCTION: increment_slot_orders (atomic)
-- Called inside place-order edge function via rpc
-- ============================================================
CREATE OR REPLACE FUNCTION increment_slot_orders(
  p_delivery_date date,
  p_slot_type     text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_slot delivery_slots%ROWTYPE;
BEGIN
  SELECT * INTO v_slot
  FROM delivery_slots
  WHERE delivery_date = p_delivery_date
    AND slot_type = p_slot_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Slot not found for date % slot %', p_delivery_date, p_slot_type;
  END IF;

  IF NOT v_slot.is_open THEN
    RAISE EXCEPTION 'Slot is closed';
  END IF;

  IF v_slot.current_orders >= v_slot.max_orders THEN
    RAISE EXCEPTION 'Slot is full';
  END IF;

  UPDATE delivery_slots
  SET current_orders = current_orders + 1
  WHERE delivery_date = p_delivery_date
    AND slot_type = p_slot_type;
END;
$$;

-- ============================================================
-- FUNCTION: decrement_slot_orders (atomic, for cancellations)
-- ============================================================
CREATE OR REPLACE FUNCTION decrement_slot_orders(
  p_delivery_date date,
  p_slot_type     text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE delivery_slots
  SET current_orders = GREATEST(0, current_orders - 1)
  WHERE delivery_date = p_delivery_date
    AND slot_type = p_slot_type;
END;
$$;

-- ============================================================
-- TRIGGER: auto-create profile on auth.users insert
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO profiles (id, role, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'role', 'customer'),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories      ENABLE ROW LEVEL SECURITY;
ALTER TABLE skus             ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_slots  ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders           ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items      ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE slot_overrides   ENABLE ROW LEVEL SECURITY;

-- Helper: is the current user an admin?
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ---- PROFILES ----
CREATE POLICY "Admins full access on profiles"
  ON profiles FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- ---- CATEGORIES ----
CREATE POLICY "Anyone can read categories"
  ON categories FOR SELECT
  USING (true);

CREATE POLICY "Admins can modify categories"
  ON categories FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- SKUS ----
CREATE POLICY "Anyone can read active skus"
  ON skus FOR SELECT
  USING (is_active = true OR is_admin());

CREATE POLICY "Admins can modify skus"
  ON skus FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- DELIVERY SLOTS ----
CREATE POLICY "Anyone can read open slots"
  ON delivery_slots FOR SELECT
  USING (
    (is_open = true AND current_orders < max_orders)
    OR is_admin()
  );

CREATE POLICY "Admins can modify delivery slots"
  ON delivery_slots FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- ---- ORDERS ----
CREATE POLICY "Admins full access on orders"
  ON orders FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Customers can insert orders"
  ON orders FOR INSERT
  WITH CHECK (
    (auth.uid() IS NOT NULL AND customer_id = auth.uid())
    OR customer_id IS NULL  -- guest orders
  );

CREATE POLICY "Customers can view own orders"
  ON orders FOR SELECT
  USING (
    is_admin()
    OR customer_id = auth.uid()
  );

-- ---- ORDER ITEMS ----
CREATE POLICY "Admins full access on order_items"
  ON order_items FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Customers can insert own order_items"
  ON order_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
        AND (orders.customer_id = auth.uid() OR orders.customer_id IS NULL)
    )
  );

CREATE POLICY "Customers can view own order_items"
  ON order_items FOR SELECT
  USING (
    is_admin()
    OR EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_id
        AND orders.customer_id = auth.uid()
    )
  );

-- ---- ADMIN SETTINGS ----
CREATE POLICY "Admins full access on admin_settings"
  ON admin_settings FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Anyone can read admin_settings"
  ON admin_settings FOR SELECT
  USING (true);

-- ---- SLOT OVERRIDES ----
CREATE POLICY "Admins full access on slot_overrides"
  ON slot_overrides FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Anyone can read slot_overrides"
  ON slot_overrides FOR SELECT
  USING (true);
