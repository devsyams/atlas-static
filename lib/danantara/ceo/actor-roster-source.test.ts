import { describe, expect, it } from "vitest";
import { mapActorRoster, type ActorRosterApiResponse } from "./actor-roster-source";

/** A roster with a duplicate handle, a float sentiment, a bot-class account, and a
 *  base64 avatar — the real-world quirks the /actor-intelligence endpoint serves. */
const SAMPLE: ActorRosterApiResponse = {
  success: true,
  status_code: 200,
  meta: { topic: "danantara_main" },
  data: [
    { username: "neg_influencer", platform: "twitter", follower_count: "1,200,000", influence_score: 9, credibility_score: 7, sentiment_score: -8, risk_level: "high", account_classification: "Negative Critic", content_themes: "kritik tata kelola", profile_picture: "data:image/jpg;base64,AAAA" },
    { username: "provocator1", platform: "instagram", follower_count: 5000, influence_score: 6, credibility_score: 3, sentiment_score: -6.5, risk_level: "high", account_classification: "Propaganda/Provocator", profile_picture: "data:image/jpg;base64,BBBB" },
    { username: "neutral_obs", platform: "youtube", follower_count: 300, influence_score: 5, credibility_score: 6, sentiment_score: 0, risk_level: "low", account_classification: "Neutral Observer" },
    // Duplicate of provocator1 — must collapse to one driver.
    { username: "provocator1", platform: "instagram", follower_count: 5000, influence_score: 6, credibility_score: 3, sentiment_score: -6.5, risk_level: "high", account_classification: "Propaganda/Provocator" },
  ],
};

describe("actor-roster mapper (A10 v5.2 — T18)", () => {
  it("maps the /actor-intelligence roster → deduped, negative-first ThreatDriver[]", () => {
    const drivers = mapActorRoster(SAMPLE);

    // Dedup by handle: provocator1 appears once.
    expect(drivers.filter((d) => d.handle === "provocator1")).toHaveLength(1);

    const byHandle = Object.fromEntries(drivers.map((d) => [d.handle, d]));
    // Bot split from account_classification.
    expect(byHandle["provocator1"].bot).toBe(true); // Propaganda/Provocator
    expect(byHandle["neg_influencer"].bot).toBe(false); // Negative Critic
    expect(byHandle["neutral_obs"].bot).toBe(false);

    // Comma-formatted follower count parsed; float sentiment tolerated (no throw).
    expect(byHandle["neg_influencer"].followers).toBe(1_200_000);
    // Base64 avatar carried through; absent → undefined.
    expect(byHandle["neg_influencer"].avatarUrl).toBe("data:image/jpg;base64,AAAA");
    expect(byHandle["neutral_obs"].avatarUrl).toBeUndefined();

    // Ranking: within the human group, the negative + influential account outranks the neutral one.
    const humans = drivers.filter((d) => !d.bot).map((d) => d.handle);
    expect(humans.indexOf("neg_influencer")).toBeLessThan(humans.indexOf("neutral_obs"));
  });

  it("returns an empty array on an empty roster (no throw)", () => {
    const empty: ActorRosterApiResponse = { success: true, status_code: 200, meta: { topic: "danantara_main" }, data: [] };
    expect(mapActorRoster(empty)).toEqual([]);
  });
});
