import { createContext, useContext, useState, type ReactNode } from "react";
import { monthOptions } from "@/lib/date";

export interface Period {
  month: number;
  year: number;
}

interface PeriodContextValue {
  period: Period;
  setPeriod: (p: Period) => void;
  options: { month: number; year: number; label: string }[];
}

const PeriodContext = createContext<PeriodContextValue | null>(null);

export function PeriodProvider({ children }: { children: ReactNode }) {
  const options = monthOptions();
  const latest = options[options.length - 1]!;
  const [period, setPeriod] = useState<Period>({ month: latest.month, year: latest.year });

  return <PeriodContext.Provider value={{ period, setPeriod, options }}>{children}</PeriodContext.Provider>;
}

export function usePeriod(): PeriodContextValue {
  const ctx = useContext(PeriodContext);
  if (!ctx) throw new Error("usePeriod must be used within PeriodProvider");
  return ctx;
}
