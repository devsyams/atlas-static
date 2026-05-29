import { describe, expect, it } from "vitest";
import { classifyCoco, getAtcsCamera, isAllowedAtcsUrl, tallyDetections } from "./atcs";

describe("classifyCoco", () => {
  it("maps COCO classes to Indonesian vehicle classes", () => {
    expect(classifyCoco("car")).toBe("mobil");
    expect(classifyCoco("motorcycle")).toBe("motor");
    expect(classifyCoco("bus")).toBe("bus");
    expect(classifyCoco("truck")).toBe("truk");
    expect(classifyCoco("person")).toBe("orang");
    expect(classifyCoco("traffic light")).toBe("lainnya");
  });
});

describe("tallyDetections", () => {
  it("counts predictions per vehicle class with a total", () => {
    const t = tallyDetections([
      { class: "car" },
      { class: "car" },
      { class: "motorcycle" },
      { class: "bus" },
      { class: "truck" },
      { class: "person" },
      { class: "kite" },
    ]);
    expect(t.mobil).toBe(2);
    expect(t.motor).toBe(1);
    expect(t.bus).toBe(1);
    expect(t.truk).toBe(1);
    expect(t.orang).toBe(1);
    expect(t.lainnya).toBe(1);
    expect(t.total).toBe(7);
  });

  it("returns all-zero on no detections", () => {
    const t = tallyDetections([]);
    expect(t.total).toBe(0);
    expect(t.mobil).toBe(0);
  });
});

describe("isAllowedAtcsUrl", () => {
  it("allows the registry host and rejects others", () => {
    expect(isAllowedAtcsUrl(getAtcsCamera("simpanglima").url)).toBe(true);
    expect(isAllowedAtcsUrl(getAtcsCamera("jogja-nolkm").url)).toBe(true);
    expect(isAllowedAtcsUrl("https://evil.example.com/x.ts")).toBe(false);
    expect(isAllowedAtcsUrl("not a url")).toBe(false);
  });
});

describe("getAtcsCamera", () => {
  it("falls back to the first camera for unknown ids", () => {
    expect(getAtcsCamera("nope").id).toBe(getAtcsCamera().id);
    expect(getAtcsCamera("mitrabatik").id).toBe("mitrabatik");
  });
});
