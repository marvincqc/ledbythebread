# Admin Console Features & Logic

## Authentication
Only users with `role = 'admin'` can access `/admin/*` routes. Use Supabase Auth middleware in Edge Functions.

## Dashboard
- Live counters: orders today (by slot), total revenue.
- Quick charts: most popular SKUs, order status distribution.
- Links to manage slots, SKUs, orders.

## Slot Management
- **Calendar View:** Month/week view showing all future dates within `max_weeks_out`.
- Each day displays two slots (morning / evening). Icon color indicates:
  - Open = green
  - Closed = grey (admin toggled or past cut‑off)
  - Full = orange (max orders reached)
- **Edit Slot:** Admins can:
  - Toggle open/close for a specific slot day.
  - Set custom `max_orders` for that slot.
  - Overwrite cut‑off deadline (advanced).
- **Global Settings:**
  - `max_weeks_out` (default 2) – only show dates up to that limit.
  - `min_order_amount` – orders below this are rejected.
- **Bulk Operations:** Open/close a weekday pattern (e.g., all Sundays closed).

## SKU Management
- List all SKUs with search/filter.
- Add new SKU: form with name, price, category, image upload (Supabase Storage).
- Edit: updates only affect future orders. Existing `order_items` preserve old price/name via denormalization.
- Delete: sets `is_active = false`. Cannot hard‑delete if any order references it (enforced by RLS or check constraint).
- **Bundles:** A SKU with `is_bundle = true`; shows a component selector UI (pick other SKUs and quantities). Bundle price can be fixed or computed from components.

## Order Management
- Filter by date, slot, status.
- View order details: items, customer info, delivery address on a map.
- Status update dropdown (allowed transitions only).
- Bulk status update for selected orders.
- Search by customer name or phone.

## Settings
- Global settings panel (`admin_settings` table): editable via form.
- Option to set a delivery area (lat/lng radius or polygon) – validate in Edge Function.