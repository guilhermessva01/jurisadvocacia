import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { formatLateDuration } from "@/lib/format-utils";

interface TimeRecord {
  id: string;
  record_date: string;
  record_time: string | null;
  record_type: string;
  location_status: string | null;
  is_late: boolean | null;
  late_minutes: number | null;
  address: string | null;
}

export function TimeHistory({ refreshKey }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [records, setRecords] = useState<TimeRecord[]>([]);

  useEffect(() => {
    if (!user) return;

    supabase
      .from("time_records")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => setRecords(data || []));
  }, [user, refreshKey]);

  const typeLabels: Record<string, string> = {
    entrada: "Entrada",
    saida: "Saída",
    intervalo_inicio: "Início Intervalo",
    intervalo_fim: "Fim Intervalo",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="overflow-auto"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Hora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead className="hidden sm:table-cell">Local</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>

        <TableBody>
          {records.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={5}
                className="text-center text-muted-foreground py-8"
              >
                Nenhum registro encontrado.
              </TableCell>
            </TableRow>
          ) : (
            records.map((r) => (
              <TableRow key={r.id}>
                {/* DATA */}
                <TableCell className="font-mono text-sm">
                  {format(
                    new Date(r.record_date + "T00:00:00"),
                    "dd/MM/yyyy"
                  )}
                </TableCell>

                <TableCell className="font-mono text-sm">
                  {r.record_time ? r.record_time.substring(0, 5) : "--:--"}
                </TableCell>

                <TableCell>
                  <Badge variant="secondary" className="text-xs">
                    {typeLabels[r.record_type] || r.record_type}
                  </Badge>
                </TableCell>

                <TableCell className="hidden sm:table-cell text-xs text-muted-foreground max-w-[200px] truncate">
                  {r.address || "—"}
                </TableCell>

                <TableCell>
                  {r.is_late ? (
                    <Badge variant="destructive" className="text-xs">
                      Atraso {formatLateDuration(r.late_minutes ?? 0)}
                    </Badge>
                  ) : (
                    <Badge className="bg-success text-success-foreground text-xs">
                      No horário
                    </Badge>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </motion.div>
  );
}
