import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Eye } from "lucide-react";

interface Props {
  onPDF: () => void;
  onExcel: () => void;
  onPreview: () => void;
  previewLoaded?: boolean;
}

export default function ExportButtons({ onPDF, onExcel, onPreview, previewLoaded = false }: Props) {
  return (
    <div className="flex gap-2">
      <Button size="sm" onClick={onPreview}>
        <Eye className="h-4 w-4 mr-1" /> Visualizar Relatório
      </Button>
      <Button size="sm" variant="outline" onClick={onPDF} disabled={!previewLoaded}>
        <FileText className="h-4 w-4 mr-1" /> PDF
      </Button>
      <Button size="sm" variant="outline" onClick={onExcel} disabled={!previewLoaded}>
        <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
      </Button>
    </div>
  );
}
