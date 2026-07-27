import { describe, expect, it } from "vitest";

import { ATCS_CAMERAS, cctvSources, isAllowedAtcsUrl } from "./atcs";

describe("cctvSources (T22 / AC22)", () => {
  it("returns the direct upstream first, the same-origin proxy second", () => {
    const cam = ATCS_CAMERAS[0];
    const sources = cctvSources(cam);
    expect(sources).toHaveLength(2);
    expect(sources).toEqual([cam.url, `/api/v1/cctv/playlist?cam=${cam.id}`]);
  });
});

describe("isAllowedAtcsUrl over the registry (T23 / AC22)", () => {
  it("allowlists every camera's direct upstream (a known CORS host, not an arbitrary origin)", () => {
    for (const cam of ATCS_CAMERAS) {
      expect(isAllowedAtcsUrl(cam.url), cam.id).toBe(true);
    }
  });
});
