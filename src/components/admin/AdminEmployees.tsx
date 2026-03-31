import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { UserPlus, Pencil, Trash2, CalendarClock, Plus } from "lucide-react";
import { motion } from "framer-motion";
import { AdminScheduleEditor } from "./AdminScheduleEditor";

interface Employee {
  id: string;
  user_id: string;
  full_name: string;
  cpf: string | null;
  username: string | null;
}

const DAYS_OF_WEEK = [
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
  { value: 0, label: "Domingo" },
];

interface ScheduleDay {
  dayOfWeek: number;
  active: boolean;
  startTime: string;
  endTime: string;
  breakMinutes: number;
}

interface ShiftBlock {
  rows: ScheduleDay[];
}

const createEmptyShift = (): ShiftBlock => ({
  rows: DAYS_OF_WEEK.map(d => ({
    dayOfWeek: d.value,
    active: d.value >= 1 && d.value <= 5,
    startTime: "08:00",
    endTime: "18:00",
    breakMinutes: 60,
  })),
});

export function AdminEmployees() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [openCreate, setOpenCreate] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [form, setForm] = useState({ full_name: "", cpf: "", email: "", password: "", username: "" });
  const [editForm, setEditForm] = useState({ full_name: "", cpf: "", email: "", password: "", username: "" });
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [newUserId, setNewUserId] = useState<string | null>(null);
  const [shifts, setShifts] = useState<ShiftBlock[]>([createEmptyShift()]);

  // Schedule editor state
  const [scheduleEditorOpen, setScheduleEditorOpen] = useState(false);
  const [scheduleEditorEmployee, setScheduleEditorEmployee] = useState<Employee | null>(null);

  const fetchEmployees = async () => {
    const { data } = await supabase.from("profiles").select("id, user_id, full_name, cpf, username").order("full_name");
    setEmployees((data || []).filter(e => e.user_id !== user?.id));
  };

  useEffect(() => { fetchEmployees(); }, []);

  const resetForm = () => {
    setForm({ full_name: "", cpf: "", email: "", password: "", username: "" });
    setStep(1);
    setNewUserId(null);
    setShifts([createEmptyShift()]);
  };

  const handleCreate = async () => {
    if (!form.full_name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("Nome, e-mail e senha são obrigatórios.");
      return;
    }
    setLoading(true);

    const { data, error } = await supabase.functions.invoke("create-employee", {
      body: {
        email: form.email,
        password: form.password,
        full_name: form.full_name,
        cpf: form.cpf || null,
        username: form.username.trim() || null,
      },
    });

    if (error || data?.error) {
      toast.error(data?.error || "Erro ao criar funcionário.");
      setLoading(false);
      return;
    }

    setNewUserId(data.user_id);
    setStep(2);
    toast.success("Funcionário criado! Configure o turno de trabalho.");
    setLoading(false);
  };

  const handleSaveSchedule = async () => {
    if (!newUserId) return;
    setLoading(true);

    const inserts: Array<{
      user_id: string;
      day_of_week: number;
      start_time: string;
      end_time: string;
      break_minutes: number;
      is_active: boolean;
    }> = [];

    for (const shift of shifts) {
      for (const d of shift.rows) {
        if (d.active) {
          inserts.push({
            user_id: newUserId,
            day_of_week: d.dayOfWeek,
            start_time: d.startTime,
            end_time: d.endTime,
            break_minutes: d.breakMinutes,
            is_active: true,
          });
        }
      }
    }

    if (inserts.length === 0) {
      toast.error("Selecione pelo menos um dia de trabalho.");
      setLoading(false);
      return;
    }

    const { error } = await supabase.from("work_schedules").insert(inserts);
    if (error) {
      toast.error("Erro ao salvar turno.");
    } else {
      toast.success("Funcionário cadastrado com turno configurado!");
      resetForm();
      setOpenCreate(false);
      fetchEmployees();
    }
    setLoading(false);
  };

  const toggleDay = (shiftIdx: number, dayOfWeek: number) => {
    setShifts(prev => prev.map((s, si) =>
      si === shiftIdx
        ? { ...s, rows: s.rows.map(r => r.dayOfWeek === dayOfWeek ? { ...r, active: !r.active } : r) }
        : s
    ));
  };

  const updateScheduleField = (shiftIdx: number, dayOfWeek: number, field: string, value: string | number) => {
    setShifts(prev => prev.map((s, si) =>
      si === shiftIdx
        ? { ...s, rows: s.rows.map(r => r.dayOfWeek === dayOfWeek ? { ...r, [field]: value } : r) }
        : s
    ));
  };

  const addShift = () => {
    if (shifts.length >= 3) {
      toast.error("Máximo de 3 turnos.");
      return;
    }
    setShifts(prev => [...prev, createEmptyShift()]);
  };

  const removeShift = (idx: number) => {
    setShifts(prev => prev.filter((_, i) => i !== idx));
  };

  const handleEdit = async (employee: Employee) => {
    setEditingEmployee(employee);
    setEditForm({ full_name: employee.full_name, cpf: employee.cpf || "", email: "", password: "", username: employee.username || "" });
    setOpenEdit(true);
  };

  const handleUpdate = async () => {
    if (!editingEmployee || !editForm.full_name.trim()) {
      toast.error("Nome é obrigatório.");
      return;
    }
    setLoading(true);

    const { error } = await supabase.from("profiles").update({
      full_name: editForm.full_name,
      cpf: editForm.cpf || null,
      username: editForm.username.trim() || null,
    }).eq("id", editingEmployee.id);

    if (error) {
      toast.error("Erro ao atualizar perfil.");
      setLoading(false);
      return;
    }

    if (editForm.email.trim() || editForm.password.trim()) {
      const credBody: Record<string, string> = { target_user_id: editingEmployee.user_id };
      if (editForm.email.trim()) credBody.email = editForm.email.trim();
      if (editForm.password.trim()) credBody.password = editForm.password.trim();

      const { data: credData, error: credError } = await supabase.functions.invoke("update-user-credentials", {
        body: credBody,
      });

      if (credError || credData?.error) {
        toast.error(credData?.error || "Erro ao atualizar login/senha.");
        setLoading(false);
        return;
      }
    }

    toast.success("Funcionário atualizado com sucesso!");
    setOpenEdit(false);
    setEditingEmployee(null);
    fetchEmployees();
    setLoading(false);
  };

  const handleDelete = async (employee: Employee) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-user", {
        body: { user_id: employee.user_id },
      });
      if (error) {
        const errorMsg = typeof data?.error === "string" ? data.error : "Erro ao excluir funcionário.";
        toast.error(errorMsg);
      } else {
        toast.success(`${employee.full_name} foi excluído com sucesso.`);
        fetchEmployees();
      }
    } catch {
      toast.error("Erro ao excluir funcionário.");
    }
    setLoading(false);
  };

  const openScheduleEditor = (employee: Employee) => {
    setScheduleEditorEmployee(employee);
    setScheduleEditorOpen(true);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card className="shadow-md">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-display">Funcionários</CardTitle>
          <Dialog open={openCreate} onOpenChange={(open) => { setOpenCreate(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <UserPlus className="w-4 h-4" /> Cadastrar
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[85vh] overflow-y-auto max-w-2xl">
              <DialogHeader>
                <DialogTitle className="font-display">
                  {step === 1 ? "Novo Funcionário" : "Configurar Turnos de Trabalho"}
                </DialogTitle>
              </DialogHeader>

              {step === 1 ? (
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label>Nome Completo *</Label>
                    <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>CPF</Label>
                    <Input value={form.cpf} onChange={(e) => setForm({ ...form, cpf: e.target.value })} placeholder="000.000.000-00" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Nome de Usuário (Login alternativo)</Label>
                    <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} placeholder="Ex: joao.silva" />
                    <p className="text-[11px] text-muted-foreground">Opcional. Permite login sem precisar do e-mail.</p>
                  </div>
                  <div className="space-y-1.5">
                    <Label>E-mail *</Label>
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Senha *</Label>
                    <Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Configure os turnos de trabalho para <strong>{form.full_name}</strong>. Você pode adicionar até 3 turnos diferentes.
                  </p>

                  {shifts.map((shift, shiftIdx) => (
                    <div key={shiftIdx} className="border border-border rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="font-semibold text-sm">Turno {shiftIdx + 1}</Label>
                        {shifts.length > 1 && (
                          <Button variant="ghost" size="sm" onClick={() => removeShift(shiftIdx)} className="h-7 text-destructive text-xs">
                            Remover
                          </Button>
                        )}
                      </div>
                      {DAYS_OF_WEEK.map((day) => {
                        const s = shift.rows.find(d => d.dayOfWeek === day.value)!;
                        return (
                          <div key={day.value} className="flex items-center gap-2 p-1.5 rounded border border-border/50">
                            <Checkbox checked={s.active} onCheckedChange={() => toggleDay(shiftIdx, day.value)} />
                            <span className="text-xs font-medium min-w-[55px]">{day.label}</span>
                            {s.active && (
                              <div className="flex items-center gap-1.5 flex-1 flex-wrap">
                                <Input type="time" value={s.startTime} onChange={(e) => updateScheduleField(shiftIdx, day.value, "startTime", e.target.value)} className="h-7 w-[90px] text-xs" />
                                <span className="text-muted-foreground text-[10px]">até</span>
                                <Input type="time" value={s.endTime} onChange={(e) => updateScheduleField(shiftIdx, day.value, "endTime", e.target.value)} className="h-7 w-[90px] text-xs" />
                                <Input type="number" value={s.breakMinutes} onChange={(e) => updateScheduleField(shiftIdx, day.value, "breakMinutes", parseInt(e.target.value) || 0)} className="h-7 w-14 text-xs" min={0} />
                                <span className="text-muted-foreground text-[10px]">min</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}

                  <Button variant="outline" size="sm" onClick={addShift} className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> Adicionar Turno
                  </Button>
                </div>
              )}

              <DialogFooter>
                {step === 1 ? (
                  <>
                    <Button variant="outline" onClick={() => { setOpenCreate(false); resetForm(); }}>Cancelar</Button>
                    <Button onClick={handleCreate} disabled={loading}>
                      {loading ? "Criando..." : "Próximo →"}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button variant="outline" onClick={() => { handleSaveSchedule(); }} disabled={loading}>
                      {loading ? "Salvando..." : "Salvar Turnos"}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead className="w-32">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {employees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                    Nenhum funcionário cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                employees.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.full_name}</TableCell>
                    <TableCell className="font-mono text-sm">{e.cpf || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(e)} title="Editar dados">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => openScheduleEditor(e)} title="Editar turnos">
                          <CalendarClock className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Funcionário</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir <strong>{e.full_name}</strong>? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(e)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Employee Dialog */}
      <Dialog open={openEdit} onOpenChange={setOpenEdit}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Editar Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nome Completo *</Label>
              <Input value={editForm.full_name} onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>CPF</Label>
              <Input value={editForm.cpf} onChange={(e) => setEditForm({ ...editForm, cpf: e.target.value })} placeholder="000.000.000-00" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome de Usuário</Label>
              <Input value={editForm.username} onChange={(e) => setEditForm({ ...editForm, username: e.target.value })} placeholder="Ex: joao.silva" />
            </div>
            <div className="space-y-1.5">
              <Label>Novo E-mail</Label>
              <Input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} placeholder="Deixe vazio para manter o atual" />
            </div>
            <div className="space-y-1.5">
              <Label>Nova Senha</Label>
              <Input type="password" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Deixe vazio para manter a atual" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenEdit(false)}>Cancelar</Button>
            <Button onClick={handleUpdate} disabled={loading}>
              {loading ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Editor */}
      {scheduleEditorEmployee && (
        <AdminScheduleEditor
          open={scheduleEditorOpen}
          onOpenChange={setScheduleEditorOpen}
          userId={scheduleEditorEmployee.user_id}
          employeeName={scheduleEditorEmployee.full_name}
        />
      )}
    </motion.div>
  );
}
