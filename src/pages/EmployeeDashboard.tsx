import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { LiveClock } from "@/components/LiveClock";
import { PunchButton } from "@/components/PunchButton";
import { TimeHistory } from "@/components/TimeHistory";
import { RequestForm } from "@/components/RequestForm";
import { MyRequests } from "@/components/MyRequests";
import { EmployeeHoursBank } from "@/components/EmployeeHoursBank";
import { ProfilePhotoUpload } from "@/components/ProfilePhotoUpload";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { motion } from "framer-motion";
import { Scale, LogOut, Clock, History, FileText, Send, Settings, Timer } from "lucide-react";
import { toast } from "sonner";

export default function EmployeeDashboard() {
  const { user, profile, signOut } = useAuth();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState("ponto");
  const [credForm, setCredForm] = useState({ email: "", password: "", confirmPassword: "" });
  const [credLoading, setCredLoading] = useState(false);
  const refresh = () => setRefreshKey((k) => k + 1);

  const handleUpdateCredentials = async () => {
    if (!credForm.email.trim() && !credForm.password.trim()) {
      toast.error("Informe o novo e-mail ou nova senha.");
      return;
    }
    if (credForm.password && credForm.password !== credForm.confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    setCredLoading(true);
    const body: Record<string, string> = { target_user_id: user!.id };
    if (credForm.email.trim()) body.email = credForm.email.trim();
    if (credForm.password.trim()) body.password = credForm.password.trim();

    const { data, error } = await supabase.functions.invoke("update-user-credentials", { body });
    if (error || data?.error) {
      toast.error(data?.error || "Erro ao atualizar credenciais.");
    } else {
      toast.success("Credenciais atualizadas com sucesso!");
      setCredForm({ email: "", password: "", confirmPassword: "" });
    }
    setCredLoading(false);
  };

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  const tabs = [
    { id: "ponto", label: "Ponto", icon: Clock },
    { id: "historico", label: "Histórico", icon: History },
    { id: "horas", label: "Horas", icon: Timer },
    { id: "solicitar", label: "Solicitar", icon: Send },
    { id: "solicitacoes", label: "Status", icon: FileText },
    { id: "config", label: "Config", icon: Settings },
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundImage: "url('/images/bg-juris.jpeg')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      <header className="border-b border-border bg-primary sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold font-display text-primary-foreground leading-none truncate">JURIS ADVOCACIA</h1>
              <p className="text-[9px] sm:text-[10px] text-primary-foreground/70">Controle de Ponto</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0">
              <AvatarImage src={profile?.photo_url || undefined} />
              <AvatarFallback className="bg-accent/20 text-primary-foreground text-[10px] sm:text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-primary-foreground/80 hidden sm:block truncate max-w-[120px]">
              {profile?.full_name}
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-8 w-8 p-0 flex-shrink-0 text-primary-foreground/80 hover:text-primary-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Bottom tab bar on mobile, top tabs on desktop */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-2 sm:px-4 py-3 sm:py-6 pb-20 sm:pb-6">
        {/* Desktop tabs */}
        <div className="hidden sm:block mb-6">
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    activeTab === tab.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content */}
        {activeTab === "ponto" && (
          <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="shadow-md">
                <CardContent className="pt-6 pb-6 sm:pt-8 sm:pb-8">
                  <LiveClock />
                </CardContent>
              </Card>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <Card className="shadow-md">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm sm:text-base font-display">Registrar Ponto</CardTitle>
                </CardHeader>
                <CardContent>
                  <PunchButton onSuccess={refresh} />
                </CardContent>
              </Card>
            </motion.div>
          </div>
        )}

        {activeTab === "historico" && (
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-display">Histórico de Registros</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <TimeHistory refreshKey={refreshKey} />
            </CardContent>
          </Card>
        )}

        {activeTab === "horas" && (
          <EmployeeHoursBank />
        )}

        {activeTab === "solicitar" && (
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-display">Nova Solicitação</CardTitle>
            </CardHeader>
            <CardContent>
              <RequestForm onSuccess={refresh} />
            </CardContent>
          </Card>
        )}

        {activeTab === "solicitacoes" && (
          <Card className="shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm sm:text-base font-display">Minhas Solicitações</CardTitle>
            </CardHeader>
            <CardContent>
              <MyRequests refreshKey={refreshKey} />
            </CardContent>
          </Card>
        )}

        {activeTab === "config" && (
          <div className="space-y-4 sm:space-y-6">
            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm sm:text-base font-display">Foto do Perfil</CardTitle>
              </CardHeader>
              <CardContent>
                <ProfilePhotoUpload />
              </CardContent>
            </Card>
            <Card className="shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm sm:text-base font-display">Alterar Login e Senha</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Novo E-mail (Login)</Label>
                    <Input type="email" value={credForm.email} onChange={(e) => setCredForm({ ...credForm, email: e.target.value })} placeholder="Deixe vazio para manter" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Nova Senha</Label>
                    <Input type="password" value={credForm.password} onChange={(e) => setCredForm({ ...credForm, password: e.target.value })} placeholder="Deixe vazio para manter" className="text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs sm:text-sm">Confirmar Nova Senha</Label>
                    <Input type="password" value={credForm.confirmPassword} onChange={(e) => setCredForm({ ...credForm, confirmPassword: e.target.value })} placeholder="Repita a nova senha" className="text-sm" />
                  </div>
                  <Button onClick={handleUpdateCredentials} disabled={credLoading} className="w-full">
                    {credLoading ? "Salvando..." : "Atualizar Credenciais"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        <footer className="text-center py-4">
          <p className="text-[10px] text-muted-foreground/70">Desenvolvido por Eng. Guilherme dos Santos</p>
        </footer>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-20 safe-area-bottom">
        <div className="flex justify-around items-center h-14">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors ${
                  activeTab === tab.id
                    ? "text-accent"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
