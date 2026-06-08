"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import {
  Database,
  LayoutDashboard,
  LineChart,
  Map as MapIcon,
  Presentation,
  Settings,
  Shapes,
  Users,
  FileText,
  Radio,
  Maximize2,
  ChevronDown,
  Bot,
  ShieldCheck,
  Sparkles,
  Bell,
  LogOut,
  TrafficCone,
  Landmark,
} from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";
import { NexorusCopilot } from "@/components/ai/NexorusCopilot";
import { parseScope, type Scope } from "@/lib/auth";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: string;
};

const NAV: NavItem[] = [
  { to: "/", label: "MBG Crisis Command", icon: LayoutDashboard, group: "Dashboards" },
  { to: "/jasamarga", label: "JasaMarga Ops Command", icon: TrafficCone, group: "Dashboards" },
  { to: "/danantara-v2", label: "Danantara CEO Command (v1)", icon: Landmark, group: "Dashboards" },
  { to: "/danantara", label: "Danantara CEO Command (v2)", icon: Landmark, group: "Dashboards" },

  { to: "/", label: "Command Center", icon: LayoutDashboard, group: "Operations" },
  { to: "/", label: "Presentation Workspace", icon: Presentation, group: "Operations" },
  { to: "/", label: "Map Workspace", icon: MapIcon, group: "Operations" },
  { to: "/", label: "Chart Builder", icon: LineChart, group: "Operations" },
  { to: "/", label: "Widget Library", icon: Shapes, group: "Operations" },
  { to: "/", label: "Data Management", icon: Database, group: "Operations" },

  { to: "/", label: "AI Agent Connection", icon: Bot, group: "System" },
  { to: "/", label: "Briefing Notes", icon: FileText, group: "System" },
  { to: "/", label: "AI Report Generator", icon: Sparkles, group: "System" },
  { to: "/", label: "User Administration", icon: Users, group: "System" },
  { to: "/", label: "AI Governance", icon: ShieldCheck, group: "System" },
  { to: "/", label: "System Settings", icon: Settings, group: "System" },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [scope, setScope] = useState<Scope>("all");

  // Read the user's dashboard scope after mount (avoids SSR hydration mismatch).
  useEffect(() => {
    const m = document.cookie.match(/(?:^|;\s*)atlas_scope=([^;]+)/);
    setScope(parseScope(m?.[1]));
  }, []);

  // Danantara-scoped demo users only ever see their own dashboard.
  const nav = scope === "danantara" ? NAV.filter((n) => n.to.startsWith("/danantara")) : NAV;
  const homeHref = scope === "danantara" ? "/danantara" : "/";

  // Executive dashboards (Danantara CEO v2 + each per-BUMN board) run a stripped
  // chrome for their 40–60 y/o CEO audience: only the Dashboards menu group, no
  // "Tanya Nexorus AI" search bar, and no notifications bell.
  const minimalChrome = pathname === "/danantara" || pathname.startsWith("/bumn");
  const menuNav = minimalChrome ? nav.filter((n) => n.group === "Dashboards") : nav;
  const groups = Array.from(new Set(menuNav.map((n) => n.group)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCopilotOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement)
      document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden text-foreground">
      {/* Top bar — dense command-bar style */}
      <header className="relative z-40 flex h-12 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar/85 px-3 backdrop-blur-xl">
        {/* Brand */}
        <Link href={homeHref} className="flex items-center">
          <Image
            src="/nexorus-logo.png"
            alt="Nexorus Atlas"
            width={120}
            height={24}
            priority
            style={{ width: "auto" }}
            className="h-6 w-auto object-contain"
          />
        </Link>

        {/* Search bar — centered. Hidden on the executive dashboards. */}
        {minimalChrome ? (
          <div className="flex-1" />
        ) : (
          <div className="mx-auto flex w-full max-w-xl items-center px-4">
            <button
              type="button"
              onClick={() => setCopilotOpen(true)}
              className="group flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-1.5 text-[12px] text-muted-foreground hover:border-primary/40 hover:text-foreground"
            >
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary/70 group-hover:text-primary" />
              <span className="flex-1 text-left">Tanya Nexorus AI…</span>
              <kbd className="hidden rounded border border-border bg-muted/40 px-1 py-0.5 text-[9px] tracking-wider sm:inline">
                ⌘K
              </kbd>
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          <IconBtn label="Fullscreen" onClick={onFullscreen}>
            <Maximize2 className="h-3.5 w-3.5" />
          </IconBtn>

          {/* Notifications — hidden on the executive dashboards. */}
          {!minimalChrome && <NotificationsMenu />}

          {/* Settings / Nav dropdown */}
          <Dropdown
            align="end"
            contentClassName="w-64"
            trigger={
              <span
                className="inline-flex items-center gap-1.5 rounded-md border border-border bg-background/40 px-2 py-1.5 text-[11px] text-muted-foreground hover:text-foreground"
                aria-label="Open menu"
              >
                <Settings className="h-3.5 w-3.5" />
                <ChevronDown className="h-3 w-3" />
              </span>
            }
          >
            {(close) => (
              <>
                {groups.map((group, gi) => (
                  <div key={group}>
                    {gi > 0 && <div className="my-1 h-px bg-border" />}
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                      {group}
                    </div>
                    {menuNav.filter((n) => n.group === group).map((item) => {
                      const Icon = item.icon;
                      const active =
                        pathname === item.to && (item.to !== "/" || item.label === "MBG Crisis Command");
                      return (
                        <Link
                          key={item.label}
                          href={item.to}
                          onClick={close}
                          className={`flex w-full items-center gap-2 rounded-sm px-2 py-1.5 hover:bg-sidebar-accent ${
                            active ? "text-primary" : ""
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span className="text-[12px]">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </Dropdown>

          <UserMenu scope={scope} />
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </main>

      <NexorusCopilot open={copilotOpen} onClose={() => setCopilotOpen(false)} />

      {/* Status strip */}
      <footer className="z-20 flex h-7 shrink-0 items-center justify-between border-t border-sidebar-border bg-sidebar/90 px-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            System Normal
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Radio className="h-2.5 w-2.5" />
            Nexorus Engine · Live
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span>Operator session active</span>
          <span>v0.1.0-alpha</span>
        </div>
      </footer>
    </div>
  );
}

interface Anomaly {
  title: string;
  detail: string;
  severity: "high" | "med" | "low";
}
const SEV_DOT: Record<Anomaly["severity"], string> = {
  high: "bg-destructive",
  med: "bg-warning",
  low: "bg-primary",
};

function NotificationsMenu() {
  const [items, setItems] = useState<Anomaly[]>([]);

  useEffect(() => {
    let alive = true;
    fetch("/api/v1/ai/forecast")
      .then((r) => r.json())
      .then((d: { anomalies?: Anomaly[] }) => alive && setItems(d.anomalies ?? []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const hasHigh = items.some((i) => i.severity === "high");

  return (
    <Dropdown
      align="end"
      contentClassName="w-80 p-0"
      trigger={
        <span className="relative rounded-md border border-border bg-background/40 p-1.5 text-muted-foreground hover:text-foreground">
          <Bell className="h-3.5 w-3.5" />
          {items.length > 0 && (
            <span
              className={`absolute right-1 top-1 h-1.5 w-1.5 rounded-full ${hasHigh ? "bg-destructive" : "bg-primary"}`}
            />
          )}
        </span>
      }
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold">
          <Sparkles className="h-3 w-3 text-primary" /> Peringatan Nexorus AI
        </span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
          {items.length} aktif
        </span>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {items.length === 0 ? (
          <div className="px-3 py-6 text-center text-[11px] text-muted-foreground">
            Tidak ada anomali terdeteksi.
          </div>
        ) : (
          items.map((n) => (
            <div
              key={n.title}
              className="flex gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-sidebar-accent"
            >
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${SEV_DOT[n.severity]}`} />
              <div className="min-w-0 flex-1">
                <span className="block text-xs font-medium leading-snug">{n.title}</span>
                <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{n.detail}</p>
              </div>
            </div>
          ))
        )}
      </div>
    </Dropdown>
  );
}

function UserMenu({ scope }: { scope: Scope }) {
  const router = useRouter();
  const isDan = scope === "danantara";
  const displayName = isDan ? "Danantara Analyst" : "Operator";
  const initials = isDan ? "DA" : "OP";
  const roleLabel = isDan ? "Sovereign Analyst" : "Super Admin";
  const emailLabel = isDan ? "danantara@nexorus.io" : "operator@nexorus.io";
  return (
    <Dropdown
      align="end"
      contentClassName="w-56 p-0"
      trigger={
        <span
          aria-label="Account"
          title={displayName}
          className="flex h-[26px] w-[26px] items-center justify-center overflow-hidden rounded-md border border-border bg-background/40 hover:border-primary/40"
        >
          <span className="flex h-full w-full items-center justify-center bg-gradient-accent text-[10px] font-semibold text-primary-foreground">
            {initials}
          </span>
        </span>
      }
    >
      {(close) => (
        <>
          <div className="px-3 py-2.5">
            <div className="text-xs font-medium leading-tight">{displayName}</div>
            <div className="mt-1.5">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                <ShieldCheck className="h-2.5 w-2.5" />
                {roleLabel}
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">{emailLabel}</div>
          </div>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              close();
              document.cookie = "atlas_auth=; path=/; max-age=0; samesite=lax";
              document.cookie = "atlas_scope=; path=/; max-age=0; samesite=lax";
              router.push("/login");
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-muted-foreground hover:bg-sidebar-accent hover:text-foreground"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </>
      )}
    </Dropdown>
  );
}

function IconBtn({
  children,
  label,
  onClick,
}: {
  children: ReactNode;
  label: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="rounded-md border border-border bg-background/40 p-1.5 text-muted-foreground hover:text-foreground"
    >
      {children}
    </button>
  );
}
