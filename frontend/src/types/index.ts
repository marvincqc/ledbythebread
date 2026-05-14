export type UserRole = "customer" | "admin";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string | null;
  phone: string | null;
  address: string | null;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface BundleComponent {
  sku_id: string;
  quantity: number;
}

export interface Sku {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  min_qty: number;
  category_id: string | null;
  is_bundle: boolean;
  bundle_components: BundleComponent[] | null;
  is_active: boolean;
  is_promo: boolean;
  sort_order: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
  category?: Category;
}

export type SlotType = "morning" | "evening";

export interface DeliverySlot {
  id: string;
  delivery_date: string;
  slot_type: SlotType;
  max_orders: number;
  current_orders: number;
  is_open: boolean;
  cut_off_override: string | null;
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "delivered"
  | "cancelled";

export interface GuestInfo {
  name: string;
  phone: string;
  email: string;
}

export interface Order {
  id: string;
  customer_id: string | null;
  guest_info: GuestInfo | null;
  delivery_address: string;
  lat: number | null;
  lng: number | null;
  delivery_date: string;
  slot_type: SlotType;
  subtotal: number;
  status: OrderStatus;
  created_at: string;
  metadata?: Record<string, unknown> | null;
  order_items?: OrderItemWithSku[];
  profile?: Profile;
}

export interface OrderItem {
  id: string;
  order_id: string;
  sku_id: string;
  quantity: number;
  unit_price: number;
}

export interface OrderItemWithSku extends OrderItem {
  sku?: Sku;
}

export interface AdminSetting {
  key: string;
  value: string;
}

export type SlotOverrideType = "close" | "open" | "custom_cut_off";

export interface SlotOverride {
  id: string;
  delivery_date: string;
  slot_type: SlotType;
  override_type: SlotOverrideType;
  custom_data: Record<string, unknown> | null;
}

export interface CartItem {
  sku: Sku;
  quantity: number;
}

const ALL_STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "delivered", "cancelled"];

// Admin can move any order to any status freely
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending:    ALL_STATUSES.filter((s) => s !== "pending"),
  confirmed:  ALL_STATUSES.filter((s) => s !== "confirmed"),
  preparing:  ALL_STATUSES.filter((s) => s !== "preparing"),
  delivered:  ALL_STATUSES.filter((s) => s !== "delivered"),
  cancelled:  ALL_STATUSES.filter((s) => s !== "cancelled"),
};

export const STATUS_ACTION_LABELS: Record<string, string> = {
  pending:    "Mark Pending",
  confirmed:  "Confirm Payment",
  preparing:  "Start Preparing",
  delivered:  "Mark Delivered",
  cancelled:  "Cancel Order",
};

// Customer-facing status labels
export const CUSTOMER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending:    "Order Received",
  confirmed:  "Order Confirmed",
  preparing:  "Being Prepared",
  delivered:  "Delivered",
  cancelled:  "Cancelled",
};

// Admin status badge colors
export const STATUS_COLORS: Record<string, string> = {
  pending:    "bg-yellow-100 text-yellow-800",
  confirmed:  "bg-blue-100 text-blue-800",
  preparing:  "bg-purple-100 text-purple-800",
  delivered:  "bg-green-100 text-green-800",
  cancelled:  "bg-red-100 text-red-800",
};
