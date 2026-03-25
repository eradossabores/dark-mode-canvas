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

    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .in("role", ["super_admin"])
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas super administradores podem excluir fábricas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { factory_id } = await req.json();
    if (!factory_id) {
      return new Response(JSON.stringify({ error: "factory_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get factory to find owner
    const { data: factory } = await adminClient
      .from("factories")
      .select("owner_id")
      .eq("id", factory_id)
      .single();

    if (!factory) {
      return new Response(JSON.stringify({ error: "Fábrica não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete all data linked to this factory (order matters for FK constraints)
    const tables = [
      "abatimentos_historico", "venda_parcelas", "venda_itens", "vendas",
      "pedido_producao_itens", "pedidos_producao",
      "producao_funcionarios", "producoes", "decisoes_producao",
      "movimentacoes_estoque", "estoque_gelos", "estoque_freezer",
      "avarias", "sabor_receita", "sabores",
      "cliente_preco_sabor", "cliente_tabela_preco", "clientes",
      "funcionarios", "presenca_producao",
      "materias_primas", "embalagens",
      "contas_a_pagar", "auditoria",
      "followup_mensagens", "prospecto_visitas", "prospectos",
      "pedidos_publicos", "contato_landing",
      "subscriptions",
    ];

    for (const table of tables) {
      await adminClient.from(table).delete().eq("factory_id", factory_id);
    }

    // Delete user_roles for this factory
    const { data: factoryUsers } = await adminClient
      .from("user_roles")
      .select("user_id")
      .eq("factory_id", factory_id);

    await adminClient.from("user_roles").delete().eq("factory_id", factory_id);

    // Delete profiles and auth users for this factory
    if (factoryUsers) {
      for (const u of factoryUsers) {
        await adminClient.from("profiles").delete().eq("id", u.user_id);
        await adminClient.auth.admin.deleteUser(u.user_id);
      }
    }

    // Also delete the owner
    await adminClient.from("profiles").delete().eq("id", factory.owner_id);

    // Delete factory itself
    await adminClient.from("factories").delete().eq("id", factory_id);

    // Delete owner auth user
    await adminClient.auth.admin.deleteUser(factory.owner_id);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
