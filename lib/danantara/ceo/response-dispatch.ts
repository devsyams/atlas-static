/**
 * Response dispatch (A9 v3.0) — pure helpers that turn a topic + its Counter-Noise
 * plan into a WhatsApp click-to-chat brief, so the comms team can be briefed in one
 * tap from the topic detail. No I/O; the number is supplied by the caller (env).
 *
 * A14 adds `buildWarRoomBrief` alongside it — same transport, richer payload (the
 * counter-narrative and its drafts). `buildResponseBrief` is deliberately untouched.
 */

import { TIER_LABEL, type CounterNoisePlan } from "./counter-noise";
import { CHANNEL_LABEL, type CounterNarrativePlan } from "./counter-narrative";
import { type CounterNarrativeTopic } from "./counter-narrative-ai";
import { fmtCount, pieTotals } from "./format";

export interface ResponseTopic {
  title: string;
  reach: number;
  mentions: number;
  posMentions: number;
  negMentions: number;
  /** The feed's AI penjelasan, included in the brief. */
  aiLine?: string;
}

/** Strip a phone number to the digits-only form wa.me expects (e.g. "+62 812…" → "62812…"). */
export function waNumber(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** A WhatsApp click-to-chat URL with a pre-filled (un-sent) message. */
export function whatsappResponseLink(number: string, message: string): string {
  return `https://wa.me/${waNumber(number)}?text=${encodeURIComponent(message)}`;
}

/** The dominant sentiment label + rounded % of a topic's mention split. */
function dominant(topic: ResponseTopic): { label: string; pct: number } {
  const { pos, neg, neu, total } = pieTotals(topic);
  const t = total || 1;
  if (neg >= pos && neg >= neu) return { label: "Negative", pct: Math.round((neg / t) * 100) };
  if (pos >= neu) return { label: "Positive", pct: Math.round((pos / t) * 100) };
  return { label: "Neutral", pct: Math.round((neu / t) * 100) };
}

/** Compose the human-readable response brief for the WhatsApp message. */
export function buildResponseBrief(topic: ResponseTopic, plan: CounterNoisePlan): string {
  const tone = dominant(topic);
  const lines = [
    "🚨 NEXORUS ATLAS · RESPONSE BRIEF",
    "",
    `Topic: ${topic.title}`,
    `Sentiment: ${tone.label} ${tone.pct}%`,
    `Reach: ${fmtCount(topic.reach)} · Impressions: ${fmtCount(topic.mentions)}`,
  ];
  if (topic.aiLine) lines.push("", `Nexorus AI: ${topic.aiLine}`);
  lines.push(
    "",
    `Communication Response plan (${TIER_LABEL[plan.tier]}):`,
    `• Clipper clips: ${plan.clipper.toLocaleString("en-US")}`,
    `• KOL posts: ${plan.kol.toLocaleString("en-US")}`,
    `• Homeless posts: ${plan.homeless.toLocaleString("en-US")}`,
    `Total: ${plan.counterActions.toLocaleString("en-US")} counter-actions`,
    "",
    "— Danantara CEO Command",
  );
  return lines.join("\n");
}

/**
 * A14 — the counter-narrative handoff: one topic's attack read, our narrative, and
 * the volume plan for each channel, in one WhatsApp message.
 *
 * Deliberately **per topic**, not one brief for the whole board: `wa.me?text=`
 * stops being reliable somewhere around 2 000 characters, and three topics with
 * rich narratives plus channel counts still push it close to the edge.
 */
export function buildWarRoomBrief(topic: CounterNarrativeTopic, plan: CounterNarrativePlan): string {
  const lines = [
    "🛡 NEXORUS ATLAS · COUNTER-NARRATIVE",
    "",
    `Topic: ${topic.title}`,
    `Hostile reach: ${fmtCount(plan.hostileReach)} (${plan.negSharePct}% negative)`,
    "",
    `Attack: ${topic.attackLine}`,
    `Counter narrative: ${topic.counterAngle}`,
    "",
    `Plan (${TIER_LABEL[plan.tier]}) — ${plan.totalPosts.toLocaleString("en-US")} posts → ${plan.shareOfVoicePct}% share of voice:`,
    ...plan.channels.map((c) => `• ${CHANNEL_LABEL[c.channel]}: ${c.posts.toLocaleString("en-US")}`),
    "",
    "The PR/media team will craft the final channel copy.",
    "— Danantara CEO Command",
  ];

  return lines.join("\n");
}
