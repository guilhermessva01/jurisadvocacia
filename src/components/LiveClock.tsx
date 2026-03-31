import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { getBrasiliaDate } from "@/lib/brasilia-time";

const DAYS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function LiveClock() {
  const [now, setNow] = useState(getBrasiliaDate());

  useEffect(() => {
    const timer = setInterval(() => setNow(getBrasiliaDate()), 1000);
    return () => clearInterval(timer);
  }, []);

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const seconds = String(now.getSeconds()).padStart(2, "0");

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center"
    >
      <div className="tabular-nums text-4xl sm:text-6xl font-bold tracking-tighter text-foreground leading-none">
        {hours}:{minutes}
        <span className="text-xl sm:text-3xl text-muted-foreground ml-1">{seconds}</span>
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">Horário de Brasília</p>
      <div className="mt-2 space-y-0.5">
        <p className="text-xs sm:text-sm font-medium text-foreground">
          {DAYS[now.getDay()]}
        </p>
        <p className="text-xs sm:text-sm text-muted-foreground">
          {now.getDate()} de {MONTHS[now.getMonth()]} de {now.getFullYear()}
        </p>
      </div>
    </motion.div>
  );
}
