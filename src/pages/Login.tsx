import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import icetechLogo from "@/assets/icetech-logo.png";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { user, role, factoryId, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading || !user) return;

    if (role === "super_admin") {
      // Se o super_admin tem uma fábrica vinculada, entra direto no painel dela
      if (factoryId) {
        navigate("/painel", { replace: true });
      } else {
        navigate("/super-admin", { replace: true });
      }
      return;
    }

    if (role === "producao") {
      navigate("/painel/producao", { replace: true });
      return;
    }

    navigate("/painel", { replace: true });
  }, [authLoading, user, role, factoryId, navigate]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: "Preencha email e senha", variant: "destructive" });
      return;
    }

    setLoading(true);

    let finished = false;
    const watchdog = window.setTimeout(() => {
      if (finished) return;
      finished = true;
      setLoading(false);
      toast({
        title: "Login em processamento",
        description: "A autenticação já foi enviada. Se não redirecionar, tente novamente.",
      });
    }, 12000);

    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (finished) return;

      if (error) {
        finished = true;
        window.clearTimeout(watchdog);
        setLoading(false);
        toast({ title: "Erro ao entrar", description: error.message, variant: "destructive" });
        return;
      }

      // Em sucesso, o redirecionamento é feito pelo useEffect baseado na sessão/role.
      finished = true;
      window.clearTimeout(watchdog);
      setLoading(false);
    } catch (error: any) {
      if (finished) return;
      finished = true;
      window.clearTimeout(watchdog);
      setLoading(false);
      toast({
        title: "Erro ao entrar",
        description: error?.message || "Falha inesperada no login",
        variant: "destructive",
      });
    }
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    try {
      const { error } = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (error) {
        toast({ title: "Erro ao entrar com Google", description: String(error), variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Erro ao entrar com Google", description: e.message, variant: "destructive" });
    }
    setGoogleLoading(false);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 px-4 py-8">
      {/* Logo */}
      <div className="mb-6 flex flex-col items-center">
        <img
          src={icetechLogo}
          alt="ICETECH"
          className="h-28 w-28 sm:h-36 sm:w-36 object-contain drop-shadow-2xl"
        />
      </div>

      <Card className="w-full max-w-md shadow-2xl border-blue-500/20 bg-card/95 backdrop-blur-sm">
        <CardHeader className="text-center space-y-1 pb-4">
          <CardTitle className="text-2xl font-bold tracking-wide">Acesso ao Sistema</CardTitle>
          <p className="text-sm text-muted-foreground">Entre com suas credenciais</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="relative my-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
              ou
            </span>
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogleLogin}
            disabled={googleLoading}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            {googleLoading ? "Entrando..." : "Entrar com Google"}
          </Button>

          <p className="text-xs text-center text-muted-foreground mt-3">
            Colaboradores: entre com Google e aguarde aprovação do administrador.
          </p>
        </CardContent>
      </Card>

      <p className="text-xs text-blue-300/50 mt-6 text-center max-w-xs">
        Sistema de gestão exclusivo para fábricas de gelos saborizados
      </p>
    </div>
  );
}
