import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, key);

    const FACTORY_ID = "00000000-0000-0000-0000-000000000001"; // MACUXI ICE
    const EMAIL = "Brendo@icetech.com";
    const PASSWORD = "Brendo@2026";
    const NOME = "Brendo";

    // check if user already exists
    const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let user = list?.users?.find((u) => (u.email ?? "").toLowerCase() === EMAIL.toLowerCase());

    if (!user) {
      const { data: created, error } = await admin.auth.admin.createUser({
        email: EMAIL,
        password: PASSWORD,
        email_confirm: true,
        user_metadata: { nome: NOME },
      });
      if (error) throw error;
      user = created.user!;
    } else {
      await admin.auth.admin.updateUserById(user.id, { password: PASSWORD, email_confirm: true });
    }

    await admin.from("profiles").upsert({
      id: user.id,
      email: EMAIL,
      nome: NOME,
      factory_id: FACTORY_ID,
      must_change_password: true,
    });

    // remove any prior role of this user, then insert auxiliar_externo
    await admin.from("user_roles").delete().eq("user_id", user.id);
    const { error: rerr } = await admin
      .from("user_roles")
      .insert({ user_id: user.id, role: "auxiliar_externo", factory_id: FACTORY_ID });
    if (rerr) throw rerr;

    return new Response(
      JSON.stringify({ ok: true, user_id: user.id, email: EMAIL }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});