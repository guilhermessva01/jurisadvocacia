import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Clock, AlertTriangle, CalendarX, Timer, TrendingUp } from "lucide-react";
import { getBrasiliaISODate, getBrasiliaDate } from "@/lib/brasilia-time";
import { formatLateDuration } from "@/lib/format-utils";

interface ActiveEmployee {
  user_id: string;
  full_name: string;
  photo_url: string | null;
  entry_time: string;
}

interface MonthlyStats {
  totalEmployees: number;
  totalHoursWorked: number;
  totalOvertime: number;
  totalLateDays: number;
  totalAbsentDays: number;
  totalWorkDays: number;
}
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

export function AdminOverview() {
  const [active, setActive] = useState<ActiveEmployee[]>([]);
  const [now, setNow] = useState(getBrasiliaDate());
  const [monthStats, setMonthStats] = useState<MonthlyStats>({
    totalEmployees: 0, totalHoursWorked: 0, totalOvertime: 0,
    totalLateDays: 0, totalAbsentDays: 0, totalWorkDays: 0,
  });
  const [todayHours, setTodayHours] = useState<{ user_id: string; full_name: string; hours: number }[]>([]);

  const fetchActive = async () => {
    const today = getBrasiliaISODate();
    const { data: entries } = await supabase
      .from("time_records")
      .select("user_id, record_time, record_type")
      .eq("record_date", today)
      .order("created_at", { ascending: true });

    if (!entries) { setActive([]); return; }

    const userStatus: Record<string, { lastEntry: string | null; exited: boolean }> = {};
    for (const r of entries) {
      if (!userStatus[r.user_id]) userStatus[r.user_id] = { lastEntry: null, exited: false };
      if (r.record_type === "entrada") {
        userStatus[r.user_id].lastEntry = r.record_time;
        userStatus[r.user_id].exited = false;
      } else if (r.record_type === "saida") {
        userStatus[r.user_id].exited = true;
      }
    }

    const activeUserIds = Object.entries(userStatus)
      .filter(([, s]) => s.lastEntry && !s.exited)
      .map(([uid, s]) => ({ user_id: uid, entry_time: s.lastEntry! }));

    if (activeUserIds.length === 0) { setActive([]); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, photo_url")
      .in("user_id", activeUserIds.map(a => a.user_id));

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.user_id, p]));
    setActive(activeUserIds.map(a => ({
      user_id: a.user_id,
      full_name: profileMap[a.user_id]?.full_name || "—",
      photo_url: profileMap[a.user_id]?.photo_url || null,
      entry_time: a.entry_time,
    })));
  };

  const fetchTodayHours = async () => {
    const today = getBrasiliaISODate();
    const { data: records } = await supabase
      .from("time_records")
      .select("user_id, record_time, record_type")
      .eq("record_date", today)
      .order("created_at", { ascending: true });

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name");

    if (!records || !profiles) return;

    const profileMap = Object.fromEntries(profiles.map(p => [p.user_id, p.full_name]));
    const userRecords: Record<string, { type: string; time: string }[]> = {};
    for (const r of records) {
      if (!userRecords[r.user_id]) userRecords[r.user_id] = [];
      userRecords[r.user_id].push({ type: r.record_type, time: r.record_time });
    }

    const hours: typeof todayHours = [];
    for (const [uid, recs] of Object.entries(userRecords)) {
      const workedMinutes = calculateWorkedMinutes(recs);

const workedHours =
  Math.round((workedMinutes / 60) * 100) / 100;
      const saidas = recs.filter(r => r.type === "saida");
      const saida = saidas.length > 0 ? saidas[saidas.length - 1] : null;

      if (entrada) {
        const [eh, em, es] = entrada.time.split(":").map(Number);
        let endSec: number;
        if (saida) {
          const [sh, sm, ss] = saida.time.split(":").map(Number);
          endSec = sh * 3600 + (sm || 0) * 60 + (ss || 0);
        } else {
          const n = getBrasiliaDate();
          endSec = n.getHours() * 3600 + n.getMinutes() * 60 + n.getSeconds();
        }
        const startSec = eh * 3600 + (em || 0) * 60 + (es || 0);
        let workedSec = endSec - startSec;

       const workedMinutes = calculateWorkedMinutes(recs);
const workedHours = Math.round((workedMinutes / 60) * 100) / 100;

hours.push({
  user_id: uid,
  full_name: profileMap[uid] || "—",
  hours: Math.max(0, workedHours),
});
      }
    }
    setTodayHours(hours);
  };

  const fetchMonthStats = async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Get cycle start date to filter only records from the current cycle
    const { data: officeData } = await supabase
      .from("office_settings")
      .select("cycle_start_date")
      .limit(1)
      .maybeSingle();

    const cycleStart = officeData?.cycle_start_date || "2026-03-30";

    const { data: bankData } = await supabase
      .from("monthly_hours_bank")
      .select("*")
      .eq("month", month)
      .eq("year", year);

    const { data: lateData } = await supabase
      .from("time_records")
      .select("id, user_id, record_date, is_late")
      .eq("record_type", "entrada")
      .eq("is_late", true)
      .gte("record_date", cycleStart);

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id");

    const lateDaysThisMonth = (lateData || []).filter(r => r.record_date >= cycleStart);
    const uniqueLateDays = new Set(lateDaysThisMonth.map(r => `${r.user_id}-${r.record_date}`)).size;

    const rows = bankData || [];
    setMonthStats({
      totalEmployees: profiles?.length || 0,
      totalHoursWorked: rows.reduce((s, r) => s + (r.total_hours_worked || 0), 0),
      totalOvertime: rows.reduce((s, r) => s + (r.overtime_hours || 0), 0),
      totalLateDays: uniqueLateDays,
      totalAbsentDays: rows.reduce((s, r) => s + (r.days_absent || 0), 0),
      totalWorkDays: rows.reduce((s, r) => s + (r.days_worked || 0), 0),
    });
  };

  useEffect(() => {
    fetchActive();
    fetchTodayHours();
    fetchMonthStats();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(getBrasiliaDate()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => { fetchActive(); fetchTodayHours(); }, 30000);
    return () => clearInterval(interval);
  }, []);

  const getElapsedTime = (entryTime: string) => {
    const [h, m, s] = entryTime.split(":").map(Number);
    const entryDate = new Date(now);
    entryDate.setHours(h, m || 0, s || 0, 0);
    const diffMs = now.getTime() - entryDate.getTime();
    if (diffMs < 0) return "0h 00min";
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    return `${hours}h ${String(mins).padStart(2, "0")}min`;
  };

  const currentMonth = new Date().toLocaleString("pt-BR", { month: "long" });

  return (
    <div className="space-y-4">
      {/* Monthly stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <Users className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold font-mono">{monthStats.totalEmployees}</p>
            <p className="text-[10px] text-muted-foreground">Funcionários</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <Timer className="w-5 h-5 mx-auto mb-1 text-primary" />
            <p className="text-lg font-bold font-mono">{Math.round(monthStats.totalHoursWorked)}h</p>
            <p className="text-[10px] text-muted-foreground">Horas ({currentMonth})</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 mx-auto mb-1 text-green-600" />
            <p className="text-lg font-bold font-mono text-green-600">{Math.round(monthStats.totalOvertime)}h</p>
            <p className="text-[10px] text-muted-foreground">Horas Extras</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <Clock className="w-5 h-5 mx-auto mb-1 text-accent" />
            <p className="text-lg font-bold font-mono">{monthStats.totalWorkDays}</p>
            <p className="text-[10px] text-muted-foreground">Dias Trabalhados</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1 text-amber-500" />
            <p className="text-lg font-bold font-mono text-amber-500">{monthStats.totalLateDays}</p>
            <p className="text-[10px] text-muted-foreground">Dias c/ Atraso</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm">
          <CardContent className="p-3 text-center">
            <CalendarX className="w-5 h-5 mx-auto mb-1 text-destructive" />
            <p className="text-lg font-bold font-mono text-destructive">{monthStats.totalAbsentDays}</p>
            <p className="text-[10px] text-muted-foreground">Dias Ausentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Active employees */}
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <Users className="w-4 h-4 text-primary" />
          <CardTitle className="text-base font-display">Funcionários em Trabalho</CardTitle>
          <Badge variant="secondary" className="ml-auto">{active.length} ativo{active.length !== 1 ? "s" : ""}</Badge>
        </CardHeader>
        <CardContent>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum funcionário trabalhando no momento.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {active.map((emp) => (
                <div key={emp.user_id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={emp.photo_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {emp.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{emp.full_name}</p>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>Entrada: {emp.entry_time.slice(0, 5)}</span>
                    </div>
                    <p className="text-xs font-mono text-primary font-semibold">{getElapsedTime(emp.entry_time)}</p>
                  </div>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's hours per employee */}
      {todayHours.length > 0 && (
        <Card className="shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Timer className="w-4 h-4 text-primary" />
              Horas Trabalhadas Hoje
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {todayHours.map((emp) => (
                <div key={emp.user_id} className="flex items-center justify-between p-2.5 rounded-lg border border-border">
                  <span className="text-sm font-medium truncate">{emp.full_name}</span>
                  <Badge variant="outline" className="font-mono text-xs">{emp.hours}h</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Creator signature */}
      <div className="text-center pt-4 pb-2">
        <p className="text-[10px] text-muted-foreground/60 italic">
          Desenvolvido por Eng. Guilherme dos Santos
        </p>
      </div>
    </div>
  );
}
