import { useEffect, useState, useMemo, lazy, Suspense, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MapPin, Truck, Package, Filter, Navigation, Undo2, Route, Clock, ArrowUpDown } from "lucide-react";
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
  valorFrete: number;
  fretePagoPor: string;
  ordem?: number;
}

function haversineDistance(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a[0] * Math.PI) / 180) *
      Math.cos((b[0] * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

/** Nearest-neighbor ordering starting from origin */
function optimizeOrder(origin: [number, number], points: PedidoEntrega[]): PedidoEntrega[] {
  const withCoords = points.filter(p => p.latitude != null && p.longitude != null);
  const withoutCoords = points.filter(p => p.latitude == null || p.longitude == null);

  if (withCoords.length <= 1) return [...withCoords, ...withoutCoords];

  const ordered: PedidoEntrega[] = [];
  const remaining = [...withCoords];
  let current = origin;

  while (remaining.length > 0) {
    let nearestIdx = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineDistance(current, [remaining[i].latitude!, remaining[i].longitude!]);
      if (d < nearestDist) {
        nearestDist = d;
        nearestIdx = i;
      }
    }
    const next = remaining.splice(nearestIdx, 1)[0];
    ordered.push({ ...next, ordem: ordered.length + 1 });
    current = [next.latitude!, next.longitude!];
  }

  return [...ordered, ...withoutCoords];
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
  const [pendingPosition, setPendingPosition] = useState<[number, number] | null>(null);
  const [previousSavedPosition, setPreviousSavedPosition] = useState<[number, number] | null>(null);
  const [otimizarRota, setOtimizarRota] = useState(true);

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
        .select("*, clientes(nome, bairro, endereco, cidade, latitude, longitude), pedido_producao_itens(quantidade), vendas(valor_frete, frete_pago_por)")
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
        valorFrete: p.vendas?.valor_frete ?? 0,
        fretePagoPor: p.vendas?.frete_pago_por ?? "cliente",
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

  function handleMarkerDragEnd(nextPosition: [number, number]) {
    setPendingPosition(nextPosition);
  }

  async function confirmReposition() {
    if (!factoryId || !pendingPosition || savingFactoryPosition) return;

    const oldPosition = factoryCoords;
    setPreviousSavedPosition(oldPosition);
    setFactoryCoords(pendingPosition);
    setHasFactoryCoords(true);
    setSavingFactoryPosition(true);
    setPendingPosition(null);

    try {
      const { error } = await supabase
        .from("factories")
        .update({ latitude: pendingPosition[0], longitude: pendingPosition[1] })
        .eq("id", factoryId);

      if (error) throw error;

      toast({
        title: "Posição da fábrica atualizada",
        description: "O ponto de partida das entregas foi salvo com sucesso.",
      });
    } catch (error: any) {
      setFactoryCoords(oldPosition);
      setPreviousSavedPosition(null);
      toast({
        title: "Erro ao salvar posição",
        description: error?.message || "Não foi possível atualizar a localização da fábrica.",
        variant: "destructive",
      });
    } finally {
      setSavingFactoryPosition(false);
    }
  }

  function cancelReposition() {
    setPendingPosition(null);
  }

  async function undoReposition() {
    if (!factoryId || !previousSavedPosition || savingFactoryPosition) return;

    setSavingFactoryPosition(true);
    const restoreTo = previousSavedPosition;

    try {
      const { error } = await supabase
        .from("factories")
        .update({ latitude: restoreTo[0], longitude: restoreTo[1] })
        .eq("id", factoryId);

      if (error) throw error;

      setFactoryCoords(restoreTo);
      setPreviousSavedPosition(null);
      toast({
        title: "Posição restaurada",
        description: "A fábrica voltou para a posição anterior.",
      });
    } catch (error: any) {
      toast({
        title: "Erro ao desfazer",
        description: error?.message || "Não foi possível restaurar a posição.",
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
    const OSRM_SERVERS = [
      `https://router.project-osrm.org/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`,
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`,
    ];

    for (const url of OSRM_SERVERS) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) continue;
        const data = await res.json();

        if (data.routes?.[0]) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates.map((c: number[]) => [c[1], c[0]] as [number, number]);
          if (coords.length > 2) {
            return {
              coords,
              distanceKm: Math.round((route.distance / 1000) * 10) / 10,
              durationMin: Math.round(route.duration / 60),
            };
          }
        }
      } catch (e) {
        console.warn("OSRM route attempt failed:", e);
      }
    }

    // Fallback: straight line with haversine distance
    const dist = haversineDistance(from, to);
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

  // Optimized ordering
  const orderedPedidos = useMemo(() => {
    if (!otimizarRota || !hasFactoryCoords) return filtered;
    return optimizeOrder(factoryCoords, filtered);
  }, [filtered, otimizarRota, factoryCoords, hasFactoryCoords]);

  useEffect(() => {
    if (!hasFactoryCoords || orderedPedidos.length === 0) {
      setRoutePolylines([]);
      setRouteInfoMap({});
      return;
    }

    const pedidosComCoords = orderedPedidos.filter(p => p.latitude != null && p.longitude != null);
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
        // When optimized, chain routes: factory -> 1st -> 2nd -> ...
        const from = otimizarRota && i > 0
          ? [pedidosComCoords[i - 1].latitude!, pedidosComCoords[i - 1].longitude!] as [number, number]
          : factoryCoords;

        const result = await fetchRoute(from, [p.latitude!, p.longitude!]);
        infoMap[p.id] = { distanceKm: result.distanceKm, durationMin: result.durationMin };
        lines.push({
          id: `route-${p.id}`,
          positions: result.coords,
          style: {
            color: selectedRoute === p.id ? "#2563eb" : ROUTE_COLORS[i % ROUTE_COLORS.length],
            weight: selectedRoute === p.id ? 6 : 4,
            opacity: selectedRoute ? (selectedRoute === p.id ? 1 : 0.25) : 0.8,
            dashArray: otimizarRota ? undefined : undefined,
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
  }, [orderedPedidos, factoryCoords, hasFactoryCoords, selectedRoute, otimizarRota]);

  const grouped = useMemo(() => {
    const map: Record<string, PedidoEntrega[]> = {};
    orderedPedidos.forEach(p => {
      if (!map[p.bairro]) map[p.bairro] = [];
      map[p.bairro].push(p);
    });
    return Object.entries(map).sort((a, b) => b[1].length - a[1].length);
  }, [orderedPedidos]);

  const STATUS_MARKER_COLORS: Record<string, string> = {
    aguardando_producao: "#f59e0b",
    em_producao: "#3b82f6",
    separado_para_entrega: "#16a34a",
  };

  const mapMarkers: MapMarker[] = useMemo(() => {
    const clientMarkers = orderedPedidos
      .filter(p => p.latitude != null && p.longitude != null)
      .map((p, idx) => {
        const info = routeInfoMap[p.id];
        const isSelected = selectedRoute === p.id;
        const orderLabel = p.ordem ? `${p.ordem}° ` : "";

        return {
          id: p.id,
          position: [p.latitude!, p.longitude!] as [number, number],
          icon: createLabeledSvgIcon(
            isSelected ? "#dc2626" : (STATUS_MARKER_COLORS[p.status] || "#6b7280"),
            `${orderLabel}${p.clienteNome}`,
            isSelected ? "large" : "medium"
          ),
          popup: {
            title: `📍 ${orderLabel}${p.clienteNome}`,
            content: (
              <div className="space-y-1 min-w-[180px]">
                <p className="text-xs">📦 {p.itens} un · {p.bairro}</p>
                <p className="text-xs">📅 {new Date(p.dataEntrega + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                {info && (
                  <p className="text-xs font-medium text-primary">🛣️ {info.distanceKm} km · ~{info.durationMin} min</p>
                )}
                {p.valorFrete > 0 && (
                  <p className="text-xs">🚚 Frete: R$ {p.valorFrete.toFixed(2)} ({p.fretePagoPor === "empresa" ? "Empresa" : p.fretePagoPor === "ambos" ? "Dividido" : "Cliente"})</p>
                )}
              </div>
            ),
          },
        } satisfies MapMarker;
      });

    const factoryMarker: MapMarker = {
      id: "factory",
      position: factoryCoords,
      draggable: true,
      icon: createLabeledSvgIcon("#ea580c", `🏭 ${factoryName}`, "large"),
      popup: {
        title: `🏭 Origem: ${factoryName}`,
        content: (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-emerald-600">📍 Ponto de partida das entregas</p>
            <p className="text-xs text-muted-foreground">Arraste o marcador para reposicionar</p>
            {savingFactoryPosition && (
              <p className="text-xs text-muted-foreground">Salvando nova posição...</p>
            )}
          </div>
        ),
      },
    };

    return [factoryMarker, ...clientMarkers];
  }, [factoryCoords, factoryName, orderedPedidos, routeInfoMap, savingFactoryPosition, selectedRoute]);

  const totalItens = filtered.reduce((s, p) => s + p.itens, 0);
  const totalFrete = filtered.reduce((s, p) => s + p.valorFrete, 0);
  const totalDistancia = Object.values(routeInfoMap).reduce((s, r) => s + r.distanceKm, 0);
  const totalTempo = Object.values(routeInfoMap).reduce((s, r) => s + r.durationMin, 0);

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

  const freteLabel = (pago: string) => {
    if (pago === "empresa") return "Empresa";
    if (pago === "ambos") return "Dividido";
    return "Cliente";
  };

  return (
    <div>
      <AlertDialog open={!!pendingPosition} onOpenChange={(open) => { if (!open) cancelReposition(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reposicionar fábrica?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja mover a fábrica para a nova posição? Isso alterará o ponto de partida de todas as rotas de entrega.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReposition}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Mapa de Entregas</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadData}>
          <Truck className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-6">
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
            <p className="text-xs text-muted-foreground">Prontos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalDistancia > 0 ? `${Math.round(totalDistancia)}km` : "—"}</p>
            <p className="text-xs text-muted-foreground">Distância total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalTempo > 0 ? `${totalTempo}min` : "—"}</p>
            <p className="text-xs text-muted-foreground">Tempo estimado</p>
          </CardContent>
        </Card>
      </div>

      {/* Frete summary */}
      {totalFrete > 0 && (
        <Card className="mb-6 border-primary/20">
          <CardContent className="pt-4 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">Frete total:</span>
              <span className="text-sm font-bold text-primary">R$ {totalFrete.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>Empresa: R$ {filtered.filter(p => p.fretePagoPor === "empresa").reduce((s, p) => s + p.valorFrete, 0).toFixed(2)}</span>
              <span>·</span>
              <span>Cliente: R$ {filtered.filter(p => p.fretePagoPor === "cliente").reduce((s, p) => s + p.valorFrete, 0).toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
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
        <Button
          variant={otimizarRota ? "default" : "outline"}
          size="sm"
          className="gap-1"
          onClick={() => setOtimizarRota(!otimizarRota)}
        >
          <ArrowUpDown className="h-4 w-4" />
          {otimizarRota ? "Rota otimizada" : "Otimizar rota"}
        </Button>
      </div>

      {/* Map */}
      {mapMarkers.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex flex-wrap items-center gap-2">
              <MapPin className="h-4 w-4" /> Mapa das Entregas
              <Badge variant="secondary">{mapMarkers.length} no mapa</Badge>
              {previousSavedPosition && (
                <Button variant="outline" size="sm" className="h-6 text-xs gap-1" onClick={undoReposition} disabled={savingFactoryPosition}>
                  <Undo2 className="h-3 w-3" /> Desfazer reposição
                </Button>
              )}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <span className="flex items-center gap-1 text-xs">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#ea580c" }} />
                🏭 Fábrica (origem)
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#16a34a" }} />
                Separado
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#3b82f6" }} />
                Em Produção
              </span>
              <span className="flex items-center gap-1 text-xs">
                <span className="inline-block w-3 h-3 rounded-full" style={{ background: "#f59e0b" }} />
                Aguardando
              </span>
            </div>
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
                    handleMarkerDragEnd(newPosition);
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
            <Navigation className="h-3 w-3" /> Rotas: {routePolylines.length}
          </span>
          {otimizarRota && (
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Route className="h-3 w-3 text-primary" /> Sequência otimizada por proximidade
            </span>
          )}
          {selectedRoute && (
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setSelectedRoute(null)}>
              Mostrar todas
            </Button>
          )}
        </div>
      )}

      {/* Pedidos list */}
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
                  <Card
                    key={p.id}
                    className={`border-l-4 ${getBairroColor(bairro)} cursor-pointer transition-shadow hover:shadow-md ${selectedRoute === p.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setSelectedRoute(prev => (prev === p.id ? null : p.id))}
                  >
                    <CardContent className="pt-3 pb-3 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-sm truncate">
                          {p.ordem && <span className="text-primary mr-1">{p.ordem}°</span>}
                          {p.clienteNome}
                        </span>
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
                      {/* Route info */}
                      {routeInfoMap[p.id] && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border/50">
                          <Navigation className="h-3 w-3 text-primary" />
                          <span className="font-medium text-foreground">{routeInfoMap[p.id].distanceKm} km</span>
                          <span>·</span>
                          <span>~{routeInfoMap[p.id].durationMin} min</span>
                        </div>
                      )}
                      {/* Frete info */}
                      {p.valorFrete > 0 && (
                        <div className="flex items-center gap-2 text-xs pt-1 border-t border-border/50">
                          <Truck className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">R$ {p.valorFrete.toFixed(2)}</span>
                          <Badge variant="outline" className="text-[9px] h-4">{freteLabel(p.fretePagoPor)}</Badge>
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
