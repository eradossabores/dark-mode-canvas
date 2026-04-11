import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdvancedMap, createLabeledSvgIcon, createSvgIcon, MAP_ICONS, type MapMarker } from "@/components/ui/interactive-map";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { MapPin, Save, X, Users, RefreshCw, Search, Undo2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { geocodeClienteAddress, hasAddressForGeocoding } from "@/lib/geocoding";
import { useAuth } from "@/contexts/AuthContext";

const clienteIcon = createSvgIcon('#2563eb');
const pendingIcon = createSvgIcon('#dc2626');
const DEFAULT_CENTER: [number, number] = [2.8195, -60.6714];

function calcDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)}m`;
  return `${km.toFixed(1)}km`;
}

interface Cliente {
  id: string;
  nome: string;
  bairro: string | null;
  endereco: string | null;
  telefone: string | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  possui_freezer: boolean;
}

type AutoGeocodeStatus = "pendente" | "localizado" | "nao-encontrado";

export default function MapaClientes() {
  const { factoryId } = useAuth();
  const [searchParams] = useSearchParams();
  const highlightedClienteId = searchParams.get("cliente");
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [placingClienteId, setPlacingClienteId] = useState<string | null>(null);
  const [tempMarker, setTempMarker] = useState<[number, number] | null>(null);
  const [filterBairro, setFilterBairro] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [flyTarget, setFlyTarget] = useState<[number, number] | null>(null);
  const [autoGeocoding, setAutoGeocoding] = useState(false);
  const [autoGeocodeStatus, setAutoGeocodeStatus] = useState<Record<string, AutoGeocodeStatus>>({});
  const [factoryCenter, setFactoryCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [factoryName, setFactoryName] = useState<string>("");
  const [hasFactoryCoords, setHasFactoryCoords] = useState(false);

  interface PendingDrag {
    type: "factory" | "client";
    id: string;
    name: string;
    oldPos: [number, number];
    newPos: [number, number];
  }
  const [pendingDrag, setPendingDrag] = useState<PendingDrag | null>(null);
  const [confirmDragOpen, setConfirmDragOpen] = useState(false);
  const [mapKey, setMapKey] = useState(0);

  useEffect(() => {
    if (!factoryId) return;
    (supabase as any).from("factories").select("latitude, longitude, name, endereco, bairro, cidade, estado").eq("id", factoryId).maybeSingle()
      .then(async ({ data }: any) => {
        if (!data) return;
        setFactoryName(data.name || "");
        if (data.latitude != null && data.longitude != null) {
          setFactoryCenter([data.latitude, data.longitude]);
          setHasFactoryCoords(true);
          return;
        }
        if (data.endereco?.trim()) {
          try {
            const coords = await geocodeClienteAddress({
              endereco: data.endereco,
              bairro: data.bairro,
              cidade: data.cidade,
              estado: data.estado,
            });
            if (coords) {
              setFactoryCenter([coords.lat, coords.lng]);
              setHasFactoryCoords(true);
              await (supabase as any).from("factories").update({ latitude: coords.lat, longitude: coords.lng }).eq("id", factoryId);
            }
          } catch (e) {
            console.warn("Falha ao geocodificar endereço da fábrica:", e);
          }
        }
      });
  }, [factoryId]);

  function getStatusLabel(status?: AutoGeocodeStatus) {
    switch (status) {
      case "localizado": return { label: "Localizado", variant: "default" as const };
      case "nao-encontrado": return { label: "Não encontrado", variant: "destructive" as const };
      default: return { label: "Pendente", variant: "secondary" as const };
    }
  }

  const autoGeocodeMissingClientes = useCallback(async (lista: Cliente[]) => {
    const pendentes = lista.filter((cliente) =>
      cliente.latitude == null && cliente.longitude == null && hasAddressForGeocoding(cliente)
    );
    setAutoGeocodeStatus((prev) => {
      const next = { ...prev };
      lista.forEach((cliente) => {
        if (cliente.latitude == null || cliente.longitude == null) {
          next[cliente.id] = hasAddressForGeocoding(cliente) ? (prev[cliente.id] ?? "pendente") : "nao-encontrado";
        }
      });
      return next;
    });
    if (pendentes.length === 0) return;
    setAutoGeocoding(true);
    let atualizados = 0;
    for (const cliente of pendentes) {
      try {
        setAutoGeocodeStatus((prev) => ({ ...prev, [cliente.id]: "pendente" }));
        const coords = await geocodeClienteAddress(cliente);
        if (!coords) { setAutoGeocodeStatus((prev) => ({ ...prev, [cliente.id]: "nao-encontrado" })); continue; }
        const { error } = await (supabase as any).from("clientes").update({ latitude: coords.lat, longitude: coords.lng }).eq("id", cliente.id);
        if (error) throw error;
        setAutoGeocodeStatus((prev) => ({ ...prev, [cliente.id]: "localizado" }));
        atualizados += 1;
      } catch (error) {
        setAutoGeocodeStatus((prev) => ({ ...prev, [cliente.id]: "nao-encontrado" }));
        console.warn("Falha ao geocodificar cliente automaticamente:", cliente.nome, error);
      }
    }
    setAutoGeocoding(false);
    if (atualizados > 0) {
      toast({ title: "📍 Clientes adicionados ao mapa", description: `${atualizados} cliente(s) com endereço foram posicionados automaticamente.` });
      await loadClientes(false);
    }
  }, []);

  useEffect(() => { void loadClientes(); }, [factoryId]);

  useEffect(() => {
    if (!highlightedClienteId || clientes.length === 0) return;
    const cliente = clientes.find((item) => item.id === highlightedClienteId);
    if (cliente?.latitude != null && cliente?.longitude != null) {
      setFlyTarget([cliente.latitude, cliente.longitude]);
    }
  }, [clientes, highlightedClienteId]);

  async function loadClientes(runAutoGeocode = true) {
    let q = (supabase as any)
      .from("clientes")
      .select("id, nome, bairro, endereco, telefone, status, latitude, longitude, possui_freezer")
      .eq("status", "ativo")
      .not("nome", "ilike", "%amostra%")
      .not("nome", "ilike", "%combo%")
      .not("nome", "ilike", "%avulso%")
      .order("nome");
    if (factoryId) q = q.eq("factory_id", factoryId);
    const { data } = await q;
    const lista = data || [];
    setClientes(lista);
    if (runAutoGeocode) await autoGeocodeMissingClientes(lista);
  }

  const semCoordenadas = clientes.filter(c => c.latitude == null || c.longitude == null);
  const comCoordenadas = clientes.filter(c => c.latitude != null && c.longitude != null);
  const bairros = [...new Set(clientes.map(c => c.bairro).filter(Boolean))].sort() as string[];

  const clientesFiltrados = filterBairro === "todos"
    ? comCoordenadas
    : comCoordenadas.filter(c => c.bairro === filterBairro);

  const searchResults = searchTerm.length >= 2
    ? comCoordenadas.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  function focusCliente(c: Cliente) {
    if (c.latitude && c.longitude) { setFlyTarget([c.latitude, c.longitude]); setSearchTerm(""); }
  }

  function startPlacing(clienteId: string) {
    setPlacingClienteId(clienteId);
    setTempMarker(null);
    toast({ title: "Clique no mapa para posicionar o cliente" });
  }

  function handleMapClick(latlng: { lat: number; lng: number }) {
    if (!placingClienteId) return;
    setTempMarker([latlng.lat, latlng.lng]);
  }

  async function savePosition() {
    if (!placingClienteId || !tempMarker) return;
    try {
      const { error } = await (supabase as any).from("clientes").update({ latitude: tempMarker[0], longitude: tempMarker[1] }).eq("id", placingClienteId);
      if (error) throw error;
      toast({ title: "Localização salva!" });
      setPlacingClienteId(null);
      setTempMarker(null);
      loadClientes();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  function cancelPlacing() { setPlacingClienteId(null); setTempMarker(null); }

  async function removePosition(clienteId: string) {
    try {
      await (supabase as any).from("clientes").update({ latitude: null, longitude: null }).eq("id", clienteId);
      toast({ title: "Localização removida" });
      loadClientes();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  const placingCliente = clientes.find(c => c.id === placingClienteId);

  const markers: MapMarker[] = [
    ...clientesFiltrados.map(c => {
      const dist = hasFactoryCoords ? calcDistanceKm(factoryCenter[0], factoryCenter[1], c.latitude!, c.longitude!) : null;
      const distLabel = dist !== null ? ` · ${formatDistance(dist)}` : '';
      return {
        id: c.id,
        position: [c.latitude!, c.longitude!] as [number, number],
        draggable: true,
        icon: createLabeledSvgIcon(
          c.id === highlightedClienteId ? '#d97706' : '#2563eb',
          `${c.nome}${distLabel}`,
          c.id === highlightedClienteId ? 'large' : 'medium'
        ),
        popup: {
          title: c.nome,
          content: (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {dist !== null && <p style={{ fontSize: 12, fontWeight: 600, color: '#2563eb' }}>📏 {formatDistance(dist)} da fábrica</p>}
              {c.bairro && <p style={{ fontSize: 12, color: '#666' }}>{c.bairro}</p>}
              {c.endereco && <p style={{ fontSize: 12, color: '#666' }}>{c.endereco}</p>}
              {c.telefone && <p style={{ fontSize: 12, color: '#666' }}>📞 {c.telefone}</p>}
              {c.possui_freezer && <p style={{ fontSize: 12, color: '#2563eb', fontWeight: 500 }}>❄️ Possui Freezer</p>}
              <p style={{ fontSize: 11, color: '#d97706' }}>✋ Arraste o marcador para ajustar a posição</p>
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button style={{ fontSize: 12, background: '#2563eb', color: 'white', padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer' }} onClick={() => startPlacing(c.id)}>Reposicionar</button>
                <button style={{ fontSize: 12, background: '#dc2626', color: 'white', padding: '4px 8px', borderRadius: 4, border: 'none', cursor: 'pointer' }} onClick={() => removePosition(c.id)}>Remover</button>
              </div>
            </div>
          ),
        },
        data: c,
      };
    }),
    ...(tempMarker ? [{
      id: 'temp-marker',
      position: tempMarker,
      icon: pendingIcon,
      popup: { title: placingCliente?.nome || '', content: 'Nova posição' },
    }] : []),
    ...(hasFactoryCoords ? [{
      id: 'factory-marker',
      position: factoryCenter,
      draggable: true,
      excludeFromCluster: true,
      icon: createLabeledSvgIcon('#ea580c', `🏭 ${factoryName || 'Fábrica'}`, 'large'),
      popup: {
        title: `🏭 ${factoryName || 'Fábrica'}`,
        content: (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <p style={{ fontSize: 12, color: '#666' }}>Localização da fábrica (ponto de referência)</p>
            <p style={{ fontSize: 11, color: '#d97706' }}>✋ Arraste para ajustar a posição</p>
          </div>
        ),
      },
    }] : []),
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Mapa de Clientes</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => loadClientes()} disabled={autoGeocoding}>
          <RefreshCw className="h-4 w-4 mr-1" /> Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-xl font-bold">{clientes.length}</p><p className="text-xs text-muted-foreground">Clientes ativos</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-xl font-bold text-primary">{comCoordenadas.length}</p><p className="text-xs text-muted-foreground">No mapa</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-xl font-bold text-amber-500">{semCoordenadas.length}</p><p className="text-xs text-muted-foreground">Sem localização</p></CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center"><p className="text-xl font-bold">{bairros.length}</p><p className="text-xs text-muted-foreground">Bairros</p></CardContent></Card>
      </div>

      <div className="relative mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar cliente no mapa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-9" />
        </div>
        {searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {searchResults.map(c => (
              <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2" onClick={() => focusCliente(c)}>
                <MapPin className="h-3 w-3 text-primary shrink-0" />
                <span className="font-medium">{c.nome}</span>
                {c.bairro && <span className="text-muted-foreground text-xs">— {c.bairro}</span>}
              </button>
            ))}
          </div>
        )}
        {searchTerm.length >= 2 && searchResults.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg px-3 py-2 text-sm text-muted-foreground">
            Nenhum cliente encontrado no mapa
          </div>
        )}
      </div>

      {placingClienteId && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">📍 Posicionando: {placingCliente?.nome}</p>
            <p className="text-xs text-muted-foreground">Clique no mapa para definir a localização</p>
          </div>
          <div className="flex gap-2">
            {tempMarker && <Button size="sm" onClick={savePosition}><Save className="h-4 w-4 mr-1" /> Salvar</Button>}
            <Button size="sm" variant="outline" onClick={cancelPlacing}><X className="h-4 w-4 mr-1" /> Cancelar</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <AdvancedMap
              key={mapKey}
              center={factoryCenter}
              zoom={13}
              markers={markers}
              onMapClick={handleMapClick}
              onMarkerDragEnd={(marker, newPos) => {
                if (marker.id === 'temp-marker') return;
                const oldPos: [number, number] = marker.position as [number, number];
                if (marker.id === 'factory-marker') {
                  setPendingDrag({ type: "factory", id: factoryId || "", name: factoryName || "Fábrica", oldPos, newPos });
                } else {
                  setPendingDrag({ type: "client", id: String(marker.id), name: marker.data?.nome || "Cliente", oldPos, newPos });
                }
                setConfirmDragOpen(true);
              }}
              enableClustering={clientesFiltrados.length > 20}
              enableControls={true}
              flyTo={flyTarget}
              flyToZoom={highlightedClienteId ? 18 : 17}
              style={{ height: "600px", width: "100%" }}
            />
          </Card>
          <div className="flex items-center gap-3 mt-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={filterBairro} onValueChange={setFilterBairro}>
              <SelectTrigger className="w-[200px]"><SelectValue placeholder="Filtrar por bairro" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os bairros</SelectItem>
                {bairros.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">
              {autoGeocoding ? "Localizando endereços automaticamente..." : `${clientesFiltrados.length} cliente(s) no mapa`}
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-500" /> Sem localização ({semCoordenadas.length})
          </h3>
          <div className="max-h-[560px] overflow-y-auto space-y-2 pr-1">
            {semCoordenadas.map(c => (
              <Card key={c.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => startPlacing(c.id)}>
                <CardContent className="pt-3 pb-3">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{c.nome}</p>
                      {c.bairro && <p className="text-xs text-muted-foreground">{c.bairro}</p>}
                    </div>
                    <Badge variant={getStatusLabel(autoGeocodeStatus[c.id]).variant} className="shrink-0 text-[10px]">
                      {getStatusLabel(autoGeocodeStatus[c.id]).label}
                    </Badge>
                  </div>
                  {c.endereco && <p className="text-xs text-muted-foreground truncate">{c.endereco}</p>}
                  <Badge variant="outline" className="mt-2 text-[10px]">Clique para posicionar</Badge>
                </CardContent>
              </Card>
            ))}
            {semCoordenadas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Todos os clientes estão no mapa! 🎉</p>
            )}
          </div>
        </div>
      </div>

      <AlertDialog open={confirmDragOpen} onOpenChange={(v) => {
        if (!v) { setConfirmDragOpen(false); setPendingDrag(null); setMapKey(k => k + 1); loadClientes(false); }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar nova posição?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDrag && (
                <>
                  Deseja mover <strong>{pendingDrag.name}</strong> para a nova localização?
                  {pendingDrag.type === "factory" && " Isso atualizará o ponto de referência da fábrica para cálculo de distâncias."}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setPendingDrag(null); setMapKey(k => k + 1); loadClientes(false); }}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
              if (!pendingDrag) return;
              setConfirmDragOpen(false);
              const { type, id, name, oldPos, newPos } = pendingDrag;
              try {
                if (type === "factory") {
                  const { error } = await (supabase as any).from("factories").update({ latitude: newPos[0], longitude: newPos[1] }).eq("id", id);
                  if (error) throw error;
                  setFactoryCenter(newPos);
                } else {
                  const { error } = await (supabase as any).from("clientes").update({ latitude: newPos[0], longitude: newPos[1] }).eq("id", id);
                  if (error) throw error;
                  await loadClientes(false);
                }
                toast({
                  title: `📍 ${name} reposicionado`,
                  description: (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs">Nova posição salva.</span>
                      <Button size="sm" variant="outline" className="h-6 text-xs gap-1" onClick={async () => {
                        try {
                          if (type === "factory") {
                            await (supabase as any).from("factories").update({ latitude: oldPos[0], longitude: oldPos[1] }).eq("id", id);
                            setFactoryCenter(oldPos);
                          } else {
                            await (supabase as any).from("clientes").update({ latitude: oldPos[0], longitude: oldPos[1] }).eq("id", id);
                            await loadClientes(false);
                          }
                          toast({ title: "↩️ Posição restaurada", description: `${name} voltou à posição anterior.` });
                        } catch (e: any) { toast({ title: "Erro ao desfazer", description: e.message, variant: "destructive" }); }
                      }}>
                        <Undo2 className="h-3 w-3" /> Desfazer
                      </Button>
                    </div>
                  ),
                  duration: 8000,
                });
              } catch (e: any) {
                toast({ title: "Erro ao salvar posição", description: e.message, variant: "destructive" });
              }
              setPendingDrag(null);
            }}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
