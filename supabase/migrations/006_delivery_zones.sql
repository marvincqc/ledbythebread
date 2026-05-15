-- Delivery zones: named geographic areas used to restrict slot availability
CREATE TABLE delivery_zones (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  center_lat numeric(10,7) NOT NULL,
  center_lng numeric(10,7) NOT NULL,
  radius_km  numeric(5,2) NOT NULL DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon checkout) can read zones to filter slots
CREATE POLICY "zones_select_all" ON delivery_zones
  FOR SELECT USING (true);

-- Only authenticated admin users can write
CREATE POLICY "zones_admin_write" ON delivery_zones
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Add zone_id to delivery_slots; null = open to all areas (backward-compatible)
ALTER TABLE delivery_slots
  ADD COLUMN zone_id uuid REFERENCES delivery_zones(id) ON DELETE SET NULL;
