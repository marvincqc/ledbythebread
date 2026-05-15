import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { supabase, callEdgeFunction } from "../../lib/supabase";
import type { Order, OrderStatus, SlotType, OrderMessage } from "../../types";
import { STATUS_COLORS, STATUS_ACTION_LABELS } from "../../types";
import { pageCache } from "../../lib/pageCache";

function formatOrderId(createdAt: string): string {
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

const ALL_STATUSES: OrderStatus[] = ["pending", "confirmed", "preparing", "delivered", "cancelled"];

export default function OrderManagement() {
  const [orders, setOrders] = useState<Order[]>(() => pageCache.get<Order[]>('admin-orders') ?? []);
  const [loading, setLoading] = useState(!pageCache.get('admin-orders'));
  const [filters, setFilters] = useState<Filters>(() => {
    const today = new Date();
    const twoWeeksLater = new Date(today);
    twoWeeksLater.setDate(today.getDate() + 13);
    return {
      dateFrom: today.toISOString().split("T")[0],
      dateTo: twoWeeksLater.toISOString().split("T")[0],
      slot: "",
      status: "",
      search: "",
    };
  });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // order_id → unread customer message count
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());

  // Messages
  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const msgChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const msgPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesCardRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const closeLightbox = useCallback(() => setLightboxUrl(null), []);

  // Fetch messages + subscribe + poll when selected order changes
  useEffect(() => {
    setMessages([]);
    setNewMsg("");
    if (msgChannelRef.current) { supabase.removeChannel(msgChannelRef.current); msgChannelRef.current = null; }
    if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; }
    if (!selectedOrder) return;

    const orderId = selectedOrder.id;

    function refreshMessages() {
      supabase.from("order_messages").select("*").eq("order_id", orderId).order("created_at")
        .then(({ data }) => { if (data) setMessages(data as OrderMessage[]); });
    }

    refreshMessages();

    supabase.from("order_messages")
      .update({ read_at: new Date().toISOString() })
      .eq("order_id", orderId).eq("sender", "customer").is("read_at", null)
      .then(() => {});

    msgChannelRef.current = supabase
      .channel(`admin-msg-${orderId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${orderId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as OrderMessage]);
          if ((payload.new as OrderMessage).sender === "customer") {
            supabase.from("order_messages").update({ read_at: new Date().toISOString() }).eq("id", payload.new.id).then(() => {});
          }
        }
      )
      .subscribe();

    // Polling fallback — real-time is unreliable for some clients
    msgPollRef.current = setInterval(refreshMessages, 5000);

    return () => {
      if (msgPollRef.current) { clearInterval(msgPollRef.current); msgPollRef.current = null; }
      if (msgChannelRef.current) { supabase.removeChannel(msgChannelRef.current); msgChannelRef.current = null; }
    };
  }, [selectedOrder?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!selectedOrder) return;
    if (window.innerWidth < 1024) {
      setTimeout(() => detailPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    }
  }, [selectedOrder?.id]);

  async function sendAdminMessage() {
    if (!newMsg.trim() || !selectedOrder) return;
    setSendingMsg(true);
    await supabase.from("order_messages").insert({ order_id: selectedOrder.id, sender: "admin", body: newMsg.trim() });
    setNewMsg("");
    setSendingMsg(false);
  }

  const unreadMessageCount = messages.filter((m) => m.sender === "customer" && !m.read_at).length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") closeLightbox(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeLightbox]);

  useEffect(() => { fetchOrders(); }, [filters.dateFrom, filters.dateTo, filters.slot, filters.status]);

  async function fetchOrders() {
    if (!pageCache.get('admin-orders')) setLoading(true);
    try {
      let query = supabase.from("orders").select("*").order("created_at", { ascending: false });
      if (filters.dateFrom) query = query.gte("delivery_date", filters.dateFrom);
      if (filters.dateTo) query = query.lte("delivery_date", filters.dateTo);
      if (filters.slot) query = query.eq("slot_type", filters.slot as SlotType);
      if (filters.status) query = query.eq("status", filters.status);
      const [ordersRes, unreadRes] = await Promise.all([
        query,
        supabase.from("order_messages").select("order_id").eq("sender", "customer").is("read_at", null),
      ]);
      if (ordersRes.data) { setOrders(ordersRes.data as Order[]); pageCache.set('admin-orders', ordersRes.data); }
      if (unreadRes.data) {
        const counts = new Map<string, number>();
        for (const row of unreadRes.data as { order_id: string }[]) {
          counts.set(row.order_id, (counts.get(row.order_id) ?? 0) + 1);
        }
        setUnreadCounts(counts);
      }
    } finally {
      setLoading(false);
    }
  }

  function openMessages(order: Order) {
    selectOrder(order);
    setTimeout(() => {
      messagesCardRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 200);
  }

  async function selectOrder(order: Order) {
    setSelectedOrder(order);
    setUnreadCounts((prev) => { const next = new Map(prev); next.delete(order.id); return next; });
    if (order.order_items) return;
    setLoadingDetail(true);
    try {
      const { data } = await supabase.from("order_items").select("*, sku:skus(*)").eq("order_id", order.id);
      if (data) {
        const withItems = { ...order, order_items: data } as unknown as Order;
        setSelectedOrder(withItems);
        setOrders((prev) => prev.map((o) => o.id === order.id ? withItems : o));
      }
    } finally {
      setLoadingDetail(false);
    }
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

        <div className="flex flex-col lg:flex-row gap-5">
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
                      <th className="hidden sm:table-cell px-4 py-3 text-left text-xs text-text-muted font-medium uppercase tracking-wide">Order ID</th>
                      <th className="px-4 py-3 text-left text-xs text-text-muted font-medium uppercase tracking-wide">Customer</th>
                      <th className="px-4 py-3 text-center text-xs text-text-muted font-medium uppercase tracking-wide w-12">
                        <svg className="w-4 h-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                      </th>
                      {["Delivery", "Status", "Total"].map((h) => (
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
                          <td className="hidden sm:table-cell px-4 py-3">
                            <span className="font-mono text-xs font-bold text-text-main">{formatOrderId(order.created_at)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium text-text-main">{order.guest_info?.name ?? "—"}</div>
                            <div className="text-xs text-text-muted">{order.guest_info?.phone}</div>
                          </td>
                          <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const count = unreadCounts.get(order.id) ?? 0;
                              return (
                                <button
                                  onClick={() => openMessages(order)}
                                  title={count > 0 ? `${count} unread message${count > 1 ? "s" : ""}` : "Messages"}
                                  className={`relative p-1.5 rounded-lg transition-colors ${
                                    count > 0
                                      ? "bg-indigo-100 text-indigo-600 hover:bg-indigo-200"
                                      : "text-gray-300 hover:text-gray-400 hover:bg-gray-50"
                                  }`}
                                >
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                                  </svg>
                                  {count > 0 && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-indigo-500 text-white text-xs rounded-full flex items-center justify-center font-bold leading-none">
                                      {count}
                                    </span>
                                  )}
                                </button>
                              );
                            })()}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-xs font-medium text-text-main">{order.delivery_date}</div>
                            <div className="text-xs text-text-muted capitalize">{order.slot_type}</div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`badge ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-800"}`}>
                              {order.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold text-primary">
                            S${order.subtotal.toFixed(2)}
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
            <div ref={detailPanelRef} className="w-full lg:w-72 flex-shrink-0 space-y-3 lg:sticky lg:top-4 h-fit">
              {/* Header */}
              <div className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs font-bold text-text-muted">{formatOrderId(selectedOrder.created_at)}</span>
                  <div className="flex items-center gap-2">
                    <a href={`/order/${selectedOrder.id}`} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:text-primary-dark text-xs font-medium transition-colors">
                      Track →
                    </a>
                    <button onClick={() => setSelectedOrder(null)} className="text-text-muted hover:text-primary">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
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
                  {ALL_STATUSES.filter((s) => s !== selectedOrder.status).map((s: OrderStatus) => (
                    <button
                      key={s}
                      onClick={() => updateStatus(selectedOrder, s)}
                      disabled={updatingId === selectedOrder.id}
                      className={`w-full text-left text-xs px-3 py-2 rounded-lg font-medium transition-colors disabled:opacity-50 ${
                        s === "cancelled"
                          ? "bg-red-50 hover:bg-red-100 text-red-700"
                          : "bg-gray-50 hover:bg-primary/10 text-text-main hover:text-primary"
                      }`}
                    >
                      {updatingId === selectedOrder.id ? "Updating…" : STATUS_ACTION_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Payment proof */}
              {!!selectedOrder.metadata?.payment_proof_url && (
                <div className="card p-4">
                  <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Payment Screenshot</p>
                  <button
                    onClick={() => setLightboxUrl(selectedOrder.metadata!.payment_proof_url as string)}
                    className="w-full group relative block rounded-lg overflow-hidden border border-primary/10 hover:border-primary/30 transition-colors"
                  >
                    <img
                      src={selectedOrder.metadata.payment_proof_url as string}
                      alt="Payment proof"
                      className="w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 text-white text-xs px-2 py-1 rounded-full">
                        Click to enlarge
                      </span>
                    </div>
                  </button>
                </div>
              )}

              {/* Messages */}
              <div ref={messagesCardRef} className="card p-4">
                <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-3">
                  Messages
                  {unreadMessageCount > 0 && (
                    <span className="ml-2 bg-indigo-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {unreadMessageCount} new
                    </span>
                  )}
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto mb-3 text-xs">
                  {messages.length === 0 ? (
                    <p className="text-text-muted text-center py-2">No messages yet.</p>
                  ) : (
                    messages.map((msg) => (
                      <div key={msg.id} className={`rounded-lg px-3 py-2 ${
                        msg.sender === "admin"
                          ? "bg-primary/10 text-primary ml-4"
                          : "bg-background border border-primary/10 text-text-main mr-4"
                      }`}>
                        <p className="font-semibold mb-0.5">{msg.sender === "admin" ? "You" : "Customer"}</p>
                        <p className="leading-relaxed">{msg.body}</p>
                        <p className="text-text-muted mt-1">
                          {new Date(msg.created_at).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                    ))
                  )}
                  <div ref={messagesEndRef} />
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={(e) => setNewMsg(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAdminMessage(); } }}
                    placeholder="Reply to customer…"
                    className="input text-xs py-1.5 flex-1"
                    disabled={sendingMsg}
                  />
                  <button
                    onClick={sendAdminMessage}
                    disabled={sendingMsg || !newMsg.trim()}
                    className="btn-primary px-3 py-1.5 text-xs flex-shrink-0 disabled:opacity-50"
                  >
                    {sendingMsg ? "…" : "Send"}
                  </button>
                </div>
              </div>

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
      {/* Lightbox */}
      {lightboxUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={closeLightbox}
        >
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-9 h-9 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <img
            src={lightboxUrl}
            alt="Payment proof"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
