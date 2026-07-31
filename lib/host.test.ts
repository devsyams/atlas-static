import { describe, expect, it } from "vitest";
import { isOpengateRequest, requestHost, OPENGATE_HOST, OPENGATE_ORIGIN } from "./host";

describe("host helpers", () => {
  it("normalizes forwarded host values and strips ports", () => {
    expect(requestHost({ get: (name) => (name === "x-forwarded-host" ? "Opengate.Atlas.Nexorus-Alpha.IO:443" : null) })).toBe(OPENGATE_HOST);
  });

  it("falls back to host when x-forwarded-host is absent", () => {
    expect(requestHost({ get: (name) => (name === "host" ? "opengate.atlas.nexorus-alpha.io:3000" : null) })).toBe(OPENGATE_HOST);
  });

  it("recognizes the OpenGate host and exposes the origin constant", () => {
    expect(isOpengateRequest({ get: () => OPENGATE_HOST })).toBe(true);
    expect(OPENGATE_ORIGIN).toBe("https://opengate.atlas.nexorus-alpha.io");
  });
});