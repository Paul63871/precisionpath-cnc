import React, { useMemo, useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function MaterialSearch({ materials, value, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = materials.find((m) => m.id === value);

  const categories = useMemo(() => {
    const map = {};
    materials.forEach((m) => { (map[m.category] = map[m.category] || []).push(m); });
    return map;
  }, [materials]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full h-9 justify-between font-normal">
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected ? selected.name : "Search material…"}
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[16rem] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search material (e.g. A36, 6061, 304)…" />
          <CommandList>
            <CommandEmpty>No material found.</CommandEmpty>
            {Object.entries(categories).map(([cat, mats]) => (
              <CommandGroup key={cat} heading={cat}>
                {mats.map((m) => (
                  <CommandItem
                    key={m.id}
                    value={`${m.name} ${m.category}`}
                    onSelect={() => { onChange(m.id); setOpen(false); }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === m.id ? "opacity-100" : "opacity-0")} />
                    {m.name}{m.custom ? " ✓" : ""}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}