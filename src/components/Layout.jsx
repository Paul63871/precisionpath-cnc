import React from "react";
import { Link, useLocation, Outlet } from "react-router-dom";
import { Cpu, Bookmark, Boxes, Cog, Sliders } from "lucide-react";

const NAV = [
  { to: "/", label: "Calculator", icon: Cpu },
  { to: "/saved-calculations", label: "Saved", icon: Bookmark },
  { to: "/materials", label: "Materials", icon: Boxes },
  { to: "/machine-profiles", label: "Machines", icon: Cog },
  { to: "/settings", label: "Settings", icon: Sliders },
];

export default function Layout() {
  const { pathname } = useLocation();
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center gap-3 h-14">
            <Link to="/" className="flex items-center gap-2 font-semibold shrink-0">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-600 text-white">
                <Cpu className="w-4 h-4" />
              </span>
              <span className="hidden sm:inline">Feeds &amp; Speeds</span>
            </Link>
            <nav className="flex-1 flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {NAV.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                      active ? "bg-amber-600 text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}