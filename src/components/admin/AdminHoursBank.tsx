import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { exportToCSV, exportToExcel } from "@/lib/export-utils";
import { Download, RefreshCw, ChevronDown, ChevronUp, Clock, TrendingUp, TrendingDown, CalendarDays, CalendarX } from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

interface DayDetail {
  date: string;
  hoursWorked: number;
  expectedHours: number;
  overtime: number;
  missing: number;
  isLate: boolean;
}

interface EmployeeSummary {
  user_id: string;
  full_name: string;
  totalHoursWorked: number;
  expectedHours: number;
  overtimeHours: number;
  missingHours: number;
  daysWorked: number;
  daysAbsent: number;
  daysLate: number;
  dailyDetails: DayDetail[];
}

export function AdminHoursBank() {
  const [data, setData] = useState<EmployeeSummary[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string }[]>([]);
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()));
  const [syncing, setSyncing] = useState(false);
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [cycleStart, setCycleStart] = useState("2026-03-30");

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").order("full_name")
      .then(({ data }) => setEmployees(data || []));
    supabase.from("office_settings").select("cycle_start_date").limit(1)
      .then(({ data }) => {
        if (data && data.length > 0 && data[0].cycle_start_date) {
          setCycleStart(data[0].cycle_start_date);
        }
      });
  }, []);

  const syncAndFetch = async (silent = false) => {
    setSyncing(true);
    const month = parseInt(filterMonth);
    const year = parseInt(filterYear);

    try {
      const targetEmployees = filterEmployee === "all"
        ? employees
        : employees.filter(e => e.user_id === filterEmployee);

      const results: EmployeeSummary[] = [];

      for (const emp of targetEmployees) {
        const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
        const endDate = month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, "0")}-01`;

        // Use cycle start as lower bound
        const effectiveStart = startDate > cycleStart ? startDate : cycleStart;

        const { data: records } = await supabase
          .from("time_records")
          .select("record_date, record_time, record_type, is_late")
          .eq("user_id", emp.user_id)
          .gte("record_date", effectiveStart)
          .lt("record_date", endDate)
          .order("created_at", { ascending: true });

        // Get work schedule
        const { data: schedules } = await supabase
          .from("work_schedules")
          .select("day_of_week, start_time, end_time, break_minutes, is_active")
          .eq("user_id", emp.user_id)
          .eq("is_active", true);

        // Group records by date
        const dayRecords: Record<string, { type: string; time: string; is_late: boolean | null }[]> = {};
        for (const r of records || []) {
          if (!dayRecords[r.record_date]) dayRecords[r.record_date] = [];
          dayRecords[r.record_date].push({ type: r.record_type, time: r.record_time, is_late: r.is_late });
        }

        const dailyDetails: DayDetail[] = [];
        let totalMinutes = 0;
        let totalExpectedMinutes = 0;
        let daysWorked = 0;
        let daysAbsent = 0;
        let daysLate = 0;

        // Calculate expected work days from cycle start to today or end of month
        const today = new Date().toISOString().slice(0, 10);
        const daysInMonth = new Date(year, month, 0).getDate();

        for (let d = 1; d <= daysInMonth; d++) {
          const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          
          // Skip dates before cycle start or after today
          if (dateStr < cycleStart || dateStr > today) continue;

          const date = new Date(year, month - 1, d);
          const dow = date.getDay();
          const sched = schedules?.find(s => s.day_of_week === dow);

          if (!sched) continue; // Not a scheduled work day

          const [sh, sm] = sched.start_time.split(":").map(Number);
          const [eh, em] = sched.end_time.split(":").map(Number);
          const expectedDayMinutes = (eh * 60 + em) - (sh * 60 + sm) - (sched.break_minutes || 0);
          totalExpectedMinutes += expectedDayMinutes;

          const recs = dayRecords[dateStr];
          if (!recs || recs.length === 0) {
            daysAbsent++;
            dailyDetails.push({
              date: dateStr,
              hoursWorked: 0,
              expectedHours: Math.round((expectedDayMinutes / 60) * 100) / 100,
              overtime: 0,
              missing: Math.round((expectedDayMinutes / 60) * 100) / 100,
              isLate: false,
            });
            continue;
          }

          // Calculate worked hours
          const entrada = recs.find(r => r.type === "entrada");
          const saidas = recs.filter(r => r.type === "saida");
          const saida = saidas.length > 0 ? saidas[saidas.length - 1] : null;

          if (entrada && saida) {
            const [eH, eM, eS] = entrada.time.split(":").map(Number);
            const [sH, sM, sS] = saida.time.split(":").map(Number);
            const workedSec = (sH * 3600 + (sM || 0) * 60 + (sS || 0)) - (eH * 3600 + (eM || 0) * 60 + (eS || 0));
            const workedMinutes = Math.max(0, workedSec / 60);
            totalMinutes += workedMinutes;
            daysWorked++;

            const workedHours = Math.round((workedMinutes / 60) * 100) / 100;
            const expectedHours = Math.round((expectedDayMinutes / 60) * 100) / 100;
            const hadLate = recs.some(r => r.is_late);
            if (hadLate) daysLate++;

            dailyDetails.push({
              date: dateStr,
              hoursWorked: workedHours,
              expectedHours,
              overtime: workedHours > expectedHours ? Math.round((workedHours - expectedHours) * 100) / 100 : 0,
              missing: workedHours < expectedHours ? Math.round((expectedHours - workedHours) * 100) / 100 : 0,
              isLate: hadLate,
            });
          } else if (entrada) {
            // Entry but no exit yet (still working)
            daysWorked++;
            dailyDetails.push({
              date: dateStr,
              hoursWorked: 0,
              expectedHours: Math.round((expectedDayMinutes / 60) * 100) / 100,
              overtime: 0,
              missing: 0,
              isLate: recs.some(r => r.is_late),
            });
          }
        }

        const totalHours = Math.round((totalMinutes / 60) * 100) / 100;
        const expectedHours = Math.round((totalExpectedMinutes / 60) * 100) / 100;

        results.push({
          user_id: emp.user_id,
          full_name: emp.full_name,
          totalHoursWorked: totalHours,
          expectedHours,
          overtimeHours: totalHours > expectedHours ? Math.round((totalHours - expectedHours) * 100) / 100 : 0,
          missingHours: totalHours < expectedHours ? Math.round((expectedHours - totalHours) * 100) / 100 : 0,
          daysWorked,
          daysAbsent,
          daysLate,
          dailyDetails: dailyDetails.sort((a, b) => a.date.localeCompare(b.date)),
        });
      }

      setData(results);
      if (!silent) toast.success("Banco de horas atualizado!");
    } catch {
      if (!silent) toast.error("Erro ao sincronizar banco de horas.");
    }
    setSyncing(false);
  };

  useEffect(() => {
    if (employees.length === 0) return;
    void syncAndFetch(true);
  }, [employees.length, filterEmployee, filterMonth, filterYear, cycleStart]);

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}`;
  };

  const formatHours = (h: number) => {
    const hours = Math.floor(h);
    const mins = Math.round((h - hours) * 60);
    return `${hours}h${mins > 0 ? `${String(mins).padStart(2, "0")}min` : ""}`;
  };

  const handleExport = (fmt: "csv" | "excel") => {
    const exportData = data.map((r) => ({
      Funcionário: r.full_name,
      "Horas Trabalhadas": r.totalHoursWorked,
      "Horas Esperadas": r.expectedHours,
      "Horas Extras": r.overtimeHours,
      "Horas Faltantes": r.missingHours,
      "Dias Trabalhados": r.daysWorked,
      "Dias Ausentes": r.daysAbsent,
      "Dias com Atraso": r.daysLate,
    }));
    if (fmt === "csv") exportToCSV(exportData, "banco-horas");
    else exportToExcel(exportData, "banco-horas");
  };

  return (
    <div className="space-y-4">
      <Card className="shadow-md">
        <CardHeader className="flex flex-col gap-4">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Banco de Horas — {MONTHS[parseInt(filterMonth) - 1]} {filterYear}
          </CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={filterEmployee} onValueChange={setFilterEmployee}>
              <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Todos" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Funcionários</SelectItem>
                {employees.map((e) => (
                  <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2 w-full sm:w-auto">
              <Select value={filterMonth} onValueChange={setFilterMonth}>
                <SelectTrigger className="flex-1 sm:w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterYear} onValueChange={setFilterYear}>
                <SelectTrigger className="w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[2024, 2025, 2026, 2027].map((y) => (
                    <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2 w-full sm:w-auto">
              <Button variant="outline" size="sm" onClick={() => void syncAndFetch()} disabled={syncing} className="gap-1.5 flex-1 sm:flex-none">
                <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Atualizar
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </Button>
              <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> Excel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {data.length === 0 ? (
        <Card className="shadow-md">
          <CardContent className="text-center py-8 text-muted-foreground">
            <p>Nenhum dado encontrado para o período selecionado.</p>
            <p className="text-sm mt-1">Clique em <strong>"Atualizar"</strong> para recalcular.</p>
          </CardContent>
        </Card>
      ) : (
        data.map((emp) => (
          <Card key={emp.user_id} className="shadow-md overflow-hidden">
            <button
              className="w-full text-left"
              onClick={() => setExpandedUser(expandedUser === emp.user_id ? null : emp.user_id)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">{emp.full_name}</CardTitle>
                  {expandedUser === emp.user_id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <Clock className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="text-sm font-bold font-mono">{formatHours(emp.totalHoursWorked)}</p>
                    <p className="text-[10px] text-muted-foreground">Trabalhadas</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <CalendarDays className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="text-sm font-bold font-mono">{formatHours(emp.expectedHours)}</p>
                    <p className="text-[10px] text-muted-foreground">Esperadas</p>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950/20 rounded-lg p-2.5 text-center">
                    <TrendingUp className="w-4 h-4 mx-auto mb-1 text-green-600" />
                    <p className="text-sm font-bold font-mono text-green-600">{formatHours(emp.overtimeHours)}</p>
                    <p className="text-[10px] text-muted-foreground">Extras</p>
                  </div>
                  <div className="bg-red-50 dark:bg-red-950/20 rounded-lg p-2.5 text-center">
                    <TrendingDown className="w-4 h-4 mx-auto mb-1 text-destructive" />
                    <p className="text-sm font-bold font-mono text-destructive">{formatHours(emp.missingHours)}</p>
                    <p className="text-[10px] text-muted-foreground">Faltantes</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <CalendarDays className="w-4 h-4 mx-auto mb-1 text-primary" />
                    <p className="text-sm font-bold font-mono">{emp.daysWorked}</p>
                    <p className="text-[10px] text-muted-foreground">Dias Trab.</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-2.5 text-center">
                    <CalendarX className="w-4 h-4 mx-auto mb-1 text-destructive" />
                    <p className="text-sm font-bold font-mono">{emp.daysAbsent}</p>
                    <p className="text-[10px] text-muted-foreground">Ausências</p>
                  </div>
                </div>
              </CardContent>
            </button>

            {expandedUser === emp.user_id && emp.dailyDetails.length > 0 && (
              <div className="border-t border-border px-4 pb-4">
                <p className="text-xs font-semibold text-muted-foreground py-3 uppercase tracking-wide">Detalhamento Diário</p>
                <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-5 gap-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-2 pb-1">
                    <span>Data</span>
                    <span className="text-center">Trabalhadas</span>
                    <span className="text-center">Esperadas</span>
                    <span className="text-center">Extras</span>
                    <span className="text-center">Faltantes</span>
                  </div>
                  {emp.dailyDetails.map((day) => (
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
              </div>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
