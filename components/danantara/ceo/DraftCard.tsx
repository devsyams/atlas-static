"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Clapperboard, ClipboardCopy, Megaphone, Users } from "lucide-react";
import type { CounterDraft, DraftChannel } from "@/lib/danantara/ceo/counter-narrative-ai";

const CHANNEL_UI: Record<DraftChannel, { label: string; Icon: typeof Megaphone }> = {
  kol: { label: "KOL post", Icon: Megaphone },
  clipper: { label: "Clipper caption", Icon: Clapperboard },
  grassroots: { label: "Grassroots post", Icon: Users },
};

/** Exactly what lands on the clipboard — body, a blank line, then the tags. */
export function draftClipboardText(draft: CounterDraft): string {
  return draft.hashtags.length > 0 ? `${draft.body}\n\n${draft.hashtags.join(" ")}` : draft.body;
}

/**
 * One ready-to-post draft (A14). Carries the volume math for its own channel in the
 * same box as the copy, so "what to post" and "how many" are read together rather
 * than in two places. The copy button puts the body + hashtags on the clipboard —
 * the whole point of the section is that a comms lead can paste it straight out.
 */
export function DraftCard({ draft, posts }: { draft: CounterDraft; posts: number }) {
  const { label, Icon } = CHANNEL_UI[draft.channel];
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const copy = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(draftClipboardText(draft)).then(
      () => {
        setCopied(true);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 1600);
      },
      () => {
        /* clipboard denied — the text is still on screen to select by hand */
      },
    );
  };

  return (
    <div data-testid={`draft-${draft.channel}`} className="rounded-lg border border-border/60 bg-background/50 p-2.5">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <Icon className="h-4 w-4 shrink-0 text-primary/80" />
        <span className="text-base font-bold uppercase tracking-[0.14em] text-foreground">{label}</span>
        <span className="text-base text-muted-foreground">{draft.platform}</span>
        <span className="ml-auto flex items-center gap-1.5 text-base text-muted-foreground">
          <span data-testid={`draft-posts-${draft.channel}`} className="font-mono font-bold tabular-nums text-foreground">
            {posts.toLocaleString("en-US")}
          </span>
          posts
        </span>
        <button
          type="button"
          onClick={copy}
          data-testid={`copy-${draft.channel}`}
          aria-label={`Copy ${label}`}
          title={`Copy ${label}`}
          className="rounded-md border border-border/60 p-1.5 text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary"
        >
          {copied ? <Check className="h-4 w-4 text-success" /> : <ClipboardCopy className="h-4 w-4" />}
        </button>
      </div>

      <p className="mt-2 min-h-[3.5rem] whitespace-pre-wrap text-base leading-snug text-foreground/90">{draft.body}</p>

      {draft.hashtags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {draft.hashtags.map((h) => (
            <span key={h} className="rounded border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-base text-primary">
              {h}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
