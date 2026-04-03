import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { CalendarIcon, Plus, Trash2, CalendarDays } from "lucide-react";

interface Holiday {
  id: string;
  date: string;
  description: string;
  type: string;
  created_at: string;
}

const HOLIDAY_TYPES = [
  { value: "feriado", label: "Feriado" },
  { value: "folga", label: "Folga" },
  { value: "ponto_facultativo", label: "Ponto Facultativo" },
];

export function AdminHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [date, setDate] = useState<Date>();
  const [description, setDescription] = useState("");
  const [type, setType] = useState("feriado");
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));

  useEffect(() => {
    loadHolidays();
  }, [filterYear]);

  const loadHolidays = async () => {
    const { data, error } = await supabase
      .from("holidays")
      .select("*")
      .gte("date", `${filterYear}-01-01`)
      .lte("date", `${filterYear}-12-31`)
      .order("date", { ascending: true });

    if (error) {
      console.error(error);
      toast.error("Erro ao carregar feriados.");
      return;
    }
    setHolidays(data || []);
  };

  const handleAdd = async () => {
    if (!date) {
      toast.error("Selecione uma data.");
      return;
    }
    if (!description.trim()) {
      toast.error("Informe a descrição.");
      return;
    }

    setLoading(true);
    const dateStr = format(date, "yyyy-MM-dd");

    const { error } = await supabase.from("holidays").insert({
      date: dateStr,
      description: description.trim(),
      type,
    });

    if (error) {
      if (error.code === "23505") {
        toast.error("Já existe um feriado/folga nesta data.");
      } else {
        toast.error("Erro ao adicionar: " + error.message);
      }
    } else {
      toast.success("Feriado/folga adicionado!");
      setDate(undefined);
      setDescription("");
      setType("feriado");
      await loadHolidays();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover este feriado/folga?")) return;

    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao remover.");
    } else {
      toast.success("Removido com sucesso!");
      setHolidays((prev) => prev.filter((h) => h.id !== id));
    }
  };

  const getTypeBadge = (t: string) => {
    switch (t) {
      case "feriado":
        return <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-red-600 border-red-300">Feriado</Badge>;
      case "folga":
        return <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-blue-600 border-blue-300">Folga</Badge>;
      case "ponto_facultativo":
        return <Badge variant="outline" className="text-[9px] px-1.5 py-0 text-amber-600 border-amber-300">Facultativo</Badge>;
      default:
        return <Badge variant="outline" className="text-[9px] px-1.5 py-0">{t}</Badge>;
    }
  };

  const holidayDates = holidays.map((h) => new Date(h.date + "T12:00:00"));

  return (
    <div className="space-y-4">
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            Feriados e Folgas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Data</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal text-sm h-9",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="w-3.5 h-3.5 mr-2" />
                    {date ? format(date, "dd/MM/yyyy") : "Selecione"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    locale={ptBR}
                    className={cn("p-3 pointer-events-auto")}
                    modifiers={{ holiday: holidayDates }}
                    modifiersStyles={{ holiday: { backgroundColor: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))" } }}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Descrição</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex: Natal, Folga coletiva..."
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Tipo</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {HOLIDAY_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAdd} disabled={loading} size="sm" className="gap-1.5 h-9">
              <Plus className="w-3.5 h-3.5" />
              {loading ? "Salvando..." : "Adicionar"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-display">
              Calendário {filterYear}
            </CardTitle>
            <Select value={filterYear} onValueChange={setFilterYear}>
              <SelectTrigger className="w-[90px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[2025, 2026, 2027, 2028].map((y) => (
                  <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum feriado ou folga cadastrado para {filterYear}.
            </p>
          ) : (
            <div className="space-y-1.5">
              {holidays.map((h) => {
                const [y, m, d] = h.date.split("-");
                return (
                  <div
                    key={h.id}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/40 hover:bg-muted/60 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-mono font-medium min-w-[60px]">
                        {d}/{m}
                      </span>
                      {getTypeBadge(h.type)}
                      <span className="text-sm">{h.description}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => handleDelete(h.id)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
