// ============================================================
// Domain types for Led by the Bread
// ============================================================

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
  category_id: string | null;
  is_bundle: boolean;
  bundle_components: BundleComponent[] | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
  // joined
  category?: Category;
}

export type SlotType = "morning" | "evening";

export interface DeliverySlot {
  id: string;
  delivery_date: string; // YYYY-MM-DD
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
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "paid"
  | "cancelled"
  | "refunded";

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
  // joined
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

// Cart types
export interface CartItem {
  sku: Sku;
  quantity: number;
}

// Valid status transitions (mirroring edge function logic)
export const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["out_for_delivery"],
  out_for_delivery: ["delivered"],
  delivered: ["paid"],
  paid: ["refunded"],
  cancelled: [],
  refunded: [],
};

// Customer-facing status labels
export const CUSTOMER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "Order Received",
  confirmed: "Order Received",
  preparing: "Being Prepared",
  ready: "Being Prepared",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  paid: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

// Admin status badge colors
export const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-purple-100 text-purple-800",
  ready: "bg-indigo-100 text-indigo-800",
  out_for_delivery: "bg-orange-100 text-orange-800",
  delivered: "bg-green-100 text-green-800",
  paid: "bg-green-200 text-green-900",
  cancelled: "bg-red-100 text-red-800",
  refunded: "bg-gray-100 text-gray-800",
};
