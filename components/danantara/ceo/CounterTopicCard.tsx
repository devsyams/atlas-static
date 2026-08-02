"use client";

import { type CSSProperties } from "react";
import { Eye, MessageCircle, ShieldAlert, Sparkles } from "lucide-react";
import { fmtCount } from "@/lib/danantara/ceo/format";
import { type CounterNarrativeTopic } from "@/lib/danantara/ceo/counter-narrative-ai";
import type { CounterNarrativePlan } from "@/lib/danantara/ceo/counter-narrative";
import { buildWarRoomBrief, whatsappResponseLink } from "@/lib/danantara/ceo/response-dispatch";
import { TONE } from "./SentimentBreakdown";

/** War-room WhatsApp number for dispatch — set via env, demo fallback (mirrors A9). */
const WA_NUMBER = process.env.NEXT_PUBLIC_RESPONSE_WHATSAPP || "6287701701717";

/**
 * One topic's counter-narrative (A14): the attack as they frame it, our answer, the
 * volume it takes on each channel, and the post allocation that delivers it.
 */
export function CounterTopicCard({
  rank,
  topic,
  plan,
}: {
  rank: number;
  topic: CounterNarrativeTopic;
  plan: CounterNarrativePlan;
}) {
  return (
    <li
      data-testid={`counter-topic-${topic.topicId}`}
      className="topic-rise"
      style={{ animationDelay: `${(rank - 1) * 55}ms` } as CSSProperties}
    >
      <div className="topic-card panel relative h-full overflow-hidden" style={{ "--tone": TONE.negative.tone } as CSSProperties}>
        <span className="topic-spine" aria-hidden />
        <div className="topic-card-bg flex h-full flex-col gap-2.5 p-3 pl-4">
          {/* Rank + title. */}
          <div className="flex items-start gap-2.5">
            <span className="topic-rank shrink-0 font-mono text-2xl font-extrabold leading-none sm:text-3xl">
              {String(rank).padStart(2, "0")}
            </span>
            <h3 className="min-w-0 flex-1 text-lg font-semibold leading-snug text-balance text-foreground">{topic.title}</h3>
          </div>

          {/* The attack, in their framing. */}
          <div>
            <div className="flex items-center gap-1.5 text-base font-bold uppercase tracking-[0.14em] text-destructive">
              <ShieldAlert className="h-4 w-4 shrink-0" /> Hostile framing
            </div>
            <p
              data-testid={`attack-${topic.topicId}`}
              className="mt-1 border-l-2 border-destructive/50 pl-2.5 text-base italic leading-snug text-muted-foreground"
            >
              {topic.attackLine}
            </p>
          </div>

          {/* Our answer. */}
          <div>
            <div className="flex items-center gap-1.5 text-base font-bold uppercase tracking-[0.14em] text-primary">
              <Sparkles className="h-4 w-4 shrink-0" /> Counter narrative
            </div>
            <p data-testid={`angle-${topic.topicId}`} className="mt-1 text-base leading-snug text-foreground">
              {topic.counterAngle}
            </p>
          </div>

          {/* What it costs to win this one. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-border/40 py-2 text-base">
            <span className="flex items-center gap-1.5 text-muted-foreground" title="Estimated hostile reach">
              <Eye className="h-4 w-4 shrink-0 text-destructive/80" />
              <span className="font-mono font-bold tabular-nums text-foreground">{fmtCount(plan.hostileReach)}</span> hostile reach
            </span>
            <span className="text-muted-foreground">
              <span className="font-mono font-bold tabular-nums text-destructive">{plan.negSharePct}%</span> negative
            </span>
            <span className="ml-auto text-muted-foreground">
              <span
                data-testid={`posts-${topic.topicId}`}
                className="font-mono text-2xl font-extrabold tabular-nums text-primary"
              >
                {plan.totalPosts.toLocaleString("en-US")}
              </span>{" "}
              posts needed
            </span>
          </div>

          {/* The content itself. */}
          <div className="grid gap-2 rounded-lg border border-border/50 bg-background/40 p-2.5">
            {plan.channels.map((c) => (
              <div key={c.channel} className="flex items-center justify-between gap-3 text-base">
                <span className="text-muted-foreground">{c.channel === "kol" ? "KOL posts" : c.channel === "clipper" ? "Clipper captions" : "Grassroots actions"}</span>
                <span data-testid={`channel-posts-${topic.topicId}-${c.channel}`} className="font-mono text-2xl font-extrabold tabular-nums text-foreground">
                  {c.posts.toLocaleString("en-US")}
                </span>
              </div>
            ))}
            <p className="pt-1 text-base leading-snug text-muted-foreground">
              The PR/media team owns the actual post copy. This panel shows the required volume per channel and the
              counter narrative that should guide it.
            </p>
          </div>

          <a
            href={whatsappResponseLink(WA_NUMBER, buildWarRoomBrief(topic, plan))}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`dispatch-${topic.topicId}`}
            title="Open WhatsApp with this counter-narrative pre-filled"
            className="mt-auto flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2 text-base font-bold text-[#06251a] shadow-sm transition hover:brightness-105"
          >
            <MessageCircle className="h-5 w-5" /> Send to Team
          </a>
        </div>
      </div>
    </li>
  );
}
