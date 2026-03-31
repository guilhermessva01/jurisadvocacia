import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const DAYS_OF_WEEK = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

interface ScheduleRow {
  id?: string;
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
}

interface Shift {
  label: string;
  rows: ScheduleRow[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  employeeName: string;
}

export function AdminScheduleEditor({
  open,
  onOpenChange,
  userId,
  employeeName,
}: Props) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !userId) return;
    loadSchedules();
  }, [open, userId]);

  const createEmptyShift = (label: string): Shift => ({
    label,
    rows: DAYS_OF_WEEK.map((d) => ({
      dayOfWeek: d.value,
      active: d.value >= 1 && d.value <= 5,
      startTime: "08:00",
      endTime: "18:00",
    })),
  });

  const loadSchedules = async () => {
    const { data, error } = await supabase
      .from("work_schedules")
      .select("*")
      .eq("user_id", userId)
      .order("shift_index", { ascending: true })
      .order("day_of_week", { ascending: true });

    if (error) {
      console.error("Load schedules error:", error);
      toast.error("Erro ao carregar turnos.");
      setShifts([createEmptyShift("Turno 1")]);
      return;
    }

    if (!data || data.length === 0) {
      setShifts([createEmptyShift("Turno 1")]);
      return;
    }

    // Agrupa corretamente pelo shift_index
    const shiftGroups = new Map<number, typeof data>();

    data.forEach((row: any) => {
      const idx = row.shift_index ?? 1;
      if (!shiftGroups.has(idx)) shiftGroups.set(idx, []);
      shiftGroups.get(idx)!.push(row);
    });

    const loadedShifts: Shift[] = [];

    Array.from(shiftGroups.entries())
      .sort((a, b) => a[0] - b[0])
      .forEach(([shiftIndex, rows]) => {
        loadedShifts.push({
          label: `Turno ${shiftIndex}`,
          rows: DAYS_OF_WEEK.map((d) => {
            const existing = rows.find((r: any) => r.day_of_week === d.value);

            return {
              id: existing?.id,
              dayOfWeek: d.value,
              active: !!existing?.is_active,
              startTime: existing?.start_time?.slice(0, 5) || "08:00",
              endTime: existing?.end_time?.slice(0, 5) || "18:00",
            };
          }),
        });
      });

    // Caso o banco tenha só turno 1 e o usuário queira adicionar mais, já deixa pronto
    if (loadedShifts.length === 0) {
      loadedShifts.push(createEmptyShift("Turno 1"));
    }

    setShifts(loadedShifts);
  };

  const addShift = () => {
    if (shifts.length >= 3) {
      toast.error("Máximo de 3 turnos.");
      return;
    }
    setShifts((prev) => [...prev, createEmptyShift(`Turno ${prev.length + 1}`)]);
  };

  const removeShift = (idx: number) => {
    setShifts((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleDay = (shiftIdx: number, dayOfWeek: number) => {
    setShifts((prev) =>
      prev.map((s, si) =>
        si === shiftIdx
          ? {
              ...s,
              rows: s.rows.map((r) =>
                r.dayOfWeek === dayOfWeek ? { ...r, active: !r.active } : r
              ),
            }
          : s
      )
    );
  };

  const updateField = (
    shiftIdx: number,
    dayOfWeek: number,
    field: "startTime" | "endTime",
    value: string
  ) => {
    setShifts((prev) =>
      prev.map((s, si) =>
        si === shiftIdx
          ? {
              ...s,
              rows: s.rows.map((r) =>
                r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r
              ),
            }
          : s
      )
    );
  };

  const handleSave = async () => {
    setLoading(true);

    try {
      // Delete all existing schedules for this user
      const { error: deleteError } = await supabase
        .from("work_schedules")
        .delete()
        .eq("user_id", userId);

      if (deleteError) {
        console.error("Delete error:", deleteError);
        toast.error("Erro ao limpar turnos anteriores.");
        setLoading(false);
        return;
      }

      // Build insert array
      const inserts: Array<{
        user_id: string;
        day_of_week: number;
        start_time: string;
        end_time: string;
        break_minutes: number;
        is_active: boolean;
        shift_index: number;
      }> = [];

      shifts.forEach((shift, shiftIdx) => {
        shift.rows.forEach((row) => {
          if (row.active) {
            inserts.push({
              user_id: userId,
              day_of_week: row.dayOfWeek,
              start_time: row.startTime,
              end_time: row.endTime,
              break_minutes: 0,
              is_active: true,
              shift_index: shiftIdx + 1,
            });
          }
        });
      });

      if (inserts.length === 0) {
        toast.error("Selecione pelo menos um dia de trabalho.");
        setLoading(false);
        return;
      }

      const { error } = await supabase.from("work_schedules").insert(inserts);

      if (error) {
        console.error("Insert error:", error);
        toast.error("Erro ao salvar turnos: " + error.message);
      } else {
        toast.success("Turnos salvos com sucesso!");
        onOpenChange(false);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro inesperado ao salvar turnos.");
    }

    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle className="font-display">
            Turnos de {employeeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {shifts.map((shift, shiftIdx) => (
            <div
              key={shiftIdx}
              className="border border-border rounded-lg p-3 space-y-2"
            >
              <div className="flex items-center justify-between">
                <Label className="font-semibold text-sm">{shift.label}</Label>

                {shifts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeShift(shiftIdx)}
                    className="h-7 w-7 text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>

              {DAYS_OF_WEEK.map((day) => {
                const row = shift.rows.find((r) => r.dayOfWeek === day.value)!;

                return (
                  <div
                    key={day.value}
                    className="flex items-center gap-2 p-1.5 rounded border border-border/50"
                  >
                    <Checkbox
                      checked={row.active}
                      onCheckedChange={() => toggleDay(shiftIdx, day.value)}
                    />

                    <span className="text-xs font-medium min-w-[55px]">
                      {day.label}
                    </span>

                    {row.active && (
                      <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                        <Input
                          type="time"
                          value={row.startTime}
                          onChange={(e) =>
                            updateField(
                              shiftIdx,
                              day.value,
                              "startTime",
                              e.target.value
                            )
                          }
                          className="h-7 w-[100px] text-xs"
                        />
                        <span className="text-muted-foreground text-[10px]">
                          até
                        </span>
                        <Input
                          type="time"
                          value={row.endTime}
                          onChange={(e) =>
                            updateField(
                              shiftIdx,
                              day.value,
                              "endTime",
                              e.target.value
                            )
                          }
                          className="h-7 w-[100px] text-xs"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addShift}
            className="gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" /> Adicionar Turno
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>

          <Button onClick={handleSave} disabled={loading}>
            {loading ? "Salvando..." : "Salvar Turnos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
