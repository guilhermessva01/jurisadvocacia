import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get today's date in Brasilia timezone
    const now = new Date();
    const brasiliaOffset = -3 * 60;
    const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
    const brasiliaDate = new Date(utcMs + brasiliaOffset * 60000);
    const todayStr = brasiliaDate.toISOString().slice(0, 10);

    // Find all users who have an "entrada" today but no corresponding "saida"
    const { data: todayRecords } = await supabase
      .from("time_records")
      .select("id, user_id, record_type, record_time")
      .eq("record_date", todayStr)
      .order("created_at", { ascending: true });

    if (!todayRecords || todayRecords.length === 0) {
      return new Response(JSON.stringify({ message: "No records today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Track open entries per user
    const userStatus: Record<string, boolean> = {};
    for (const r of todayRecords) {
      if (r.record_type === "entrada") {
        userStatus[r.user_id] = true; // has open entry
      } else if (r.record_type === "saida") {
        userStatus[r.user_id] = false; // closed
      }
    }

    const usersToClose = Object.entries(userStatus)
      .filter(([, isOpen]) => isOpen)
      .map(([uid]) => uid);

    if (usersToClose.length === 0) {
      return new Response(JSON.stringify({ message: "No open punches to close" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert auto-close records at 23:59
    const inserts = usersToClose.map((uid) => ({
      user_id: uid,
      record_date: todayStr,
      record_time: "23:59:00",
      record_type: "saida",
      location_status: "auto",
      outside_reason: "Encerramento automático - horas não contabilizadas",
      is_late: false,
      late_minutes: 0,
    }));

    const { error } = await supabase.from("time_records").insert(inserts);

    if (error) {
      console.error("Error auto-closing punches:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ message: `Auto-closed ${usersToClose.length} punches` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Auto-close error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
