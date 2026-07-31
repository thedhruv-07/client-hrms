import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { Menu, Moon, Sun, LogOut, User as UserIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useModule } from "@/hooks/useModule";
import { useTheme } from "@/hooks/useTheme";
import { usePeriod } from "@/hooks/usePeriod";
import { getNavItems } from "@/constants/nav";
import { ROLE_LABELS } from "@/constants/roles";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ShortcutsPopover } from "@/components/shortcuts-popover";
import type { PayrollType } from "@/types";

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { module, setModule } = useModule();
  const navItems = getNavItems(module);

  return (
    <>
      {open ? <div className="fixed inset-0 z-40 bg-ink-900/50 md:hidden" onClick={onClose} /> : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-ink-900 text-paper-50 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <span className="font-display text-lg font-semibold">Ledger HRMS</span>
          <button className="text-paper-50/70 hover:text-paper-50 md:hidden" onClick={onClose} aria-label="Close menu">
            <X className="size-5" />
          </button>
        </div>

        <div className="px-5 pb-4">
          <Tabs value={module} onValueChange={(v) => setModule(v as PayrollType)}>
            <TabsList className="w-full rounded-sm border border-paper-50/15 p-0.5">
              <TabsTrigger
                value="CONTRACT"
                className="flex-1 rounded-sm border-b-0 py-1.5 text-paper-50/70 data-[state=active]:bg-paper-50/10 data-[state=active]:text-seal-600"
              >
                Contract Billing
              </TabsTrigger>
              <TabsTrigger
                value="INHOUSE"
                className="flex-1 rounded-sm border-b-0 py-1.5 text-paper-50/70 data-[state=active]:bg-paper-50/10 data-[state=active]:text-seal-600"
              >
                In-House Payroll
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-sm px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-paper-50/10 text-seal-600" : "text-paper-50/75 hover:bg-paper-50/5 hover:text-paper-50"
                )
              }
            >
              <item.icon className="size-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-paper-50/10 px-5 py-4 text-xs text-paper-50/50">v1.0.0 — mock data</div>
      </aside>
    </>
  );
}

function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();
  const { period, setPeriod, options } = usePeriod();

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-3">
        <button className="text-muted hover:text-foreground md:hidden" onClick={onMenuClick} aria-label="Open menu">
          <Menu className="size-5" />
        </button>
        <Select
          value={`${period.month}-${period.year}`}
          onValueChange={(v) => {
            const [month, year] = v.split("-").map(Number);
            setPeriod({ month: month!, year: year! });
          }}
        >
          <SelectTrigger className="w-44 figure">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={`${o.month}-${o.year}`} value={`${o.month}-${o.year}`} className="figure">
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2">
        <ShortcutsPopover />

        <div className="flex items-center gap-1.5 px-1">
          <Sun className="size-3.5 text-muted" />
          <Switch checked={dark} onCheckedChange={toggle} aria-label="Toggle dark mode" />
          <Moon className="size-3.5 text-muted" />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <UserIcon className="size-4" />
              <span className="hidden sm:inline">{user?.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{user ? ROLE_LABELS[user.role] : ""}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={logout}>
              <LogOut className="size-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
