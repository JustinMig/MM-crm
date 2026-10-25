// @ts-nocheck -- Compiled and verified by the Supabase Deno runtime.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...cors, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

const toHex = (buffer: ArrayBuffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
async function tokenHash(token: string) {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const url = new URL(req.url);
    const token = String(url.searchParams.get("token") || "").trim();
    if (!token || token.length < 20) return json({ error: "Invalid signing link." }, 400);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
    const hash = await tokenHash(token);

    const { data: request, error: requestError } = await admin
      .from("soa_signature_requests")
      .select("id,client_id,requested_by,status,request_payload,expires_at,signed_at,document_id,retention_until")
      .eq("token_hash", hash)
      .maybeSingle();

    if (requestError) return json({ error: "Unable to load signing request." }, 500);
    if (!request) return json({ error: "This signing link is invalid or no longer available." }, 404);
    if (request.status === "signed") return json({ status: "signed", signed_at: request.signed_at });
    if (request.status !== "pending") return json({ error: "This signing request is no longer active." }, 410);
    if (new Date(request.expires_at).getTime() < Date.now()) {
      await admin.from("soa_signature_requests").update({ status: "expired", updated_at: new Date().toISOString() }).eq("id", request.id);
      return json({ error: "This signing link has expired. Please contact your agent for a new link." }, 410);
    }

    const payload = request.request_payload || {};
    const appointmentDate = String(payload.appointment_date || "").trim();
    const coverageYear = Number(payload.coverage_year || 0);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate) || !coverageYear) {
      return json({ error: "This SOA is missing required appointment or coverage-year information. Please contact your agent for a corrected signing link." }, 409);
    }

    if (req.method === "GET") {
      return json({ status: "pending", request: payload, expires_at: request.expires_at });
    }

    if (req.method !== "POST") return json({ error: "Method not allowed." }, 405);
    const body = await req.json().catch(() => ({}));
    const base64 = String(body.signature_png_base64 || "").replace(/^data:image\/png;base64,/, "");
    if (!base64) return json({ error: "Signed document is required." }, 400);

    let bytes: Uint8Array;
    try {
      const binary = atob(base64);
      bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    } catch {
      return json({ error: "Signed document could not be read." }, 400);
    }
    if (!bytes.length || bytes.length > 8 * 1024 * 1024) return json({ error: "Signed document is too large." }, 400);

    const signedAt = new Date();
    const signedDate = signedAt.toISOString().slice(0, 10);
    const retainUntil = new Date(signedAt);
    retainUntil.setUTCFullYear(retainUntil.getUTCFullYear() + 10);
    const clientName = String(payload.beneficiary_name || "Client").replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "Client";
    const fileName = `Scope_of_Appointment_${clientName}_${signedDate}.png`;
    const storagePath = `${request.client_id}/${crypto.randomUUID()}-${fileName}`;

    const { error: uploadError } = await admin.storage.from("platinum-client-documents").upload(storagePath, bytes, {
      contentType: "image/png",
      upsert: false,
      cacheControl: "3600",
    });
    if (uploadError) return json({ error: uploadError.message || "Unable to save signed document." }, 500);

    const { data: document, error: docError } = await admin.from("documents").insert({
      client_id: request.client_id,
      uploaded_by: request.requested_by,
      category: "soa",
      file_name: fileName,
      storage_path: storagePath,
      mime_type: "image/png",
      file_size: bytes.length,
      document_date: signedDate,
      appointment_date: appointmentDate,
      coverage_year: coverageYear,
      signed_at: signedAt.toISOString(),
      retention_until: retainUntil.toISOString(),
      compliance_locked: true,
      notes: `Signed remotely from secure SOA link; Appointment ${appointmentDate}; Coverage Year ${coverageYear}`
    }).select("id").single();

    if (docError || !document) {
      await admin.storage.from("platinum-client-documents").remove([storagePath]);
      return json({ error: docError?.message || "Unable to save signed SOA record." }, 500);
    }

    const { error: updateError } = await admin.from("soa_signature_requests").update({
      status: "signed",
      signed_at: signedAt.toISOString(),
      document_id: document.id,
      retention_until: retainUntil.toISOString(),
      updated_at: signedAt.toISOString()
    }).eq("id", request.id).eq("status", "pending");
    if (updateError) return json({ error: "SOA was saved but request status could not be updated." }, 500);

    return json({ ok: true, status: "signed" });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unable to process Scope of Appointment." }, 500);
  }
});

