import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VALID_STATUSES = new Set(["pending", "confirmed", "preparing", "delivered", "cancelled"]);
const DECREMENT_ON_CANCEL = new Set(["pending", "confirmed", "preparing"]);

interface UpdateStatusPayload {
  order_id: string;
  new_status: string;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role via JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return errorResponse("Unauthorized", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!).auth.getUser(
      token
    );

    if (authError || !user) {
      return errorResponse("Unauthorized", 401);
    }

    // Check admin role
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || profile.role !== "admin") {
      return errorResponse("Forbidden: admin access required", 403);
    }

    const payload: UpdateStatusPayload = await req.json();

    if (!payload.order_id || !payload.new_status) {
      return errorResponse("order_id and new_status are required", 400);
    }

    if (!VALID_STATUSES.has(payload.new_status)) {
      return errorResponse(`Invalid status: ${payload.new_status}`, 400);
    }

    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", payload.order_id)
      .single();

    if (fetchError || !order) {
      return errorResponse("Order not found", 404);
    }

    const currentStatus = order.status as string;
    const newStatus = payload.new_status;

    // Update order status
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", payload.order_id);

    if (updateError) {
      return errorResponse("Failed to update order: " + updateError.message, 500);
    }

    // If transitioning to cancelled and slot should be decremented
    if (newStatus === "cancelled" && currentStatus !== "cancelled" && DECREMENT_ON_CANCEL.has(currentStatus)) {
      const { error: decrementError } = await supabase.rpc(
        "decrement_slot_orders",
        {
          p_delivery_date: order.delivery_date,
          p_slot_type: order.slot_type,
        }
      );

      if (decrementError) {
        console.error("Slot decrement error:", decrementError);
        // Non-fatal: log but don't fail the status update
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: payload.order_id,
        previous_status: currentStatus,
        new_status: newStatus,
      }),
      {
        status: 200,
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
