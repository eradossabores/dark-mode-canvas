import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";

interface Props {
  onPDF: () => void;
  onExcel: () => void;
}

export default function ExportButtons({ onPDF, onExcel }: Props) {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={onPDF}>
        <FileText className="h-4 w-4 mr-1" /> PDF
      </Button>
      <Button size="sm" variant="outline" onClick={onExcel}>
        <FileSpreadsheet className="h-4 w-4 mr-1" /> Excel
      </Button>
    </div>
  );
}
