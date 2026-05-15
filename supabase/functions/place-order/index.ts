import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://ledbythebread.onrender.com",
  "http://localhost:5173",
  "http://localhost:4173",
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin)
      ? origin
      : "https://ledbythebread.onrender.com",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

interface OrderItem {
  sku_id: string;
  quantity: number;
  unit_price: number;
}

interface PlaceOrderPayload {
  customer_id?: string;
  guest_info?: { name: string; phone: string; email: string };
  delivery_address: string;
  lat?: number;
  lng?: number;
  delivery_date: string;
  slot_type: "morning" | "evening";
  items: OrderItem[];
  metadata?: { payment_proof_url?: string };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  const headers = corsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PlaceOrderPayload = await req.json();

    if (!payload.items || payload.items.length === 0) {
      return error("No items in order", 400, headers);
    }

    if (!payload.delivery_date || !payload.slot_type) {
      return error("delivery_date and slot_type are required", 400, headers);
    }

    if (!payload.delivery_address) {
      return error("delivery_address is required", 400, headers);
    }

    if (!payload.customer_id) {
      if (!payload.guest_info?.name || !payload.guest_info?.phone || !payload.guest_info?.email) {
        return error("guest_info (name, phone, email) is required for guest orders", 400, headers);
      }
    }

    // Require and validate payment proof URL
    const proofUrl = payload.metadata?.payment_proof_url;
    if (!proofUrl) {
      return error("Payment proof is required.", 400, headers);
    }
    const expectedStorageBase = `${supabaseUrl}/storage/v1/object/public/payment-proofs/`;
    if (!proofUrl.startsWith(expectedStorageBase)) {
      return error("Invalid payment proof URL.", 400, headers);
    }

    const subtotal = payload.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

    // Per-product minimum quantity
    const skuIds = payload.items.map((i) => i.sku_id);
    const { data: skuRows } = await supabase.from("skus").select("id, min_qty").in("id", skuIds);
    for (const item of payload.items) {
      const productMin = (skuRows as { id: string; min_qty: number }[] | null)?.find((s) => s.id === item.sku_id)?.min_qty ?? 1;
      if (item.quantity < productMin) {
        return error(`Minimum order for this item is ${productMin} sets.`, 400, headers);
      }
    }

    // Store minimum order value
    const { data: settingsRows } = await supabase.from("admin_settings").select("key, value")
      .in("key", ["store_min_order_value", "store_min_order_value_enabled"]);
    const minOrderValueEnabled = settingsRows?.find((s: { key: string }) => s.key === "store_min_order_value_enabled")?.value === "true";
    if (minOrderValueEnabled) {
      const minOrderValue = parseFloat(settingsRows?.find((s: { key: string }) => s.key === "store_min_order_value")?.value ?? "0") || 0;
      if (subtotal < minOrderValue) {
        return error(`Minimum order value is S$${minOrderValue.toFixed(2)}.`, 400, headers);
      }
    }

    // Delivery slot
    const { data: slot, error: slotError } = await supabase.from("delivery_slots")
      .select("*, zone:delivery_zones(*)")
      .eq("delivery_date", payload.delivery_date).eq("slot_type", payload.slot_type).single();
    if (slotError || !slot) return error("Delivery slot not found", 404, headers);
    if (!slot.is_open) return error("This delivery slot is closed", 400, headers);
    if (slot.current_orders >= slot.max_orders) return error("This delivery slot is fully booked", 400, headers);

    // Delivery zone check
    if (slot.zone && payload.lat != null && payload.lng != null) {
      const dist = haversineKm(payload.lat, payload.lng, slot.zone.center_lat, slot.zone.center_lng);
      if (dist > slot.zone.radius_km) {
        return error("Delivery is not available to your address for this slot.", 400, headers);
      }
    }

    // Cut-off time
    const { data: cutoffResult } = await supabase.rpc("get_slot_cutoff", {
      p_delivery_date: payload.delivery_date,
      p_slot_type: payload.slot_type,
      p_cut_off_override: slot.cut_off_override ?? null,
    });
    const cutoffTime = cutoffResult ? new Date(cutoffResult) : null;
    if (cutoffTime && new Date() > cutoffTime) {
      return error(`Order cut-off for this slot has passed.`, 400, headers);
    }

    // Insert order
    const { data: order, error: orderError } = await supabase.from("orders").insert({
      customer_id: payload.customer_id ?? null,
      guest_info: payload.guest_info ?? null,
      delivery_address: payload.delivery_address,
      lat: payload.lat ?? null,
      lng: payload.lng ?? null,
      delivery_date: payload.delivery_date,
      slot_type: payload.slot_type,
      subtotal,
      status: "pending",
      metadata: { payment_proof_url: proofUrl },
    }).select().single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);
      return error("Failed to create order: " + orderError?.message, 500, headers);
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      payload.items.map((item) => ({
        order_id: order.id,
        sku_id: item.sku_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))
    );

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      console.error("Order items insert error:", itemsError);
      return error("Failed to create order items: " + itemsError.message, 500, headers);
    }

    const { error: incrementError } = await supabase.rpc("increment_slot_orders", {
      p_delivery_date: payload.delivery_date,
      p_slot_type: payload.slot_type,
    });

    if (incrementError) {
      await supabase.from("orders").delete().eq("id", order.id);
      console.error("Slot increment error:", incrementError);
      return error("Failed to reserve slot: " + incrementError.message, 500, headers);
    }

    return new Response(JSON.stringify({ success: true, order_id: order.id, order }), {
      status: 201,
      headers: { ...headers, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return error("Internal server error", 500, headers);
  }
});

function error(message: string, status: number, headers: Record<string, string>): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
