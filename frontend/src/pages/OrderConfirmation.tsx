import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { Order, OrderStatus } from "../types";
import { CUSTOMER_STATUS_LABELS } from "../types";

const TIMELINE_STEPS: { statuses: OrderStatus[]; label: string; icon: string }[] = [
  { statuses: ["pending"],             label: "Order Received",  icon: "📋" },
  { statuses: ["confirmed"],           label: "Payment Verified", icon: "✅" },
  { statuses: ["preparing"],           label: "Being Prepared",  icon: "👨‍🍳" },
  { statuses: ["delivered"],           label: "Delivered",       icon: "🎉" },
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
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-SG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function OrderConfirmation() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      if (!id) return;
      setLoading(true);
      try {
        const { data, error: fetchError } = await supabase
          .from("orders")
          .select("*, order_items(*, sku:skus(*))")
          .eq("id", id)
          .single();
        if (fetchError || !data) {
          setError("Order not found. Please check your order ID.");
        } else {
          setOrder(data as unknown as Order);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchOrder();

    // Real-time subscription for status updates
    if (!id) return;
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "orders",
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setOrder((prev) =>
            prev ? { ...prev, status: payload.new.status } : prev
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

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
        <h2 className="font-heading text-2xl font-semibold text-primary mb-2">
          Order Not Found
        </h2>
        <p className="text-text-muted mb-6">{error}</p>
        <Link to="/" className="btn-primary">
          Go Home
        </Link>
      </div>
    );
  }

  if (order.status === "cancelled") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <span className="text-5xl block mb-4">🚫</span>
        <h2 className="font-heading text-2xl font-semibold text-error mb-2">
          Order Cancelled
        </h2>
        <p className="text-text-muted mb-6">
          Order #{formatOrderId(order.created_at)} has been cancelled.
        </p>
        <Link to="/" className="btn-primary">
          Place a New Order
        </Link>
      </div>
    );
  }

  const currentStep = getStepIndex(order.status as OrderStatus);
  const guestName =
    order.guest_info?.name ?? "Customer";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Success banner */}
      <div className="bg-success/10 border border-success/30 rounded-card p-5 mb-6 text-center">
        <span className="text-4xl block mb-2">🎉</span>
        <h1 className="font-heading text-2xl font-bold text-success mb-1">
          Order Confirmed!
        </h1>
        <p className="text-text-muted text-sm">
          Thank you, {guestName}! We'll confirm your order once payment is verified.
        </p>
        <p className="font-mono text-xs text-text-muted mt-2 bg-white rounded px-2 py-1 inline-block">
          Order ID: {formatOrderId(order.created_at)}
        </p>
      </div>

      {/* Status Timeline */}
      <div className="card p-5 mb-6">
        <h2 className="font-heading text-lg font-semibold text-primary mb-5">
          Order Status
        </h2>

        <div className="relative">
          {/* Progress line */}
          <div className="absolute left-5 top-8 bottom-8 w-0.5 bg-primary/10" />
          <div
            className="absolute left-5 top-8 w-0.5 bg-primary transition-all duration-700"
            style={{
              height: `${(currentStep / (TIMELINE_STEPS.length - 1)) * 100}%`,
            }}
          />

          <div className="space-y-6">
            {TIMELINE_STEPS.map((step, index) => {
              const isDone = index < currentStep;
              const isCurrent = index === currentStep;

              return (
                <div key={step.label} className="flex items-center gap-4 relative">
                  {/* Step circle */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all ${
                      isDone
                        ? "bg-primary text-white"
                        : isCurrent
                        ? "bg-primary text-white ring-4 ring-primary/20"
                        : "bg-white border-2 border-primary/20 text-text-muted"
                    }`}
                  >
                    {isDone ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="text-lg">{step.icon}</span>
                    )}
                  </div>

                  <div>
                    <p
                      className={`font-semibold ${
                        isCurrent ? "text-primary" : "text-text-muted"
                      }`}
                    >
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

      {/* Order details */}
      <div className="card p-5 mb-6">
        <h2 className="font-heading text-lg font-semibold text-primary mb-4">
          Delivery Details
        </h2>
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
            <span className="font-medium">PayNow · Pending verification</span>
          </div>
        </div>
      </div>

      {/* Items */}
      {order.order_items && order.order_items.length > 0 && (
        <div className="card p-5 mb-6">
          <h2 className="font-heading text-lg font-semibold text-primary mb-4">
            Items Ordered
          </h2>
          <div className="space-y-3">
            {order.order_items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-text-muted">
                  {item.sku?.name ?? "Item"}{" "}
                  <span className="font-semibold text-text-main">×{item.quantity}</span>
                </span>
                <span className="font-medium">
                  S${(item.unit_price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}
            <div className="border-t border-primary/10 pt-2 mt-1 flex justify-between">
              <span className="font-semibold">Total</span>
              <span className="font-bold text-lg text-primary">
                S${order.subtotal.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="text-center space-y-3">
        <p className="text-text-muted text-sm">
          Questions about your order?{" "}
          <a
            href="https://wa.me/6591803918"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary font-medium underline underline-offset-2"
          >
            WhatsApp us
          </a>
          {" "}with your order ID.
        </p>
        <Link to="/" className="btn-primary inline-block">
          Order More Pandesal
        </Link>
      </div>
    </div>
  );
}
