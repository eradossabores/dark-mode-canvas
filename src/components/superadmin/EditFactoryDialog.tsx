import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Upload } from "lucide-react";
import { extractColorsFromImage } from "@/lib/color-extract";

interface EditFactoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  factory: {
    id: string;
    name: string;
    logo_url: string | null;
    max_collaborators: number;
    latitude?: number | null;
    longitude?: number | null;
    subscription?: {
      amount: number;
    };
  };
  onSaved: () => void;
}

export default function EditFactoryDialog({ open, onOpenChange, factory, onSaved }: EditFactoryDialogProps) {
  const [name, setName] = useState(factory.name);
  const [maxCollab, setMaxCollab] = useState(factory.max_collaborators);
  const [amount, setAmount] = useState(factory.subscription?.amount ?? 99.90);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(factory.logo_url);
  const [latitude, setLatitude] = useState(factory.latitude?.toString() || "");
  const [longitude, setLongitude] = useState(factory.longitude?.toString() || "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      let logoUrl = factory.logo_url;
      let theme: any = undefined;

      // Upload new logo if changed
      if (logoFile) {
        const fileExt = logoFile.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('factory-logos')
          .upload(fileName, logoFile, { contentType: logoFile.type });
        if (uploadError) throw new Error("Erro ao enviar logo: " + uploadError.message);
        const { data: urlData } = supabase.storage.from('factory-logos').getPublicUrl(fileName);
        logoUrl = urlData.publicUrl;
        theme = await extractColorsFromImage(logoFile);
      }

      // Update factory
      const updateData: any = {
        name,
        max_collaborators: maxCollab,
        logo_url: logoUrl,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
      };
      if (theme) updateData.theme = theme;

      const { error: factoryError } = await (supabase as any)
        .from("factories")
        .update(updateData)
        .eq("id", factory.id);

      if (factoryError) throw factoryError;

      // Update subscription amount
      const { error: subError } = await (supabase as any)
        .from("subscriptions")
        .update({ amount })
        .eq("factory_id", factory.id);

      if (subError) throw subError;

      toast({ title: "Fábrica atualizada!" });
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar Fábrica</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {/* Logo */}
          <div>
            <Label>Logomarca</Label>
            <div className="mt-1 flex items-center gap-4">
              {logoPreview ? (
                <div className="relative">
                  <img src={logoPreview} alt="Logo" className="h-16 w-16 rounded-lg object-contain border border-border bg-muted" />
                  <button
                    type="button"
                    onClick={() => { setLogoFile(null); setLogoPreview(null); }}
                    className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center text-xs"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 transition-colors bg-muted/30">
                  <Upload className="h-5 w-5 text-muted-foreground" />
                  <span className="text-[9px] text-muted-foreground mt-0.5">Logo</span>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setLogoFile(file);
                        setLogoPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
              )}
              <p className="text-[11px] text-muted-foreground flex-1">
                Altere a logomarca. O tema será recalculado automaticamente.
              </p>
            </div>
          </div>

          <div>
            <Label>Nome da Fábrica</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Máx. Colaboradores</Label>
            <Input
              type="number"
              min={1}
              value={maxCollab}
              onChange={(e) => setMaxCollab(parseInt(e.target.value) || 1)}
            />
          </div>

          <div>
            <Label>Valor Mensal (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min={0}
              value={amount}
              onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Latitude</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="Ex: 2.8195"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value)}
              />
            </div>
            <div>
              <Label>Longitude</Label>
              <Input
                type="number"
                step="0.0001"
                placeholder="Ex: -60.6714"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value)}
              />
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground -mt-2">📍 Coordenadas da fábrica (usadas como referência no mapa)</p>

          <Button className="w-full" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
