import { createContext, useContext, useState, type ReactNode } from "react";
import type { PayrollType } from "@/types";

const STORAGE_KEY = "hrms-module";

interface ModuleContextValue {
  module: PayrollType;
  setModule: (m: PayrollType) => void;
}

const ModuleContext = createContext<ModuleContextValue | null>(null);

function readStored(): PayrollType {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "INHOUSE" ? "INHOUSE" : "CONTRACT";
}

export function ModuleProvider({ children }: { children: ReactNode }) {
  const [module, setModuleState] = useState<PayrollType>(readStored);

  function setModule(m: PayrollType) {
    setModuleState(m);
    localStorage.setItem(STORAGE_KEY, m);
  }

  return <ModuleContext.Provider value={{ module, setModule }}>{children}</ModuleContext.Provider>;
}

export function useModule(): ModuleContextValue {
  const ctx = useContext(ModuleContext);
  if (!ctx) throw new Error("useModule must be used within ModuleProvider");
  return ctx;
}
