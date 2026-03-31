import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Users, Clock } from "lucide-react";
import { getBrasiliaISODate, getBrasiliaDate } from "@/lib/brasilia-time";

interface ActiveEmployee {
  user_id: string;
  full_name: string;
  photo_url: string | null;
  entry_time: string;
  entry_date: string;
}

export function AdminActiveEmployees() {
  const [active, setActive] = useState<ActiveEmployee[]>([]);
  const [now, setNow] = useState(getBrasiliaDate());

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
      entry_date: today,
    })));
  };

  useEffect(() => { fetchActive(); }, []);

  useEffect(() => {
    const interval = setInterval(() => setNow(getBrasiliaDate()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(fetchActive, 30000);
    return () => clearInterval(interval);
  }, []);

  const getElapsedTime = (entryTime: string) => {
    const [h, m, s] = entryTime.split(":").map(Number);
    const entryDate = new Date(now);
    entryDate.setHours(h, m || 0, s || 0, 0);
    const diffMs = now.getTime() - entryDate.getTime();
    if (diffMs < 0) return "0h 00min 00s";
    const totalSec = Math.floor(diffMs / 1000);
    const hours = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hours}h ${String(mins).padStart(2, "0")}min ${String(secs).padStart(2, "0")}s`;
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="flex flex-row items-center gap-2">
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
  );
}
