import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const STATUS_OPTIONS = [
  { value: "visitado", label: "✅ Visitado" },
  { value: "interessado", label: "🤝 Interessado" },
  { value: "pedido_fechado", label: "🎉 Pedido Fechado" },
  { value: "retornar", label: "🔄 Retornar Outro Dia" },
  { value: "sem_interesse", label: "❌ Sem Interesse" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: any) => void;
  prospectoNome: string;
}

export default function RegistrarVisitaDialog({ open, onOpenChange, onSubmit, prospectoNome }: Props) {
  const [form, setForm] = useState({
    resultado: "visitado",
    produto_apresentado: "Gelos saborizados premium (linha completa)",
    feedback: "",
    proxima_acao: "",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Registrar Visita - {prospectoNome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Resultado da Visita</Label>
            <Select value={form.resultado} onValueChange={v => setForm({ ...form, resultado: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STATUS_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Produto Apresentado</Label><Input value={form.produto_apresentado} onChange={e => setForm({ ...form, produto_apresentado: e.target.value })} /></div>
          <div><Label>Feedback do Cliente</Label><Textarea value={form.feedback} onChange={e => setForm({ ...form, feedback: e.target.value })} placeholder="O que o cliente disse..." /></div>
          <div><Label>Próxima Ação</Label><Input value={form.proxima_acao} onChange={e => setForm({ ...form, proxima_acao: e.target.value })} placeholder="Ex: Retornar sexta com amostras" /></div>
          <Button className="w-full" onClick={() => onSubmit(form)}>Registrar Visita</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
