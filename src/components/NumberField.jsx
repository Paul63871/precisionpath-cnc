import React, { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";

// A number input that allows free editing — clear the field, type partial values
// like "5." or "0.0" — while propagating a valid parsed number to the parent.
// External value changes (unit switches, loading a saved calc) are mirrored when
// the field is not focused, so display stays in sync without clobbering in-progress edits.
// allowClear: when true, clearing the field pushes `undefined` (used for optional/auto fields).
export default function NumberField({ value, onValueChange, className, placeholder, allowClear }) {
  const [text, setText] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      const v = value === undefined || value === null || Number.isNaN(value)
        ? ""
        : String(Math.round(value * 1e6) / 1e6); // strip float noise from unit conversions
      setText(v);
    }
  }, [value, focused]);

  const handleChange = (e) => {
    const t = e.target.value;
    setText(t);
    if (t === "") {
      if (allowClear) onValueChange(undefined);
      return;
    }
    const n = Number(t);
    if (t !== "-" && t !== "." && !Number.isNaN(n)) {
      onValueChange(n);
    }
  };

  return (
    <Input
      type="text"
      inputMode="decimal"
      value={text}
      onChange={handleChange}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      className={className}
      placeholder={placeholder}
    />
  );
}