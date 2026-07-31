import { Keyboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SHORTCUTS } from "@/hooks/useKeyboardShortcuts";

export function ShortcutsPopover() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts">
          <Keyboard />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end">
        <p className="mb-2 text-sm font-semibold">Keyboard shortcuts</p>
        <ul className="flex flex-col gap-1.5">
          {SHORTCUTS.map((s) => (
            <li key={s.key} className="flex items-center justify-between text-sm">
              <span className="text-muted">{s.description}</span>
              <kbd className="rounded-sm border border-border bg-border/30 px-1.5 py-0.5 font-mono text-xs">{s.key}</kbd>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
