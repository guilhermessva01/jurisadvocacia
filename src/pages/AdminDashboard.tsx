import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Scale, LogOut, Users, ClipboardList, Clock, CalendarDays, FileBarChart, Settings, Activity } from "lucide-react";
import { AdminEmployees } from "@/components/admin/AdminEmployees";
import { AdminTimeRecords } from "@/components/admin/AdminTimeRecords";
import { AdminRequests } from "@/components/admin/AdminRequests";
import { AdminHoursBank } from "@/components/admin/AdminHoursBank";
import { AdminLateReport } from "@/components/admin/AdminLateReport";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { AdminOverview } from "@/components/admin/AdminOverview";
import { AdminHolidays } from "@/components/admin/AdminHolidays";

const ADMIN_TABS = [
  { id: "overview", label: "Painel", icon: Activity },
  { id: "employees", label: "Func.", icon: Users },
  { id: "records", label: "Registros", icon: ClipboardList },
  { id: "requests", label: "Solic.", icon: FileBarChart },
  { id: "hours", label: "Horas", icon: Clock },
  { id: "holidays", label: "Feriados", icon: CalendarDays },
  { id: "late", label: "Atrasos", icon: CalendarDays },
  { id: "settings", label: "Config", icon: Settings },
];

export default function AdminDashboard() {
  const { profile, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState("overview");

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "?";

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundImage: "url('/images/bg-juris.jpeg')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
      <header className="border-b border-border bg-primary sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-accent flex items-center justify-center flex-shrink-0">
              <Scale className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-accent-foreground" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-bold font-display text-primary-foreground leading-none truncate">JURIS ADVOCACIA</h1>
              <p className="text-[9px] sm:text-[10px] text-primary-foreground/70">Painel Administrativo</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar className="h-6 w-6 sm:h-7 sm:w-7 flex-shrink-0">
              <AvatarImage src={profile?.photo_url || undefined} />
              <AvatarFallback className="bg-accent/20 text-primary-foreground text-[10px] sm:text-xs">{initials}</AvatarFallback>
            </Avatar>
            <span className="text-sm text-primary-foreground/80 hidden sm:block truncate max-w-[120px]">
              {profile?.full_name} (Admin)
            </span>
            <Button variant="ghost" size="sm" onClick={signOut} className="h-8 w-8 p-0 flex-shrink-0 text-primary-foreground/80 hover:text-primary-foreground">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-2 sm:px-4 py-3 sm:py-6 pb-20 sm:pb-6">
        {/* Desktop tabs */}
        <div className="hidden sm:block mb-6">
          <div className="flex gap-1 bg-muted/50 rounded-lg p-1 overflow-x-auto">
            {ADMIN_TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all whitespace-nowrap ${
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
        <div className="overflow-x-auto">
          {activeTab === "overview" && <AdminOverview />}
          {activeTab === "employees" && <AdminEmployees />}
          {activeTab === "records" && <AdminTimeRecords />}
          {activeTab === "requests" && <AdminRequests />}
          {activeTab === "hours" && <AdminHoursBank />}
          {activeTab === "holidays" && <AdminHolidays />}
          {activeTab === "late" && <AdminLateReport />}
          {activeTab === "settings" && <AdminSettings />}
        </div>
        <footer className="text-center py-4">
          <p className="text-[10px] text-muted-foreground/70">Desenvolvido por Eng. Guilherme dos Santos</p>
        </footer>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-20 safe-area-bottom">
        <div className="grid grid-cols-7 h-14">
          {ADMIN_TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
                  activeTab === tab.id
                    ? "text-accent"
                    : "text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="text-[8px] sm:text-[10px] font-medium leading-tight">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
