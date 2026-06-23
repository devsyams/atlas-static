"use client";

import { useEffect, useState, type FormEvent } from "react";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { NeuralIgnition } from "@/components/login/NeuralIgnition";
import type { DashboardData } from "@/lib/mbg/types";
import { findUser } from "@/lib/auth";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [igniting, setIgniting] = useState(false);
  const [home, setHome] = useState("/");
  const [crisis, setCrisis] = useState<DashboardData | null>(null);

  // Preload the live crisis data for the ignition HUD.
  useEffect(() => {
    fetch("/api/v1/mbg-crisis")
      .then((r) => r.json())
      .then(setCrisis)
      .catch(() => {});
  }, []);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const user = findUser(email, password);
    if (!user) {
      setError("Email atau kata sandi salah.");
      return;
    }
    setBusy(true);
    setHome(user.home);
    // Mark the session + scope, then play the ignition which navigates on completion.
    const maxAge = 60 * 60 * 24;
    document.cookie = `atlas_auth=1; path=/; max-age=${maxAge}; samesite=lax`;
    document.cookie = `atlas_scope=${user.scope}; path=/; max-age=${maxAge}; samesite=lax`;
    setIgniting(true);
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,oklch(0.30_0.10_270/.4),transparent_60%),radial-gradient(ellipse_at_bottom,oklch(0.30_0.15_240/.3),transparent_60%)]" />

      {/* Decorative grid */}
      <div className="pointer-events-none absolute inset-0 -z-10 opacity-[0.04] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className={cn("panel panel-glow w-full max-w-md p-8", igniting && "ig-implode")}>
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gradient-accent shadow-[var(--shadow-glow)]">
            <Image
              src="/nexorus-icon.png"
              alt="Nexorus"
              width={28}
              height={28}
              priority
              className="h-7 w-7 object-contain"
            />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Nexorus
            </div>
            <div className="text-gradient text-sm font-semibold tracking-wide">ATLAS / ALPHA</div>
          </div>
        </div>

        <div className="mb-1 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] uppercase tracking-[0.22em] text-primary">
          <ShieldCheck className="h-3 w-3" />
          Restricted
        </div>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Operator Sign-In</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Authenticate with your issued credentials to enter the command workspace.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <Field label="Email or username" type="text" value={email} onChange={setEmail} required autoFocus />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={setPassword}
            required
            minLength={6}
          />

          {error && (
            <div className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-md bg-gradient-accent px-3 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-glow)] disabled:opacity-50"
          >
            {busy ? "Authenticating…" : "Sign in"}
          </button>
        </form>

        <p className="mt-6 border-t border-border pt-4 text-center text-[11px] leading-relaxed text-muted-foreground">
          Access is provisioned by your administrator. Public registration is disabled for this
          workspace.
        </p>
      </div>

      {igniting && (
        <NeuralIgnition data={crisis} onComplete={() => window.location.assign(home)} />
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
  minLength,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
  minLength?: number;
  autoFocus?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <input
        type={type}
        value={value}
        required={required}
        minLength={minLength}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-border bg-background/40 px-3 py-2 text-sm text-foreground outline-none focus:border-primary/60"
      />
    </label>
  );
}
