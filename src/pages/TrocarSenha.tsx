import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Lock } from "lucide-react";

export default function TrocarSenha() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [nova, setNova] = useState("");
  const [conf, setConf] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (nova.length < 8) return toast({ title: "Senha muito curta", description: "Mínimo 8 caracteres", variant: "destructive" });
    if (nova !== conf) return toast({ title: "Senhas diferentes", variant: "destructive" });
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: nova });
      if (error) throw error;
      if (user?.id) {
        await (supabase as any).from("profiles").update({ must_change_password: false }).eq("id", user.id);
      }
      toast({ title: "Senha alterada com sucesso" });
      navigate("/painel/operacao-externa", { replace: true });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[70vh] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2"><Lock className="h-8 w-8 text-primary" /></div>
          <CardTitle>Trocar senha</CardTitle>
          <p className="text-sm text-muted-foreground">Defina uma nova senha para continuar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div><Label>Nova senha</Label><Input type="password" value={nova} onChange={(e) => setNova(e.target.value)} required /></div>
            <div><Label>Confirmar senha</Label><Input type="password" value={conf} onChange={(e) => setConf(e.target.value)} required /></div>
            <Button type="submit" className="w-full" disabled={loading}>{loading ? "Salvando..." : "Salvar nova senha"}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}