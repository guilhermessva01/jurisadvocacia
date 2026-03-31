import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const REQUEST_TYPES = [
  { value: "folga", label: "Folga" },
  { value: "ferias", label: "Férias" },
  { value: "falta", label: "Aviso de Falta" },
  { value: "troca", label: "Troca de Dia" },
  { value: "ajuste", label: "Ajuste de Horário" },
];

const DAYS_OF_WEEK = [
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

interface AdjustmentDay {
  dayOfWeek: number;
  selected: boolean;
  startTime: string;
  endTime: string;
}

export function RequestForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [trocaDateOff, setTrocaDateOff] = useState("");
  const [trocaDateOn, setTrocaDateOn] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [adjustmentDays, setAdjustmentDays] = useState<AdjustmentDay[]>(
    DAYS_OF_WEEK.map(d => ({ dayOfWeek: d.value, selected: false, startTime: "08:00", endTime: "18:00" }))
  );

  const isVacation = type === "ferias";
  const isAdjustment = type === "ajuste";
  const isTroca = type === "troca";

  const toggleDay = (dayOfWeek: number) => {
    setAdjustmentDays(prev =>
      prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, selected: !d.selected } : d)
    );
  };

  const updateDayTime = (dayOfWeek: number, field: "startTime" | "endTime", value: string) => {
    setAdjustmentDays(prev =>
      prev.map(d => d.dayOfWeek === dayOfWeek ? { ...d, [field]: value } : d)
    );
  };

  const buildReason = () => {
    if (isAdjustment) {
      const selectedDays = adjustmentDays.filter(d => d.selected);
      if (selectedDays.length === 0) return "";
      const details = selectedDays.map(d => {
        const dayLabel = DAYS_OF_WEEK.find(dw => dw.value === d.dayOfWeek)?.label;
        return `${dayLabel}: ${d.startTime} - ${d.endTime}`;
      }).join("\n");
      return `Ajuste de horário solicitado:\n${details}\n\nMotivo: ${reason.trim()}`;
    }
    if (isTroca) {
      return `Dia que vai faltar: ${trocaDateOff}\nDia que irá repor: ${trocaDateOn}\n\nMotivo: ${reason.trim()}`;
    }
    return reason.trim();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !type) {
      toast.error("Selecione o tipo de solicitação.");
      return;
    }

    if (isVacation) {
      if (!date || !endDate) {
        toast.error("Informe a data de início e fim das férias.");
        return;
      }
      if (endDate < date) {
        toast.error("Data final deve ser após a data de início.");
        return;
      }
    } else if (isTroca) {
      if (!trocaDateOff || !trocaDateOn) {
        toast.error("Informe o dia que vai faltar e o dia que irá repor.");
        return;
      }
    } else if (!isAdjustment && !date) {
      toast.error("Informe a data.");
      return;
    }

    if (isAdjustment) {
      const selectedDays = adjustmentDays.filter(d => d.selected);
      if (selectedDays.length === 0) {
        toast.error("Selecione pelo menos um dia para ajuste.");
        return;
      }
    }

    if (!reason.trim()) {
      toast.error("Informe o motivo.");
      return;
    }

    setLoading(true);
    const finalReason = buildReason();
    const requestDate = isAdjustment ? new Date().toISOString().split("T")[0] : isTroca ? trocaDateOff : date;
    const fullReason = isVacation ? `Período: ${date} a ${endDate}\n${finalReason}` : finalReason;

    const { error } = await supabase.from("requests").insert({
      user_id: user.id,
      request_type: type,
      request_date: requestDate,
      reason: fullReason,
    });

    if (error) {
      toast.error("Erro ao enviar solicitação.");
    } else {
      toast.success("Solicitação enviada com sucesso!");
      setType("");
      setDate("");
      setEndDate("");
      setTrocaDateOff("");
      setTrocaDateOn("");
      setReason("");
      setAdjustmentDays(DAYS_OF_WEEK.map(d => ({ dayOfWeek: d.value, selected: false, startTime: "08:00", endTime: "18:00" })));
      onSuccess?.();
    }
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Solicitação</Label>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger><SelectValue placeholder="Selecione o tipo" /></SelectTrigger>
          <SelectContent>
            {REQUEST_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isVacation ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Data de Início</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Data de Término</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
        </div>
      ) : isTroca ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Dia que vai faltar</Label>
            <Input type="date" value={trocaDateOff} onChange={(e) => setTrocaDateOff(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Dia que irá repor</Label>
            <Input type="date" value={trocaDateOn} onChange={(e) => setTrocaDateOn(e.target.value)} />
          </div>
        </div>
      ) : isAdjustment ? (
        <div className="space-y-3">
          <Label>Selecione os dias e horários desejados</Label>
          <div className="space-y-2 max-h-60 overflow-auto">
            {DAYS_OF_WEEK.map((day) => {
              const adj = adjustmentDays.find(d => d.dayOfWeek === day.value)!;
              return (
                <div key={day.value} className="flex items-center gap-3 p-2 rounded-lg border border-border">
                  <Checkbox
                    checked={adj.selected}
                    onCheckedChange={() => toggleDay(day.value)}
                  />
                  <span className="text-sm font-medium min-w-[110px]">{day.label}</span>
                  {adj.selected && (
                    <div className="flex items-center gap-2 flex-1">
                      <Input
                        type="time"
                        value={adj.startTime}
                        onChange={(e) => updateDayTime(day.value, "startTime", e.target.value)}
                        className="h-8 w-24 text-xs"
                      />
                      <span className="text-muted-foreground text-xs">até</span>
                      <Input
                        type="time"
                        value={adj.endTime}
                        onChange={(e) => updateDayTime(day.value, "endTime", e.target.value)}
                        className="h-8 w-24 text-xs"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Data</Label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      )}

      <div className="space-y-2">
        <Label>Motivo</Label>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Descreva o motivo..." maxLength={500} />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Enviando..." : "Enviar Solicitação"}
      </Button>
    </form>
  );
}
