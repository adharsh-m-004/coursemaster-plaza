// @ts-nocheck
// Supabase Edge Function: create_random_meet
// Generates a random Jitsi meeting link and returns it.
// No external auth or calendar required.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

// CORS helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function safeSlug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
}

function generateRoom(bookingId?: string): string {
  const rand = crypto.randomUUID().slice(0, 8);
  const base = bookingId ? `booking-${safeSlug(bookingId.slice(0, 12))}` : "session";
  return `coursemaster-${base}-${rand}`;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const booking_id: string | undefined = body?.booking_id;

    const room = generateRoom(booking_id);
    const link = `https://meet.jit.si/${room}`;

    return new Response(JSON.stringify({ link }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message || "Unexpected error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
