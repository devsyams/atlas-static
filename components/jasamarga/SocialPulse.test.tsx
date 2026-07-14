// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SocialPulse } from "./SocialPulse";
import type { SocialPulse as SocialPulseData } from "@/lib/jasamarga/types";

const liveData: SocialPulseData = {
  mentions_24h: 8277074,
  impressions: 8277074,
  reach: 5518049,
  negativity: 3.6,
  sentiment_pct: { positive: 5.79, negative: 35.97, neutral: 58.24 },
  trend: [],
  top_posts: [],
  source: "live",
  topics: [
    {
      title: "Kemacetan Panjang di Rest Area KM 19 Tol Jakarta-Cikampek",
      aiLine: "Keluhan pengguna jalan soal antrian truk.",
      impressions: 207681,
      reach: 138454,
      sentiment: -80,
    },
  ],
};

const demoData: SocialPulseData = {
  mentions_24h: 3291,
  negativity: 7.3,
  source: "demo",
  trend: [{ keyword: "#MacetJapek", count: 1240, sentiment: "negative" }],
  top_posts: [
    { handle: "@infomudik", platform: "X", text: "Macet parah!", sentiment: "negative", engagement: 4200, time: "17 mnt lalu" },
  ],
};

/** T13 / AC10 */
describe("SocialPulse — live media-intelligence feed", () => {
  it("renders the real volume, the real sentiment split and the real topics", () => {
    render(<SocialPulse data={liveData} />);

    expect(screen.getByText("Impresi")).toBeInTheDocument();
    expect(screen.getByText("8.277.074")).toBeInTheDocument();
    expect(screen.getByText(/Jangkauan 5\.518\.049/)).toBeInTheDocument();
    expect(screen.getByText("35.97%")).toBeInTheDocument();
    expect(screen.getByText(/Rest Area KM 19/)).toBeInTheDocument();
    expect(screen.getByText(/antrian truk/)).toBeInTheDocument();
  });

  it("badges itself Live and shows no fabricated @handle posts", () => {
    render(<SocialPulse data={liveData} />);
    expect(screen.getByText("Live")).toBeInTheDocument();
    expect(screen.queryByText(/@infomudik/)).not.toBeInTheDocument();
    expect(screen.queryByText("Sebutan 24 jam")).not.toBeInTheDocument();
  });
});

describe("SocialPulse — synthetic fallback", () => {
  it("keeps the legacy demo pulse and labels it Simulasi", () => {
    render(<SocialPulse data={demoData} />);
    expect(screen.getByText("Sebutan 24 jam")).toBeInTheDocument();
    expect(screen.getByText("@infomudik")).toBeInTheDocument();
    expect(screen.getByText(/Simulasi/)).toBeInTheDocument();
    expect(screen.queryByText("Live")).not.toBeInTheDocument();
  });
});
