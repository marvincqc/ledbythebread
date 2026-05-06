# Order Statuses & Workflow

## Statuses
1. `pending` – order placed, awaiting admin confirmation.
2. `confirmed` – admin accepted the order into the schedule.
3. `preparing` – bakery is working on it.
4. `ready` – ready for delivery/rider pickup.
5. `out_for_delivery` – rider is on the way.
6. `delivered` – delivered to customer.
7. `paid` – payment received (can occur earlier if online payment).
8. `cancelled` – order cancelled (before `preparing` ideally).
9. `refunded` – money returned.

## Allowed Transitions (Admin enforced)
- `pending` → `confirmed` / `cancelled`
- `confirmed` → `preparing` / `cancelled`
- `preparing` → `ready`
- `ready` → `out_for_delivery`
- `out_for_delivery` → `delivered`
- `delivered` → `paid` (if COD) – or automatic via Stripe
- `paid` → (only refunded if needed)
- `cancelled` → cannot proceed unless refund is manually reversed.

## Edge Function Logic
- On status change, Edge Function validates transition, records timestamps, sends notifications.
- If status becomes `cancelled` before `preparing`, optionally increment `current_orders` back (slot capacity reclaim).

## Customer Visibility
Customers see a simplified timeline: "Order Received", "Being Prepared", "Out for Delivery", "Delivered". Map these internally.