import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star } from "lucide-react";

const TIPOS = [
  { value: "bar", label: "Bar" },
  { value: "tabacaria", label: "Tabacaria" },
  { value: "distribuidora", label: "Distribuidora" },
  { value: "casa_noturna", label: "Casa Noturna" },
  { value: "evento_buffet", label: "Evento/Buffet" },
  { value: "restaurante_lounge", label: "Restaurante/Lounge" },
  { value: "lanchonete", label: "Lanchonete" },
  { value: "mercado", label: "Mercado" },
  { value: "outro", label: "Outro" },
];

const PRIORIDADES = [
  { value: "alta", label: "🔴 Alta" },
  { value: "media", label: "🟡 Média" },
  { value: "baixa", label: "🟢 Baixa" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: any) => void;
  initial?: any;
}

export default function ProspectoForm({ open, onOpenChange, onSubmit, initial }: Props) {
  const [form, setForm] = useState(initial || {
    nome: "", tipo: "bar", bairro: "", endereco: "", telefone: "",
    contato_nome: "", prioridade: "media", score: 3,
    observacoes_estrategicas: "", volume_potencial: "", perfil_publico: "",
    script_abordagem: "Olá! Trabalhamos com gelos saborizados premium, ideais para drinks diferenciados. Temos mais de 10 sabores e preços especiais para parceiros comerciais. Posso apresentar nossos produtos?",
  });

  const [hoverStar, setHoverStar] = useState(0);

  function handleSubmit() {
    if (!form.nome) return;
    onSubmit(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Editar Prospecto" : "Novo Prospecto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome do Estabelecimento *</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Prioridade</Label>
              <Select value={form.prioridade} onValueChange={v => setForm({ ...form, prioridade: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORIDADES.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div><Label>Bairro</Label><Input value={form.bairro} onChange={e => setForm({ ...form, bairro: e.target.value })} /></div>
            <div><Label>Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
          </div>

          <div><Label>Endereço</Label><Input value={form.endereco} onChange={e => setForm({ ...form, endereco: e.target.value })} /></div>
          <div><Label>Nome do Contato</Label><Input value={form.contato_nome} onChange={e => setForm({ ...form, contato_nome: e.target.value })} /></div>

          <div>
            <Label>Score (1-5 ⭐)</Label>
            <div className="flex gap-1 mt-1">
              {[1, 2, 3, 4, 5].map(s => (
                <button
                  key={s}
                  type="button"
                  onMouseEnter={() => setHoverStar(s)}
                  onMouseLeave={() => setHoverStar(0)}
                  onClick={() => setForm({ ...form, score: s })}
                >
                  <Star className={`h-6 w-6 transition-colors ${s <= (hoverStar || form.score) ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                </button>
              ))}
            </div>
          </div>

          <div><Label>Volume Potencial</Label><Input placeholder="Ex: 100 un/semana" value={form.volume_potencial} onChange={e => setForm({ ...form, volume_potencial: e.target.value })} /></div>
          <div><Label>Perfil do Público</Label><Input placeholder="Ex: Público premium, jovens 20-35" value={form.perfil_publico} onChange={e => setForm({ ...form, perfil_publico: e.target.value })} /></div>
          <div><Label>Observações Estratégicas</Label><Textarea placeholder="Ex: Fluxo alto à noite, funciona de qua-dom" value={form.observacoes_estrategicas} onChange={e => setForm({ ...form, observacoes_estrategicas: e.target.value })} /></div>
          <div><Label>Script de Abordagem</Label><Textarea rows={3} value={form.script_abordagem} onChange={e => setForm({ ...form, script_abordagem: e.target.value })} /></div>

          <Button className="w-full" onClick={handleSubmit}>{initial ? "Salvar" : "Cadastrar"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
