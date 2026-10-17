import React, { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Group an options array (each may carry a `group` label) preserving first-seen order.
function groupOptions(options) {
  const groups = [];
  const index = new Map();
  options.forEach((o) => {
    const key = o.group || null;
    if (!index.has(key)) {
      index.set(key, groups.length);
      groups.push({ label: key, items: [] });
    }
    groups[index.get(key)].items.push(o);
  });
  return groups;
}

// Option label with an optional leading icon (e.g. a tool illustration).
function OptionLabel({ o }) {
  if (!o.icon) return <span className="min-w-0 break-words">{o.label}</span>;
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="shrink-0 flex items-center justify-center">{o.icon}</span>
      <span className="min-w-0 break-words">{o.label}</span>
    </span>
  );
}

// Touch-friendly select: shadcn Select on desktop, a Vaul bottom-drawer picker on
// mobile. Same API regardless of which renders: { value, onValueChange, options }.
export default function ResponsiveSelect({ value, onValueChange, options = [], placeholder, className, showIconInTrigger = true }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const groups = groupOptions(options);

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={cn("h-auto min-h-[44px] py-1.5", className)}>
          <SelectValue placeholder={placeholder}>
            {!showIconInTrigger && selected ? <span className="truncate">{selected.label}</span> : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {groups.map((g, gi) =>
            g.label ? (
              <SelectGroup key={g.label}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.items.map((o) => (
                  <SelectItem key={o.value} value={o.value}><OptionLabel o={o} /></SelectItem>
                ))}
              </SelectGroup>
            ) : (
              <React.Fragment key={gi}>
                {g.items.map((o) => (
                  <SelectItem key={o.value} value={o.value}><OptionLabel o={o} /></SelectItem>
                ))}
              </React.Fragment>
            )
          )}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          className={cn("h-auto min-h-[44px] w-full justify-between whitespace-normal font-normal py-1.5", className)}
        >
          <span className={cn("flex min-w-0 flex-1 items-center gap-2 text-left", selected ? "" : "text-muted-foreground")}>
            {selected ? <OptionLabel o={showIconInTrigger ? selected : { label: selected.label }} /> : (placeholder || "Select…")}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="max-h-[80vh]">
        <DrawerHeader className="text-left">
          <DrawerTitle>{placeholder || "Select"}</DrawerTitle>
        </DrawerHeader>
        <div className="overflow-y-auto px-2 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          {groups.map((g, gi) => (
            <div key={g.label || gi}>
              {g.label && (
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground select-none">{g.label}</div>
              )}
              {g.items.map((o) => (
                <button
                  type="button"
                  key={o.value}
                  onClick={() => { onValueChange(o.value); setOpen(false); }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-3 text-sm min-h-[44px] text-left hover:bg-accent"
                >
                  <OptionLabel o={o} />
                  {o.value === value && <Check className="w-4 h-4 text-brand shrink-0 ml-2" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}