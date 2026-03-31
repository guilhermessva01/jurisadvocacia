import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save, MapPin } from "lucide-react";

interface OfficeSetting {
  id: string;
  office_name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  radius_meters: number;
  whatsapp_notification_number: string | null;
  cycle_start_date: string | null;
}

export function AdminSettings() {
  const [offices, setOffices] = useState<OfficeSetting[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.from("office_settings").select("*").order("created_at")
      .then(({ data }) => setOffices((data as unknown as OfficeSetting[]) || []));
  }, []);

  const updateOffice = (index: number, field: string, value: string | number) => {
    setOffices(prev => prev.map((o, i) => i === index ? { ...o, [field]: value } : o));
  };

  const handleSave = async () => {
    setLoading(true);
    let hasError = false;

    for (const office of offices) {
      const { error } = await supabase.from("office_settings").update({
        office_name: office.office_name,
        address: office.address,
        latitude: office.latitude,
        longitude: office.longitude,
        radius_meters: office.radius_meters,
        whatsapp_notification_number: office.whatsapp_notification_number,
      }).eq("id", office.id);

      if (error) hasError = true;
    }

    if (hasError) toast.error("Erro ao salvar algumas configurações.");
    else toast.success("Configurações salvas!");
    setLoading(false);
  };

  if (offices.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {offices.map((office, idx) => (
          <Card key={office.id} className="shadow-md">
            <CardHeader>
              <CardTitle className="text-base font-display flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                {office.office_name || `Escritório ${idx + 1}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Nome</Label>
                <Input value={office.office_name} onChange={(e) => updateOffice(idx, "office_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Endereço</Label>
                <Input value={office.address || ""} onChange={(e) => updateOffice(idx, "address", e.target.value)} placeholder="Preencha o endereço" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label>Latitude</Label>
                  <Input type="number" step="any" value={office.latitude} onChange={(e) => updateOffice(idx, "latitude", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Longitude</Label>
                  <Input type="number" step="any" value={office.longitude} onChange={(e) => updateOffice(idx, "longitude", parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Raio (metros)</Label>
                <Input type="number" value={office.radius_meters} onChange={(e) => updateOffice(idx, "radius_meters", parseInt(e.target.value) || 50)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="text-base font-display">Notificações WhatsApp</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Número para Notificações</Label>
            <Input
              value={offices[0]?.whatsapp_notification_number || ""}
              onChange={(e) => updateOffice(0, "whatsapp_notification_number", e.target.value)}
              placeholder="+5511999999999"
            />
            <p className="text-xs text-muted-foreground">
              Formato internacional com código do país. Ex: +5511999999999
            </p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="gap-1.5">
        <Save className="w-4 h-4" />
        {loading ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
}
