import React, { useRef, useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";

// Lightweight pull-to-refresh for touch devices. Activates only when the page
// is scrolled to the top; calls onRefresh (which should return a promise) and
// shows a spinner until it resolves.
const THRESHOLD = 70;

export default function PullToRefresh({ onRefresh, children }) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef(null);
  const pulling = useRef(false);

  const onTouchStart = (e) => {
    if (refreshing || window.scrollY > 0) return;
    startY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (startY.current == null || refreshing) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy > 0 && window.scrollY <= 0) {
      pulling.current = true;
      setPull(Math.min(dy * 0.5, 100));
    } else {
      pulling.current = false;
    }
  };

  const onTouchEnd = async () => {
    if (startY.current == null) return;
    startY.current = null;
    if (pulling.current && pull >= THRESHOLD && !refreshing) {
      setRefreshing(true);
      setPull(THRESHOLD);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
    pulling.current = false;
  };

  return (
    <div className="relative">
      <div
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 flex items-center justify-center text-muted-foreground"
        style={{ top: `${Math.max(0, pull - 28)}px`, opacity: pull > 0 || refreshing ? 1 : 0 }}
      >
        {refreshing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <ChevronDown className={`w-5 h-5 transition-transform ${pull >= THRESHOLD ? "rotate-180" : ""}`} />
        )}
      </div>
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: startY.current == null ? "transform 0.2s ease" : "none",
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}