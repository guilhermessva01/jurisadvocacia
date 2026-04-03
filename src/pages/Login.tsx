import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Scale, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const { signIn } = useAuth();
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!login.trim() || !password.trim()) {
      toast.error("Preencha todos os campos.");
      return;
    }
    setLoading(true);

    let email = login.trim();

    // If input doesn't look like an email, look up username
    if (!email.includes("@")) {
      try {
        const { data, error } = await supabase.functions.invoke("lookup-username", {
          body: { username: email },
        });
        if (error || data?.error || !data?.email) {
          toast.error("Usuário não encontrado.");
          setLoading(false);
          return;
        }
        email = data.email;
      } catch {
        toast.error("Erro ao buscar usuário.");
        setLoading(false);
        return;
      }
    }

    const { error } = await signIn(email, password);
    if (error) {
      toast.error("Credenciais inválidas. Tente novamente.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-xl bg-primary mb-4">
            <Scale className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold font-display text-foreground tracking-tight">
            JURIS ADVOCACIA
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Sistema de Controle de Ponto
          </p>
        </div>

        <Card className="shadow-md border-border">
          <CardHeader className="pb-4">
            <h2 className="text-lg font-semibold font-display text-foreground text-center">
              Acessar Sistema
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login">Login (E-mail ou Usuário)</Label>
                <Input
                  id="login"
                  type="text"
                  placeholder="seu@email.com ou nome.usuario"
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-12 rounded-xl font-semibold text-base" disabled={loading}>
                {loading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} Juris Advocacia — Todos os direitos reservados
        </p>
        <p className="text-center text-[10px] text-muted-foreground mt-1">
          Desenvolvido por Eng. Guilherme dos Santos
        </p>
      </motion.div>
    </div>
  );
}
