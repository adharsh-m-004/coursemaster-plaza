// @ts-nocheck
// Supabase Edge Function: create_meeting
// Creates an immediate meeting link and returns it.
// - Tries Zoom first (Server-to-Server OAuth).
// - Falls back to a Jitsi link if Zoom isn't configured.
// Request (POST): { booking_id?: string }
// Response: { link: string, provider: 'zoom' | 'jitsi' }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function safeSlug(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/(^-|-$)/g, "");
}

function generateJitsiRoom(bookingId?: string): string {
  const rand = crypto.randomUUID().slice(0, 8);
  const base = bookingId ? `booking-${safeSlug(bookingId.slice(0, 12))}` : "session";
  return `coursemaster-${base}-${rand}`;
}

// Reads requested_start_time and requested_end_time for a booking.
// Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY function secrets.
async function fetchBookingTimes(booking_id?: string): Promise<{ start: string; end: string } | null> {
  try {
    if (!booking_id) return null;
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return null;

    const resp = await fetch(
      `${url}/rest/v1/booking_requests?id=eq.${booking_id}&select=requested_start_time,requested_end_time`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
      }
    );
    if (!resp.ok) return null;
    const rows = await resp.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row?.requested_start_time || !row?.requested_end_time) return null;
    return { start: row.requested_start_time, end: row.requested_end_time };
  } catch (_e) {
    return null;
  }
}

// Zoom: Server-to-Server OAuth token
async function getZoomAccessToken(): Promise<string | null> {
  try {
    const accountId = Deno.env.get("ZOOM_ACCOUNT_ID");
    const clientId = Deno.env.get("ZOOM_CLIENT_ID");
    const clientSecret = Deno.env.get("ZOOM_CLIENT_SECRET");
    if (!accountId || !clientId || !clientSecret) return null;

    const basic = btoa(`${clientId}:${clientSecret}`);
    const resp = await fetch(
      `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${encodeURIComponent(accountId)}`,
      {
        method: "POST",
        headers: { Authorization: `Basic ${basic}` },
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.access_token as string;
  } catch (_e) {
    return null;
  }
}

// Create a Zoom meeting, return join_url
async function createZoomMeeting(booking_id?: string): Promise<string | null> {
  const token = await getZoomAccessToken();
  if (!token) return null;

  // Determine start time and duration based on booking (fallback to now/60min)
  const times = await fetchBookingTimes(booking_id);
  const now = new Date();
  const startISO = times?.start || now.toISOString();

  let duration = 60; // minutes default
  if (times?.start && times?.end) {
    const startDate = new Date(times.start);
    const endDate = new Date(times.end);
    const diffMin = Math.max(15, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
    duration = diffMin;
  }

  const topic = "Coursemaster Session" + (booking_id ? ` #${booking_id.slice(0, 8)}` : "");
  const body = {
    topic,
    type: 2, // scheduled
    start_time: startISO, // ISO8601
    duration, // minutes
    settings: {
      join_before_host: true,
      waiting_room: false,
      approval_type: 2,
      audio: "both",
      auto_recording: "none",
    },
  } as any;

  const resp = await fetch("https://api.zoom.us/v2/users/me/meetings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    // Optional: log error body for debugging
    // const errText = await resp.text();
    // console.log("Zoom create meeting error:", errText);
    return null;
  }
  const data = await resp.json();
  return data?.join_url || null;
}

Deno.serve(async (req: Request) => {
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

    // Try Zoom first if configured correctly
    const zoomLink = await createZoomMeeting(booking_id);
    if (zoomLink) {
      return new Response(JSON.stringify({ link: zoomLink, provider: "zoom" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Fallback: Jitsi immediate meeting link
    const room = generateJitsiRoom(booking_id);
    const link = `https://meet.jit.si/${room}`;

    return new Response(JSON.stringify({ link, provider: "jitsi" }), {
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