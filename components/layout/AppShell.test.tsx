// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let pathname = "/";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
  default: (props: Record<string, unknown>) => <img {...(props as object)} />,
}));
vi.mock("@/components/ai/NexorusCopilot", () => ({
  NexorusCopilot: () => null,
}));

import { AppShell } from "./AppShell";

const openGearMenu = () => {
  fireEvent.click(screen.getByLabelText("Open menu"));
};

describe("AppShell gear menu — Nexorus Opengate (P8 / AC1)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ anomalies: [] }), { status: 200 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "atlas_scope=; path=/; max-age=0";
  });

  it("shows a fixed Nexorus Opengate external link at the bottom of the menu", () => {
    pathname = "/";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    const link = screen.getByRole("link", { name: /nexorus opengate/i });
    expect(link).toHaveAttribute("href", "/api/v1/opengate/autologin");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("keeps the item for danantara-scoped users on the minimal-chrome dashboard", () => {
    pathname = "/danantara";
    document.cookie = "atlas_scope=danantara; path=/";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    // Scope + minimal-chrome filters strip every non-Dashboards nav group…
    expect(screen.queryByText("System Settings")).not.toBeInTheDocument();
    // …but the Opengate escape hatch must survive both filters.
    expect(screen.getByRole("link", { name: /nexorus opengate/i })).toBeInTheDocument();
  });
});

describe("AppShell gear menu — Danantara Crisis Gate link (A10)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ anomalies: [] }), { status: 200 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "atlas_scope=; path=/; max-age=0";
  });

  it("links to /danantara/krisis from the gear menu", () => {
    pathname = "/";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    const link = screen.getByRole("link", { name: /crisis gate/i });
    expect(link).toHaveAttribute("href", "/danantara/krisis");
  });

  it("keeps the Crisis Gate link on the minimal-chrome danantara dashboards for danantara-scoped users", () => {
    // The /danantara/krisis page itself runs minimal chrome (Dashboards group only)
    // and a danantara-scoped user is limited to /danantara* — the link must survive both.
    pathname = "/danantara/krisis";
    document.cookie = "atlas_scope=danantara; path=/";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    const link = screen.getByRole("link", { name: /crisis gate/i });
    expect(link).toHaveAttribute("href", "/danantara/krisis");
  });
});

describe("AppShell gear menu — BGN Command Center link (A13 v4.0)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ anomalies: [] }), { status: 200 })),
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    document.cookie = "atlas_scope=; path=/; max-age=0";
  });

  it("links to /bgn/command from the gear menu, labelled BGN Command Center (T14)", () => {
    pathname = "/";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    // "BGN" disambiguates from the Operations-group "Command Center" item.
    const link = screen.getByRole("link", { name: /bgn command center/i });
    expect(link).toHaveAttribute("href", "/bgn/command");
  });

  it("keeps the link on the minimal-chrome /bgn/command page for danantara-scoped users (T14)", () => {
    // /bgn/command runs minimal chrome (Dashboards group only) and a danantara-scoped
    // user is limited to /danantara* + /bgn* — the link must survive both filters.
    pathname = "/bgn/command";
    document.cookie = "atlas_scope=danantara; path=/";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    const link = screen.getByRole("link", { name: /bgn command center/i });
    expect(link).toHaveAttribute("href", "/bgn/command");
  });

  it("applies minimal executive chrome on /bgn/command (Dashboards group only) (T14)", () => {
    // minimalChrome must match /bgn like it does /danantara/* — the System group
    // (e.g. System Settings) is stripped from the menu on this page.
    pathname = "/bgn/command";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    expect(screen.queryByText("System Settings")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /bgn command center/i })).toBeInTheDocument();
  });

  it("links to /danantara/simulation from the gear menu, through both filters (A15 T17)", () => {
    // Same two gates as T14: minimal chrome keeps only the Dashboards group, and a
    // danantara-scoped user is limited to /danantara* + /bgn* — the entry must survive both.
    pathname = "/bgn/command";
    document.cookie = "atlas_scope=danantara; path=/";
    render(<AppShell>content</AppShell>);
    openGearMenu();

    const link = screen.getByRole("link", { name: /crisis simulation room/i });
    expect(link).toHaveAttribute("href", "/danantara/simulation");
  });
});
