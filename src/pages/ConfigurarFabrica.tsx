import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Save, Loader2, Package, MapPin, Users, DollarSign, Cog, Building2, Search, FileText, Eye, EyeOff, CheckCircle, XCircle, AlertTriangle, RefreshCw, CheckCircle2, Circle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ConfigVendasSection from "@/components/configurar/ConfigVendasSection";
import ConfigPrecoSaborSection from "@/components/configurar/ConfigPrecoSaborSection";
import ConfigGeloCuboSection from "@/components/configurar/ConfigGeloCuboSection";
import { formatCep, isValidCep, normalizeCep } from "@/lib/cep";
import { geocodeClienteAddress } from "@/lib/geocoding";

interface ReceitaRaw {
  id: string;
  sabor_nome: string;
  gelos_por_lote: number;
  quantidade_insumo_por_lote: number;
}

interface ConfigGeral {
  gelos_por_lote: number;
}

const ESTADOS_BR = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"
];

interface FactoryAddress {
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
  cnpj: string;
  latitude: number | null;
  longitude: number | null;
}

export default function ConfigurarFabrica() {
  const { factoryId } = useAuth();
  const [receitas, setReceitas] = useState<ReceitaRaw[]>([]);
  const [config, setConfig] = useState<ConfigGeral>({ gelos_por_lote: 84 });
  const [loadingRec, setLoadingRec] = useState(true);
  const [savingRec, setSavingRec] = useState(false);

  const [usaSacos, setUsaSacos] = useState(false);
  const [unidadesPorSaco, setUnidadesPorSaco] = useState(50);
  const [estoqueSacos, setEstoqueSacos] = useState(0);
  const [savingSacos, setSavingSacos] = useState(false);
  const [loadingSacos, setLoadingSacos] = useState(true);

  const [address, setAddress] = useState<FactoryAddress>({ endereco: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "SP", cep: "", cnpj: "", latitude: null, longitude: null });
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [savingAddr, setSavingAddr] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  const [partners, setPartners] = useState<any[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);

  const [emiteNfe, setEmiteNfe] = useState(false);
  const [nfeApiKey, setNfeApiKey] = useState("");
  const [nfeCompanyId, setNfeCompanyId] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [loadingNfe, setLoadingNfe] = useState(true);
  const [savingNfe, setSavingNfe] = useState(false);
  const [nfEmitidas, setNfEmitidas] = useState<any[]>([]);

  function updateAddressText(field: keyof FactoryAddress, value: string) {
    setAddress((prev) => ({ ...prev, [field]: value }));
  }

  // ── Setup progress ──
  const setupStatus = useMemo(() => {
    const checks = [
      { label: "Receitas", ok: receitas.length > 0, icon: "🧪" },
      { label: "CEP", ok: !!address.cep && isValidCep(normalizeCep(address.cep)), icon: "📍" },
      { label: "CNPJ", ok: !!address.cnpj && address.cnpj.replace(/\D/g, "").length === 14, icon: "🏢" },
      { label: "Coordenadas", ok: address.latitude != null && address.longitude != null, icon: "🗺️" },
    ];
    const done = checks.filter(c => c.ok).length;
    return { checks, done, total: checks.length, percent: Math.round((done / checks.length) * 100) };
  }, [receitas, address]);

  useEffect(() => {
    loadReceitas();
    loadSacosConfig();
    loadAddress();
    loadPartners();
    loadNfeConfig();
  }, [factoryId]);

  async function loadPartners() {
    if (!factoryId) { setLoadingPartners(false); return; }
    setLoadingPartners(true);
    try {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("factory_id", factoryId)
        .in("role", ["factory_owner", "admin"]);

      if (!roles || roles.length === 0) { setPartners([]); setLoadingPartners(false); return; }

      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, nome, email").in("id", userIds);
      const { data: sessions } = await supabase.from("user_sessions").select("user_id, last_seen_at").in("user_id", userIds).order("last_seen_at", { ascending: false });

      const partnerList = roles.map(r => {
        const profile = profiles?.find(p => p.id === r.user_id);
        const lastSession = sessions?.find(s => s.user_id === r.user_id);
        return {
          user_id: r.user_id,
          role: r.role,
          nome: profile?.nome || "Sem nome",
          email: profile?.email || "",
          last_seen: lastSession?.last_seen_at || null,
        };
      });
      setPartners(partnerList);
    } catch (err) {
      console.error("Erro ao carregar sócios:", err);
    } finally {
      setLoadingPartners(false);
    }
  }

  async function loadAddress() {
    if (!factoryId) { setLoadingAddr(false); return; }
    setLoadingAddr(true);
    try {
      const { data } = await (supabase as any)
        .from("factories")
        .select("endereco, bairro, cidade, estado, cep, cnpj, latitude, longitude")
        .eq("id", factoryId)
        .single();
      if (data) {
        const endParts = (data.endereco || "").match(/^(.+?),\s*(\d+\S*)\s*(?:-\s*(.+))?$/) || [];
        setAddress({
          endereco: endParts[1] || data.endereco || "",
          numero: endParts[2] || "",
          complemento: endParts[3] || "",
          bairro: data.bairro || "",
          cidade: data.cidade || "",
          estado: data.estado || "SP",
          cep: data.cep || "",
          cnpj: data.cnpj || "",
          latitude: data.latitude,
          longitude: data.longitude,
        });
      }
    } catch { /* ignore */ }
    setLoadingAddr(false);
  }

  async function handleCepLookup(cep: string) {
    const cleanCep = normalizeCep(cep);
    if (!isValidCep(cleanCep)) return;
    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (!data.erro) {
        const newAddr = { ...address, cep: formatCep(cleanCep), endereco: data.logradouro || address.endereco, bairro: data.bairro || address.bairro, cidade: data.localidade || address.cidade, estado: data.uf || address.estado, latitude: null as number | null, longitude: null as number | null };
        try {
          const coords = await geocodeFullAddress(newAddr);
          setAddress({ ...newAddr, latitude: coords?.lat ?? null, longitude: coords?.lng ?? null });
        } catch { setAddress(newAddr); }
        toast({ title: "CEP encontrado!", description: `${data.localidade} - ${data.uf}` });
      } else {
        toast({ title: "CEP não encontrado", description: "Verifique o CEP digitado.", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro ao buscar CEP", description: "Tente novamente.", variant: "destructive" });
    }
    setFetchingCep(false);
  }

  async function geocodeFullAddress(addr: FactoryAddress): Promise<{ lat: number; lng: number } | null> {
    const enderecoCompleto = [addr.endereco?.trim(), addr.numero?.trim()].filter(Boolean).join(", ");
    if (!enderecoCompleto) return null;
    try {
      return await geocodeClienteAddress({ endereco: enderecoCompleto, bairro: addr.bairro, cidade: addr.cidade, estado: addr.estado });
    } catch { return null; }
  }

  async function handleSaveAddress() {
    if (!factoryId) return;
    const cleanCep = normalizeCep(address.cep);
    if (cleanCep && !isValidCep(cleanCep)) {
      toast({ title: "CEP inválido", description: "Informe um CEP com 8 dígitos válidos.", variant: "destructive" });
      return;
    }
    setSavingAddr(true);
    try {
      let fullEndereco = address.endereco;
      if (address.numero) fullEndereco += `, ${address.numero}`;
      if (address.complemento) fullEndereco += ` - ${address.complemento}`;
      const coords = await geocodeFullAddress(address);
      const lat = coords?.lat ?? null;
      const lng = coords?.lng ?? null;
      await (supabase as any).from("factories").update({
        endereco: fullEndereco || null, bairro: address.bairro || null, cidade: address.cidade || null,
        estado: address.estado || null, cep: cleanCep || null, cnpj: address.cnpj || null, latitude: lat, longitude: lng,
      }).eq("id", factoryId);
      setAddress((prev) => ({ ...prev, cep: cleanCep ? formatCep(cleanCep) : "", latitude: lat, longitude: lng }));
      toast({ title: "Endereço salvo com sucesso!", description: lat != null && lng != null ? `📍 Coordenadas: ${lat.toFixed(4)}, ${lng.toFixed(4)}` : "Endereço salvo, coordenadas não localizadas." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSavingAddr(false);
  }

  function formatCnpj(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3").replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  }

  async function loadSacosConfig() {
    if (!factoryId) { setLoadingSacos(false); return; }
    setLoadingSacos(true);
    try {
      const { data: factory } = await (supabase as any).from("factories").select("usa_sacos, unidades_por_saco").eq("id", factoryId).single();
      if (factory) { setUsaSacos(factory.usa_sacos || false); setUnidadesPorSaco(factory.unidades_por_saco || 50); }
      const { data: estoque } = await (supabase as any).from("estoque_sacos").select("quantidade").eq("factory_id", factoryId).single();
      setEstoqueSacos(estoque?.quantidade || 0);
    } catch { /* ignore */ }
    setLoadingSacos(false);
  }

  async function handleSaveSacos() {
    if (!factoryId) return;
    setSavingSacos(true);
    try {
      await (supabase as any).from("factories").update({ usa_sacos: usaSacos, unidades_por_saco: unidadesPorSaco }).eq("id", factoryId);
      const { data: existing } = await (supabase as any).from("estoque_sacos").select("id").eq("factory_id", factoryId).single();
      if (existing) {
        await (supabase as any).from("estoque_sacos").update({ quantidade: estoqueSacos }).eq("factory_id", factoryId);
      } else {
        await (supabase as any).from("estoque_sacos").insert({ factory_id: factoryId, quantidade: estoqueSacos });
      }
      toast({ title: "✅ Configuração de sacos salva!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingSacos(false);
  }

  async function loadReceitas() {
    if (!factoryId) { setLoadingRec(false); return; }
    setLoadingRec(true);
    try {
      const { data, error } = await (supabase as any).from("sabor_receita").select("*, sabores(nome)").eq("factory_id", factoryId);
      if (error) throw error;
      const list = (data || []).map((r: any) => ({ id: r.id, sabor_nome: r.sabores?.nome || "?", gelos_por_lote: r.gelos_por_lote, quantidade_insumo_por_lote: r.quantidade_insumo_por_lote }));
      setReceitas(list);
      setConfig({ gelos_por_lote: list[0]?.gelos_por_lote || 84 });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setLoadingRec(false); }
  }

  async function handleSaveReceitas() {
    setSavingRec(true);
    try {
      for (const r of receitas) {
        const { error } = await (supabase as any).from("sabor_receita").update({ gelos_por_lote: config.gelos_por_lote, quantidade_insumo_por_lote: r.quantidade_insumo_por_lote, embalagens_por_lote: config.gelos_por_lote }).eq("id", r.id);
        if (error) throw error;
      }
      toast({ title: "✅ Configurações de produção salvas!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally { setSavingRec(false); }
  }

  async function loadNfeConfig() {
    if (!factoryId) { setLoadingNfe(false); return; }
    setLoadingNfe(true);
    try {
      const { data: factoryData } = await (supabase as any)
        .from("factories")
        .select("emite_nfe")
        .eq("id", factoryId)
        .single();
      if (factoryData) {
        setEmiteNfe(factoryData.emite_nfe || false);
      }
      const { data: secretsData } = await (supabase as any)
        .from("factory_secrets")
        .select("nfe_api_key, nfe_company_id")
        .eq("factory_id", factoryId)
        .maybeSingle();
      if (secretsData) {
        setNfeApiKey(secretsData.nfe_api_key || "");
        setNfeCompanyId(secretsData.nfe_company_id || "");
      }
      const { data: nfs } = await (supabase as any)
        .from("notas_fiscais")
        .select("*")
        .eq("factory_id", factoryId)
        .order("created_at", { ascending: false })
        .limit(20);
      setNfEmitidas(nfs || []);
    } catch { /* ignore */ }
    setLoadingNfe(false);
  }

  async function handleSaveNfe() {
    if (!factoryId) return;
    setSavingNfe(true);
    try {
      await (supabase as any).from("factories").update({
        emite_nfe: emiteNfe,
      }).eq("id", factoryId);
      await (supabase as any).from("factory_secrets").upsert({
        factory_id: factoryId,
        nfe_api_key: nfeApiKey || null,
        nfe_company_id: nfeCompanyId || null,
      }, { onConflict: "factory_id" });
      toast({ title: "✅ Configuração de NF-e salva!" });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
    setSavingNfe(false);
  }

  async function handleCheckNfStatus(nfId: string) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/check-nfe-status`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ nf_id: nfId }),
        }
      );
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erro ao consultar");
      toast({ title: "Status atualizado", description: `Status: ${result.status}` });
      loadNfeConfig();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  function getNfStatusBadge(status: string) {
    switch (status) {
      case "autorizada":
        return <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400"><CheckCircle className="h-3 w-3" />Autorizada</span>;
      case "processando":
        return <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400"><RefreshCw className="h-3 w-3 animate-spin" />Processando</span>;
      case "cancelada":
        return <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"><XCircle className="h-3 w-3" />Cancelada</span>;
      case "erro":
        return <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive"><AlertTriangle className="h-3 w-3" />Erro</span>;
      default:
        return <span className="text-xs text-muted-foreground">{status}</span>;
    }
  }

  const isLoading = loadingRec || loadingAddr;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* ── Header ── */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
            <Settings className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Configurar Fábrica</h1>
            <p className="text-sm text-muted-foreground">Gerencie preços, produção, estoque e dados da sua fábrica</p>
          </div>
        </div>
      </div>

      {/* ── Barra de Progresso de Setup ── */}
      {!isLoading && setupStatus.percent < 100 && (
        <Card className="border border-primary/20 bg-primary/5 shadow-sm">
          <CardContent className="pt-5 pb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">🚀</span>
                <span className="text-sm font-semibold">Setup da Fábrica</span>
              </div>
              <Badge variant="outline" className="text-xs font-bold">
                {setupStatus.done}/{setupStatus.total} concluído
              </Badge>
            </div>
            <Progress value={setupStatus.percent} className="h-2" />
            <div className="flex flex-wrap gap-3">
              {setupStatus.checks.map(c => (
                <div key={c.label} className="flex items-center gap-1.5 text-xs">
                  {c.ok
                    ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                    : <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                  <span className={c.ok ? "text-muted-foreground line-through" : "font-medium"}>{c.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Cards de Status Rápido ── */}
      {!isLoading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {setupStatus.checks.map(c => (
            <div key={c.label} className={`rounded-xl border p-3 flex items-center gap-3 transition-colors ${c.ok ? "bg-emerald-500/5 border-emerald-500/20" : "bg-muted/30 border-border"}`}>
              <span className="text-lg">{c.icon}</span>
              <div className="min-w-0">
                <p className="text-xs font-medium truncate">{c.label}</p>
                <p className={`text-[11px] ${c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"}`}>
                  {c.ok ? "✓ Configurado" : "Pendente"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Abas Reorganizadas ── */}
      <Tabs defaultValue="vendas" className="space-y-6">
        {/* Grupo: Operacional */}
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Operacional</p>
          <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1">
            <TabsTrigger value="vendas" className="gap-1.5 text-xs sm:text-sm py-2.5">
              <DollarSign className="h-4 w-4" />
              <span>Preços</span>
            </TabsTrigger>
            <TabsTrigger value="producao" className="gap-1.5 text-xs sm:text-sm py-2.5">
              <Cog className="h-4 w-4" />
              <span>Produção</span>
            </TabsTrigger>
            <TabsTrigger value="sacos" className="gap-1.5 text-xs sm:text-sm py-2.5">
              <Package className="h-4 w-4" />
              <span>Sacos</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Grupo: Dados da Empresa */}
        <div className="space-y-2 -mt-2">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Dados da Empresa</p>
          <TabsList className="grid w-full grid-cols-3 h-auto gap-1 p-1">
            <TabsTrigger value="endereco" className="gap-1.5 text-xs sm:text-sm py-2.5">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Endereço</span>
              <span className="sm:hidden">End.</span>
            </TabsTrigger>
            <TabsTrigger value="equipe" className="gap-1.5 text-xs sm:text-sm py-2.5">
              <Users className="h-4 w-4" />
              <span>Equipe</span>
            </TabsTrigger>
            <TabsTrigger value="nfe" className="gap-1.5 text-xs sm:text-sm py-2.5">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Nota Fiscal</span>
              <span className="sm:hidden">NF-e</span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* ═══════ PREÇOS ═══════ */}
        <TabsContent value="vendas" className="space-y-6">
          <ConfigVendasSection factoryId={factoryId} />
          <ConfigPrecoSaborSection factoryId={factoryId} />
          <ConfigGeloCuboSection factoryId={factoryId} />
        </TabsContent>

        {/* ═══════ PRODUÇÃO ═══════ */}
        <TabsContent value="producao">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                  <Cog className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Configuração de Produção</CardTitle>
                  <CardDescription>Quantidade de gelos e matéria-prima por lote para cada sabor</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {loadingRec ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando receitas...
                </div>
              ) : receitas.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Cog className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhuma receita cadastrada. Cadastre sabores primeiro.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Definição do Lote */}
                  <div className="rounded-xl border bg-card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10">
                        <span className="text-base">⚙️</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Definição do Lote</h3>
                        <p className="text-xs text-muted-foreground">Quantas unidades a máquina produz em cada lote</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-4">
                      <span className="text-sm font-medium whitespace-nowrap">1 Lote =</span>
                      <Input
                        type="number"
                        min={1}
                        className="h-10 text-center w-28 font-bold text-lg"
                        value={config.gelos_por_lote}
                        onChange={(e) => setConfig(prev => ({ ...prev, gelos_por_lote: Number(e.target.value) }))}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">unidades</span>
                    </div>
                  </div>

                  {/* Matéria-Prima por Lote */}
                  <div className="rounded-xl border bg-card p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10">
                        <span className="text-base">🧪</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Matéria-Prima por Lote</h3>
                        <p className="text-xs text-muted-foreground">Quantidade de insumo (g) por lote para cada sabor</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {receitas.map((r, idx) => (
                        <div key={r.id} className="flex items-center justify-between bg-muted/40 hover:bg-muted/60 transition-colors rounded-lg px-4 py-3">
                          <span className="font-medium text-sm truncate max-w-[200px]">{r.sabor_nome}</span>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={0}
                              step={10}
                              className="h-9 text-center w-24 font-bold"
                              value={r.quantidade_insumo_por_lote}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setReceitas(prev => prev.map((rec, i) => i === idx ? { ...rec, quantidade_insumo_por_lote: val } : rec));
                              }}
                            />
                            <span className="text-xs text-muted-foreground w-10">{r.quantidade_insumo_por_lote >= 1000 ? "g (kg)" : "g"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resumo */}
                  <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
                    <span className="text-lg mt-0.5">📋</span>
                    <div className="text-sm text-muted-foreground">
                      <strong>Resumo:</strong> 1 lote = <strong>{config.gelos_por_lote} unidades</strong>. 
                      Embalagens: <strong>{config.gelos_por_lote}</strong> por lote (1 por unidade).
                    </div>
                  </div>

                  <Button className="w-full sm:w-auto" size="lg" onClick={handleSaveReceitas} disabled={savingRec}>
                    {savingRec ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Salvar Configurações</>}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ SACOS ═══════ */}
        <TabsContent value="sacos">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Configuração de Sacos</CardTitle>
                  <CardDescription>Configure se sua fábrica utiliza sacos para armazenar gelos antes da venda</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {loadingSacos ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between rounded-xl border p-5 bg-card">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Usar sacos para estoque</Label>
                      <p className="text-sm text-muted-foreground">Na venda você poderá escolher vender por pacote ou unidade</p>
                    </div>
                    <Switch checked={usaSacos} onCheckedChange={setUsaSacos} />
                  </div>

                  {usaSacos && (
                    <div className="space-y-5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-xl border bg-card p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-blue-500/10">
                              <Package className="h-4 w-4 text-blue-500" />
                            </div>
                            <h3 className="font-semibold text-sm">Unidades por Saco</h3>
                          </div>
                          <p className="text-xs text-muted-foreground">Quantas unidades de gelo cabem em cada saco</p>
                          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                            <span className="text-sm font-medium">1 Saco =</span>
                            <Input type="number" min={1} className="h-9 text-center w-24 font-bold" value={unidadesPorSaco} onChange={(e) => setUnidadesPorSaco(Number(e.target.value))} />
                            <span className="text-sm text-muted-foreground">und</span>
                          </div>
                        </div>

                        <div className="rounded-xl border bg-card p-5 space-y-3">
                          <div className="flex items-center gap-2">
                            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10">
                              <span className="text-sm">🧮</span>
                            </div>
                            <h3 className="font-semibold text-sm">Estoque Atual</h3>
                          </div>
                          <p className="text-xs text-muted-foreground">Quantidade de sacos disponíveis</p>
                          <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                            <Input type="number" min={0} className="h-9 text-center w-24 font-bold" value={estoqueSacos} onChange={(e) => setEstoqueSacos(Number(e.target.value))} />
                            <span className="text-sm text-muted-foreground">sacos</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
                        <span className="text-lg mt-0.5">📋</span>
                        <div className="text-sm text-muted-foreground">
                          <strong>Resumo:</strong> {estoqueSacos} sacos × {unidadesPorSaco} und = <strong>{estoqueSacos * unidadesPorSaco} unidades</strong> em sacos
                        </div>
                      </div>
                    </div>
                  )}

                  <Button className="w-full sm:w-auto" size="lg" onClick={handleSaveSacos} disabled={savingSacos}>
                    {savingSacos ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Salvar Configuração</>}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ ENDEREÇO ═══════ */}
        <TabsContent value="endereco">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Endereço e CNPJ</CardTitle>
                  <CardDescription>Preencha o CEP para buscar automaticamente. As coordenadas serão ajustadas para o mapa.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {loadingAddr ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* CNPJ + CEP */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">CNPJ</Label>
                      <Input placeholder="00.000.000/0000-00" value={address.cnpj} onChange={(e) => setAddress({ ...address, cnpj: formatCnpj(e.target.value) })} maxLength={18} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">CEP</Label>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Input
                            placeholder="00000-000"
                            value={address.cep}
                            onChange={(e) => {
                              const formatted = formatCep(e.target.value);
                              updateAddressText("cep", formatted);
                              if (formatted.replace(/\D/g, "").length === 8) handleCepLookup(formatted);
                            }}
                            maxLength={9}
                          />
                          {fetchingCep && (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          )}
                        </div>
                        <Button variant="outline" size="icon" className="shrink-0" onClick={() => handleCepLookup(address.cep)} disabled={fetchingCep}>
                          <Search className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Rua + Número + Complemento */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_100px_160px] gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Rua / Logradouro</Label>
                      <Input placeholder="Rua Exemplo" value={address.endereco} onChange={(e) => updateAddressText("endereco", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Nº</Label>
                      <Input placeholder="123" value={address.numero} onChange={(e) => updateAddressText("numero", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Complemento</Label>
                      <Input placeholder="Sala 2, Galpão" value={address.complemento} onChange={(e) => updateAddressText("complemento", e.target.value)} />
                    </div>
                  </div>

                  {/* Bairro + Cidade + Estado */}
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_90px] gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Bairro</Label>
                      <Input placeholder="Centro" value={address.bairro} onChange={(e) => updateAddressText("bairro", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">Cidade</Label>
                      <Input placeholder="São Paulo" value={address.cidade} onChange={(e) => updateAddressText("cidade", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">UF</Label>
                      <Select value={address.estado} onValueChange={(v) => updateAddressText("estado", v)}>
                        <SelectTrigger><SelectValue placeholder="UF" /></SelectTrigger>
                        <SelectContent>
                          {ESTADOS_BR.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Coordenadas */}
                  <div className="rounded-xl border bg-muted/30 p-5 space-y-4">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      <h3 className="font-semibold text-sm">Coordenadas do Mapa</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">Ajuste manualmente para posicionar a fábrica no ponto exato</p>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Latitude</Label>
                        <Input type="number" step="0.0000001" placeholder="Ex: 2.8400" value={address.latitude ?? ""} onChange={(e) => setAddress((prev) => ({ ...prev, latitude: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Longitude</Label>
                        <Input type="number" step="0.0000001" placeholder="Ex: -60.7524" value={address.longitude ?? ""} onChange={(e) => setAddress((prev) => ({ ...prev, longitude: e.target.value ? Number(e.target.value) : null }))} />
                      </div>
                    </div>
                    {address.latitude && address.longitude ? (
                      <Badge variant="outline" className="bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20">
                        ✅ Coordenadas: {address.latitude.toFixed(6)}, {address.longitude.toFixed(6)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
                        ⚠️ Sem coordenadas — fábrica não aparecerá no mapa
                      </Badge>
                    )}
                  </div>

                  <Button className="w-full sm:w-auto" size="lg" onClick={handleSaveAddress} disabled={savingAddr}>
                    {savingAddr ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Salvar Endereço</>}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ EQUIPE ═══════ */}
        <TabsContent value="equipe">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Equipe da Fábrica</CardTitle>
                  <CardDescription>Sócios e administradores com acesso ao sistema</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {loadingPartners ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando equipe...
                </div>
              ) : partners.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <Users className="h-10 w-10 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm text-muted-foreground">Nenhum sócio ou administrador encontrado.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {partners.map((p) => (
                    <div key={p.user_id} className="flex items-center gap-4 rounded-xl border bg-card p-4 hover:bg-muted/30 transition-colors">
                      <Avatar className="h-11 w-11">
                        <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
                          {p.nome?.substring(0, 2).toUpperCase() || "??"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm truncate">{p.nome}</span>
                          <Badge variant={p.role === "factory_owner" ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                            {p.role === "factory_owner" ? "Dono" : "Admin"}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{p.email}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {p.last_seen ? (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1 justify-end">
                              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-xs text-muted-foreground">Último acesso</span>
                            </div>
                            <p className="text-xs font-medium">
                              {formatDistanceToNow(new Date(p.last_seen), { addSuffix: true, locale: ptBR })}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Nunca acessou</span>
                        )}
                      </div>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    A gestão de sócios é realizada pelo administrador do sistema.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ NOTA FISCAL ═══════ */}
        <TabsContent value="nfe">
          <Card className="border-0 shadow-lg">
            <CardHeader className="pb-4">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10">
                  <FileText className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-lg">Nota Fiscal Eletrônica (NF-e)</CardTitle>
                  <CardDescription>Configure a emissão automática de notas fiscais via NFE.io</CardDescription>
                </div>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="pt-6">
              {loadingNfe ? (
                <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" /> Carregando...
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex items-center justify-between rounded-xl border p-5 bg-card">
                    <div className="space-y-1">
                      <Label className="text-base font-medium">Emitir NF-e automaticamente</Label>
                      <p className="text-sm text-muted-foreground">Ao finalizar uma venda, a nota fiscal será emitida automaticamente via NFE.io</p>
                    </div>
                    <Switch checked={emiteNfe} onCheckedChange={setEmiteNfe} />
                  </div>

                  {emiteNfe && (
                    <div className="space-y-5 animate-in fade-in-0 slide-in-from-top-2 duration-300">
                      <div className="rounded-xl border bg-card p-5 space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
                            <span className="text-base">🔑</span>
                          </div>
                          <h3 className="font-semibold text-sm">Credenciais NFE.io</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Obtenha sua API Key e Company ID no painel do{" "}
                          <a href="https://app.nfe.io" target="_blank" rel="noopener noreferrer" className="text-primary underline">NFE.io</a>
                        </p>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">API Key</Label>
                            <div className="relative">
                              <Input
                                type={showApiKey ? "text" : "password"}
                                placeholder="Sua API Key do NFE.io"
                                value={nfeApiKey}
                                onChange={(e) => setNfeApiKey(e.target.value)}
                                className="pr-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowApiKey(!showApiKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Company ID</Label>
                            <Input
                              placeholder="ID da empresa no NFE.io"
                              value={nfeCompanyId}
                              onChange={(e) => setNfeCompanyId(e.target.value)}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
                        <span className="text-lg mt-0.5">📋</span>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p><strong>Como funciona:</strong></p>
                          <ul className="list-disc pl-4 space-y-0.5">
                            <li>Ao finalizar uma venda, a NF-e é emitida automaticamente</li>
                            <li>O NCM padrão utilizado é 22011000 (Gelo)</li>
                            <li>CFOP padrão: 5102 (Venda de mercadoria)</li>
                            <li>O processamento é assíncrono no NFE.io</li>
                            <li>Certifique-se que o CNPJ e certificado digital estão configurados no NFE.io</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button className="w-full sm:w-auto" size="lg" onClick={handleSaveNfe} disabled={savingNfe}>
                    {savingNfe ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : <><Save className="h-4 w-4 mr-2" /> Salvar Configuração</>}
                  </Button>

                  {nfEmitidas.length > 0 && (
                    <div className="space-y-3 pt-4 border-t">
                      <h3 className="font-semibold text-sm">Últimas NF-e Emitidas</h3>
                      <div className="space-y-2">
                        {nfEmitidas.map((nf) => (
                          <div key={nf.id} className="flex items-center justify-between rounded-lg border bg-card px-4 py-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                {getNfStatusBadge(nf.status)}
                                {nf.numero && <span className="text-xs text-muted-foreground">Nº {nf.numero}</span>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                {nf.cliente_nome} — R$ {Number(nf.valor_total).toFixed(2)}
                                {nf.erro_mensagem && <span className="text-destructive ml-1">| {nf.erro_mensagem}</span>}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 ml-3">
                              {nf.status === "processando" && (
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => handleCheckNfStatus(nf.id)}>
                                  <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
                                </Button>
                              )}
                              {nf.pdf_url && (
                                <a href={nf.pdf_url} target="_blank" rel="noopener noreferrer">
                                  <Button size="sm" variant="outline" className="h-7 text-xs">PDF</Button>
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
