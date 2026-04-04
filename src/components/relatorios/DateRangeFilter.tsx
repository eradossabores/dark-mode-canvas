import { useState, useRef, useCallback } from "react";
import { format, parse, isValid } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

interface Props {
  startDate: Date | undefined;
  endDate: Date | undefined;
  onStartChange: (d: Date | undefined) => void;
  onEndChange: (d: Date | undefined) => void;
  children?: React.ReactNode;
}

function DateInput({ value, onChange, placeholder }: { value: Date | undefined; onChange: (d: Date | undefined) => void; placeholder: string }) {
  const [text, setText] = useState(value ? format(value, "dd/MM/yyyy") : "");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 8);
    let formatted = "";
    for (let i = 0; i < raw.length; i++) {
      if (i === 2 || i === 4) formatted += "/";
      formatted += raw[i];
    }
    setText(formatted);

    if (raw.length === 8) {
      const parsed = parse(formatted, "dd/MM/yyyy", new Date());
      if (isValid(parsed)) {
        onChange(parsed);
      }
    }
  }, [onChange]);

  const handleCalendarSelect = useCallback((d: Date | undefined) => {
    onChange(d);
    setText(d ? format(d, "dd/MM/yyyy") : "");
    setOpen(false);
  }, [onChange]);

  // Sync external changes
  const formatted = value ? format(value, "dd/MM/yyyy") : "";
  if (formatted && formatted !== text && document.activeElement !== inputRef.current) {
    // Will sync on next render via state
  }

  return (
    <div className="flex items-center gap-1">
      <Input
        ref={inputRef}
        value={text}
        onChange={handleTextChange}
        placeholder={placeholder}
        className="w-[120px] h-10 text-sm"
        maxLength={10}
        onBlur={() => {
          if (value) setText(format(value, "dd/MM/yyyy"));
        }}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-10 w-10 shrink-0">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar mode="single" selected={value} onSelect={handleCalendarSelect} initialFocus className="p-3 pointer-events-auto" />
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default function DateRangeFilter({ startDate, endDate, onStartChange, onEndChange, children }: Props) {
  return (
    <div className="flex flex-wrap items-end gap-3 mb-6 p-4 bg-card rounded-lg border">
      <div>
        <Label className="text-xs mb-1 block">Data Inicial</Label>
        <DateInput value={startDate} onChange={onStartChange} placeholder="dd/mm/aaaa" />
      </div>
      <div>
        <Label className="text-xs mb-1 block">Data Final</Label>
        <DateInput value={endDate} onChange={onEndChange} placeholder="dd/mm/aaaa" />
      </div>
      {children}
    </div>
  );
}
