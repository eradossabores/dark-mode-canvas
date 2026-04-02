import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Settings, Save, Loader2, Package, MapPin, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import ConfigVendasSection from "@/components/configurar/ConfigVendasSection";
import { formatCep, isValidCep, normalizeCep } from "@/lib/cep";

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

  // Saco config
  const [usaSacos, setUsaSacos] = useState(false);
  const [unidadesPorSaco, setUnidadesPorSaco] = useState(50);
  const [estoqueSacos, setEstoqueSacos] = useState(0);
  const [savingSacos, setSavingSacos] = useState(false);
  const [loadingSacos, setLoadingSacos] = useState(true);

  // Address config
  const [address, setAddress] = useState<FactoryAddress>({ endereco: "", bairro: "", cidade: "", estado: "SP", cep: "", cnpj: "", latitude: null, longitude: null });
  const [loadingAddr, setLoadingAddr] = useState(true);
  const [savingAddr, setSavingAddr] = useState(false);
  const [fetchingCep, setFetchingCep] = useState(false);

  // Partners/Sócios
  const [partners, setPartners] = useState<any[]>([]);
  const [loadingPartners, setLoadingPartners] = useState(true);

  useEffect(() => {
    loadReceitas();
    loadSacosConfig();
    loadAddress();
    loadPartners();
  }, [factoryId]);

  async function loadPartners() {
    if (!factoryId) { setLoadingPartners(false); return; }
    setLoadingPartners(true);
    try {
      // Get all users with roles for this factory (owners/admins)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("factory_id", factoryId)
        .in("role", ["factory_owner", "admin"]);

      if (!roles || roles.length === 0) { setPartners([]); setLoadingPartners(false); return; }

      const userIds = roles.map(r => r.user_id);
      
      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, nome, email")
        .in("id", userIds);

      // Get last session for each user
      const { data: sessions } = await supabase
        .from("user_sessions")
        .select("user_id, last_seen_at")
        .in("user_id", userIds)
        .order("last_seen_at", { ascending: false });

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
        setAddress({
          endereco: data.endereco || "",
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
    if (!isValidCep(cleanCep)) {
      return;
    }

    setFetchingCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (!data.erro) {
        const newAddr = {
          ...address,
          cep: formatCep(cleanCep),
          endereco: data.logradouro || address.endereco,
          bairro: data.bairro || address.bairro,
          cidade: data.localidade || address.cidade,
          estado: data.uf || address.estado,
        };
        setAddress(newAddr);

        try {
          const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${newAddr.cidade}, ${newAddr.estado}, Brasil`)}&format=json&limit=1`);
          const geoData = await geoRes.json();
          if (geoData.length > 0) {
            setAddress(prev => ({ ...prev, latitude: parseFloat(geoData[0].lat), longitude: parseFloat(geoData[0].lon) }));
          }
        } catch {
        }

        toast({ title: "CEP encontrado!", description: `${data.localidade} - ${data.uf}` });
      } else {
        toast({ title: "CEP não encontrado", description: "Verifique o CEP digitado.", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("CEP lookup error:", err);
      toast({ title: "Erro ao buscar CEP", description: "Tente novamente em alguns segundos.", variant: "destructive" });
    }
    setFetchingCep(false);
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
      await (supabase as any).from("factories").update({
        endereco: address.endereco || null,
        bairro: address.bairro || null,
        cidade: address.cidade || null,
        estado: address.estado || null,
        cep: cleanCep || null,
        cnpj: address.cnpj || null,
        latitude: address.latitude,
        longitude: address.longitude,
      }).eq("id", factoryId);
      setAddress((prev) => ({ ...prev, cep: cleanCep ? formatCep(cleanCep) : "" }));
      toast({ title: "Endereço salvo com sucesso!" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSavingAddr(false);
  }

  function formatCnpj(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 14);
    return digits
      .replace(/^(\d{2})(\d)/, "$1.$2")
      .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2")
      .replace(/(\d{4})(\d)/, "$1-$2");
  }

  async function loadSacosConfig() {
    if (!factoryId) { setLoadingSacos(false); return; }
    setLoadingSacos(true);
    try {
      const { data: factory } = await (supabase as any)
        .from("factories").select("usa_sacos, unidades_por_saco").eq("id", factoryId).single();
      if (factory) {
        setUsaSacos(factory.usa_sacos || false);
        setUnidadesPorSaco(factory.unidades_por_saco || 50);
      }
      const { data: estoque } = await (supabase as any)
        .from("estoque_sacos").select("quantidade").eq("factory_id", factoryId).single();
      setEstoqueSacos(estoque?.quantidade || 0);
    } catch { /* ignore */ }
    setLoadingSacos(false);
  }

  async function handleSaveSacos() {
    if (!factoryId) return;
    setSavingSacos(true);
    try {
      await (supabase as any).from("factories").update({
        usa_sacos: usaSacos,
        unidades_por_saco: unidadesPorSaco,
      }).eq("id", factoryId);

      // Upsert estoque_sacos
      const { data: existing } = await (supabase as any)
        .from("estoque_sacos").select("id").eq("factory_id", factoryId).single();
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
      const { data, error } = await (supabase as any)
        .from("sabor_receita")
        .select("*, sabores(nome)")
        .eq("factory_id", factoryId);
      if (error) throw error;
      const list = (data || []).map((r: any) => ({
        id: r.id,
        sabor_nome: r.sabores?.nome || "?",
        gelos_por_lote: r.gelos_por_lote,
        quantidade_insumo_por_lote: r.quantidade_insumo_por_lote,
      }));
      setReceitas(list);
      const first = list[0];
      setConfig({
        gelos_por_lote: first?.gelos_por_lote || 84,
      });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoadingRec(false);
    }
  }

  async function handleSaveReceitas() {
    setSavingRec(true);
    try {
      for (const r of receitas) {
        const { error } = await (supabase as any)
          .from("sabor_receita")
          .update({
            gelos_por_lote: config.gelos_por_lote,
            quantidade_insumo_por_lote: r.quantidade_insumo_por_lote,
            embalagens_por_lote: config.gelos_por_lote,
          })
          .eq("id", r.id);
        if (error) throw error;
      }
      toast({ title: `✅ Configurações de produção salvas!` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setSavingRec(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Settings className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Configurar Fábrica</h1>
      </div>

      <Tabs defaultValue="vendas" className="space-y-4">
        <TabsList>
          <TabsTrigger value="vendas">💰 Preços</TabsTrigger>
          <TabsTrigger value="producao">⚙️ Produção</TabsTrigger>
          <TabsTrigger value="sacos">📦 Sacos</TabsTrigger>
          <TabsTrigger value="endereco">📍 Endereço / CNPJ</TabsTrigger>
          
        </TabsList>

        <TabsContent value="vendas">
          <ConfigVendasSection factoryId={factoryId} />
        </TabsContent>

        <TabsContent value="producao">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configuração de Produção
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure a quantidade de gelos e matéria-prima por lote para cada sabor.
                As embalagens são descontadas automaticamente (1 por gelo).
              </p>
            </CardHeader>
            <CardContent>
              {loadingRec ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando receitas...
                </div>
              ) : receitas.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma receita cadastrada. Cadastre sabores primeiro.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Seção 1: Definição do Lote */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">⚙️</span>
                      <h3 className="font-semibold text-sm">Definição do Lote</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Quantas unidades (gelos) a máquina produz em cada lote.
                    </p>
                    <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                      <span className="text-sm font-medium whitespace-nowrap">1 Lote =</span>
                      <Input
                        type="number"
                        min={1}
                        className="h-9 text-center text-sm w-24 font-bold"
                        value={config.gelos_por_lote}
                        onChange={(e) => setConfig(prev => ({ ...prev, gelos_por_lote: Number(e.target.value) }))}
                      />
                      <span className="text-sm text-muted-foreground whitespace-nowrap">unidades</span>
                    </div>
                  </div>

                  {/* Seção 2: Matéria-Prima por Lote (por sabor) */}
                  <div className="rounded-lg border p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🧪</span>
                      <h3 className="font-semibold text-sm">Matéria-Prima por Lote</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Configure a quantidade de insumo (g ou kg) por lote para cada sabor individualmente.
                    </p>
                    <div className="space-y-2">
                      {receitas.map((r, idx) => (
                        <div key={r.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                          <span className="font-medium text-sm truncate max-w-[180px]">{r.sabor_nome}</span>
                          <div className="flex items-center gap-1">
                            <Input
                              type="number"
                              min={0}
                              step={10}
                              className="h-9 text-center text-sm w-24 font-bold"
                              value={r.quantidade_insumo_por_lote}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setReceitas(prev => prev.map((rec, i) => i === idx ? { ...rec, quantidade_insumo_por_lote: val } : rec));
                              }}
                            />
                            <span className="text-xs text-muted-foreground">{r.quantidade_insumo_por_lote >= 1000 ? "g (kg)" : "g"}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resumo */}
                  <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                    <p className="text-xs text-muted-foreground">
                      📋 <strong>Resumo:</strong> 1 lote = <strong>{config.gelos_por_lote} unidades</strong>. 
                      Embalagens: <strong>{config.gelos_por_lote}</strong> por lote (1 por unidade).
                      Cada sabor tem sua própria configuração de matéria-prima.
                    </p>
                  </div>

                  <Button className="w-full" onClick={handleSaveReceitas} disabled={savingRec}>
                    {savingRec ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Salvar Configurações</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sacos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Configuração de Sacos para Estoque
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Configure se sua fábrica utiliza sacos para armazenar gelos antes da venda.
                Se ativado, na hora da venda você poderá escolher vender por pacote (saco) ou por unidade.
              </p>
            </CardHeader>
            <CardContent>
              {loadingSacos ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Toggle usa sacos */}
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label className="text-sm font-medium">Usar sacos para estoque</Label>
                      <p className="text-xs text-muted-foreground">
                        Ative se sua fábrica armazena gelos dentro de sacos para venda em pacotes.
                      </p>
                    </div>
                    <Switch checked={usaSacos} onCheckedChange={setUsaSacos} />
                  </div>

                  {usaSacos && (
                    <>
                      {/* Unidades por saco */}
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">📦</span>
                          <h3 className="font-semibold text-sm">Unidades por Saco</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Quantas unidades de gelo cabem dentro de cada saco.
                        </p>
                        <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                          <span className="text-sm font-medium whitespace-nowrap">1 Saco =</span>
                          <Input
                            type="number"
                            min={1}
                            className="h-9 text-center text-sm w-24 font-bold"
                            value={unidadesPorSaco}
                            onChange={(e) => setUnidadesPorSaco(Number(e.target.value))}
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">unidades</span>
                        </div>
                      </div>

                      {/* Estoque atual de sacos */}
                      <div className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🧮</span>
                          <h3 className="font-semibold text-sm">Estoque Atual de Sacos</h3>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Quantidade de sacos disponíveis no estoque.
                        </p>
                        <div className="flex items-center gap-3 bg-muted/50 rounded-lg p-3">
                          <Input
                            type="number"
                            min={0}
                            className="h-9 text-center text-sm w-24 font-bold"
                            value={estoqueSacos}
                            onChange={(e) => setEstoqueSacos(Number(e.target.value))}
                          />
                          <span className="text-sm text-muted-foreground whitespace-nowrap">sacos</span>
                        </div>
                      </div>

                      {/* Resumo */}
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                        <p className="text-xs text-muted-foreground">
                          📋 <strong>Resumo:</strong> {estoqueSacos} sacos × {unidadesPorSaco} unidades = <strong>{estoqueSacos * unidadesPorSaco} unidades</strong> em sacos.
                          Na venda, ao selecionar "Pacote", o sistema descontará 1 saco + {unidadesPorSaco} unidades do estoque.
                        </p>
                      </div>
                    </>
                  )}

                  <Button className="w-full" onClick={handleSaveSacos} disabled={savingSacos}>
                    {savingSacos ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Salvar Configuração de Sacos</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endereco">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                Endereço e CNPJ da Fábrica
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Preencha o CEP para buscar o endereço automaticamente. As coordenadas do mapa serão ajustadas para a cidade.
              </p>
            </CardHeader>
            <CardContent>
              {loadingAddr ? (
                <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                </div>
              ) : (
                <div className="space-y-4">
                  {/* CNPJ */}
                  <div>
                    <Label>CNPJ</Label>
                    <Input
                      placeholder="00.000.000/0000-00"
                      value={address.cnpj}
                      onChange={(e) => setAddress({ ...address, cnpj: formatCnpj(e.target.value) })}
                      maxLength={18}
                    />
                  </div>

                  {/* CEP with auto-fill */}
                  <div>
                    <Label>CEP</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="00000-000"
                        value={address.cep}
                        onChange={(e) => {
                          const formatted = formatCep(e.target.value);
                          setAddress({ ...address, cep: formatted });
                          if (formatted.replace(/\D/g, "").length === 8) {
                            handleCepLookup(formatted);
                          }
                        }}
                        maxLength={9}
                      />
                      {fetchingCep && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mt-2" />}
                    </div>
                  </div>

                  {/* Address fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Endereço (Rua/Logradouro)</Label>
                      <Input
                        placeholder="Rua Exemplo, 123"
                        value={address.endereco}
                        onChange={(e) => setAddress({ ...address, endereco: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Bairro</Label>
                      <Input
                        placeholder="Centro"
                        value={address.bairro}
                        onChange={(e) => setAddress({ ...address, bairro: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Cidade</Label>
                      <Input
                        placeholder="São Paulo"
                        value={address.cidade}
                        onChange={(e) => setAddress({ ...address, cidade: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Estado (UF)</Label>
                      <Input
                        placeholder="SP"
                        value={address.estado}
                        onChange={(e) => setAddress({ ...address, estado: e.target.value.toUpperCase().slice(0, 2) })}
                        maxLength={2}
                      />
                    </div>
                  </div>

                  {/* Coordinates info */}
                  {address.latitude && address.longitude && (
                    <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                      <p className="text-xs text-muted-foreground">
                        📍 <strong>Coordenadas detectadas:</strong> {address.latitude.toFixed(4)}, {address.longitude.toFixed(4)} — O mapa será centralizado nesta localização.
                      </p>
                    </div>
                  )}

                  <Button className="w-full" onClick={handleSaveAddress} disabled={savingAddr}>
                    {savingAddr ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</>
                    ) : (
                      <><Save className="h-4 w-4 mr-2" /> Salvar Endereço</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
