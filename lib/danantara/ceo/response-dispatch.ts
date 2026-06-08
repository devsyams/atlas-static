/**
 * Response dispatch (A9 v3.0) — pure helpers that turn a topic + its Counter-Noise
 * plan into a WhatsApp click-to-chat brief, so the comms team can be briefed in one
 * tap from the topic detail. No I/O; the number is supplied by the caller (env).
 */

import { TIER_LABEL, type CounterNoisePlan } from "./counter-noise";
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
