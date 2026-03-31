import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Clock, TrendingUp, TrendingDown, CalendarDays, CalendarX } from "lucide-react";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

const calculateWorkedMinutes = (records: { type: string; time: string }[]) => {
  let totalMinutes = 0;
  let lastEntry: string | null = null;

  const sorted = [...records].sort((a, b) =>
    a.time.localeCompare(b.time)
  );

  for (const record of sorted) {
    if (record.type === "entrada") {
      lastEntry = record.time;
    }

    if (record.type === "saida" && lastEntry) {
      const [eH, eM, eS] = lastEntry.split(":").map(Number);
      const [sH, sM, sS] = record.time.split(":").map(Number);

      const entrySec =
        eH * 3600 + (eM || 0) * 60 + (eS || 0);

      const exitSec =
        sH * 3600 + (sM || 0) * 60 + (sS || 0);

      totalMinutes += Math.max(0, (exitSec - entrySec) / 60);

      lastEntry = null;
    }
  }

  return totalMinutes;
};

interface DayDetail {
  date: string;
  hoursWorked: number;
  expectedHours: number;
  overtime: number;
  missing: number;
  isLate: boolean;
}

export function EmployeeHoursBank() {
  const { user } = useAuth();
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [dailyDetails, setDailyDetails] = useState<DayDetail[]>([]);
  const [summary, setSummary] = useState({ totalHours: 0, expectedHours: 0, overtime: 0, missing: 0, daysWorked: 0, daysAbsent: 0, daysLate: 0 });
  const [cycleStart, setCycleStart] = useState("2026-03-30");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("office_settings").select("cycle_start_date").limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].cycle_start_date) {
          setCycleStart(data[0].cycle_start_date);
        }
      });
  }, []);

  useEffect(() => {
    if (!user) return;
    void fetchData();
  }, [user, filterMonth, filterYear, cycleStart]);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const month = parseInt(filterMonth);
    const year = parseInt(filterYear);

    const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
    const endDate = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const effectiveStart = startDate > cycleStart ? startDate : cycleStart;

    const { data: records } = await supabase
      .from("time_records")
      .select("record_date, record_time, record_type, is_late")
      .eq("user_id", user.id)
      .gte("record_date", effectiveStart)
      .lt("record_date", endDate)
      .order("created_at", { ascending: true });

    const { data: schedules } = await supabase
      .from("work_schedules")
      .select("day_of_week, start_time, end_time, break_minutes, is_active")
      .eq("user_id", user.id)
      .eq("is_active", true);

    const dayRecords: Record<string, { type: string; time: string; is_late: boolean | null }[]> = {};
    for (const r of records || []) {
      if (!dayRecords[r.record_date]) dayRecords[r.record_date] = [];
      dayRecords[r.record_date].push({ type: r.record_type, time: r.record_time, is_late: r.is_late });
    }

    const details: DayDetail[] = [];
    let totalMin = 0, totalExpMin = 0, worked = 0, absent = 0, late = 0;
    const today = new Date().toISOString().slice(0, 10);
    const daysInMonth = new Date(year, month, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      if (dateStr < cycleStart || dateStr > today) continue;

      const date = new Date(year, month - 1, d);
      const sched = schedules?.find(s => s.day_of_week === date.getDay());
      if (!sched) continue;

      const [sh, sm] = sched.start_time.split(":").map(Number);
      const [eh, em] = sched.end_time.split(":").map(Number);
      const expMin = (eh * 60 + em) - (sh * 60 + sm) - (sched.break_minutes || 0);
      totalExpMin += expMin;

      const recs = dayRecords[dateStr];
      if (!recs || recs.length === 0) {
        absent++;
        details.push({ date: dateStr, hoursWorked: 0, expectedHours: Math.round((expMin / 60) * 100) / 100, overtime: 0, missing: Math.round((expMin / 60) * 100) / 100, isLate: false });
        continue;
      }

     const workedMinutes = calculateWorkedMinutes(recs);

if (workedMinutes > 0) {
  totalMin += workedMinutes;
  worked++;

  const wH = Math.round((workedMinutes / 60) * 100) / 100;
  const eHours = Math.round((expMin / 60) * 100) / 100;
  const hadLate = recs.some(r => r.is_late);

  if (hadLate) late++;

  details.push({
    date: dateStr,
    hoursWorked: wH,
    expectedHours: eHours,
    overtime: wH > eHours ? Math.round((wH - eHours) * 100) / 100 : 0,
    missing: wH < eHours ? Math.round((eHours - wH) * 100) / 100 : 0,
    isLate: hadLate,
  });
}
        const [eH, eM, eS] = entrada.time.split(":").map(Number);
        const [sH, sM, sS] = saida.time.split(":").map(Number);
        const wMin = Math.max(0, ((sH * 3600 + (sM || 0) * 60 + (sS || 0)) - (eH * 3600 + (eM || 0) * 60 + (eS || 0))) / 60);
        totalMin += wMin;
        worked++;
        const wH = Math.round((wMin / 60) * 100) / 100;
        const eHours = Math.round((expMin / 60) * 100) / 100;
        const hadLate = recs.some(r => r.is_late);
        if (hadLate) late++;
        details.push({
          date: dateStr, hoursWorked: wH, expectedHours: eHours,
          overtime: wH > eHours ? Math.round((wH - eHours) * 100) / 100 : 0,
          missing: wH < eHours ? Math.round((eHours - wH) * 100) / 100 : 0,
          isLate: hadLate,
        });
      }
    }

    const tH = Math.round((totalMin / 60) * 100) / 100;
    const eH = Math.round((totalExpMin / 60) * 100) / 100;
    setSummary({ totalHours: tH, expectedHours: eH, overtime: tH > eH ? Math.round((tH - eH) * 100) / 100 : 0, missing: tH < eH ? Math.round((eH - tH) * 100) / 100 : 0, daysWorked: worked, daysAbsent: absent, daysLate: late });
    setDailyDetails(details.sort((a, b) => a.date.localeCompare(b.date)));
    setLoading(false);
  };

  const formatDate = (dateStr: string) => {
    const [, m, d] = dateStr.split("-");
    return `${d}/${m}`;
  };

  const formatHours = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${hours}h${mins > 0 ? `${String(mins).padStart(2, "0")}min` : ""}`;
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-md">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <CardTitle className="text-sm sm:text-base font-display flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary" />
              Meu Banco de Horas
            </CardTitle>
            <div className="flex gap-2 sm:ml-auto">
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[80px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2025, 2026, 2027].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <Clock className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-sm font-bold font-mono">{formatHours(summary.totalHours)}</p>
              <p className="text-[10px] text-muted-foreground">Trabalhadas</p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-3 text-center">
              <TrendingUp className="w-4 h-4 mx-auto mb-1 text-green-600" />
              <p className="text-sm font-bold font-mono text-green-600">{formatHours(summary.overtime)}</p>
              <p className="text-[10px] text-muted-foreground">Extras</p>
            </div>
            <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-3 text-center">
              <TrendingDown className="w-4 h-4 mx-auto mb-1 text-destructive" />
              <p className="text-sm font-bold font-mono text-destructive">{formatHours(summary.missing)}</p>
              <p className="text-[10px] text-muted-foreground">Faltantes</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <CalendarDays className="w-4 h-4 mx-auto mb-1 text-primary" />
              <p className="text-sm font-bold font-mono">{summary.daysWorked}</p>
              <p className="text-[10px] text-muted-foreground">Dias Trab.</p>
            </div>
          </div>

          {loading ? (
            <p className="text-center text-sm text-muted-foreground py-4">Carregando...</p>
          ) : dailyDetails.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-4">Nenhum registro encontrado.</p>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-5 gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pb-1">
                <span>Data</span>
                <span className="text-center">Trabalhadas</span>
                <span className="text-center">Esperadas</span>
                <span className="text-center">Extras</span>
                <span className="text-center">Faltantes</span>
              </div>
              {dailyDetails.map((day) => (
                <div
                  key={day.date}
                  className={`grid grid-cols-5 gap-2 items-center px-2 py-1.5 rounded text-xs ${
                    day.hoursWorked === 0 && day.missing > 0
                      ? "bg-red-50 dark:bg-red-950/10"
                      : day.isLate
                      ? "bg-amber-50 dark:bg-amber-950/10"
                      : day.overtime > 0
                      ? "bg-green-50 dark:bg-green-950/10"
                      : "bg-muted/30"
                  }`}
                >
                  <span className="font-medium flex items-center gap-1">
                    {formatDate(day.date)}
                    {day.isLate && <Badge variant="outline" className="text-[8px] px-1 py-0 text-amber-600 border-amber-300">Atraso</Badge>}
                    {day.hoursWorked === 0 && day.missing > 0 && <Badge variant="outline" className="text-[8px] px-1 py-0 text-destructive border-destructive/30">Ausente</Badge>}
                  </span>
                  <span className="text-center font-mono">{formatHours(day.hoursWorked)}</span>
                  <span className="text-center font-mono text-muted-foreground">{formatHours(day.expectedHours)}</span>
                  <span className={`text-center font-mono ${day.overtime > 0 ? "text-green-600 font-semibold" : "text-muted-foreground"}`}>
                    {day.overtime > 0 ? `+${formatHours(day.overtime)}` : "—"}
                  </span>
                  <span className={`text-center font-mono ${day.missing > 0 ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {day.missing > 0 ? `-${formatHours(day.missing)}` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

