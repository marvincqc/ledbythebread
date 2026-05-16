-- Replace single zone_id FK with a junction table for many-to-many slot ↔ zone
CREATE TABLE delivery_slot_zones (
  slot_id uuid NOT NULL REFERENCES delivery_slots(id) ON DELETE CASCADE,
  zone_id uuid NOT NULL REFERENCES delivery_zones(id)  ON DELETE CASCADE,
  PRIMARY KEY (slot_id, zone_id)
);

ALTER TABLE delivery_slot_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "slot_zones_select_all" ON delivery_slot_zones
  FOR SELECT USING (true);

CREATE POLICY "slot_zones_admin_write" ON delivery_slot_zones
  FOR ALL TO authenticated
  USING   (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Migrate any existing single-zone assignments
INSERT INTO delivery_slot_zones (slot_id, zone_id)
SELECT id, zone_id FROM delivery_slots WHERE zone_id IS NOT NULL;

-- Drop the old single-zone column
ALTER TABLE delivery_slots DROP COLUMN zone_id;
