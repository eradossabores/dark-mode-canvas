import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import logo from "@/assets/logo.png";

export default function Cadastro() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();

  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [valid, setValid] = useState(false);
  const [inviteRole, setInviteRole] = useState("");

  useEffect(() => {
    if (!token) {
      setValidating(false);
      return;
    }
    // Validate token
    (async () => {
      const { data } = await (supabase as any)
        .from("invites")
        .select("*")
        .eq("token", token)
        .is("used_by", null)
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      
      if (data) {
        setValid(true);
        setInviteRole(data.role);
      }
      setValidating(false);
    })();
  }, [token]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!nome || !email || !password) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Senha deve ter pelo menos 6 caracteres", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      // Sign up
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { nome } },
      });
      if (signUpError) throw signUpError;

      if (!signUpData.user) throw new Error("Erro ao criar conta");

      // Call edge function to process invite
      const { error: fnError } = await supabase.functions.invoke("process-invite", {
        body: { token, user_id: signUpData.user.id },
      });

      if (fnError) {
        console.error("Invite processing error:", fnError);
        // Even if invite processing fails, account was created
      }

      toast({
        title: "Conta criada com sucesso!",
        description: "Você já pode fazer login.",
      });
      navigate("/login");
    } catch (e: any) {
      toast({ title: "Erro ao criar conta", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }

  if (validating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100 dark:from-sky-950 dark:via-gray-900 dark:to-cyan-950">
        <p className="text-muted-foreground">Validando convite...</p>
      </div>
    );
  }

  if (!token || !valid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100 dark:from-sky-950 dark:via-gray-900 dark:to-cyan-950 px-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <p className="text-lg font-semibold text-destructive">Convite inválido ou expirado</p>
            <p className="text-sm text-muted-foreground">Solicite um novo link de convite ao administrador.</p>
            <Button variant="outline" onClick={() => navigate("/login")}>Ir para Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-sky-50 to-cyan-100 dark:from-sky-950 dark:via-gray-900 dark:to-cyan-950 px-4">
      <Card className="w-full max-w-md shadow-2xl border-sky-200/50">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <img src={logo} alt="A Era dos Sabores" className="h-16 w-16 rounded-lg shadow-md" />
          </div>
          <CardTitle className="text-2xl font-bold">Criar sua conta</CardTitle>
          <p className="text-sm text-muted-foreground">
            Convite para acesso: <span className="font-medium capitalize">{inviteRole === "admin" ? "Administrador" : "Produção"}</span>
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome completo</Label>
              <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Seu nome" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" />
            </div>
            <div>
              <Label htmlFor="password">Senha</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Criando conta..." : "Criar Conta"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
