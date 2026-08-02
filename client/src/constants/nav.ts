import { LayoutDashboard, Users, Building2, ClipboardList, Receipt, FileText, BarChart3, Settings, type LucideIcon } from "lucide-react";
import type { PayrollType } from "@/types";

export interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
}

export function getNavItems(module: PayrollType): NavItem[] {
  const items: NavItem[] = [
    { label: "Dashboard", to: "/", icon: LayoutDashboard },
    { label: module === "CONTRACT" ? "Workers" : "Employees", to: module === "CONTRACT" ? "/workers" : "/employees", icon: Users },
    ...(module === "CONTRACT" ? [{ label: "Clients", to: "/clients", icon: Building2 }] : []),
    { label: "Payroll Runs", to: "/payroll-runs", icon: ClipboardList },
    module === "CONTRACT"
      ? { label: "Bills", to: "/bills", icon: Receipt }
      : { label: "Salary Slips", to: "/salary-slips", icon: FileText },
    { label: "Reports", to: "/reports", icon: BarChart3 },
    { label: "Settings", to: "/settings", icon: Settings },
  ];
  return items;
}
