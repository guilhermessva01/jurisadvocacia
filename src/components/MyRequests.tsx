import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Request {
  id: string;
  request_type: string;
  request_date: string;
  reason: string;
  status: string;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  folga: "Folga",
  ferias: "Férias",
  falta: "Aviso de Falta",
  troca: "Troca de Dia",
  ajuste: "Ajuste de Horário",
};

const statusColors: Record<string, string> = {
  pendente: "bg-warning text-warning-foreground",
  aprovado: "bg-success text-success-foreground",
  recusado: "bg-destructive text-destructive-foreground",
};

export function MyRequests({ refreshKey }: { refreshKey?: number }) {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("requests")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => setRequests(data || []));
  }, [user, refreshKey]);

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tipo</TableHead>
          <TableHead>Data</TableHead>
          <TableHead className="hidden sm:table-cell">Motivo</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {requests.length === 0 ? (
          <TableRow>
            <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
              Nenhuma solicitação encontrada.
            </TableCell>
          </TableRow>
        ) : (
          requests.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="text-sm">{typeLabels[r.request_type] || r.request_type}</TableCell>
              <TableCell className="font-mono text-sm">
                {format(new Date(r.request_date + "T00:00:00"), "dd/MM/yyyy")}
              </TableCell>
              <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                {r.reason}
              </TableCell>
              <TableCell>
                <Badge className={`text-xs ${statusColors[r.status] || ""}`}>
                  {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                </Badge>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
