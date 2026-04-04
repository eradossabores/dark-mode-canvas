import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Truck, Package, Filter, Navigation, Undo2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import type { MapMarker, MapPolyline } from "@/components/ui/interactive-map";
import { createLabeledSvgIcon } from "@/components/ui/interactive-map";

const LazyMap = lazy(() => import("@/components/ui/interactive-map").then(m => ({ default: m.AdvancedMap })));

const BAIRRO_COLORS: Record<string, string> = {};
const COLOR_PALETTE = [
  "bg-blue-100 border-blue-400 text-blue-800",
  "bg-emerald-100 border-emerald-400 text-emerald-800",
  "bg-amber-100 border-amber-400 text-amber-800",
  "bg-purple-100 border-purple-400 text-purple-800",
  "bg-rose-100 border-rose-400 text-rose-800",
  "bg-cyan-100 border-cyan-400 text-cyan-800",
  "bg-orange-100 border-orange-400 text-orange-800",
  "bg-indigo-100 border-indigo-400 text-indigo-800",
  "bg-pink-100 border-pink-400 text-pink-800",
  "bg-teal-100 border-teal-400 text-teal-800",
];

function getBairroColor(bairro: string) {
  if (!BAIRRO_COLORS[bairro]) {
    const idx = Object.keys(BAIRRO_COLORS).length % COLOR_PALETTE.length;
    BAIRRO_COLORS[bairro] = COLOR_PALETTE[idx];
  }
  return BAIRRO_COLORS[bairro];
}

interface RouteInfo {
  distanceKm: number;
  durationMin: number;
}

interface PedidoEntrega {
  id: string;
  clienteNome: string;
  bairro: string;
  endereco: string;
  cidade: string;
  status: string;
  dataEntrega: string;
  itens: number;
  latitude: number | null;
  longitude: number | null;
}

