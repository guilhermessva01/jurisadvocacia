import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { exportToCSV, exportToExcel } from "@/lib/export-utils";
import { Download, Pencil, Trash2 } from "lucide-react";
import { formatLateDuration } from "@/lib/format-utils";
import { toast } from "sonner";

interface TimeRecord {
  id: string;
  user_id: string;
  record_date: string;
  record_time: string;
  record_type: string;
  location_status: string | null;
  is_late: boolean | null;
  late_minutes: number | null;
  address: string | null;
  outside_reason: string | null;
}

interface Employee {
  user_id: string;
  full_name: string;
}

export function AdminTimeRecords() {
  const formatDate = (dateString: string) =>
    new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(`${dateString}T00:00:00`));

  const formatTime = (timeString: string) => timeString.slice(0, 8);

  const [records, setRecords] = useState<TimeRecord[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filterEmployee, setFilterEmployee] = useState("all");
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [editRecord, setEditRecord] = useState<TimeRecord | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editTime, setEditTime] = useState("");
  const [editType, setEditType] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const employeeMap = Object.fromEntries(
    (employees || []).map((e) => [e.user_id, e.full_name])
  );

  useEffect(() => {
    supabase.from("profiles").select("user_id, full_name").order("full_name")
      .then(({ data }) => setEmployees(data || []));
  }, []);

  const fetchRecords = async () => {
    let query = supabase
      .from("time_records")
      .select("id, user_id, record_date, record_time, record_type, location_status, is_late, late_minutes, address, outside_reason")
      .order("created_at", { ascending: false })
      .limit(200);

    if (filterEmployee !== "all") {
      query = query.eq("user_id", filterEmployee);
    }

    const { data } = await query;

    const filtered = (data || []).filter((r) => {
      const recordMonth = new Date(`${r.record_date}T00:00:00`).getMonth() + 1;
      return String(recordMonth) === filterMonth;
    });

    setRecords(filtered);
  };

  useEffect(() => { fetchRecords(); }, [filterEmployee, filterMonth]);

  const typeLabels: Record<string, string> = {
    entrada: "Entrada",
    saida: "Saída",
  };

  const handleEdit = (r: TimeRecord) => {
    setEditRecord(r);
    setEditDate(r.record_date);
    setEditTime(r.record_time.slice(0, 5));
    setEditType(r.record_type);
  };

  const handleSaveEdit = async () => {
    if (!editRecord) return;
    const { error } = await supabase
      .from("time_records")
      .update({
        record_date: editDate,
        record_time: editTime,
        record_type: editType,
      })
      .eq("id", editRecord.id);

    if (error) {
      toast.error("Erro ao atualizar registro.");
    } else {
      toast.success("Registro atualizado!");
      setEditRecord(null);
      fetchRecords();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("time_records").delete().eq("id", id);
    if (error) {
      toast.error("Erro ao excluir registro.");
    } else {
      toast.success("Registro excluído!");
      setDeleteConfirm(null);
      fetchRecords();
    }
  };

  const handleExport = (fmt: "csv" | "excel") => {
    const data = records.map((r) => ({
      Funcionário: employeeMap[r.user_id] || "—",
      Data: formatDate(r.record_date),
      Hora: formatTime(r.record_time),
      Tipo: typeLabels[r.record_type] || r.record_type,
      Localização: r.location_status === "dentro" ? "Escritório" : r.outside_reason || "Externo",
      Atraso: r.is_late ? formatLateDuration(r.late_minutes ?? 0) : "Não",
      Endereço: r.address || "",
    }));
    if (fmt === "csv") exportToCSV(data, "registros-ponto");
    else exportToExcel(data, "registros-ponto");
  };

  return (
    <>
      <Card className="shadow-md">
        <CardHeader className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
          <CardTitle className="text-base font-display">Relatório de Pontos</CardTitle>
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
              <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => (
                  <SelectItem key={i + 1} value={String(i + 1)}>
                    {new Date(2024, i).toLocaleString("pt-BR", { month: "long" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button onClick={() => handleExport("csv")} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1" /> CSV
            </Button>
            <Button onClick={() => handleExport("excel")} size="sm" variant="outline">
              <Download className="w-4 h-4 mr-1" /> Excel
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Hora</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Local</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center">Nenhum registro encontrado.</TableCell>
                </TableRow>
              ) : (
                records.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{employeeMap[r.user_id] || "—"}</TableCell>
                    <TableCell>{formatDate(r.record_date)}</TableCell>
                    <TableCell>{formatTime(r.record_time)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-xs">{typeLabels[r.record_type] || r.record_type}</Badge>
                    </TableCell>
                    <TableCell>{r.location_status === "dentro" ? "Escritório" : r.outside_reason || "Externo"}</TableCell>
                    <TableCell>
                      {r.is_late ? <Badge variant="destructive">Atraso</Badge> : <Badge variant="secondary">OK</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(r)}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteConfirm(r.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={!!editRecord} onOpenChange={(o) => !o && setEditRecord(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Registro</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Data</label>
              <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Hora</label>
              <Input type="time" value={editTime} onChange={(e) => setEditTime(e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Tipo</label>
              <Select value={editType} onValueChange={setEditType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entrada">Entrada</SelectItem>
                  <SelectItem value="saida">Saída</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRecord(null)}>Cancelar</Button>
            <Button onClick={handleSaveEdit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <Dialog open={!!deleteConfirm} onOpenChange={(o) => !o && setDeleteConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Exclusão</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza que deseja excluir este registro? Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteConfirm && handleDelete(deleteConfirm)}>Excluir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
