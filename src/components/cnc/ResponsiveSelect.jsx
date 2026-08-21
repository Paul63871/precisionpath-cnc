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

// Touch-friendly select: shadcn Select on desktop, a Vaul bottom-drawer picker on
// mobile. Same API regardless of which renders: { value, onValueChange, options }.
export default function ResponsiveSelect({ value, onValueChange, options = [], placeholder, className }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);
  const groups = groupOptions(options);

  if (!isMobile) {
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger className={cn("h-11 min-h-[44px]", className)}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {groups.map((g, gi) =>
            g.label ? (
              <SelectGroup key={g.label}>
                <SelectLabel>{g.label}</SelectLabel>
                {g.items.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectGroup>
            ) : (
              <React.Fragment key={gi}>
                {g.items.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
          className={cn("h-11 min-h-[44px] w-full justify-between font-normal", className)}
        >
          <span className={selected ? "" : "text-muted-foreground"}>
            {selected ? selected.label : placeholder || "Select…"}
          </span>
          <ChevronDown className="w-4 h-4 opacity-50" />
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
                  <span>{o.label}</span>
                  {o.value === value && <Check className="w-4 h-4 text-amber-600" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}