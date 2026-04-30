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
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas super administradores podem resetar fábricas" }), {
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

    // Operational data to wipe (preserves factory, users, roles, sabores, materias_primas, embalagens, clientes, funcionarios, config)
    const tables = [
      "abatimentos_historico",
      "venda_parcelas",
      "venda_itens",
      "vendas",
      "pedido_producao_itens",
      "pedidos_producao",
      "producao_funcionarios",
      "producoes",
      "decisoes_producao",
      "movimentacoes_estoque",
      "avarias",
      "presenca_producao",
      "auditoria",
      "followup_mensagens",
      "prospecto_visitas",
      "prospectos",
      "pedidos_publicos",
      "contas_a_pagar",
    ];

    const results: Record<string, string> = {};
    for (const table of tables) {
      const { error } = await adminClient.from(table).delete().eq("factory_id", factory_id);
      results[table] = error ? `erro: ${error.message}` : "ok";
    }

    // Zera estoques (mantém os registros, apenas zera quantidades)
    await adminClient.from("estoque_gelos").update({ quantidade: 0 }).eq("factory_id", factory_id);
    await adminClient.from("estoque_freezer").update({ quantidade: 0 }).eq("factory_id", factory_id);
    await adminClient.from("materias_primas").update({ estoque_atual: 0 }).eq("factory_id", factory_id);
    await adminClient.from("embalagens").update({ estoque_atual: 0 }).eq("factory_id", factory_id);

    // Zera última compra dos clientes
    await adminClient.from("clientes").update({ ultima_compra: null }).eq("factory_id", factory_id);

    // Audit log
    await adminClient.from("auditoria").insert({
      factory_id,
      modulo: "super_admin",
      acao: "resetar_fabrica",
      usuario_nome: caller.email || "super_admin",
      descricao: `Fábrica resetada por super admin (${caller.email}). Dados operacionais zerados.`,
    });

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});