-- Reset all existing slots to default capacity of 10
-- (Previous default was 30)
UPDATE delivery_slots
SET max_orders = 10
WHERE max_orders = 30;

-- Recalculate current_orders from actual active orders
UPDATE delivery_slots ds
SET current_orders = (
  SELECT COUNT(*)
  FROM orders o
  WHERE o.delivery_date = ds.delivery_date
    AND o.slot_type = ds.slot_type
    AND o.status NOT IN ('cancelled', 'delivered')
);
