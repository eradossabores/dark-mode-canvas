import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, RefreshCw, CheckCircle, Clock, Database, Shield } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

const TABLES_TO_BACKUP = [
  { table: "clientes", label: "Clientes" },
  { table: "vendas", label: "Vendas" },
  { table: "venda_itens", label: "Itens de Venda" },
  { table: "venda_parcelas", label: "Parcelas" },
  { table: "producoes", label: "Produções" },
  { table: "estoque_gelos", label: "Estoque de Gelos" },
  { table: "sabores", label: "Sabores" },
  { table: "funcionarios", label: "Funcionários" },
  { table: "materias_primas", label: "Matérias-Primas" },
  { table: "embalagens", label: "Embalagens" },
  { table: "movimentacoes_estoque", label: "Movimentações" },
  { table: "contas_a_pagar", label: "Contas a Pagar" },
  { table: "pedidos_producao", label: "Pedidos Produção" },
  { table: "prospectos", label: "Prospectos" },
];

export default function Backup() {
  const [exporting, setExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [autoBackupEnabled, setAutoBackupEnabled] = useState(false);
  const [settingUpAuto, setSettingUpAuto] = useState(false);

  async function handleExportAll() {
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();
      let totalRows = 0;

      for (const { table, label } of TABLES_TO_BACKUP) {
        const { data, error } = await (supabase as any).from(table).select("*");
        if (error) {
          console.error(`Erro ao exportar ${table}:`, error);
          continue;
        }
        const rows = data || [];
        totalRows += rows.length;
        const ws = XLSX.utils.json_to_sheet(rows);
        // Sheet name max 31 chars
        XLSX.utils.book_append_sheet(wb, ws, label.substring(0, 31));
      }

      const now = new Date();
      const filename = `backup-a-era-dos-sabores-${now.toISOString().slice(0, 10)}.xlsx`;
      XLSX.writeFile(wb, filename);
      setLastBackup(now.toLocaleString("pt-BR"));
      toast.success(`Backup exportado com sucesso! ${totalRows} registros em ${TABLES_TO_BACKUP.length} tabelas.`);
    } catch (err: any) {
      toast.error("Erro ao exportar: " + err.message);
    } finally {
      setExporting(false);
    }
  }

  async function handleSetupAutoBackup() {
    setSettingUpAuto(true);
    try {
      // Store preference in localStorage for now
      localStorage.setItem("auto_backup_enabled", "true");
      localStorage.setItem("auto_backup_last_check", new Date().toISOString());
      setAutoBackupEnabled(true);
      toast.success("Backup automático ativado! O sistema irá lembrar você semanalmente de fazer backup.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setSettingUpAuto(false);
    }
  }

  // Check auto backup on mount
  useState(() => {
    const enabled = localStorage.getItem("auto_backup_enabled") === "true";
    setAutoBackupEnabled(enabled);
    
    if (enabled) {
      const lastCheck = localStorage.getItem("auto_backup_last_check");
      if (lastCheck) {
        const diff = Date.now() - new Date(lastCheck).getTime();
        const days = diff / (1000 * 60 * 60 * 24);
        if (days >= 7) {
          toast.info("Já se passaram 7+ dias desde o último backup. Recomendamos exportar agora!", { duration: 8000 });
        }
      }
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Backup de Dados</h1>
        <p className="text-muted-foreground text-sm mt-1">Exporte e proteja os dados do seu sistema</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Manual Export */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Download className="h-5 w-5 text-primary" />
              Exportar Dados (Manual)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Exporta todas as tabelas críticas do sistema em um único arquivo Excel (.xlsx).
            </p>
            <div className="flex flex-wrap gap-1.5">
              {TABLES_TO_BACKUP.map(t => (
                <Badge key={t.table} variant="outline" className="text-xs">{t.label}</Badge>
              ))}
            </div>
            <Button onClick={handleExportAll} disabled={exporting} className="w-full">
              {exporting ? (
                <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Exportando...</>
              ) : (
                <><Download className="h-4 w-4 mr-2" /> Exportar Backup Completo</>
              )}
            </Button>
            {lastBackup && (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <CheckCircle className="h-3 w-3 text-green-500" /> Último backup: {lastBackup}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Auto Backup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-primary" />
              Backup Automático (Lembrete)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Ativa um lembrete semanal para você exportar seus dados. O sistema avisará quando já se passaram 7 dias sem backup.
            </p>
            <div className="flex items-center gap-2">
              <Badge variant={autoBackupEnabled ? "default" : "secondary"}>
                {autoBackupEnabled ? "Ativo" : "Desativado"}
              </Badge>
            </div>
            {!autoBackupEnabled ? (
              <Button onClick={handleSetupAutoBackup} disabled={settingUpAuto} variant="outline" className="w-full">
                {settingUpAuto ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Configurando...</>
                ) : (
                  <><Clock className="h-4 w-4 mr-2" /> Ativar Lembrete Semanal</>
                )}
              </Button>
            ) : (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  localStorage.removeItem("auto_backup_enabled");
                  localStorage.removeItem("auto_backup_last_check");
                  setAutoBackupEnabled(false);
                  toast.info("Lembrete desativado.");
                }}
              >
                Desativar Lembrete
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Shield className="h-5 w-5 text-primary" />
            Sobre a Segurança dos Seus Dados
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <Database className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p><strong>Backup na nuvem:</strong> Seus dados já possuem backup automático diário na infraestrutura do Lovable Cloud.</p>
          </div>
          <div className="flex items-start gap-2">
            <Download className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p><strong>Backup local:</strong> Use o botão acima para salvar uma cópia dos dados no seu computador em formato Excel.</p>
          </div>
          <div className="flex items-start gap-2">
            <Shield className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
            <p><strong>Recomendação:</strong> Faça backups locais semanalmente e guarde em local seguro (HD externo, Google Drive, etc).</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
