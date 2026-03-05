import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { MapPin, Save, X, Users, RefreshCw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Fix leaflet default icons
delete (L.Icon.Default.prototype as any)._getIconUrl;

const createSvgIcon = (color: string) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="25" height="41" viewBox="0 0 25 41"><path d="M12.5 0C5.6 0 0 5.6 0 12.5C0 21.9 12.5 41 12.5 41S25 21.9 25 12.5C25 5.6 19.4 0 12.5 0z" fill="${color}" stroke="#fff" stroke-width="1.5"/><circle cx="12.5" cy="12.5" r="5" fill="#fff"/></svg>`;
  return L.divIcon({
    html: svg,
    className: '',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
  });
};

const clienteIcon = createSvgIcon('#2563eb');
const pendingIcon = createSvgIcon('#dc2626');

// Boa Vista center coordinates
const BOA_VISTA_CENTER: [number, number] = [2.8195, -60.6714];

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

function ClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyToClient({ target }: { target: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (target) {
      map.flyTo([target.lat, target.lng], 17, { duration: 1.2 });
    }
  }, [target, map]);
  return null;
}

export default function MapaClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [placingClienteId, setPlacingClienteId] = useState<string | null>(null);
  const [tempMarker, setTempMarker] = useState<[number, number] | null>(null);
  const [filterBairro, setFilterBairro] = useState<string>("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [flyTarget, setFlyTarget] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => { loadClientes(); }, []);

  async function loadClientes() {
    const { data } = await (supabase as any)
      .from("clientes")
      .select("id, nome, bairro, endereco, telefone, status, latitude, longitude, possui_freezer")
      .eq("status", "ativo")
      .not("nome", "ilike", "%amostra%")
      .not("nome", "ilike", "%avulso%")
      .order("nome");
    setClientes(data || []);
  }

  const semCoordenadas = clientes.filter(c => !c.latitude || !c.longitude);
  const comCoordenadas = clientes.filter(c => c.latitude && c.longitude);
  const bairros = [...new Set(clientes.map(c => c.bairro).filter(Boolean))].sort() as string[];

  const clientesFiltrados = filterBairro === "todos"
    ? comCoordenadas
    : comCoordenadas.filter(c => c.bairro === filterBairro);

  const searchResults = searchTerm.length >= 2
    ? comCoordenadas.filter(c => c.nome.toLowerCase().includes(searchTerm.toLowerCase()))
    : [];

  function focusCliente(c: Cliente) {
    if (c.latitude && c.longitude) {
      setFlyTarget({ lat: c.latitude, lng: c.longitude });
      setSearchTerm("");
    }
  }

  function startPlacing(clienteId: string) {
    setPlacingClienteId(clienteId);
    setTempMarker(null);
    toast({ title: "Clique no mapa para posicionar o cliente" });
  }

  function handleMapClick(lat: number, lng: number) {
    if (!placingClienteId) return;
    setTempMarker([lat, lng]);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Mapa de Clientes</h1>
        </div>
        <Button variant="outline" size="sm" onClick={loadClientes}>
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
            <div style={{ height: "600px" }}>
              <MapContainer
                center={BOA_VISTA_CENTER}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <ClickHandler onMapClick={handleMapClick} />
                <FlyToClient target={flyTarget} />
                {/* Client markers */}
                {clientesFiltrados.map(c => (
                  <Marker
                    key={c.id}
                    position={[c.latitude!, c.longitude!]}
                    icon={clienteIcon}
                  >
                    <Popup>
                      <div className="min-w-[180px]">
                        <p className="font-bold text-sm">{c.nome}</p>
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
                    </Popup>
                  </Marker>
                ))}

                {/* Temp marker for placing */}
                {tempMarker && (
                  <Marker position={tempMarker} icon={pendingIcon}>
                    <Popup>
                      <p className="font-bold text-sm">{placingCliente?.nome}</p>
                      <p className="text-xs text-gray-500">Nova posição</p>
                    </Popup>
                  </Marker>
                )}
              </MapContainer>
            </div>
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
            <span className="text-sm text-muted-foreground">{clientesFiltrados.length} cliente(s) no mapa</span>
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
                  <p className="font-medium text-sm truncate">{c.nome}</p>
                  {c.bairro && <p className="text-xs text-muted-foreground">{c.bairro}</p>}
                  {c.endereco && <p className="text-xs text-muted-foreground truncate">{c.endereco}</p>}
                  <Badge variant="outline" className="text-[10px] mt-1">Clique para posicionar</Badge>
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
