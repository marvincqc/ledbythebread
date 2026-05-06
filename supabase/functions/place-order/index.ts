import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface OrderItem {
  sku_id: string;
  quantity: number;
  unit_price: number;
}

interface PlaceOrderPayload {
  customer_id?: string;
  guest_info?: {
    name: string;
    phone: string;
    email: string;
  };
  delivery_address: string;
  lat?: number;
  lng?: number;
  delivery_date: string; // ISO date string YYYY-MM-DD
  slot_type: "morning" | "evening";
  items: OrderItem[];
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role client for atomic operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: PlaceOrderPayload = await req.json();

    // ---- VALIDATION ----

    // 1. Require at least one item
    if (!payload.items || payload.items.length === 0) {
      return errorResponse("No items in order", 400);
    }

    // 2. Validate required fields
    if (!payload.delivery_date || !payload.slot_type) {
      return errorResponse("delivery_date and slot_type are required", 400);
    }

    if (!payload.delivery_address) {
      return errorResponse("delivery_address is required", 400);
    }

    // 3. Guest info required if no customer_id
    if (!payload.customer_id) {
      if (
        !payload.guest_info?.name ||
        !payload.guest_info?.phone ||
        !payload.guest_info?.email
      ) {
        return errorResponse(
          "guest_info (name, phone, email) is required for guest orders",
          400
        );
      }
    }

    // 4. Compute subtotal
    const subtotal = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );

    // 5. Check min_order_amount setting
    const { data: settingRow } = await supabase
      .from("admin_settings")
      .select("value")
      .eq("key", "min_order_amount")
      .single();

    const minOrderAmount = settingRow ? parseFloat(settingRow.value) : 150;

    if (subtotal < minOrderAmount) {
      return errorResponse(
        `Minimum order amount is ₱${minOrderAmount.toFixed(2)}. Your subtotal is ₱${subtotal.toFixed(2)}.`,
        400
      );
    }

    // 6. Fetch the delivery slot
    const { data: slot, error: slotError } = await supabase
      .from("delivery_slots")
      .select("*")
      .eq("delivery_date", payload.delivery_date)
      .eq("slot_type", payload.slot_type)
      .single();

    if (slotError || !slot) {
      return errorResponse("Delivery slot not found", 404);
    }

    if (!slot.is_open) {
      return errorResponse("This delivery slot is closed", 400);
    }

    if (slot.current_orders >= slot.max_orders) {
      return errorResponse("This delivery slot is fully booked", 400);
    }

    // 7. Check cut-off time
    const { data: cutoffResult } = await supabase.rpc("get_slot_cutoff", {
      p_delivery_date: payload.delivery_date,
      p_slot_type: payload.slot_type,
      p_cut_off_override: slot.cut_off_override ?? null,
    });

    const cutoffTime = cutoffResult ? new Date(cutoffResult) : null;
    const now = new Date();

    if (cutoffTime && now > cutoffTime) {
      return errorResponse(
        `Order cut-off for this slot has passed (${cutoffTime.toLocaleString("en-PH", { timeZone: "Asia/Manila" })})`,
        400
      );
    }

    // ---- INSERT ORDER + ITEMS (atomic via transaction) ----

    // Insert order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        customer_id: payload.customer_id ?? null,
        guest_info: payload.guest_info ?? null,
        delivery_address: payload.delivery_address,
        lat: payload.lat ?? null,
        lng: payload.lng ?? null,
        delivery_date: payload.delivery_date,
        slot_type: payload.slot_type,
        subtotal: subtotal,
        status: "pending",
      })
      .select()
      .single();

    if (orderError || !order) {
      console.error("Order insert error:", orderError);
      return errorResponse("Failed to create order: " + orderError?.message, 500);
    }

    // Insert order items
    const itemsToInsert = payload.items.map((item) => ({
      order_id: order.id,
      sku_id: item.sku_id,
      quantity: item.quantity,
      unit_price: item.unit_price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(itemsToInsert);

    if (itemsError) {
      // Rollback by deleting the order
      await supabase.from("orders").delete().eq("id", order.id);
      console.error("Order items insert error:", itemsError);
      return errorResponse("Failed to create order items: " + itemsError.message, 500);
    }

    // 8. Atomically increment slot current_orders
    const { error: incrementError } = await supabase.rpc("increment_slot_orders", {
      p_delivery_date: payload.delivery_date,
      p_slot_type: payload.slot_type,
    });

    if (incrementError) {
      // Rollback by deleting the order and items (cascade)
      await supabase.from("orders").delete().eq("id", order.id);
      console.error("Slot increment error:", incrementError);
      return errorResponse(
        "Failed to reserve slot: " + incrementError.message,
        500
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        order,
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return errorResponse("Internal server error", 500);
  }
});

function errorResponse(message: string, status: number): Response {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
