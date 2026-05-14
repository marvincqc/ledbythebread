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

interface OrderItem {
  sku_id: string;
  quantity: number;
  unit_price: number;
}

interface AdminCreateOrderPayload {
  guest_info: { name: string; phone: string; email: string };
  delivery_address: string;
  lat?: number;
  lng?: number;
  delivery_date: string;
  slot_type: "morning" | "evening";
  items: OrderItem[];
  waitlist_entry_id?: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(req) });
  }

  const headers = corsHeaders(req);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return error("Unauthorized", 401, headers);
    }
    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await serviceClient.auth.getUser(jwt);
    if (authError || !user) {
      return error("Unauthorized", 401, headers);
    }
    const { data: profile } = await serviceClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    if (profile?.role !== "admin") {
      return error("Forbidden: admin access required", 403, headers);
    }

    const payload: AdminCreateOrderPayload = await req.json();

    if (!payload.items || payload.items.length === 0) {
      return error("No items in order", 400, headers);
    }
    if (!payload.delivery_date || !payload.slot_type) {
      return error("delivery_date and slot_type are required", 400, headers);
    }
    if (!payload.delivery_address) {
      return error("delivery_address is required", 400, headers);
    }
    if (!payload.guest_info?.name || !payload.guest_info?.phone || !payload.guest_info?.email) {
      return error("guest_info (name, phone, email) is required", 400, headers);
    }

    const subtotal = payload.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price,
      0
    );

    // Insert order — status "confirmed", capacity and cut-off intentionally bypassed
    const { data: order, error: orderError } = await serviceClient
      .from("orders")
      .insert({
        customer_id: null,
        guest_info: payload.guest_info,
        delivery_address: payload.delivery_address,
        lat: payload.lat ?? null,
        lng: payload.lng ?? null,
        delivery_date: payload.delivery_date,
        slot_type: payload.slot_type,
        subtotal,
        status: "confirmed",
        metadata: {
          created_by_admin: true,
          admin_user_id: user.id,
          waitlist_entry_id: payload.waitlist_entry_id ?? null,
        },
      })
      .select()
      .single();

    if (orderError || !order) {
      return error("Failed to create order: " + orderError?.message, 500, headers);
    }

    const { error: itemsError } = await serviceClient.from("order_items").insert(
      payload.items.map((item) => ({
        order_id: order.id,
        sku_id: item.sku_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      }))
    );

    if (itemsError) {
      await serviceClient.from("orders").delete().eq("id", order.id);
      return error("Failed to create order items: " + itemsError.message, 500, headers);
    }

    // Ensure slot record exists (admin may pick a date with no slot created yet)
    const { data: existingSlot } = await serviceClient
      .from("delivery_slots")
      .select("id")
      .eq("delivery_date", payload.delivery_date)
      .eq("slot_type", payload.slot_type)
      .single();

    if (!existingSlot) {
      await serviceClient.from("delivery_slots").insert({
        delivery_date: payload.delivery_date,
        slot_type: payload.slot_type,
        max_orders: 20,
        current_orders: 1,
        is_open: false,
      });
    } else {
      await serviceClient.rpc("increment_slot_orders", {
        p_delivery_date: payload.delivery_date,
        p_slot_type: payload.slot_type,
      });
    }

    // Remove waitlist entry if this order was created from one
    if (payload.waitlist_entry_id) {
      await serviceClient.from("slot_waitlist").delete().eq("id", payload.waitlist_entry_id);
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
