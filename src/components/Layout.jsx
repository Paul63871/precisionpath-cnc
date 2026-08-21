import React from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { Cpu, Bookmark, Boxes, Cog, Sliders, ArrowLeft } from "lucide-react";

const NAV = [
  { to: "/", label: "Calculator", title: "Calculator", icon: Cpu },
  { to: "/saved-calculations", label: "Saved", title: "Saved Calculations", icon: Bookmark },
  { to: "/materials", label: "Materials", title: "Materials", icon: Boxes },
  { to: "/machine-profiles", label: "Machines", title: "Machine Profiles", icon: Cog },
  { to: "/settings", label: "Settings", title: "Settings", icon: Sliders },
];

// Known non-tab routes → friendly header title.
const ROUTE_TITLES = { "/reference": "Reference" };

function resolveChildTitle(pathname) {
  if (ROUTE_TITLES[pathname]) return ROUTE_TITLES[pathname];
  const seg = pathname.split("/").filter(Boolean).pop() || "";
  return seg.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) || "Back";
}

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = NAV.find((n) => n.to === pathname);
  const isMainTab = !!current;
  const headerTitle = isMainTab ? current.title || "Feeds & Speeds" : resolveChildTitle(pathname);

  // Re-selecting the active tab resets to that page's root and scrolls to top.
  const onTabClick = (e, to) => {
    if (pathname === to) {
      e.preventDefault();
      navigate(to);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop top header */}
      <header
        className="hidden md:flex sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur select-none"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-6xl w-full px-4">
          <div className="flex items-center gap-3 h-14">
            <Link to="/" className="flex items-center gap-2 font-semibold shrink-0">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-600 text-white">
                <Cpu className="w-4 h-4" />
              </span>
              <span>Feeds &amp; Speeds</span>
            </Link>
            <nav className="flex-1 flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {NAV.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={(e) => onTabClick(e, to)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap min-h-[44px] ${
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

      {/* Mobile top header — renders on ALL pages */}
      <header
        className="md:hidden sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur select-none"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-2 h-14 px-2">
          {!isMainTab ? (
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-1 rounded-md text-foreground hover:bg-muted"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="flex items-center gap-2 pl-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-600 text-white">
                <Cpu className="w-4 h-4" />
              </span>
            </span>
          )}
          <span className="font-semibold truncate">{headerTitle}</span>
        </div>
      </header>

      <main className={isMainTab ? "pb-16 md:pb-0" : "md:pb-0"}>
        <Outlet />
      </main>

      {/* Mobile bottom tab bar — hidden on child (non-tab) views */}
      {isMainTab && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/95 backdrop-blur select-none"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-center justify-around h-14">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={(e) => onTabClick(e, to)}
                  className={`flex flex-col items-center justify-center gap-0.5 min-h-[44px] px-2 text-[10px] ${
                    active ? "text-amber-600" : "text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}