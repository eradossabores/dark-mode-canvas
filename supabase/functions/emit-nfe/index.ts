import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const NFE_API_BASE = "https://api.nfse.io/v2";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { venda_id, factory_id } = body;

    if (!venda_id || !factory_id) {
      return new Response(JSON.stringify({ error: "venda_id e factory_id são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get factory info
    const { data: factory, error: factoryError } = await supabase
      .from("factories")
      .select("emite_nfe, name, cnpj, endereco, bairro, cidade, estado, cep")
      .eq("id", factory_id)
      .single();

    if (factoryError || !factory) {
      return new Response(JSON.stringify({ error: "Fábrica não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!factory.emite_nfe) {
      return new Response(JSON.stringify({ error: "Emissão de NF desativada para esta fábrica" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get NF-e secrets from factory_secrets table
    const { data: secrets } = await supabase
      .from("factory_secrets")
      .select("nfe_api_key, nfe_company_id")
      .eq("factory_id", factory_id)
      .single();

    if (!secrets?.nfe_api_key || !secrets?.nfe_company_id) {
      return new Response(JSON.stringify({ error: "API Key ou Company ID do NFE.io não configurados" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get sale data with items and client
    const { data: venda, error: vendaError } = await supabase
      .from("vendas")
      .select("*, clientes(*), venda_itens(*, sabores(nome))")
      .eq("id", venda_id)
      .single();

    if (vendaError || !venda) {
      return new Response(JSON.stringify({ error: "Venda não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if NF already exists for this sale
    const { data: existingNf } = await supabase
      .from("notas_fiscais")
      .select("id, status")
      .eq("venda_id", venda_id)
      .in("status", ["processando", "autorizada"])
      .maybeSingle();

    if (existingNf) {
      return new Response(JSON.stringify({ error: "Já existe uma NF emitida ou em processamento para esta venda", nf_id: existingNf.id }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cliente = venda.clientes;
    const itens = venda.venda_itens || [];

    function mapPaymentMethod(forma: string) {
      switch (forma?.toLowerCase()) {
        case "pix": return "InstantPayment";
        case "especie": case "dinheiro": return "Cash";
        case "cartao_credito": return "CreditCard";
        case "cartao_debito": return "DebitCard";
        case "boleto": return "BankBill";
        case "transferencia": return "WireTransfer";
        default: return "Others";
      }
    }

    const nfePayload = {
      operationNature: "Venda de mercadoria",
      operationType: "Outgoing",
      destination: "Internal_Operation",
      printType: "NFeNormalPortrait",
      purposeType: "Normal",
      consumerType: cliente?.cpf_cnpj && cliente.cpf_cnpj.replace(/\D/g, "").length === 14
        ? "Normal"
        : "FinalConsumer",
      presenceType: "Presence",
      buyer: {
        name: cliente?.nome || "Consumidor",
        federalTaxNumber: cliente?.cpf_cnpj
          ? parseInt(cliente.cpf_cnpj.replace(/\D/g, ""), 10)
          : null,
        email: cliente?.email || null,
        address: {
          state: cliente?.estado || factory.estado || "SP",
          city: { name: cliente?.cidade || factory.cidade || "" },
          district: cliente?.bairro || "",
          street: cliente?.endereco || "",
          number: "S/N",
          postalCode: cliente?.cep?.replace(/\D/g, "") || "",
          country: "BRA",
        },
        phone: cliente?.telefone || null,
        type: cliente?.cpf_cnpj && cliente.cpf_cnpj.replace(/\D/g, "").length === 14
          ? "LegalEntity"
          : "NaturalPerson",
        stateTaxNumberIndicator: "NonTaxPayer",
      },
      items: itens.map((item: any, idx: number) => ({
        code: item.sabor_id?.substring(0, 8) || `GELO-${idx + 1}`,
        description: `Gelo - ${item.sabores?.nome || "Sabor"}`,
        quantity: item.quantidade,
        unitAmount: item.preco_unitario,
        amount: item.subtotal,
        taxObject: "InformedWithICMS",
        ncm: "22011000",
        cest: "",
        cfop: "5102",
        unitOfMeasure: "UN",
        taxes: {
          icms: { cst: "00", origin: "National", bcAmount: item.subtotal, rate: 0, amount: 0 },
          pis: { cst: "07" },
          cofins: { cst: "07" },
        },
      })),
      payment: [{ paymentDetail: [{ method: mapPaymentMethod(venda.forma_pagamento), amount: venda.total }] }],
      transport: { freightModality: "Free" },
    };

    const { data: nfRecord, error: nfInsertError } = await supabase
      .from("notas_fiscais")
      .insert({
        factory_id,
        venda_id,
        status: "processando",
        valor_total: venda.total,
        cliente_nome: cliente?.nome || "Consumidor",
        cliente_cpf_cnpj: cliente?.cpf_cnpj || null,
      })
      .select()
      .single();

    if (nfInsertError) {
      return new Response(JSON.stringify({ error: "Erro ao criar registro da NF" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      const nfeResponse = await fetch(
        `${NFE_API_BASE}/companies/${secrets.nfe_company_id}/productinvoices`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: secrets.nfe_api_key,
          },
          body: JSON.stringify(nfePayload),
        }
      );

      const nfeResult = await nfeResponse.json();

      if (!nfeResponse.ok) {
        await supabase
          .from("notas_fiscais")
          .update({
            status: "erro",
            erro_mensagem: nfeResult?.message || nfeResult?.error || JSON.stringify(nfeResult).substring(0, 500),
          })
          .eq("id", nfRecord.id);

        return new Response(
          JSON.stringify({ error: "Erro ao emitir NF no NFE.io", details: nfeResult?.message || nfeResult?.error, nf_id: nfRecord.id }),
          { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await supabase
        .from("notas_fiscais")
        .update({
          nfe_io_id: nfeResult.id || null,
          numero: nfeResult.number?.toString() || null,
          serie: nfeResult.serie?.toString() || null,
          chave_acesso: nfeResult.accessKey || null,
          status: nfeResult.flowStatus === "Issued" ? "autorizada" : "processando",
        })
        .eq("id", nfRecord.id);

      if (nfeResult.number) {
        await supabase
          .from("vendas")
          .update({ numero_nf: nfeResult.number.toString() })
          .eq("id", venda_id);
      }

      return new Response(
        JSON.stringify({ success: true, nf_id: nfRecord.id, nfe_io_id: nfeResult.id, status: nfeResult.flowStatus || "processando", numero: nfeResult.number || null }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (apiError: any) {
      await supabase
        .from("notas_fiscais")
        .update({ status: "erro", erro_mensagem: apiError.message || "Erro de conexão com NFE.io" })
        .eq("id", nfRecord.id);

      return new Response(
        JSON.stringify({ error: "Falha na comunicação com NFE.io", details: apiError.message, nf_id: nfRecord.id }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
