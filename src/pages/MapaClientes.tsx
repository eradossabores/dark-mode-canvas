import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AdvancedMap, createLabeledSvgIcon, createSvgIcon, MAP_ICONS, type MapMarker } from "@/components/ui/interactive-map";
import L from "leaflet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { MapPin, Save, X, Users, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { geocodeClienteAddress, hasAddressForGeocoding } from "@/lib/geocoding";
import { useAuth } from "@/contexts/AuthContext";

const clienteIcon = createSvgIcon('#2563eb');
const pendingIcon = createSvgIcon('#dc2626');
const DEFAULT_CENTER: [number, number] = [2.8195, -60.6714];

// Custom factory icon - distinct building shape
const createFactoryIcon = (label: string) => {
  const w = 44;
  const h = 44;
  const labelWidth = Math.max(160, Math.min(240, label.length * 7.4));
  const labelHeight = 52;
  const gap = 6;
  const totalHeight = h + labelHeight + gap;
  const totalWidth = Math.max(w, labelWidth);

  return L.divIcon({
    html: `
      <div style="display:flex; flex-direction:column; align-items:center; width:${totalWidth}px; height:${totalHeight}px;">
        <div style="width:${labelWidth}px; min-height:${labelHeight}px; padding:4px; margin-bottom:${gap}px; border-radius:22px; background:linear-gradient(180deg, rgba(255,255,255,0.96), rgba(255,255,255,0.88)); border:2px solid rgba(234,88,12,0.4); box-shadow:0 22px 40px -24px rgba(15,23,42,0.48), 0 0 16px -4px rgba(234,88,12,0.25); backdrop-filter:blur(16px);">
          <div style="display:flex; align-items:center; gap:10px; min-height:${labelHeight - 8}px; padding:0 12px; border-radius:18px; background:rgba(255,255,255,0.72);">
            <div style="font-size:20px; flex-shrink:0;">🏭</div>
            <div style="flex:1; min-width:0; color:#ea580c; font-family:'DM Sans', system-ui, sans-serif; font-size:12.5px; font-weight:900; letter-spacing:-0.03em; line-height:1.1; text-transform:uppercase; display:-webkit-box; -webkit-box-orient:vertical; -webkit-line-clamp:2; overflow:hidden; text-overflow:ellipsis;">
              ${label}
            </div>
          </div>
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="20" fill="#ea580c" stroke="#fff" stroke-width="2.5" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.3))"/>
          <g transform="translate(10, 10)" fill="#fff">
            <rect x="0" y="8" width="8" height="16" rx="1"/>
            <rect x="10" y="4" width="8" height="20" rx="1"/>
            <rect x="3" y="2" width="3" height="8" rx="1"/>
            <rect x="13" y="0" width="2" height="5" rx="0.5"/>
            <rect x="20" y="10" width="4" height="14" rx="1"/>
          </g>
        </svg>
      </div>
    `,
    className: '',
    iconSize: [totalWidth, totalHeight] as [number, number],
    iconAnchor: [totalWidth / 2, totalHeight] as [number, number],
    popupAnchor: [1, -totalHeight + 10] as [number, number],
  });
};

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

  // Load factory location
  useEffect(() => {
    if (!factoryId) return;
    (supabase as any).from("factories").select("latitude, longitude, name").eq("id", factoryId).maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setFactoryName(data.name || "");
          if (data.latitude != null && data.longitude != null) {
            setFactoryCenter([data.latitude, data.longitude]);
          }
        }
      });
  }, [factoryId]);

  function getStatusLabel(status?: AutoGeocodeStatus) {
    switch (status) {
      case "localizado":
        return { label: "Localizado", variant: "default" as const };
      case "nao-encontrado":
        return { label: "Não encontrado", variant: "destructive" as const };
      case "pendente":
      default:
        return { label: "Pendente", variant: "secondary" as const };
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
        if (!coords) {
          setAutoGeocodeStatus((prev) => ({ ...prev, [cliente.id]: "nao-encontrado" }));
          continue;
        }

        const { error } = await (supabase as any)
          .from("clientes")
          .update({ latitude: coords.lat, longitude: coords.lng })
          .eq("id", cliente.id);

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
      toast({
        title: "📍 Clientes adicionados ao mapa",
        description: `${atualizados} cliente(s) com endereço foram posicionados automaticamente.`,
      });
      await loadClientes(false);
    }
  }, []);

  useEffect(() => { void loadClientes(); }, [factoryId]);

  useEffect(() => {
    if (!highlightedClienteId || clientes.length === 0) return;

    const cliente = clientes.find((item) => item.id === highlightedClienteId);
    if (!cliente) return;

    if (cliente.latitude != null && cliente.longitude != null) {
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

    if (runAutoGeocode) {
      await autoGeocodeMissingClientes(lista);
    }
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
    if (c.latitude && c.longitude) {
      setFlyTarget([c.latitude, c.longitude]);
      setSearchTerm("");
    }
  }

  function startPlacing(clienteId: string) {
    setPlacingClienteId(clienteId);
    setTempMarker(null);
    toast({ title: "Clique no mapa para posicionar o cliente" });
  }

  function handleMapClick(latlng: L.LatLng) {
    if (!placingClienteId) return;
    setTempMarker([latlng.lat, latlng.lng]);
  }

  async function savePosition() {
    if (!placingClienteId || !tempMarker) return;
    try {
      const { error } = await (supabase as any)
        .from("clientes")
        .update({ latitude: tempMarker[0], longitude: tempMarker[1] })
        .eq("id", placingClienteId);
      if (error) throw error;
      toast({ title: "Localização salva!" });
      setPlacingClienteId(null);
      setTempMarker(null);
      loadClientes();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  function cancelPlacing() {
    setPlacingClienteId(null);
    setTempMarker(null);
  }

  async function removePosition(clienteId: string) {
    try {
      await (supabase as any)
        .from("clientes")
        .update({ latitude: null, longitude: null })
        .eq("id", clienteId);
      toast({ title: "Localização removida" });
      loadClientes();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  }

  const placingCliente = clientes.find(c => c.id === placingClienteId);

  // Build markers for AdvancedMap
  const markers: MapMarker[] = [
    ...clientesFiltrados.map(c => ({
      id: c.id,
      position: [c.latitude!, c.longitude!] as [number, number],
      icon: createLabeledSvgIcon(
        c.id === highlightedClienteId ? '#d97706' : '#2563eb',
        c.nome,
        c.id === highlightedClienteId ? 'large' : 'medium'
      ),
      popup: {
        title: c.nome,
        content: (
          <div className="space-y-1">
            {c.bairro && <p className="text-xs text-gray-600">{c.bairro}</p>}
            {c.endereco && <p className="text-xs text-gray-500">{c.endereco}</p>}
            {c.telefone && <p className="text-xs text-gray-500">📞 {c.telefone}</p>}
            {c.possui_freezer && <p className="text-xs text-blue-600 font-medium mt-1">❄️ Possui Freezer</p>}
            <div className="flex gap-1 mt-2">
              <button
                className="text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
                onClick={() => startPlacing(c.id)}
              >
                Reposicionar
              </button>
              <button
                className="text-xs bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600"
                onClick={() => removePosition(c.id)}
              >
                Remover
              </button>
            </div>
          </div>
        ),
      },
      data: c,
    })),
    ...(tempMarker ? [{
      id: 'temp-marker',
      position: tempMarker,
      icon: pendingIcon,
      popup: {
        title: placingCliente?.nome || '',
        content: <p className="text-xs text-gray-500">Nova posição</p>,
      },
    }] : []),
    // Factory marker
    ...(factoryCenter[0] !== DEFAULT_CENTER[0] || factoryCenter[1] !== DEFAULT_CENTER[1] ? [{
      id: 'factory-marker',
      position: factoryCenter,
      icon: createFactoryIcon(factoryName || 'Fábrica'),
      popup: {
        title: `🏭 ${factoryName || 'Fábrica'}`,
        content: <p className="text-xs text-muted-foreground">Localização da fábrica (ponto de referência)</p>,
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

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Card><CardContent className="pt-3 pb-3 text-center">
          <p className="text-xl font-bold">{clientes.length}</p>
          <p className="text-xs text-muted-foreground">Clientes ativos</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center">
          <p className="text-xl font-bold text-primary">{comCoordenadas.length}</p>
          <p className="text-xs text-muted-foreground">No mapa</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center">
          <p className="text-xl font-bold text-amber-500">{semCoordenadas.length}</p>
          <p className="text-xs text-muted-foreground">Sem localização</p>
        </CardContent></Card>
        <Card><CardContent className="pt-3 pb-3 text-center">
          <p className="text-xl font-bold">{bairros.length}</p>
          <p className="text-xs text-muted-foreground">Bairros</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar cliente no mapa..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
            {searchResults.map(c => (
              <button
                key={c.id}
                className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                onClick={() => focusCliente(c)}
              >
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

      {/* Placing mode banner */}
      {placingClienteId && (
        <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-300 rounded-lg flex items-center justify-between">
          <div>
            <p className="font-bold text-sm">📍 Posicionando: {placingCliente?.nome}</p>
            <p className="text-xs text-muted-foreground">Clique no mapa para definir a localização</p>
          </div>
          <div className="flex gap-2">
            {tempMarker && (
              <Button size="sm" onClick={savePosition}>
                <Save className="h-4 w-4 mr-1" /> Salvar
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={cancelPlacing}>
              <X className="h-4 w-4 mr-1" /> Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Map */}
        <div className="lg:col-span-3">
          <Card className="overflow-hidden">
            <AdvancedMap
              center={factoryCenter}
              zoom={13}
              markers={markers}
              onMapClick={handleMapClick}
              enableClustering={clientesFiltrados.length > 20}
              enableControls={true}
              flyTo={flyTarget}
              flyToZoom={highlightedClienteId ? 18 : 17}
              style={{ height: "600px", width: "100%" }}
            />
          </Card>

          {/* Filter */}
          <div className="flex items-center gap-3 mt-3">
            <Users className="h-4 w-4 text-muted-foreground" />
            <Select value={filterBairro} onValueChange={setFilterBairro}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Filtrar por bairro" />
              </SelectTrigger>
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

        {/* Sidebar - clients without coordinates */}
        <div className="space-y-3">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-amber-500" />
            Sem localização ({semCoordenadas.length})
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
    </div>
  );
}
