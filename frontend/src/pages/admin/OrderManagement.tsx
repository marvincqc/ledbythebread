import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "../../lib/supabase";
import { callEdgeFunction } from "../../lib/supabase";
import type { Order, OrderStatus, SlotType } from "../../types";
import { STATUS_COLORS, STATUS_TRANSITIONS, STATUS_ACTION_LABELS } from "../../types";

function formatOrderNo(createdAt: string): string {
  const d = new Date(createdAt);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}-${hh}${min}`;
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  slot: string;
  status: string;
  search: string;
}

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<Filters>({
    dateFrom: new Date().toISOString().split("T")[0],
    dateTo: new Date().toISOString().split("T")[0],
    slot: "",
    status: "",
    search: "",
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [filters.dateFrom, filters.dateTo, filters.slot, filters.status]);

  async function fetchOrders() {
    setLoading(true);

    // Fetch order headers only — no nested joins for the list
    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.dateFrom) query = query.gte("delivery_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("delivery_date", filters.dateTo);
    if (filters.slot) query = query.eq("slot_type", filters.slot as SlotType);
    if (filters.status) query = query.eq("status", filters.status);

    const { data } = await query;
    if (data) setOrders(data as Order[]);
    setLoading(false);
  }

  async function selectOrder(order: Order) {
    setSelectedOrder(order);
    if (order.order_items) return; // already loaded
    setLoadingDetail(true);
    const { data } = await supabase
      .from("order_items")
      .select("*, sku:skus(*)")
      .eq("order_id", order.id);
    if (data) {
      const withItems = { ...order, order_items: data };
      setSelectedOrder(withItems);
      setOrders((prev) => prev.map((o) => o.id === order.id ? withItems : o));
    }
    setLoadingDetail(false);
  }

  const filteredOrders = orders.filter((o) => {
    if (!filters.search) return true;
    const q = filters.search.toLowerCase();
    const guestName = o.guest_info?.name?.toLowerCase() ?? "";
    const guestPhone = o.guest_info?.phone?.toLowerCase() ?? "";
    const orderId = o.id.toLowerCase();
    return guestName.includes(q) || guestPhone.includes(q) || orderId.includes(q);
  });

  async function updateStatus(order: Order, newStatus: OrderStatus) {
    setUpdatingId(order.id);

    const { data, error } = await callEdgeFunction("update-order-status", {
      order_id: order.id,
      new_status: newStatus,
    });

    if (error) {
      showMessage("error", error);
    } else {
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: newStatus } : o))
      );
      if (selectedOrder?.id === order.id) {
        setSelectedOrder({ ...selectedOrder, status: newStatus });
      }
      showMessage("success", `Order updated to "${newStatus}".`);
    }

    setUpdatingId(null);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3500);
  }

  const allStatuses: OrderStatus[] = [
    "pending", "confirmed", "preparing", "ready",
    "out_for_delivery", "delivered", "paid", "cancelled", "refunded",
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-white/70 hover:text-white">← Dashboard</Link>
        <h1 className="font-heading text-xl font-bold">Order Management</h1>
      </header>

      {/* Toast */}
      {message && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-card shadow-lg text-white text-sm font-medium ${
            message.type === "success" ? "bg-success" : "bg-error"
          }`}
        >
          {message.text}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Filters */}
        <div className="card p-4 mb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="label text-xs">From</label>
            <input
              type="date"
              value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="input text-sm py-2"
            />
          </div>
          <div>
            <label className="label text-xs">To</label>
            <input
              type="date"
              value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="input text-sm py-2"
            />
          </div>
          <div>
            <label className="label text-xs">Slot</label>
            <select
              value={filters.slot}
              onChange={(e) => setFilters({ ...filters, slot: e.target.value })}
              className="input text-sm py-2"
            >
              <option value="">All slots</option>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input text-sm py-2"
            >
              <option value="">All statuses</option>
              {allStatuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Search</label>
            <input
              type="search"
              placeholder="Name, phone, or order ID..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input text-sm py-2"
            />
          </div>
        </div>

        <div className="flex gap-6">
          {/* Order table */}
          <div className="flex-1 card overflow-hidden">
            <div className="px-5 py-3 border-b border-primary/10 flex items-center justify-between">
              <span className="font-semibold text-primary">
                {filteredOrders.length} orders
              </span>
              <button
                onClick={fetchOrders}
                className="text-sm text-primary hover:text-primary-dark font-medium"
              >
                Refresh
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-background">
                    <tr>
                      {["Order No.", "Customer", "Delivery", "Subtotal", "Status", "Actions"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-text-muted font-medium uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-5 py-10 text-center text-text-muted">
                          No orders found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => {
                        const nextStatuses = STATUS_TRANSITIONS[order.status as OrderStatus] ?? [];
                        return (
                          <tr
                            key={order.id}
                            className={`hover:bg-background/50 cursor-pointer transition-colors ${
                              selectedOrder?.id === order.id ? "bg-primary/5" : ""
                            }`}
                            onClick={() => selectOrder(order)}
                          >
                            <td className="px-4 py-3">
                              <span className="font-mono text-xs font-semibold text-text-main">
                                {formatOrderNo(order.created_at)}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-medium">{order.guest_info?.name ?? "—"}</div>
                              <div className="text-xs text-text-muted">{order.guest_info?.phone}</div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="text-xs font-medium text-text-main">{order.delivery_date}</div>
                              <div className="text-xs text-text-muted capitalize">{order.slot_type}</div>
                            </td>
                            <td className="px-4 py-3 font-semibold text-primary">
                              S${order.subtotal.toFixed(2)}
                            </td>
                            <td className="px-4 py-3">
                              <span className={`badge ${STATUS_COLORS[order.status as OrderStatus] ?? "bg-gray-100 text-gray-800"}`}>
                                {order.status}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {nextStatuses.length > 0 && (
                                <select
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) => {
                                    if (e.target.value) {
                                      updateStatus(order, e.target.value as OrderStatus);
                                      e.target.value = "";
                                    }
                                  }}
                                  disabled={updatingId === order.id}
                                  className="text-xs border border-primary/30 rounded-button px-2 py-1 bg-white text-text-main focus:outline-none focus:ring-1 focus:ring-primary"
                                >
                                  <option value="">Action…</option>
                                  {nextStatuses.map((s) => (
                                    <option key={s} value={s}>{STATUS_ACTION_LABELS[s] ?? s}</option>
                                  ))}
                                </select>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Order detail panel */}
          {selectedOrder && (
            <div className="w-72 flex-shrink-0 card p-4 h-fit sticky top-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-heading font-semibold text-primary">Order Detail</h3>
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="text-text-muted hover:text-primary"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-text-muted block">Order ID</span>
                  <span className="font-mono font-medium">{selectedOrder.id}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Customer</span>
                  <span className="font-medium">{selectedOrder.guest_info?.name ?? "—"}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Phone</span>
                  <span>{selectedOrder.guest_info?.phone ?? "—"}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Email</span>
                  <span className="break-all">{selectedOrder.guest_info?.email ?? "—"}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Address</span>
                  <span>{selectedOrder.delivery_address}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Delivery</span>
                  <span>{selectedOrder.delivery_date} · {selectedOrder.slot_type}</span>
                </div>
                <div>
                  <span className="text-text-muted block">Status</span>
                  <span className={`badge ${STATUS_COLORS[selectedOrder.status as OrderStatus]}`}>
                    {selectedOrder.status}
                  </span>
                </div>
              </div>

              {/* Payment proof */}
              {selectedOrder.metadata?.payment_proof_url && (
                <div className="mt-4 pt-3 border-t border-primary/10">
                  <p className="text-xs text-text-muted font-medium mb-2">Payment Screenshot</p>
                  <a href={selectedOrder.metadata.payment_proof_url as string} target="_blank" rel="noopener noreferrer">
                    <img
                      src={selectedOrder.metadata.payment_proof_url as string}
                      alt="Payment proof"
                      className="w-full rounded-lg border border-primary/10 hover:opacity-90 transition-opacity"
                    />
                  </a>
                </div>
              )}

              {/* Items */}
              <div className="mt-4 pt-3 border-t border-primary/10">
                <p className="text-xs text-text-muted font-medium mb-2">Items</p>
                {loadingDetail ? (
                  <div className="flex justify-center py-3">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : selectedOrder.order_items ? (
                  <div className="space-y-1">
                    {selectedOrder.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span>{item.sku?.name ?? "Item"} ×{item.quantity}</span>
                        <span className="font-medium">S${(item.unit_price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t border-primary/10 pt-1 mt-1 flex justify-between font-semibold text-xs">
                      <span>Total</span>
                      <span className="text-primary">S${selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Quick status change */}
              {(STATUS_TRANSITIONS[selectedOrder.status as OrderStatus] ?? []).length > 0 && (
                <div className="mt-4 pt-3 border-t border-primary/10">
                  <p className="text-xs text-text-muted font-medium mb-2">Change Status</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(STATUS_TRANSITIONS[selectedOrder.status as OrderStatus] ?? []).map((s) => (
                      <button
                        key={s}
                        onClick={() => updateStatus(selectedOrder, s)}
                        disabled={updatingId === selectedOrder.id}
                        className={`text-xs px-3 py-1.5 rounded-button font-medium transition-colors disabled:opacity-50 ${
                          s === "cancelled"
                            ? "bg-error/10 hover:bg-error/20 text-error"
                            : "bg-primary/10 hover:bg-primary/20 text-primary"
                        }`}
                      >
                        {STATUS_ACTION_LABELS[s] ?? s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
