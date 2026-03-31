import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

interface Request {
  id: string;
  user_id: string;
  request_type: string;
  request_date: string;
  reason: string;
  status: string;
  created_at: string;
}

const typeLabels: Record<string, string> = {
  folga: "Folga", ferias: "Férias", falta: "Aviso de Falta", troca: "Troca de Dia", ajuste: "Ajuste",
};

export function AdminRequests() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [employees, setEmployees] = useState<Record<string, string>>({});

  const fetchData = async () => {
    const [reqRes, empRes] = await Promise.all([
      supabase.from("requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name"),
    ]);
    setRequests(reqRes.data || []);
    setEmployees(Object.fromEntries((empRes.data || []).map(e => [e.user_id, e.full_name])));
  };

  useEffect(() => { fetchData(); }, []);

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase.from("requests").update({ status }).eq("id", id);
    if (error) {
      toast.error("Erro ao atualizar solicitação.");
    } else {
      toast.success(`Solicitação ${status === "aprovado" ? "aprovada" : "recusada"}!`);
      fetchData();
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader>
        <CardTitle className="text-base font-display">Solicitações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="hidden sm:table-cell">Motivo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhuma solicitação.
                  </TableCell>
                </TableRow>
              ) : (
                requests.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium text-sm">{employees[r.user_id] || "—"}</TableCell>
                    <TableCell className="text-sm">{typeLabels[r.request_type] || r.request_type}</TableCell>
                    <TableCell className="font-mono text-sm">
                      {format(new Date(r.request_date + "T00:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell text-sm text-muted-foreground max-w-[200px] truncate">
                      {r.reason}
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-xs ${
                        r.status === "pendente" ? "bg-warning text-warning-foreground" :
                        r.status === "aprovado" ? "bg-success text-success-foreground" :
                        "bg-destructive text-destructive-foreground"
                      }`}>
                        {r.status.charAt(0).toUpperCase() + r.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.status === "pendente" && (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-success" onClick={() => updateStatus(r.id, "aprovado")}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => updateStatus(r.id, "recusado")}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
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
