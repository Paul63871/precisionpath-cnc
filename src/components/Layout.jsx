import React from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { Cpu, Bookmark, Boxes, Cog, Sliders, ArrowLeft, BookOpen } from "lucide-react";

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

// Resolve which bottom tab a pathname belongs to (exact for "/", prefix for others).
function tabForPath(pathname) {
  for (const n of NAV) {
    if (n.to === "/" ? pathname === "/" : pathname === n.to || pathname.startsWith(n.to + "/")) {
      return n.to;
    }
  }
  return null;
}

function BrandMark() {
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
      <Cpu className="w-4 h-4" />
    </span>
  );
}

function ReferenceLink({ className }) {
  return (
    <Link
      to="/reference"
      className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground hover:bg-accent min-h-[40px] ${className || ""}`}
    >
      <BookOpen className="w-4 h-4" />
      <span className="hidden sm:inline">Reference</span>
    </Link>
  );
}

export default function Layout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const current = NAV.find((n) => n.to === pathname);
  const isMainTab = !!current;
  const headerTitle = isMainTab ? current.title || "PrecisionPath" : resolveChildTitle(pathname);

  // Per-tab memory of the last visited (incl. nested) pathname, so switching
  // back to a tab restores its deepest route via native history navigation.
  const tabMemory = React.useRef(new Map());
  React.useEffect(() => {
    const tab = tabForPath(pathname);
    if (tab) tabMemory.current.set(tab, pathname);
  }, [pathname]);

  const onTabClick = (e, to) => {
    // Re-selecting the active tab resets to its root and scrolls to top.
    if (pathname === to) {
      e.preventDefault();
      navigate(to);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    // Switching tabs: restore the cached nested pathname for that tab if any.
    const cached = tabMemory.current.get(to);
    if (cached && cached !== to) {
      e.preventDefault();
      navigate(cached);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop top header */}
      <header
        className="hidden md:flex sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md select-none"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="mx-auto max-w-6xl w-full px-4">
          <div className="flex items-center gap-3 h-16">
            <Link to="/" className="flex items-center gap-2.5 shrink-0">
              <BrandMark />
              <span className="font-bold tracking-tight text-[15px]">PrecisionPath</span>
            </Link>
            <nav className="flex-1 flex items-center gap-1 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {NAV.map(({ to, label, icon: Icon }) => {
                const active = pathname === to;
                return (
                  <Link
                    key={to}
                    to={to}
                    onClick={(e) => onTabClick(e, to)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap min-h-[40px] transition-colors ${
                      active ? "bg-brand text-white shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </nav>
            <ReferenceLink />
          </div>
        </div>
      </header>

      {/* Mobile top header — renders on ALL pages */}
      <header
        className="md:hidden sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md select-none"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-2 h-14 px-2">
          {!isMainTab ? (
            <button
              onClick={() => navigate(-1)}
              aria-label="Back"
              className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-1 rounded-md text-foreground hover:bg-accent"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <span className="flex items-center pl-1.5">
              <BrandMark />
            </span>
          )}
          <span className="font-semibold truncate flex-1">{headerTitle}</span>
          <Link
            to="/reference"
            aria-label="Reference"
            className="flex items-center justify-center min-h-[44px] min-w-[44px] -mr-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent"
          >
            <BookOpen className="w-5 h-5" />
          </Link>
        </div>
      </header>

      <main className={isMainTab ? "pb-16 md:pb-0" : "md:pb-0"}>
        <Outlet />
      </main>

      {/* Mobile bottom tab bar — hidden on child (non-tab) views */}
      {isMainTab && (
        <nav
          className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-background/90 backdrop-blur-md select-none"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          <div className="flex items-stretch justify-around h-16">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active = pathname === to;
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={(e) => onTabClick(e, to)}
                  className={`relative flex flex-col items-center justify-center gap-1 min-h-[44px] px-2 text-[10px] font-medium transition-colors ${
                    active ? "text-brand" : "text-muted-foreground"
                  }`}
                >
                  {active && <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-brand" />}
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