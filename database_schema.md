# Database Schema (Supabase PostgreSQL)

## Tables & Relationships

### `profiles`
- `id` uuid PK (references `auth.users`)
- `role` text default 'customer' (customer / admin)
- `full_name` text
- `phone` text
- `address` text

### `categories`
- `id` uuid PK
- `name` text (e.g., Classic, Whole Wheat, Cheese)
- `sort_order` int

### `skus`
- `id` uuid PK
- `name` text
- `description` text
- `image_url` text
- `price` numeric(10,2)
- `category_id` uuid FK → categories
- `is_bundle` boolean default false
- `bundle_components` jsonb (array of `{sku_id, quantity}`) – only for bundles
- `is_active` boolean default true (soft delete)
- `metadata` jsonb (for future extensibility)
- `created_at` timestamptz

### `delivery_slots`
- `id` uuid PK
- `delivery_date` date
- `slot_type` text (morning / evening)
- `max_orders` int (settable per day)
- `current_orders` int default 0
- `is_open` boolean default true
- `cut_off_override` timestamptz (nullable – overrides computed cut‑off time)

Unique constraint on (`delivery_date`, `slot_type`).

### `orders`
- `id` uuid PK
- `customer_id` uuid FK → profiles (nullable for guest checkout)
- `guest_info` jsonb (name, phone, email)
- `delivery_address` text
- `lat` double precision, `lng` double precision
- `delivery_date` date
- `slot_type` text
- `subtotal` numeric(10,2)
- `status` text default 'pending' (see Order Status Workflow)
- `created_at` timestamptz

### `order_items`
- `id` uuid PK
- `order_id` uuid FK → orders
- `sku_id` uuid FK → skus
- `quantity` int
- `unit_price` numeric(10,2)

### `admin_settings`
- `key` text PK (e.g., 'min_order_amount', 'max_weeks_out')
- `value` text

### `slot_overrides`
- `id` uuid PK
- `delivery_date` date
- `slot_type` text
- `override_type` text ('close', 'open', 'custom_cut_off')
- `custom_data` jsonb

## Row Level Security (Key Policies)
- Admins (`role = 'admin'`): all access.
- Customers: read only active SKUs, open slots where `is_open = true` and `current_orders < max_orders`.
- Customers: create orders and their own order items; can view own orders.
- Edge Functions operate with `service_role` (bypass RLS).

## Triggers / Functions
- Automatically compute cut‑off deadline based on slot type and date (e.g., morning slot deadline = day before 6 PM; evening slot = same day 11 AM). Override if `cut_off_override` exists.
- On order creation, increment `current_orders` atomically; on cancellation decrement (if admin decides).