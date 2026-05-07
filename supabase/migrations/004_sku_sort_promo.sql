-- Add sort_order to skus for drag-and-drop sequencing
ALTER TABLE skus ADD COLUMN IF NOT EXISTS sort_order int NOT NULL DEFAULT 0;

-- Initialize sort_order from existing created_at order
UPDATE skus SET sort_order = sub.rn
FROM (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn
  FROM skus
) sub
WHERE skus.id = sub.id;

-- Add is_promo flag
ALTER TABLE skus ADD COLUMN IF NOT EXISTS is_promo boolean NOT NULL DEFAULT false;