export default function MapaEntregas() {
  const { factoryId, role } = useAuth();
  const { toast } = useToast();
  const [pedidos, setPedidos] = useState<PedidoEntrega[]>([]);
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [filtroBairro, setFiltroBairro] = useState<string>("todos");
  const [factoryCoords, setFactoryCoords] = useState<[number, number]>([2.8195, -60.6714]);
  const [factoryName, setFactoryName] = useState("Fábrica");
  const [hasFactoryCoords, setHasFactoryCoords] = useState(false);
  const [savingFactoryPosition, setSavingFactoryPosition] = useState(false);
  const [routePolylines, setRoutePolylines] = useState<MapPolyline[]>([]);
  const [routeInfoMap, setRouteInfoMap] = useState<Record<string, RouteInfo>>({});
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null);

  useEffect(() => {
    if (role !== "super_admin" && !factoryId) {
      setPedidos([]);
      return;
    }
    loadData();
  }, [factoryId, role]);

  async function loadData() {
    try {
      let q = (supabase as any)
        .from("pedidos_producao")
        .select("*, clientes(nome, bairro, endereco, cidade, latitude, longitude), pedido_producao_itens(quantidade)")
        .in("status", ["separado_para_entrega", "em_producao", "aguardando_producao"])
        .eq("tipo_pedido", "entrega")
        .order("data_entrega");

      if (factoryId) q = q.eq("factory_id", factoryId);
      const { data } = await q;

      const mapped: PedidoEntrega[] = (data || []).map((p: any) => ({
        id: p.id,
        clienteNome: p.clientes?.nome || "?",
        bairro: p.clientes?.bairro || "Sem bairro",
        endereco: p.clientes?.endereco || "",
        cidade: p.clientes?.cidade || "Boa Vista",
        status: p.status,
        dataEntrega: p.data_entrega,
        itens: (p.pedido_producao_itens || []).reduce((s: number, i: any) => s + i.quantidade, 0),
        latitude: p.clientes?.latitude ?? null,
        longitude: p.clientes?.longitude ?? null,
      }));

      if (factoryId) {
        const { data: fData } = await supabase
          .from("factories")
          .select("latitude, longitude, name")
          .eq("id", factoryId)
          .single();

        if (fData?.latitude != null && fData?.longitude != null) {
          setFactoryCoords([fData.latitude, fData.longitude]);
          setHasFactoryCoords(true);
        } else {
          setHasFactoryCoords(false);
        }

        setFactoryName(fData?.name || "Fábrica");
      }

      setPedidos(mapped);
    } catch (e) {
      console.error("MapaEntregas error:", e);
    }
  }

  async function saveFactoryPosition(nextPosition: [number, number]) {
    if (!factoryId || savingFactoryPosition) return;

    const previousPosition = factoryCoords;
    setFactoryCoords(nextPosition);
    setHasFactoryCoords(true);
    setSavingFactoryPosition(true);

    try {
      const { error } = await supabase
        .from("factories")
        .update({ latitude: nextPosition[0], longitude: nextPosition[1] })
        .eq("id", factoryId);

      if (error) throw error;

      toast({
        title: "Posição da fábrica atualizada",
        description: "O ponto de partida das entregas foi salvo com sucesso.",
      });
    } catch (error: any) {
      setFactoryCoords(previousPosition);
      toast({
        title: "Erro ao salvar posição",
        description: error?.message || "Não foi possível atualizar a localização da fábrica.",
        variant: "destructive",
      });
    } finally {
      setSavingFactoryPosition(false);
    }
  }

  async function fetchRoute(
    from: [number, number],
    to: [number, number]
  ): Promise<{ coords: [number, number][]; distanceKm: number; durationMin: number }> {
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`OSRM ${res.status}`);
      const data = await res.json();

      if (data.routes?.[0]) {
        const route = data.routes[0];
        const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
        return {
          coords,
          distanceKm: Math.round((route.distance / 1000) * 10) / 10,
          durationMin: Math.round(route.duration / 60),
        };
      }
    } catch (e) {
      console.error("OSRM route error:", e);
    }

    const R = 6371;
    const dLat = ((to[0] - from[0]) * Math.PI) / 180;
    const dLon = ((to[1] - from[1]) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((from[0] * Math.PI) / 180) *
        Math.cos((to[0] * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return {
      coords: [from, to],
      distanceKm: Math.round(dist * 10) / 10,
      durationMin: Math.round((dist / 30) * 60),
    };
  }

  const bairros = useMemo(() => {
    const set = new Set(pedidos.map(p => p.bairro));
    return Array.from(set).sort();
  }, [pedidos]);

  const filtered = useMemo(() => {
    return pedidos.filter(p => {
      if (filtroStatus !== "todos" && p.status !== filtroStatus) return false;
      if (filtroBairro !== "todos" && p.bairro !== filtroBairro) return false;
      return true;
    });
  }, [pedidos, filtroStatus, filtroBairro]);

  useEffect(() => {
    if (!hasFactoryCoords || filtered.length === 0) {
      setRoutePolylines([]);
      setRouteInfoMap({});
      return;
    }

    const pedidosComCoords = filtered.filter(p => p.latitude != null && p.longitude != null);
    if (pedidosComCoords.length === 0) {
      setRoutePolylines([]);
      setRouteInfoMap({});
      return;
    }

    let cancelled = false;

    async function loadRoutes() {
      const ROUTE_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#ea580c", "#db2777"];
      const lines: MapPolyline[] = [];
      const infoMap: Record<string, RouteInfo> = {};

      for (let i = 0; i < pedidosComCoords.length; i++) {
        if (cancelled) return;
        const p = pedidosComCoords[i];
        const result = await fetchRoute(factoryCoords, [p.latitude!, p.longitude!]);
        infoMap[p.id] = { distanceKm: result.distanceKm, durationMin: result.durationMin };
        lines.push({
          id: `route-${p.id}`,
          positions: result.coords,
          style: {
            color: selectedRoute === p.id ? "#2563eb" : ROUTE_COLORS[i % ROUTE_COLORS.length],
            weight: selectedRoute === p.id ? 5 : 3,
            opacity: selectedRoute ? (selectedRoute === p.id ? 1 : 0.2) : 0.7,
            dashArray: selectedRoute === p.id ? undefined : "8 4",
          },
        });
      }

      if (!cancelled) {
        setRoutePolylines(lines);
        setRouteInfoMap(infoMap);
      }
    }

    loadRoutes();
    return () => {
      cancelled = true;
    };
  }, [filtered, factoryCoords, hasFactoryCoords, selectedRoute]);

  const grouped = useMemo(() => {
    const map: Record<string, PedidoEntrega[]> = {};
    filtered.forEach(p => {
      if (!map[p.bairro]) map[p.bairro] = [];
      map[p.bairro].push(p);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [filtered]);

  const STATUS_MARKER_COLORS: Record<string, string> = {
    aguardando_producao: "#f59e0b",
    em_producao: "#3b82f6",
    separado_para_entrega: "#16a34a",
  };

  const mapMarkers: MapMarker[] = useMemo(() => {
    const clientMarkers = filtered
      .filter(p => p.latitude != null && p.longitude != null)
      .map(p => {
        const info = routeInfoMap[p.id];
        const routeText = info ? `\n🛣️ ${info.distanceKm} km · ~${info.durationMin} min` : "";

        return {
          id: p.id,
          position: [p.latitude!, p.longitude!] as [number, number],
          color: STATUS_MARKER_COLORS[p.status] || "#6b7280",
          popup: {
            title: p.clienteNome,
            content: `📦 ${p.itens} un · ${p.bairro}\n📅 ${new Date(p.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR")}${routeText}\n🗺️ Clique para ver a rota`,
          },
        } satisfies MapMarker;
      });

    const factoryMarker: MapMarker = {
      id: "factory",
      position: factoryCoords,
      draggable: true,
      icon: createLabeledSvgIcon("#d97706", `🏭 ${factoryName}`, "large"),
      popup: {
        title: factoryName,
        content: (
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Localização da fábrica (ponto de partida das entregas)</p>
            <p className="text-xs text-primary font-medium">✋ Arraste o marcador para reposicionar a fábrica</p>
            {savingFactoryPosition && (
              <p className="text-xs text-muted-foreground">Salvando nova posição...</p>
            )}
          </div>
        ),
      },
    };

    return [factoryMarker, ...clientMarkers];
  }, [factoryCoords, factoryName, filtered, routeInfoMap, savingFactoryPosition]);

  const totalItens = filtered.reduce((s, p) => s + p.itens, 0);

  const statusLabel: Record<string, string> = {
    aguardando_producao: "Aguardando",
    em_producao: "Em Produção",
    separado_para_entrega: "Separado",
  };

  const statusVariant = (s: string) => {
    if (s === "separado_para_entrega") return "default" as const;
    if (s === "em_producao") return "secondary" as const;
    return "outline" as const;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Mapa de Entregas</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <Truck className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{filtered.length}</p>
            <p className="text-xs text-muted-foreground">Pedidos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{bairros.length}</p>
            <p className="text-xs text-muted-foreground">Bairros</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{totalItens}</p>
            <p className="text-xs text-muted-foreground">Unidades</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold">{filtered.filter(p => p.status === "separado_para_entrega").length}</p>
            <p className="text-xs text-muted-foreground">Prontos p/ entrega</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="aguardando_producao">Aguardando</SelectItem>
              <SelectItem value="em_producao">Em Produção</SelectItem>
              <SelectItem value="separado_para_entrega">Separado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={filtroBairro} onValueChange={setFiltroBairro}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Bairro" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os bairros</SelectItem>
            {bairros.map(b => (
              <SelectItem key={b} value={b}>
                {b}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {mapMarkers.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex flex-wrap items-center gap-2">
              <MapPin className="h-4 w-4" /> Mapa das Entregas
              <Badge variant="secondary">{mapMarkers.length} no mapa</Badge>
              <Badge variant="outline">Arraste a fábrica para reposicionar</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Suspense fallback={<div className="h-[400px] flex items-center justify-center text-muted-foreground">Carregando mapa...</div>}>
              <LazyMap
                center={factoryCoords}
                zoom={13}
                markers={mapMarkers}
                polylines={routePolylines}
                onMarkerClick={(marker) => {
                  if (marker.id !== "factory") {
                    setSelectedRoute(prev => (prev === marker.id ? null : String(marker.id)));
                  }
                }}
                onMarkerDragEnd={(marker, newPosition) => {
                  if (marker.id === "factory") {
                    void saveFactoryPosition(newPosition);
                  }
                }}
                style={{ height: "400px", width: "100%" }}
                className="rounded-b-lg overflow-hidden"
              />
            </Suspense>
          </CardContent>
        </Card>
      )}

      {routePolylines.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mb-4 px-1">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Navigation className="h-3 w-3" /> Rotas traçadas: {routePolylines.length}
          </span>
          {selectedRoute && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedRoute(null)}>
              Mostrar todas
            </Button>
          )}
        </div>
      )}

      {grouped.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Truck className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p className="text-lg font-medium">Nenhum pedido pendente de entrega</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([bairro, pedidosBairro]) => (
            <div key={bairro}>
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-lg">{bairro}</h3>
                <Badge variant="secondary">{pedidosBairro.length} pedido(s)</Badge>
                <Badge variant="outline">{pedidosBairro.reduce((s, p) => s + p.itens, 0)} un</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {pedidosBairro.map(p => (
                  <Card key={p.id} className={`border-l-4 ${getBairroColor(bairro)}`}>
                    <CardContent className="pt-3 pb-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">{p.clienteNome}</span>
                        <Badge variant={statusVariant(p.status)} className="text-[10px] shrink-0">
                          {statusLabel[p.status] || p.status}
                        </Badge>
                      </div>
                      {p.endereco && <p className="text-xs text-muted-foreground truncate">{p.endereco}</p>}
                      <div className="flex items-center justify-between text-xs gap-2">
                        <span className="flex items-center gap-1">
                          <Package className="h-3 w-3" /> {p.itens} un
                        </span>
                        <span className="text-muted-foreground">
                          Entrega: {new Date(p.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR")}
                        </span>
                      </div>
                      {routeInfoMap[p.id] && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                          <Navigation className="h-3 w-3 text-primary" />
                          <span className="font-medium text-foreground">{routeInfoMap[p.id].distanceKm} km</span>
                          <span>·</span>
                          <span>~{routeInfoMap[p.id].durationMin} min</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
