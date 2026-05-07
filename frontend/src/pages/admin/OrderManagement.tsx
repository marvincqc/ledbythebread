import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import type { Order, OrderStatus, SlotType } from "../../types";
import { STATUS_COLORS, STATUS_ACTION_LABELS } from "../../types";
import { pageCache } from "../../lib/pageCache";

function formatOrderId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

interface Filters {
  dateFrom: string;
  dateTo: string;
  slot: string;
  status: string;
  search: string;
}

const ALL_STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "delivered", "cancelled"];

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>(() => pageCache.get<Order[]>('admin-orders') ?? []);
  const [loading, setLoading] = useState(!pageCache.get('admin-orders'));
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

  useEffect(() => { fetchOrders(); }, [filters.dateFrom, filters.dateTo, filters.slot, filters.status]);

  async function fetchOrders() {
    const hasCached = !!pageCache.get('admin-orders');
    if (!hasCached) setLoading(true);

    let query = supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.dateFrom) query = query.gte("delivery_date", filters.dateFrom);
    if (filters.dateTo) query = query.lte("delivery_date", filters.dateTo);
    if (filters.slot) query = query.eq("slot_type", filters.slot as SlotType);
    if (filters.status) query = query.eq("status", filters.status);

    const { data } = await query;
    if (data) {
      setOrders(data as Order[]);
      pageCache.set('admin-orders', data);
    }
    setLoading(false);
  }

  async function selectOrder(order: Order) {
    setSelectedOrder(order);
    if (order.order_items) return;
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
    return (
      (o.guest_info?.name?.toLowerCase() ?? "").includes(q) ||
      (o.guest_info?.phone?.toLowerCase() ?? "").includes(q) ||
      o.id.toLowerCase().includes(q)
    );
  });

  async function updateStatus(order: Order, newStatus: OrderStatus) {
    setUpdatingId(order.id);
    const { error } = await callEdgeFunction("update-order-status", {
      order_id: order.id,
      new_status: newStatus,
    });
    if (error) {
      showMessage("error", error);
    } else {
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === order.id) setSelectedOrder({ ...selectedOrder, status: newStatus });
      showMessage("success", `Status updated to "${newStatus}".`);
    }
    setUpdatingId(null);
  }

  function showMessage(type: "success" | "error", text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-primary text-white px-6 py-4 flex items-center gap-4">
        <Link to="/admin" className="text-white/70 hover:text-white">← Dashboard</Link>
        <h1 className="font-heading text-xl font-bold">Order Management</h1>
      </header>

      {message && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-card shadow-lg text-white text-sm font-medium ${
          message.type === "success" ? "bg-success" : "bg-error"
        }`}>
          {message.text}
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <div className="card p-4 mb-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div>
            <label className="label text-xs">From</label>
            <input type="date" value={filters.dateFrom}
              onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
              className="input text-sm py-2" />
          </div>
          <div>
            <label className="label text-xs">To</label>
            <input type="date" value={filters.dateTo}
              onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
              className="input text-sm py-2" />
          </div>
          <div>
            <label className="label text-xs">Slot</label>
            <select value={filters.slot}
              onChange={(e) => setFilters({ ...filters, slot: e.target.value })}
              className="input text-sm py-2">
              <option value="">All slots</option>
              <option value="morning">Morning</option>
              <option value="evening">Evening</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Status</label>
            <select value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="input text-sm py-2">
              <option value="">All statuses</option>
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label text-xs">Search</label>
            <input type="search" placeholder="Name, phone, order ID…"
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="input text-sm py-2" />
          </div>
        </div>

        <div className="flex gap-5">
          {/* Order table */}
          <div className="flex-1 card overflow-hidden min-w-0">
            <div className="px-5 py-3 border-b border-primary/10 flex items-center justify-between">
              <span className="font-semibold text-primary text-sm">{filteredOrders.length} orders</span>
              <button onClick={fetchOrders} className="text-sm text-primary hover:text-primary-dark font-medium">
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
                      {["Order ID", "Customer", "Delivery", "Total", "Status"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs text-text-muted font-medium uppercase tracking-wide">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary/5">
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-5 py-10 text-center text-text-muted">
                          No orders found.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order) => (
                        <tr
                          key={order.id}
                          onClick={() => selectOrder(order)}
                          className={`cursor-pointer transition-colors hover:bg-primary/5 ${
                            selectedOrder?.id === order.id ? "bg-primary/8 border-l-2 border-l-primary" : ""
                          }`}
                        >
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-bold text-text-main">{formatOrderId(order.id)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-text-main">{order.guest_info?.name ?? "—"}</div>
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
                            <span className={`badge ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800"}`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detail panel */}
          {selectedOrder && (
            <div className="w-72 flex-shrink-0 space-y-3 sticky top-4 h-fit">
              {/* Header */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-text-muted">{formatOrderId(selectedOrder.id)}</span>
                  <button onClick={() => setSelectedOrder(null)} className="text-text-muted hover:text-primary">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-text-muted">Customer</span>
                    <span className="font-medium text-right">{selectedOrder.guest_info?.name ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Phone</span>
                    <span>{selectedOrder.guest_info?.phone ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Email</span>
                    <span className="break-all text-right max-w-[160px]">{selectedOrder.guest_info?.email ?? "—"}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-text-muted flex-shrink-0">Address</span>
                    <span className="text-right">{selectedOrder.delivery_address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-muted">Delivery</span>
                    <span className="capitalize">{selectedOrder.delivery_date} · {selectedOrder.slot_type}</span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-text-muted">Status</span>
                    <span className={`badge ${STATUS_COLORS[selectedOrder.status]}`}>{selectedOrder.status}</span>
                  </div>
                </div>
              </div>

              {/* Change status */}
              <div className="card p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">Change Status</p>
                <div className="space-y-1.5">
                  {ALL_STATUSES.filter((s) => s !== selectedOrder.status).map((s) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selectedOrder, s)}
                      disabled={updatingId === selectedOrder.id}
                      className={`w-full text-left text-xs px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                        s === "cancelled"
                          ? "bg-red-50 hover:bg-red-100 text-red-700"
                          : s === selectedOrder.status
                          ? "bg-primary/10 text-primary"
                          : "bg-gray-50 hover:bg-primary/10 text-text-main hover:text-primary"
                      }`}
                    >
                      {updatingId === selectedOrder.id ? "Updating…" : STATUS_ACTION_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment proof */}
              {selectedOrder.metadata?.payment_proof_url && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Payment Screenshot</p>
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
              <div className="card p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Items</p>
                {loadingDetail ? (
                  <div className="flex justify-center py-3">
                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : selectedOrder.order_items ? (
                  <div className="space-y-1.5">
                    {selectedOrder.order_items.map((item) => (
                      <div key={item.id} className="flex justify-between text-xs">
                        <span className="text-text-muted">{item.sku?.name ?? "Item"} <span className="font-medium text-text-main">×{item.quantity}</span></span>
                        <span className="font-medium">S${(item.unit_price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                    <div className="border-t border-primary/10 pt-1.5 mt-1 flex justify-between font-bold text-xs">
                      <span>Total</span>
                      <span className="text-primary">S${selectedOrder.subtotal.toFixed(2)}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
