import { useEffect, useState, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Order, OrderStatus, OrderMessage } from "../types";
import { CUSTOMER_STATUS_LABELS } from "../types";
import { WHATSAPP_LINK } from "../lib/constants";

const TIMELINE_STEPS: { statuses: OrderStatus[]; label: string; icon: string }[] = [
  { statuses: ["pending"],             label: "Order Received",   icon: "📋" },
  { statuses: ["confirmed"],           label: "Payment Verified", icon: "✅" },
  { statuses: ["preparing"],           label: "Being Prepared",   icon: "👨‍🍳" },
  { statuses: ["delivered"],           label: "Delivered",        icon: "🎉" },
];

function formatOrderId(createdAt: string): string {
  const d = new Date(createdAt);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}-${String(d.getHours()).padStart(2,"0")}${String(d.getMinutes()).padStart(2,"0")}`;
}

function getStepIndex(status: OrderStatus): number {
  for (let i = 0; i < TIMELINE_STEPS.length; i++) {
    if (TIMELINE_STEPS[i].statuses.includes(status)) return i;
  }
  return 0;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-SG", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-SG", { hour: "2-digit", minute: "2-digit" });
}

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const [messages, setMessages] = useState<OrderMessage[]>([]);
  const [newMsg, setNewMsg] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  function handleCopyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  useEffect(() => {
    async function fetchOrder() {
      if (!id) return;
      setLoading(true);

      // Retry up to 4 times with 800 ms gap — handles brief read-replica lag
      // after the edge function writes to the primary DB.
      for (let attempt = 0; attempt < 4; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 800));
        try {
          const { data, error: fetchError } = await supabase
            .from("orders")
            .select("*, order_items(*, sku:skus(*))")
            .eq("id", id)
            .single();

          if (!fetchError && data) {
            setOrder(data as unknown as Order);
            setLoading(false);
            return;
          }

          // Only retry on "no rows" — not on auth or network errors
          if (fetchError?.code !== "PGRST116" || attempt === 3) {
            setError(
              fetchError?.code === "PGRST116"
                ? "Order not found. Please check your order ID."
                : "Unable to load your order. Please refresh the page."
            );
            break;
          }
        } catch {
          setError("Unable to load your order. Please refresh the page.");
          break;
        }
      }

      setLoading(false);
    }

    fetchOrder();

    if (!id) return;

    const orderChannel = supabase
      .channel(`order-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => { setOrder((prev) => prev ? { ...prev, status: payload.new.status } : prev); }
      )
      .subscribe();

    supabase.from("order_messages").select("*").eq("order_id", id).order("created_at")
      .then(({ data }) => setMessages((data ?? []) as OrderMessage[]));

    const msgChannel = supabase
      .channel(`messages-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "order_messages", filter: `order_id=eq.${id}` },
        (payload) => { setMessages((prev) => [...prev, payload.new as OrderMessage]); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Polling fallback — real-time subscriptions are unreliable for anon users
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      supabase.from("order_messages").select("*").eq("order_id", id).order("created_at")
        .then(({ data }) => { if (data) setMessages(data as OrderMessage[]); });
    }, 5000);
    return () => clearInterval(interval);
  }, [id]);

  async function sendMessage() {
    if (!newMsg.trim() || !id) return;
    setSendingMsg(true);
    await supabase.from("order_messages").insert({ order_id: id, sender: "customer", body: newMsg.trim() });
    setNewMsg("");
    setSendingMsg(false);
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 flex justify-center">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <span className="text-5xl block mb-4">❌</span>
        <h2 className="font-heading text-2xl font-semibold text-primary mb-2">Order Not Found</h2>
        <p className="text-text-muted mb-6">{error}</p>
        <Link to="/" className="btn-primary">Go Home</Link>
      </div>
    );
  }

  if (order.status === "cancelled") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <span className="text-5xl block mb-4">🚫</span>
        <h2 className="font-heading text-2xl font-semibold text-error mb-2">Order Cancelled</h2>
        <p className="text-text-muted mb-6">Order #{formatOrderId(order.created_at)} has been cancelled.</p>
        <Link to="/" className="btn-primary">Place a New Order</Link>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status as OrderStatus);
  const guestName = order.guest_info?.name ?? "Customer";
  const isPending = order.status === "pending";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Banner — wording changes based on whether payment is verified */}
      <div className={`border rounded-card p-5 mb-6 text-center ${
        isPending ? "bg-yellow-50 border-yellow-200" : "bg-success/10 border-success/30"
      }`}>
        <span className="text-4xl block mb-2">{isPending ? "📋" : "🎉"}</span>
        <h1 className={`font-heading text-2xl font-bold mb-1 ${isPending ? "text-yellow-800" : "text-success"}`}>
          {isPending ? "Order Received!" : "Order Confirmed!"}
        </h1>
        <p className="text-text-muted text-sm">
          {isPending
            ? `Thanks, ${guestName}! We'll confirm once your payment is verified.`
            : `Thank you, ${guestName}! Your order is confirmed.`}
        </p>
        <p className="font-mono text-xs text-text-muted mt-2 bg-white rounded px-2 py-1 inline-block">
          Order ID: {formatOrderId(order.created_at)}
        </p>
        <button
          onClick={handleCopyLink}
          className="mt-3 flex items-center gap-1.5 text-primary/60 hover:text-primary text-xs mx-auto transition-colors"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copy order link
            </>
          )}
        </button>
      </div>

      {/* Status Timeline */}
      <div className="card p-5 mb-6">
        <h2 className="font-heading text-lg font-semibold text-primary mb-5">Order Status</h2>
        <div className="relative">
          <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-primary/10" />
          <div
            className="absolute left-5 top-8 w-0.5 bg-primary transition-all duration-700"
            style={{ height: `${(currentStep / (TIMELINE_STEPS.length - 1)) * 100}%` }}
          />
          <div className="space-y-6">
            {TIMELINE_STEPS.map((step, index) => {
              const isDone = index < currentStep;
              const isCurrent = index === currentStep;
              return (
                <div key={step.label} className="flex items-center gap-4 relative">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all ${
                    isDone ? "bg-primary text-white"
                    : isCurrent ? "bg-primary text-white ring-4 ring-primary/20"
                    : "bg-white border-2 border-primary/20 text-text-muted"
                  }`}>
                    {isDone ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-lg">{step.icon}</span>
                    )}
                  </div>
                  <div>
                    <p className={`font-semibold ${isCurrent ? "text-primary" : "text-text-muted"}`}>
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-primary/70 mt-0.5">
                        {CUSTOMER_STATUS_LABELS[order.status as OrderStatus]}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Delivery Details */}
      <div className="card p-5 mb-6">
        <h2 className="font-heading text-lg font-semibold text-primary mb-4">Delivery Details</h2>
        <div className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-text-muted w-28 flex-shrink-0">Date</span>
            <span className="font-medium">{formatDate(order.delivery_date)}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-text-muted w-28 flex-shrink-0">Slot</span>
            <span className="font-medium capitalize">
              {order.slot_type === "morning" ? "🌅 Morning" : "🌇 Evening"}
            </span>
          </div>
          <div className="flex gap-2">
            <span className="text-text-muted w-28 flex-shrink-0">Address</span>
            <span className="font-medium">{order.delivery_address}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-text-muted w-28 flex-shrink-0">Payment</span>
            <span className="font-medium">PayNow · {isPending ? "Pending verification" : "Verified"}</span>
          </div>
        </div>
      </div>

      {/* Items */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-heading text-lg font-semibold text-primary mb-4">Items Ordered</h2>
          <div className="space-y-3">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-text-muted">
                  {item.sku?.name ?? "Item"}{" "}
                  <span className="font-semibold text-text-main">×{item.quantity}</span>
                </span>
                <span className="font-medium">S${(item.unit_price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-primary/10 pt-2 mt-1 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg text-primary">S${order.subtotal.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="card p-5 mb-6">
        <h2 className="font-heading text-lg font-semibold text-primary mb-4">Messages</h2>
        <div className="space-y-3 max-h-64 overflow-y-auto mb-4 pr-1">
          {messages.length === 0 ? (
            <p className="text-text-muted text-sm text-center py-4">
              No messages yet. Have a question? Send one below.
            </p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === "customer" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  msg.sender === "customer"
                    ? "bg-primary text-white rounded-tr-sm"
                    : "bg-background border border-primary/10 text-text-main rounded-tl-sm"
                }`}>
                  {msg.sender === "admin" && (
                    <p className="text-xs font-semibold text-primary mb-0.5">Baker</p>
                  )}
                  <p className="text-sm leading-relaxed">{msg.body}</p>
                  <p className={`text-xs mt-1 ${msg.sender === "customer" ? "text-white/60" : "text-text-muted"}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
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
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Send a message to the baker…"
            className="input flex-1 text-sm py-2"
            disabled={sendingMsg}
          />
          <button
            onClick={sendMessage}
            disabled={sendingMsg || !newMsg.trim()}
            className="btn-primary px-4 py-2 text-sm flex-shrink-0 disabled:opacity-50"
          >
            {sendingMsg ? "…" : "Send"}
          </button>
        </div>
      </div>

      <div className="text-center space-y-3">
        <p className="text-text-muted text-sm">
          Questions about your order?{" "}
          <a href={WHATSAPP_LINK} target="_blank" rel="noopener noreferrer"
            className="text-primary font-medium underline underline-offset-2">
            WhatsApp us
          </a>
          {" "}with your order ID.
        </p>
        <Link to="/" className="btn-primary inline-block">Order More Pandesal</Link>
      </div>
    </div>
  );
}
