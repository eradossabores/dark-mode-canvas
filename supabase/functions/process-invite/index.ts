import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const { token, user_id } = await req.json();

    if (!token || !user_id) {
      return new Response(JSON.stringify({ error: "Token e user_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Find valid invite
    const { data: invite, error: inviteError } = await adminClient
      .from("invites")
      .select("*")
      .eq("token", token)
      .is("used_by", null)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();

    if (inviteError || !invite) {
      return new Response(JSON.stringify({ error: "Convite inválido ou expirado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get factory_id from the invite creator
    const { data: creatorRole } = await adminClient
      .from("user_roles")
      .select("factory_id")
      .eq("user_id", invite.created_by)
      .maybeSingle();

    const factoryId = creatorRole?.factory_id || null;

    // Assign role WITH factory_id
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({ user_id, role: invite.role, factory_id: factoryId });

    if (roleError) {
      console.error("Role insert error:", roleError);
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with factory_id
    await adminClient
      .from("profiles")
      .update({ factory_id: factoryId })
      .eq("id", user_id);

    // Mark invite as used
    await adminClient
      .from("invites")
      .update({ used_by: user_id, used_at: new Date().toISOString() })
      .eq("id", invite.id);

    // Confirm user email automatically
    await adminClient.auth.admin.updateUserById(user_id, { email_confirm: true });

    return new Response(JSON.stringify({ success: true, role: invite.role }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
