import { useEffect, useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MapContainer, TileLayer, Marker, Popup, Polyline, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import ProspectoForm from "@/components/prospeccao/ProspectoForm";
import RegistrarVisitaDialog from "@/components/prospeccao/RegistrarVisitaDialog";
import FollowUpTab from "@/components/prospeccao/FollowUpTab";
import {
  Plus, MapPin, Star, Search, ClipboardCheck, Route, BarChart3,
  Users, Target, TrendingUp, Eye, Pencil, Trash2, Phone, FileText, RefreshCw, MessageSquare,
  Navigation, Crosshair, Loader2, X,
} from "lucide-react";

// Leaflet icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const BOA_VISTA_CENTER: [number, number] = [2.8195, -60.6714];

const TIPO_LABELS: Record<string, string> = {
  bar: "🍺 Bar", tabacaria: "🚬 Tabacaria", distribuidora: "📦 Distribuidora",
  casa_noturna: "🌙 Casa Noturna", evento_buffet: "🎉 Evento/Buffet",
  restaurante_lounge: "🍽️ Restaurante", lanchonete: "🍔 Lanchonete",
  mercado: "🛒 Mercado", outro: "📍 Outro",
};

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo", visitado: "Visitado", interessado: "Interessado",
  pedido_fechado: "Pedido Fechado", retornar: "Retornar", sem_interesse: "Sem Interesse",
};

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-muted text-muted-foreground",
  visitado: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  interessado: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  pedido_fechado: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  retornar: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  sem_interesse: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

