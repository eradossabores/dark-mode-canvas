import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCors } from "../_shared/cors.ts";

Deno.serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;
  const corsHeaders = getCorsHeaders(req);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is super_admin
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check caller is super_admin
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["super_admin"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas super administradores podem criar fábricas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, password, nome, factory_name } = await req.json();

    if (!email || !password || !nome || !factory_name) {
      return new Response(JSON.stringify({ error: "Campos obrigatórios faltando" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create the user
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create the factory
    const { data: factory, error: factoryError } = await adminClient
      .from("factories")
      .insert({
        name: factory_name,
        owner_id: newUser.user.id,
      })
      .select()
      .single();

    if (factoryError) {
      // Cleanup: delete the user if factory creation fails
      await adminClient.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: factoryError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Assign factory_owner role with factory_id
    const { error: roleError } = await adminClient
      .from("user_roles")
      .insert({
        user_id: newUser.user.id,
        role: "factory_owner",
        factory_id: factory.id,
      });

    if (roleError) {
      return new Response(JSON.stringify({ error: roleError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create subscription (30 days trial)
    const { error: subError } = await adminClient
      .from("subscriptions")
      .insert({
        factory_id: factory.id,
        status: "trial",
        trial_start: new Date().toISOString(),
        amount: 99.90,
      });

    if (subError) {
      return new Response(JSON.stringify({ error: subError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Update profile with factory_id
    await adminClient
      .from("profiles")
      .update({ factory_id: factory.id })
      .eq("id", newUser.user.id);

    return new Response(JSON.stringify({
      success: true,
      user_id: newUser.user.id,
      factory_id: factory.id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
