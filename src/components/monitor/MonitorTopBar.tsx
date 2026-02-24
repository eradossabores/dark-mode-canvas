import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, Package, Volume2, VolumeX, Minimize2, Smartphone, RefreshCw } from "lucide-react";

interface MonitorTopBarProps {
  isFullPage: boolean;
  activeCount: number;
  aguardandoCount: number;
  emProducaoCount: number;
  totalGelos: number;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onToggleFullPage: () => void;
  refreshCountdown: number;
}

export default function MonitorTopBar({
  isFullPage,
  activeCount,
  aguardandoCount,
  emProducaoCount,
  totalGelos,
  soundEnabled,
  onToggleSound,
  onToggleFullPage,
  refreshCountdown,
}: MonitorTopBarProps) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isFullPage) return null;

  const hours = now.getHours().toString().padStart(2, "0");
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const seconds = now.getSeconds().toString().padStart(2, "0");

  return (
    <div className="fixed top-0 left-0 right-0 z-[60] bg-card/95 backdrop-blur-md border-b border-border shadow-lg px-4 py-2 flex items-center justify-between">
      {/* Left: Clock */}
      <div className="flex items-center gap-3">
        <Clock className="h-5 w-5 text-primary" />
        <span className="text-2xl font-extrabold font-mono tracking-wider text-foreground tabular-nums">
          {hours}:{minutes}
          <span className="text-muted-foreground text-lg">:{seconds}</span>
        </span>
      </div>

      {/* Center: Summary badges */}
      <div className="flex items-center gap-3">
        <Badge className="bg-amber-500 text-white text-sm px-3 py-1 font-bold">
          ⏳ {aguardandoCount} aguardando
        </Badge>
        <Badge className="bg-blue-500 text-white text-sm px-3 py-1 font-bold">
          🔨 {emProducaoCount} em andamento
        </Badge>
        <Badge variant="secondary" className="text-sm px-3 py-1 font-bold">
          <Package className="h-4 w-4 mr-1 inline" />
          {totalGelos.toLocaleString()} gelos em estoque
        </Badge>
      </div>

      {/* Right: Controls */}
      <div className="flex items-center gap-2">
        {/* Refresh countdown */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted rounded-full px-3 py-1.5">
          <RefreshCw className={`h-3.5 w-3.5 ${refreshCountdown <= 5 ? "animate-spin" : ""}`} />
          <span className="tabular-nums font-mono font-bold">{refreshCountdown}s</span>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSound}
          title={soundEnabled ? "Desativar alertas sonoros" : "Ativar alertas sonoros"}
        >
          {soundEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
        </Button>

        <Button variant="default" size="sm" onClick={onToggleFullPage} className="gap-1.5">
          <Minimize2 className="h-4 w-4" /> Sair
        </Button>
      </div>
    </div>
  );
}