function makeIcon(color: string) {
  return new L.Icon({
    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${color}.png`,
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
    iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
  });
}

const ICONS: Record<string, L.Icon> = {
  novo: makeIcon("grey"),
  visitado: makeIcon("blue"),
  interessado: makeIcon("orange"),
  pedido_fechado: makeIcon("green"),
  retornar: makeIcon("violet"),
  sem_interesse: makeIcon("red"),
};

const EXPLORE_ICON = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
  iconSize: [30, 49], iconAnchor: [15, 49], popupAnchor: [1, -34],
});

const CLIENT_ICON = makeIcon("blue");

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({ click(e) { onMapClick(e.latlng.lat, e.latlng.lng); } });
  return null;
}

// Simple route optimization using nearest-neighbor
function optimizeRoute(points: { lat: number; lng: number; id: string }[]) {
  if (points.length <= 2) return points;
  const remaining = [...points];
  const route = [remaining.shift()!];
  while (remaining.length > 0) {
    const last = route[route.length - 1];
    let nearest = 0;
    let minDist = Infinity;
    remaining.forEach((p, i) => {
      const d = Math.sqrt((p.lat - last.lat) ** 2 + (p.lng - last.lng) ** 2);
      if (d < minDist) { minDist = d; nearest = i; }
    });
    route.push(remaining.splice(nearest, 1)[0]);
  }
  return route;
}

export default function Prospeccao() {
  const { user } = useAuth();
  const [prospectos, setProspectos] = useState<any[]>([]);
  const [visitas, setVisitas] = useState<any[]>([]);
  const [clientes, setClientes] = useState<any[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingProspecto, setEditingProspecto] = useState<any>(null);
  const [visitaDialogId, setVisitaDialogId] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterTipo, setFilterTipo] = useState("todos");
  const [filterBairro, setFilterBairro] = useState("todos");
  const [placingId, setPlacingId] = useState<string | null>(null);
  const [showRoute, setShowRoute] = useState(false);
  const followUpRef = useRef<{ loadFollowups: () => void } | null>(null);
  const [scriptView, setScriptView] = useState<string | null>(null);

  // Exploration pin state
  const [exploreMode, setExploreMode] = useState(false);
  const [explorePin, setExplorePin] = useState<{ lat: number; lng: number } | null>(null);
  const [exploreBairro, setExploreBairro] = useState<string>("");
  const [exploreLoading, setExploreLoading] = useState(false);
  const [exploreNearby, setExploreNearby] = useState<any[]>([]);
  const [exploreRoute, setExploreRoute] = useState<{ lat: number; lng: number; id: string }[]>([]);
  const [exploreRadius, setExploreRadius] = useState(2); // km
  const [quickRegisterOpen, setQuickRegisterOpen] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [p, v, c, ci] = await Promise.all([
      (supabase as any).from("prospectos").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("prospecto_visitas").select("*").order("data_visita", { ascending: false }),
      (supabase as any).from("clientes").select("id, nome, bairro, endereco, telefone, latitude, longitude, status").eq("status", "ativo"),
      (supabase as any).from("clientes").select("id, nome, bairro, endereco, telefone, latitude, longitude, status").eq("status", "inativo"),
    ]);
    setProspectos(p.data || []);
    setVisitas(v.data || []);
    setClientes([...(c.data || []), ...(ci.data || [])]);
  }

  const operador = user?.email?.split("@")[0] || "admin";

  async function handleCreateProspecto(data: any) {
    try {
      const { error } = await (supabase as any).from("prospectos").insert({ ...data, operador });
      if (error) throw error;
      toast({ title: "Prospecto cadastrado!" });
      setFormOpen(false);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleEditProspecto(data: any) {
    try {
      const { error } = await (supabase as any).from("prospectos").update(data).eq("id", editingProspecto.id);
      if (error) throw error;
      toast({ title: "Prospecto atualizado!" });
      setEditingProspecto(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Excluir este prospecto?")) return;
    await (supabase as any).from("prospectos").delete().eq("id", id);
    toast({ title: "Prospecto excluído" });
    loadData();
  }

  async function handleRegistrarVisita(data: any) {
    try {
      // Insert visit
      const { data: visitaData } = await (supabase as any).from("prospecto_visitas").insert({
        prospecto_id: visitaDialogId, ...data, operador,
      }).select().single();
      await (supabase as any).from("prospectos").update({ status: data.resultado }).eq("id", visitaDialogId);
      toast({ title: "Visita registrada!" });

      // Auto-generate follow-up for visitado/interessado
      if (["visitado", "interessado"].includes(data.resultado)) {
        const prospecto = prospectos.find(p => p.id === visitaDialogId);
        if (prospecto) {
          generateFollowUp(prospecto, visitaData || data);
        }
      }

      setVisitaDialogId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  async function generateFollowUp(prospecto: any, visita: any) {
    try {
      const { data, error } = await supabase.functions.invoke("generate-followup", {
        body: { prospecto, visita },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const { addDays, format } = await import("date-fns");
      const dataAgendada = format(addDays(new Date(), 5), "yyyy-MM-dd");
      
      await (supabase as any).from("followup_mensagens").insert({
        prospecto_id: prospecto.id,
        visita_id: visita.id || null,
        mensagem_gerada: data.mensagem,
        data_agendada: dataAgendada,
        tom: "informal",
      });
      toast({ title: "🤖 Follow-up IA gerado!", description: "Mensagem agendada para 5 dias." });
    } catch (e: any) {
      console.error("Follow-up generation failed:", e);
      // Non-blocking - don't show error toast for auto-generation
    }
  }

  async function handleMapClick(lat: number, lng: number) {
    // Explore mode: drop pin and find nearby
    if (exploreMode) {
      setExplorePin({ lat, lng });
      setExploreLoading(true);
      try {
        // Reverse geocode to get bairro
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`);
        const geo = await res.json();
        const bairro = geo?.address?.suburb || geo?.address?.neighbourhood || geo?.address?.city_district || "";
        setExploreBairro(bairro);

        // Find nearby prospectos + clients (by bairro match OR distance < radius)
        // Include ALL prospectos (even closed/rejected) as context
        const nearby: any[] = [];
        const MAX_DIST = exploreRadius * 0.01; // ~1km per 0.01 degrees

        prospectos.forEach(p => {
          const byBairro = bairro && p.bairro?.toLowerCase() === bairro.toLowerCase();
          const byDist = p.latitude && p.longitude &&
            Math.sqrt((p.latitude - lat) ** 2 + (p.longitude - lng) ** 2) < MAX_DIST;
          if (byBairro || byDist) {
            nearby.push({ ...p, _type: "prospecto" });
          }
        });

        // Include ALL clients (active + inactive for reactivation)
        clientes.forEach(c => {
          const byBairro = bairro && c.bairro?.toLowerCase() === bairro.toLowerCase();
          const byDist = c.latitude && c.longitude &&
            Math.sqrt((c.latitude - lat) ** 2 + (c.longitude - lng) ** 2) < MAX_DIST;
          if (byBairro || byDist) {
            nearby.push({ ...c, _type: c.status === "inativo" ? "cliente_inativo" : "cliente", score: c.status === "inativo" ? 2 : 5 });
          }
        });

        setExploreNearby(nearby);

        // Generate route from pin through all nearby with coordinates
        const withCoords = nearby.filter(n => n.latitude && n.longitude);
        const startPoint = { lat, lng, id: "start" };
        const points = withCoords.map(n => ({ lat: n.latitude, lng: n.longitude, id: n.id }));
        const route = optimizeRoute([startPoint, ...points]);
        setExploreRoute(route);
      } catch (e) {
        console.error("Explore error:", e);
        setExploreBairro("Não identificado");
      } finally {
        setExploreLoading(false);
      }
      return;
    }

    if (!placingId) return;
    try {
      await (supabase as any).from("prospectos").update({ latitude: lat, longitude: lng }).eq("id", placingId);
      toast({ title: "Localização salva!" });
      setPlacingId(null);
      loadData();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  function clearExplore() {
    setExploreMode(false);
    setExplorePin(null);
    setExploreBairro("");
    setExploreNearby([]);
    setExploreRoute([]);
  }

  // Filters
  const filtered = useMemo(() => {
    return prospectos.filter(p => {
      if (busca && !p.nome.toLowerCase().includes(busca.toLowerCase())) return false;
      if (filterStatus !== "todos" && p.status !== filterStatus) return false;
      if (filterTipo !== "todos" && p.tipo !== filterTipo) return false;
      if (filterBairro !== "todos" && p.bairro !== filterBairro) return false;
      return true;
    });
  }, [prospectos, busca, filterStatus, filterTipo, filterBairro]);

  const comCoordenadas = filtered.filter(p => p.latitude && p.longitude);
  const bairros = [...new Set(prospectos.map(p => p.bairro).filter(Boolean))].sort() as string[];

  // Route
  const routePoints = useMemo(() => {
    if (!showRoute) return [];
    const points = comCoordenadas
      .filter(p => p.status !== "pedido_fechado" && p.status !== "sem_interesse")
      .map(p => ({ lat: p.latitude, lng: p.longitude, id: p.id }));
    return optimizeRoute(points);
  }, [showRoute, comCoordenadas]);

  // Stats
  const stats = useMemo(() => ({
    total: prospectos.length,
    novos: prospectos.filter(p => p.status === "novo").length,
    visitados: prospectos.filter(p => p.status === "visitado").length,
    interessados: prospectos.filter(p => p.status === "interessado").length,
    fechados: prospectos.filter(p => p.status === "pedido_fechado").length,
    retornar: prospectos.filter(p => p.status === "retornar").length,
    taxaConversao: prospectos.length > 0 ? ((prospectos.filter(p => p.status === "pedido_fechado").length / prospectos.length) * 100).toFixed(1) : "0",
    totalVisitas: visitas.length,
    bairroTop: (() => {
      const map: Record<string, number> = {};
      prospectos.filter(p => p.status === "pedido_fechado").forEach(p => { map[p.bairro || "?"] = (map[p.bairro || "?"] || 0) + 1; });
      const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
      return sorted[0]?.[0] || "-";
    })(),
  }), [prospectos, visitas]);

  const visitaProspecto = prospectos.find(p => p.id === visitaDialogId);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Target className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Prospecção de Clientes</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData}><RefreshCw className="h-4 w-4" /></Button>
          <Button size="sm" onClick={() => setFormOpen(true)}><Plus className="h-4 w-4 mr-1" />Novo Prospecto</Button>
        </div>
      </div>

      <Tabs defaultValue="mapa">
        <TabsList className="mb-4">
          <TabsTrigger value="mapa" className="gap-1"><MapPin className="h-4 w-4" />Mapa</TabsTrigger>
          <TabsTrigger value="lista" className="gap-1"><Users className="h-4 w-4" />Lista</TabsTrigger>
          <TabsTrigger value="followup" className="gap-1"><MessageSquare className="h-4 w-4" />Follow-Up IA</TabsTrigger>
          <TabsTrigger value="relatorio" className="gap-1"><BarChart3 className="h-4 w-4" />Relatório</TabsTrigger>
        </TabsList>

        {/* ========= MAPA ========= */}
        <TabsContent value="mapa">
          {placingId && (
            <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 rounded-lg flex items-center justify-between">
              <p className="text-sm font-bold">📍 Clique no mapa para posicionar: {prospectos.find(p => p.id === placingId)?.nome}</p>
              <Button size="sm" variant="outline" onClick={() => setPlacingId(null)}>Cancelar</Button>
            </div>
          )}

          {exploreMode && !explorePin && (
            <div className="mb-3 p-3 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-between">
              <p className="text-sm font-bold flex items-center gap-2"><Crosshair className="h-4 w-4" /> Clique no mapa para explorar o bairro e ver potenciais clientes</p>
              <Button size="sm" variant="outline" onClick={clearExplore}>Cancelar</Button>
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-3 items-center">
            <Button
              size="sm"
              variant={exploreMode ? "default" : "outline"}
              onClick={() => { if (exploreMode) clearExplore(); else { setExploreMode(true); setPlacingId(null); } }}
            >
              <Crosshair className="h-4 w-4 mr-1" />{exploreMode ? "Sair Exploração" : "Explorar Bairro"}
            </Button>
            {exploreMode && (
              <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Raio:</span>
                <input
                  type="range"
                  min={1}
                  max={5}
                  step={0.5}
                  value={exploreRadius}
                  onChange={e => setExploreRadius(Number(e.target.value))}
                  className="w-20 h-2 accent-primary"
                />
                <span className="text-xs font-bold w-10">{exploreRadius}km</span>
              </div>
            )}
            <Button size="sm" variant={showRoute ? "default" : "outline"} onClick={() => setShowRoute(!showRoute)}>
              <Route className="h-4 w-4 mr-1" />{showRoute ? "Ocultar Rota" : "Gerar Rota"}
            </Button>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterTipo} onValueChange={setFilterTipo}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(TIPO_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className={explorePin ? "grid grid-cols-1 lg:grid-cols-3 gap-4" : ""}>
            <Card className={`overflow-hidden ${explorePin ? "lg:col-span-2" : ""}`}>
              <div style={{ height: "550px" }}>
                <MapContainer center={BOA_VISTA_CENTER} zoom={13} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
                  <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <ClickHandler onMapClick={handleMapClick} />

                  {comCoordenadas.map(p => (
                    <Marker key={p.id} position={[p.latitude, p.longitude]} icon={ICONS[p.status] || ICONS.novo}>
                      <Popup>
                        <div className="min-w-[200px] space-y-1">
                          <p className="font-bold">{p.nome}</p>
                          <p className="text-xs">{TIPO_LABELS[p.tipo] || p.tipo}</p>
                          {p.bairro && <p className="text-xs text-muted-foreground">{p.bairro}</p>}
                          {p.telefone && <p className="text-xs">📞 {p.telefone}</p>}
                          <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <span key={s} className={`text-xs ${s <= p.score ? "text-amber-400" : "text-muted-foreground/40"}`}>★</span>)}</div>
                          {p.observacoes_estrategicas && <p className="text-xs italic text-muted-foreground mt-1">{p.observacoes_estrategicas}</p>}
                          <div className="flex gap-1 mt-2 flex-wrap">
                            <button className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded" onClick={() => setVisitaDialogId(p.id)}>Registrar Visita</button>
                            <button className="text-xs bg-muted text-foreground px-2 py-1 rounded" onClick={() => { setEditingProspecto(p); }}>Editar</button>
                            <button className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded" onClick={() => setPlacingId(p.id)}>Reposicionar</button>
                          </div>
                        </div>
                      </Popup>
                    </Marker>
                  ))}

                  {/* Explore pin */}
                  {explorePin && (
                    <>
                      <Circle
                        center={[explorePin.lat, explorePin.lng]}
                        radius={exploreRadius * 1000}
                        pathOptions={{
                          color: "hsl(38, 90%, 50%)",
                          fillColor: "hsl(38, 90%, 50%)",
                          fillOpacity: 0.08,
                          weight: 2,
                          dashArray: "6 4",
                        }}
                      />
                      <Marker position={[explorePin.lat, explorePin.lng]} icon={EXPLORE_ICON}>
                        <Popup><p className="font-bold text-sm">📍 Ponto de exploração</p><p className="text-xs">{exploreBairro || "Identificando..."} · Raio: {exploreRadius}km</p></Popup>
                      </Marker>
                    </>
                  )}

                  {/* Explore route */}
                  {exploreRoute.length > 1 && (
                    <Polyline positions={exploreRoute.map(p => [p.lat, p.lng] as [number, number])} color="hsl(38,90%,50%)" weight={4} dashArray="10 5" />
                  )}

                  {showRoute && routePoints.length > 1 && !explorePin && (
                    <Polyline positions={routePoints.map(p => [p.lat, p.lng] as [number, number])} color="hsl(200,98%,39%)" weight={3} dashArray="8 4" />
                  )}
                </MapContainer>
              </div>
            </Card>

            {/* Explore results panel */}
            {explorePin && (() => {
              const ativos = exploreNearby.filter(n => n._type === "cliente");
              const inativos = exploreNearby.filter(n => n._type === "cliente_inativo");
              const prospectosAtivos = exploreNearby.filter(n => n._type === "prospecto" && !["pedido_fechado", "sem_interesse"].includes(n.status));
              const prospectosEncerrados = exploreNearby.filter(n => n._type === "prospecto" && ["pedido_fechado", "sem_interesse"].includes(n.status));
              const cobertura = ativos.length + prospectosAtivos.length;
              const oportunidade = cobertura === 0 ? "alta" : cobertura <= 2 ? "media" : "baixa";

              return (
              <Card className="lg:col-span-1 max-h-[550px] overflow-y-auto">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Navigation className="h-4 w-4 text-amber-500" />
                      {exploreLoading ? "Buscando..." : exploreBairro || "Região não identificada"}
                    </CardTitle>
                    <Button size="icon" variant="ghost" onClick={clearExplore}><X className="h-4 w-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {exploreLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : (
                    <div className="space-y-3">
                      {/* Area analysis - always shown */}
                      <div className="p-3 rounded-lg bg-muted/40 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Análise da Região</span>
                          <Badge variant={oportunidade === "alta" ? "destructive" : oportunidade === "media" ? "secondary" : "outline"} className="text-[10px]">
                            {oportunidade === "alta" ? "🔥 Oportunidade Alta" : oportunidade === "media" ? "⚡ Oportunidade Média" : "✅ Boa cobertura"}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                          <div className="bg-background rounded p-1.5">
                            <p className="text-lg font-bold text-primary">{ativos.length}</p>
                            <p className="text-[9px] text-muted-foreground">Clientes ativos</p>
                          </div>
                          <div className="bg-background rounded p-1.5">
                            <p className="text-lg font-bold">{prospectosAtivos.length}</p>
                            <p className="text-[9px] text-muted-foreground">Prospectos abertos</p>
                          </div>
                          <div className="bg-background rounded p-1.5">
                            <p className="text-lg font-bold text-amber-500">{inativos.length}</p>
                            <p className="text-[9px] text-muted-foreground">Inativos (reativar)</p>
                          </div>
                          <div className="bg-background rounded p-1.5">
                            <p className="text-lg font-bold text-muted-foreground">{prospectosEncerrados.length}</p>
                            <p className="text-[9px] text-muted-foreground">Já visitados</p>
                          </div>
                        </div>
                        {oportunidade === "alta" && (
                          <p className="text-[10px] text-destructive font-medium">📍 Região sem cobertura! Ideal para prospectar novos clientes.</p>
                        )}
                        {oportunidade === "media" && (
                          <p className="text-[10px] text-amber-600 font-medium">⚡ Região com pouca cobertura. Há espaço para crescimento.</p>
                        )}
                      </div>

                      {/* Quick register - always prominent */}
                      <Button size="sm" className="w-full" onClick={() => setQuickRegisterOpen(true)}>
                        <Plus className="h-4 w-4 mr-1" />Cadastrar Prospecto {exploreBairro ? `em ${exploreBairro}` : "Aqui"}
                      </Button>

                      {/* Inactive clients for reactivation */}
                      {inativos.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-600">🔄 Reativar ({inativos.length})</p>
                          {inativos.map((n: any) => (
                            <div key={n.id} className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/30 space-y-1">
                              <p className="text-sm font-medium">{n.nome}</p>
                              {n.telefone && <p className="text-[10px] text-muted-foreground">📞 {n.telefone}</p>}
                              {n.telefone && (
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" asChild>
                                  <a href={`tel:${n.telefone}`}><Phone className="h-3 w-3 mr-1" />Ligar</a>
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Active prospects */}
                      {prospectosAtivos.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Prospectos em andamento ({prospectosAtivos.length})</p>
                          {prospectosAtivos.map((n: any, i: number) => (
                            <div key={n.id} className="p-2 rounded-lg bg-muted/50 space-y-1">
                              <div className="flex items-center justify-between">
                                <div>
                                  <p className="text-sm font-medium">{n.nome}</p>
                                  <p className="text-[10px] text-muted-foreground">{TIPO_LABELS[n.tipo] || n.tipo}{n.bairro && ` · ${n.bairro}`}</p>
                                </div>
                                <span className={`px-1.5 py-0.5 rounded text-[9px] font-medium ${STATUS_COLORS[n.status]}`}>
                                  {STATUS_LABELS[n.status]}
                                </span>
                              </div>
                              {n.telefone && <p className="text-[10px] text-muted-foreground">📞 {n.telefone}</p>}
                              <div className="flex gap-1 mt-1">
                                <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setVisitaDialogId(n.id)}>
                                  <ClipboardCheck className="h-3 w-3 mr-1" />Visitar
                                </Button>
                                {n.telefone && (
                                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" asChild>
                                    <a href={`tel:${n.telefone}`}><Phone className="h-3 w-3 mr-1" />Ligar</a>
                                  </Button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Active clients in area */}
                      {ativos.length > 0 && (
                        <div className="space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Clientes ativos ({ativos.length})</p>
                          {ativos.map((n: any) => (
                            <div key={n.id} className="p-2 rounded-lg bg-primary/5 border border-primary/10 space-y-1">
                              <p className="text-sm font-medium">{n.nome}</p>
                              <p className="text-[10px] text-muted-foreground">👤 Cliente ativo{n.bairro && ` · ${n.bairro}`}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {exploreRoute.length > 1 && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 pt-1"><Route className="h-3 w-3" />Rota otimizada gerada no mapa</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              );
            })()}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 text-xs">
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <span key={k} className={`px-2 py-1 rounded ${STATUS_COLORS[k]}`}>{v}</span>
            ))}
          </div>

          {/* Prospects without location */}
          {filtered.filter(p => !p.latitude).length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Sem localização ({filtered.filter(p => !p.latitude).length})</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {filtered.filter(p => !p.latitude).map(p => (
                    <Button key={p.id} variant="outline" size="sm" onClick={() => setPlacingId(p.id)} className="text-xs">
                      <MapPin className="h-3 w-3 mr-1" />{p.nome}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ========= LISTA ========= */}
        <TabsContent value="lista">
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Buscar por nome..." value={busca} onChange={e => setBusca(e.target.value)} />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterBairro} onValueChange={setFilterBairro}>
              <SelectTrigger className="w-[150px]"><SelectValue placeholder="Bairro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {bairros.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Bairro</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Prioridade</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.slice(0, 50).map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        <div>
                          {p.nome}
                          {p.contato_nome && <p className="text-xs text-muted-foreground">{p.contato_nome}</p>}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs">{TIPO_LABELS[p.tipo] || p.tipo}</TableCell>
                      <TableCell className="text-xs">{p.bairro || "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-0.5">{[1,2,3,4,5].map(s => <Star key={s} className={`h-3 w-3 ${s <= p.score ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`} />)}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={p.prioridade === "alta" ? "destructive" : p.prioridade === "media" ? "secondary" : "outline"} className="text-[10px]">
                          {p.prioridade}
                        </Badge>
                      </TableCell>
                      <TableCell><span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[p.status]}`}>{STATUS_LABELS[p.status]}</span></TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          {p.script_abordagem && (
                            <Button size="icon" variant="ghost" onClick={() => setScriptView(p.script_abordagem)} title="Script"><FileText className="h-4 w-4" /></Button>
                          )}
                          {p.telefone && (
                            <Button size="icon" variant="ghost" asChild title="Ligar"><a href={`tel:${p.telefone}`}><Phone className="h-4 w-4" /></a></Button>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => setVisitaDialogId(p.id)} title="Registrar Visita"><ClipboardCheck className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => setEditingProspecto(p)} title="Editar"><Pencil className="h-4 w-4" /></Button>
                          <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)} title="Excluir"><Trash2 className="h-4 w-4 text-destructive" /></Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhum prospecto encontrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========= FOLLOW-UP IA ========= */}
        <TabsContent value="followup">
          <FollowUpTab prospectos={prospectos} onReload={loadData} />
        </TabsContent>

        {/* ========= RELATÓRIO ========= */}
        <TabsContent value="relatorio">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Prospectos</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-primary">{stats.totalVisitas}</p>
              <p className="text-xs text-muted-foreground">Visitas Realizadas</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold text-green-600">{stats.fechados}</p>
              <p className="text-xs text-muted-foreground">Pedidos Fechados</p>
            </CardContent></Card>
            <Card><CardContent className="pt-4 text-center">
              <p className="text-3xl font-bold">{stats.taxaConversao}%</p>
              <p className="text-xs text-muted-foreground">Taxa de Conversão</p>
            </CardContent></Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Funil */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Funil de Prospecção</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[
                    { label: "Novos", count: stats.novos, color: "bg-muted", pct: stats.total > 0 ? (stats.novos / stats.total * 100) : 0 },
                    { label: "Visitados", count: stats.visitados, color: "bg-blue-500", pct: stats.total > 0 ? (stats.visitados / stats.total * 100) : 0 },
                    { label: "Interessados", count: stats.interessados, color: "bg-amber-500", pct: stats.total > 0 ? (stats.interessados / stats.total * 100) : 0 },
                    { label: "Retornar", count: stats.retornar, color: "bg-purple-500", pct: stats.total > 0 ? (stats.retornar / stats.total * 100) : 0 },
                    { label: "Fechados", count: stats.fechados, color: "bg-green-500", pct: stats.total > 0 ? (stats.fechados / stats.total * 100) : 0 },
                  ].map(item => (
                    <div key={item.label} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{item.label}</span>
                        <span className="font-bold">{item.count}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div className={`h-2 rounded-full ${item.color} transition-all`} style={{ width: `${Math.max(item.pct, 2)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Insights */}
            <Card>
              <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Eye className="h-4 w-4" />Insights</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Bairro mais promissor</p>
                  <p className="text-lg font-bold">{stats.bairroTop}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Para retornar</p>
                  <p className="text-lg font-bold">{stats.retornar} prospecto(s)</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Prospectos sem visita</p>
                  <p className="text-lg font-bold">{stats.novos} novo(s)</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">Sugestão</p>
                  <p className="text-sm">
                    {stats.retornar > 0 ? `Priorize retornar aos ${stats.retornar} prospectos marcados.` :
                     stats.novos > 0 ? `Visite os ${stats.novos} prospectos novos cadastrados.` :
                     "Cadastre mais prospectos para expandir sua rede comercial."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recent visits */}
          <Card className="mt-6">
            <CardHeader><CardTitle className="text-sm">Últimas Visitas</CardTitle></CardHeader>
            <CardContent>
              {visitas.length === 0 ? (
                <p className="text-muted-foreground text-center py-6">Nenhuma visita registrada</p>
              ) : (
                <div className="space-y-3">
                  {visitas.slice(0, 10).map(v => {
                    const prospect = prospectos.find(p => p.id === v.prospecto_id);
                    return (
                      <div key={v.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                        <div>
                          <p className="text-sm font-medium">{prospect?.nome || "?"}</p>
                          <p className="text-xs text-muted-foreground">{new Date(v.data_visita).toLocaleDateString("pt-BR")} · {v.produto_apresentado}</p>
                          {v.feedback && <p className="text-xs italic text-muted-foreground">"{v.feedback}"</p>}
                        </div>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_COLORS[v.resultado]}`}>{STATUS_LABELS[v.resultado]}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ProspectoForm open={formOpen} onOpenChange={setFormOpen} onSubmit={handleCreateProspecto} />
      {/* Quick register from explore panel */}
      <ProspectoForm
        open={quickRegisterOpen}
        onOpenChange={setQuickRegisterOpen}
        onSubmit={async (data: any) => {
          const enriched = {
            ...data,
            bairro: data.bairro || exploreBairro,
            latitude: explorePin?.lat || null,
            longitude: explorePin?.lng || null,
          };
          await handleCreateProspecto(enriched);
          setQuickRegisterOpen(false);
        }}
        initial={{ nome: "", tipo: "bar", bairro: exploreBairro, endereco: "", telefone: "", contato_nome: "", prioridade: "media", score: 3, observacoes_estrategicas: "", volume_potencial: "", perfil_publico: "", script_abordagem: "Olá! Trabalhamos com gelos saborizados premium, ideais para drinks diferenciados. Temos mais de 10 sabores e preços especiais para parceiros comerciais. Posso apresentar nossos produtos?" }}
      />
      {editingProspecto && (
        <ProspectoForm open={!!editingProspecto} onOpenChange={v => !v && setEditingProspecto(null)} onSubmit={handleEditProspecto} initial={editingProspecto} />
      )}
      {visitaDialogId && (
        <RegistrarVisitaDialog
          open={!!visitaDialogId}
          onOpenChange={v => !v && setVisitaDialogId(null)}
          onSubmit={handleRegistrarVisita}
          prospectoNome={visitaProspecto?.nome || ""}
        />
      )}

      {/* Script viewer */}
      {scriptView && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setScriptView(null)}>
          <Card className="max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <CardHeader><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4" />Script de Abordagem</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{scriptView}</p>
              <Button className="w-full mt-4" variant="outline" onClick={() => setScriptView(null)}>Fechar</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
