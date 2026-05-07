# SKU Structure & Future‑Proofing

## Current Design
- Simple items: Pandesal classic, ube cheese, etc. – each is an SKU.
- Bundles: A SKU that groups other SKUs with defined quantities.
- Category grouping (e.g., "Flavors", "Boxes", "Combos").

## Extensibility
All SKUs have a `metadata` JSONB column. Use cases:
- `{ "allergens": ["dairy", "eggs"] }`
- `{ "dietary_tags": ["vegan", "low-sugar"] }`
- `{ "preparation_time": "overnight" }`
- `{ "image_gallery": [] }` – for multiple images
- `{ "add_ons": [{ "sku_id": "...", "name": "Extra Butter" }] }` – compatible upsells

## Inventory Tracking (Future)
Add `inventory` table:
- `sku_id`
- `available_date` (date)
- `quantity`
Admins can set per‑day stock; Edge Function deducts upon order.

## Dynamic Pricing (Future)
`sku_pricing` table (with start/end dates, price) to support flash sales or season pricing. The Edge Function resolves the active price at order time based on delivery date.

## Recommendations
- Always denormalize `unit_price` and `sku_name` into `order_items` to preserve historical data.
- Avoid deleting any SKU that appears in orders – soft‑delete only.
- Use the metadata field early to store tags for filtering.