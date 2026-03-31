import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCurrentPosition, reverseGeocode, isWithinRadius } from "@/lib/geofence";
import { getBrasiliaDate, getBrasiliaISODate, getBrasiliaTimeString } from "@/lib/brasilia-time";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { MapPin, LogIn, LogOut } from "lucide-react";

const RECORD_TYPES = [
  { value: "entrada", label: "Entrada", icon: LogIn },
  { value: "saida", label: "Saída", icon: LogOut },
] as const;

const OUTSIDE_REASONS = [
  "Audiência",
  "Reunião externa",
  "Visita ao cliente",
  "Trabalho externo",
  "Outro",
];

export function PunchButton({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useAuth();
  const [type, setType] = useState<string>("entrada");
  const [loading, setLoading] = useState(false);
  const [showOutsideDialog, setShowOutsideDialog] = useState(false);
  const [outsideReason, setOutsideReason] = useState("");
  const [customReason, setCustomReason] = useState("");
  const [pendingData, setPendingData] = useState<{
    lat: number; lon: number; address: string;
  } | null>(null);

  const getLastRecord = async () => {
    if (!user) return null;

    const { data } = await supabase
      .from("time_records")
      .select("record_type, record_date, record_time")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return data;
  };

  useEffect(() => {
    if (!user) return;

    void getLastRecord().then((lastRecord) => {
      if (!lastRecord || lastRecord.record_type === "saida") {
        setType("entrada");
      } else if (lastRecord.record_type === "entrada") {
        setType("saida");
      } else {
        setType("entrada");
      }
    });
  }, [user]);

  const handlePunch = async () => {
    if (!user) return;

    if (type === "saida" && !window.confirm("Confirmar registro de saída?")) {
      return;
    }

    setLoading(true);

    try {
      const lastRecord = await getLastRecord();
      const lastType = lastRecord?.record_type;

      if (type === "entrada" && lastType && lastType !== "saida") {
        toast.error("Você precisa registrar a saída antes de uma nova entrada.");
        setLoading(false);
        return;
      }

      if (type === "saida") {
        if (!lastType || lastType === "saida") {
          toast.error("Você precisa registrar entrada antes de registrar saída.");
          setLoading(false);
          return;
        }
      }

      const pos = await getCurrentPosition();
      if (!pos) {
        toast.error("Ative o GPS.");
        setLoading(false);
        return;
      }

      const address = await reverseGeocode(pos.lat, pos.lon);

      const { data: allOffices } = await supabase
        .from("office_settings")
        .select("*");

      // Filter offices that have been properly configured (not default São Paulo coords)
      const configuredOffices = (allOffices || []).filter(office => {
        const isDefaultLat = Math.abs(office.latitude - (-23.5505)) < 0.001;
        const isDefaultLon = Math.abs(office.longitude - (-46.6333)) < 0.001;
        return !(isDefaultLat && isDefaultLon);
      });

      // If no offices have been configured with real coordinates, allow the punch
      const within = configuredOffices.length === 0
        ? true
        : configuredOffices.some(office =>
            isWithinRadius(pos.lat, pos.lon, office.latitude, office.longitude, office.radius_meters)
          );

      if (!within) {
        setPendingData({ lat: pos.lat, lon: pos.lon, address });
        setShowOutsideDialog(true);
        setLoading(false);
        return;
      }

      // Check if within scheduled work hours
      const scheduleStatus = await checkScheduleStatus();
      await saveRecord(pos.lat, pos.lon, address, "dentro", null, scheduleStatus);
    } catch {
      toast.error("Erro ao registrar ponto.");
    }

    setLoading(false);
  };

  const checkScheduleStatus = async (): Promise<{ withinSchedule: boolean; isLate: boolean; lateMinutes: number }> => {
    if (!user) return { withinSchedule: false, isLate: false, lateMinutes: 0 };

    const now = getBrasiliaDate();
    const dayOfWeek = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const { data: schedules } = await supabase
      .from("work_schedules")
      .select("start_time, end_time")
      .eq("user_id", user.id)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true);

    if (!schedules || schedules.length === 0) {
      return { withinSchedule: true, isLate: false, lateMinutes: 0 };
    }

    // Check if current time falls within ANY configured shift
    let withinSchedule = false;
    let isLate = false;
    let lateMinutes = 0;

    for (const schedule of schedules) {
      const [sh, sm] = schedule.start_time.split(":").map(Number);
      const [eh, em] = schedule.end_time.split(":").map(Number);
      const startMin = sh * 60 + sm;
      const endMin = eh * 60 + em;

      // Within this shift (with 5min grace after end)
      if (currentMinutes >= startMin && currentMinutes <= endMin + 5) {
        withinSchedule = true;

        // Check late for entrada
        if (type === "entrada" && currentMinutes > startMin) {
          isLate = true;
          lateMinutes = currentMinutes - startMin;
        }
        break;
      }
    }

    return { withinSchedule, isLate, lateMinutes };
  };

  const saveRecord = async (
    lat: number,
    lon: number,
    address: string,
    locationStatus: string,
    reason: string | null,
    scheduleStatus?: { withinSchedule: boolean; isLate: boolean; lateMinutes: number }
  ) => {
    if (!user) return;

    const status = scheduleStatus || await checkScheduleStatus();

    let effectiveReason = reason;
    if (!status.withinSchedule) {
      effectiveReason = reason ? `${reason} (fora do horário)` : "Fora do horário de trabalho";
      toast.info("⚠️ Registro FORA do horário de trabalho programado.", { duration: 5000 });
    } else {
      toast.info("✅ Registro DENTRO do horário de trabalho.", { duration: 3000 });
    }

    const currentType = type;
    const recordDate = getBrasiliaISODate();
    const recordTime = getBrasiliaTimeString();

    const { error } = await supabase.from("time_records").insert({
      user_id: user.id,
      record_date: recordDate,
      record_time: recordTime,
      record_type: currentType,
      latitude: lat,
      longitude: lon,
      address,
      location_status: locationStatus,
      outside_reason: effectiveReason,
      is_late: status.isLate,
      late_minutes: status.lateMinutes,
    });

    if (error) {
      console.error(error);
      toast.error("Erro ao salvar registro.");
    } else {
      if (currentType === "entrada") setType("saida");
      else if (currentType === "saida") setType("entrada");

      toast.success(`${RECORD_TYPES.find(r => r.value === currentType)?.label} registrada com sucesso!`);
      onSuccess?.();
    }
  };

  const handleOutsideSubmit = async () => {
    if (!pendingData) return;

    const reason = outsideReason === "Outro" ? customReason : outsideReason;

    if (!reason.trim()) {
      toast.error("Informe o motivo.");
      return;
    }

    setLoading(true);
    const scheduleStatus = await checkScheduleStatus();
    await saveRecord(pendingData.lat, pendingData.lon, pendingData.address, "fora", reason, scheduleStatus);
    setShowOutsideDialog(false);
    setOutsideReason("");
    setCustomReason("");
    setPendingData(null);
    setLoading(false);
  };

  return (
    <>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {RECORD_TYPES.map((rt) => {
            const Icon = rt.icon;
            return (
              <button
                key={rt.value}
                onClick={() => setType(rt.value)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium ${
                  type === rt.value
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {rt.label}
              </button>
            );
          })}
        </div>

        <motion.div whileTap={{ scale: 0.95 }}>
          <Button onClick={handlePunch} disabled={loading} className="w-full h-16 text-lg">
            <MapPin className="w-5 h-5 mr-2" />
            {loading ? "Registrando..." : "Confirmar Registro"}
          </Button>
        </motion.div>
      </div>

      <Dialog open={showOutsideDialog} onOpenChange={setShowOutsideDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registro Fora da Área</DialogTitle>
            <DialogDescription>
              Você está fora do local permitido. Informe o motivo para continuar.
            </DialogDescription>
          </DialogHeader>

          <Select value={outsideReason} onValueChange={setOutsideReason}>
            <SelectTrigger>
              <SelectValue placeholder="Motivo" />
            </SelectTrigger>
            <SelectContent>
              {OUTSIDE_REASONS.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {outsideReason === "Outro" && (
            <Textarea value={customReason} onChange={(e) => setCustomReason(e.target.value)} />
          )}

          <DialogFooter>
            <Button onClick={handleOutsideSubmit}>
              {loading ? "Registrando..." : "Confirmar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
