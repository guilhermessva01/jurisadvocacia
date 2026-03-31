import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { exportToCSV, exportToExcel } from "@/lib/export-utils";
import { format } from "date-fns";
import { Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { formatLateDuration } from "@/lib/format-utils";

interface LateRecord {
  id: string;
  user_id: string;
  record_date: string;
  record_time: string;
  late_minutes: number | null;
  scheduled_time?: string;
}


export function AdminLateReport() {
  const [records, setRecords] = useState<LateRecord[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; full_name: string }[]>([]);
  const [schedules, setSchedules] = useState<Record<string, Record<number, string>>>({});
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [syncing, setSyncing] = useState(false);
  const employeeMap = Object.fromEntries(employees.map(e => [e.user_id, e.full_name]));

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").order("full_name")
      .then(({ data }) => setEmployees(data || []));

    supabase.from("work_schedules").select("user_id, day_of_week, start_time").eq("is_active", true)
      .then(({ data }) => {
        const map: Record<string, Record<number, string>> = {};
        (data || []).forEach(s => {
          if (!map[s.user_id]) map[s.user_id] = {};
          map[s.user_id][s.day_of_week] = s.start_time;
        });
        setSchedules(map);
      });
  }, []);

  const fetchRecords = () => {
    let query = supabase
      .from("time_records")
      .select("id, user_id, record_date, record_time, late_minutes, is_late")
      .eq("record_type", "entrada")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterEmployee !== "all") {
      query = query.eq("user_id", filterEmployee);
    }

    query.then(({ data }) => {
      const filtered = (data || []).filter((r) => {
        const m = new Date(r.record_date + "T00:00:00").getMonth() + 1;
        return String(m) === filterMonth && r.is_late;
      });
      const enriched = filtered.map(r => {
        const dow = new Date(r.record_date + "T00:00:00").getDay();
        const scheduledTime = schedules[r.user_id]?.[dow] || "—";
        return { ...r, scheduled_time: scheduledTime?.slice(0, 5) };
      });
      setRecords(enriched);
    });
  };

  useEffect(() => { fetchRecords(); }, [filterEmployee, filterMonth, schedules]);

  const syncLateRecords = async () => {
    setSyncing(true);
    try {
      const month = parseInt(filterMonth);
      const year = new Date().getFullYear();
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const endDate = month === 12
        ? `${year + 1}-01-01`
        : `${year}-${String(month + 1).padStart(2, "0")}-01`;

      let query = supabase
        .from("time_records")
        .select("id, user_id, record_date, record_time, record_type")
        .eq("record_type", "entrada")
        .gte("record_date", startDate)
        .lt("record_date", endDate);

      if (filterEmployee !== "all") {
        query = query.eq("user_id", filterEmployee);
      }

      const { data: entries } = await query;
      if (!entries) { setSyncing(false); return; }

      let updated = 0;
      for (const entry of entries) {
        const dow = new Date(entry.record_date + "T00:00:00").getDay();
        const scheduledTime = schedules[entry.user_id]?.[dow];
        if (!scheduledTime) continue;

        const [sh, sm, ss] = scheduledTime.split(":").map(Number);
        const timeParts = entry.record_time.split(":");
        const [eh, em, es] = timeParts.map(Number);
        const scheduledSec = sh * 3600 + (sm || 0) * 60 + (ss || 0);
        const actualSec = eh * 3600 + (em || 0) * 60 + (es || 0);
        const isLate = actualSec > scheduledSec;
        const lateMin = isLate ? Math.floor((actualSec - scheduledSec) / 60) : 0;

        await supabase.from("time_records").update({
          is_late: isLate,
          late_minutes: lateMin,
        }).eq("id", entry.id);
        updated++;
      }

      toast.success(`${updated} registros sincronizados!`);
      fetchRecords();
    } catch {
      toast.error("Erro ao sincronizar atrasos.");
    }
    setSyncing(false);
  };

  const handleExport = (fmt: "csv" | "excel") => {
    const exportData = records.map((r) => ({
      Funcionário: employeeMap[r.user_id] || "—",
      Data: r.record_date,
      "Horário Previsto": r.scheduled_time || "—",
      "Horário Registrado": r.record_time.slice(0, 8),
      "Atraso": formatLateDuration(r.late_minutes ?? 0),
    }));
    if (fmt === "csv") exportToCSV(exportData, "relatorio-atrasos");
    else exportToExcel(exportData, "relatorio-atrasos");
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
        <CardTitle className="text-base font-display">Relatório de Atrasos</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.user_id} value={e.user_id}>{e.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterMonth} onValueChange={setFilterMonth}>
            <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>
                  {new Date(2024, i).toLocaleString("pt-BR", { month: "long" })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={syncLateRecords} disabled={syncing} className="gap-1.5">
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} /> Sincronizar
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("csv")} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => handleExport("excel")} className="gap-1.5">
            <Download className="w-3.5 h-3.5" /> Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Horário Previsto</TableHead>
                <TableHead>Hora Registrada</TableHead>
                <TableHead>Atraso</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    Nenhum atraso encontrado. Clique em "Sincronizar" para atualizar.
                  </TableCell>
                </TableRow>
              ) : (
                records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{employeeMap[r.user_id] || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{format(new Date(r.record_date + "T00:00:00"), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="font-mono text-sm">{r.scheduled_time || "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{r.record_time.slice(0, 8)}</TableCell>
                    <TableCell>
                      <Badge variant="destructive" className="text-xs">
                        {formatLateDuration(r.late_minutes ?? 0)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
