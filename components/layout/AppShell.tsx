"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { ComponentType, ReactNode } from "react";
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
  Search,
  Radio,
  Maximize2,
  ChevronDown,
  Bot,
  ShieldCheck,
  Sparkles,
  Bell,
  LogOut,
} from "lucide-react";
import { Dropdown } from "@/components/ui/Dropdown";

type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  group: string;
};

const NAV: NavItem[] = [
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
  const groups = Array.from(new Set(NAV.map((n) => n.group)));

  const onFullscreen = () => {
    if (typeof document === "undefined") return;
    if (!document.fullscreenElement)
      document.documentElement.requestFullscreen?.().catch(() => {});
    else document.exitFullscreen?.().catch(() => {});
  };

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden text-foreground">
      {/* Top bar — dense command-bar style */}
      <header className="relative z-20 flex h-12 shrink-0 items-center gap-3 border-b border-sidebar-border bg-sidebar/85 px-3 backdrop-blur-xl">
        {/* Brand */}
        <Link href="/" className="flex items-center">
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

        {/* Search bar — centered */}
        <div className="mx-auto flex w-full max-w-xl items-center px-4">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md border border-border bg-background/40 px-3 py-1.5 text-[12px] text-muted-foreground hover:text-foreground"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1 text-left">Search Atlas…</span>
            <kbd className="hidden rounded border border-border bg-muted/40 px-1 py-0.5 text-[9px] tracking-wider sm:inline">
              ⌘K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <IconBtn label="Fullscreen" onClick={onFullscreen}>
            <Maximize2 className="h-3.5 w-3.5" />
          </IconBtn>

          {/* Notifications */}
          <NotificationsMenu />

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
                    {NAV.filter((n) => n.group === group).map((item) => {
                      const Icon = item.icon;
                      const active = pathname === item.to && item.label === "Command Center";
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

          <UserMenu />
        </div>
      </header>

      {/* Main */}
      <main className="relative flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1800px] px-4 py-4 sm:px-6 sm:py-6">{children}</div>
      </main>

      {/* Status strip */}
      <footer className="z-20 flex h-7 shrink-0 items-center justify-between border-t border-sidebar-border bg-sidebar/90 px-4 font-mono text-[10px] uppercase tracking-widest text-muted-foreground backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
            System Nominal
          </span>
          <span className="hidden items-center gap-1.5 sm:flex">
            <Radio className="h-2.5 w-2.5" />
            Supabase · Live
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

function NotificationsMenu() {
  const items = [
    { title: "Anomaly detected", body: "Signal spike in Sector 7 — +312% in 15m", time: "2m" },
    { title: "Source reconnected", body: "Feed “Maritime AIS” is back online", time: "18m" },
    { title: "Briefing ready", body: "Daily strategic digest compiled", time: "1h" },
  ];
  return (
    <Dropdown
      align="end"
      contentClassName="w-80 p-0"
      trigger={
        <span className="relative rounded-md border border-border bg-background/40 p-1.5 text-muted-foreground hover:text-foreground">
          <Bell className="h-3.5 w-3.5" />
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-destructive" />
        </span>
      }
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <span className="text-xs font-semibold">Notifications</span>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground">3 new</span>
      </div>
      <div className="max-h-80 overflow-y-auto">
        {items.map((n) => (
          <div
            key={n.title}
            className="flex gap-2 border-b border-border/40 px-3 py-2 last:border-b-0 hover:bg-sidebar-accent"
          >
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium">{n.title}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{n.time}</span>
              </div>
              <p className="mt-0.5 text-[11px] leading-snug text-muted-foreground">{n.body}</p>
            </div>
          </div>
        ))}
      </div>
    </Dropdown>
  );
}

function UserMenu() {
  const router = useRouter();
  const displayName = "Operator";
  const initials = "OP";
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
                Super Admin
              </span>
            </div>
            <div className="mt-2 text-[10px] text-muted-foreground">operator@nexorus.io</div>
          </div>
          <div className="h-px bg-border" />
          <button
            type="button"
            onClick={() => {
              close();
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
