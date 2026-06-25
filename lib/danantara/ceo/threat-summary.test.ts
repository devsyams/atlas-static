import { describe, expect, it } from "vitest";
import { fallbackPoints, parseSummaryPoints, shortenPoint, summaryPrompt } from "./threat-summary";

describe("threat-summary helpers", () => {
  describe("shortenPoint", () => {
    it("prefers the lead clause before the first comma", () => {
      expect(shortenPoint("Banyak narasi negatif menyoroti risiko pencucian uang, potensi penyalahgunaan instrumen.")).toBe(
        "Banyak narasi negatif menyoroti risiko pencucian uang",
      );
    });

    it("keeps a long comma-less sentence whole — never truncates", () => {
      const long = "satu dua tiga empat lima enam tujuh delapan sembilan sepuluh sebelas dua belas";
      expect(shortenPoint(long)).toBe(long);
      expect(shortenPoint(long)).not.toContain("…");
    });

    it("returns a short sentence unchanged", () => {
      expect(shortenPoint("Tiga kata saja.")).toBe("Tiga kata saja");
    });
  });

  describe("fallbackPoints", () => {
    it("splits a multi-sentence read into shortened points, capped at 3", () => {
      const aiLine =
        "Pasal 50A memberi imunitas hukum bagi pembeli bond. " +
        "Banyak narasi negatif menyoroti risiko pencucian uang, potensi penyalahgunaan. " +
        "Menteri Keuangan memberi klarifikasi, namun publik mengkritik kurangnya transparansi. " +
        "Kalimat keempat yang seharusnya terpotong.";
      const points = fallbackPoints(aiLine);
      expect(points).toHaveLength(3);
      expect(points[0]).toBe("Pasal 50A memberi imunitas hukum bagi pembeli bond");
      expect(points[1]).toBe("Banyak narasi negatif menyoroti risiko pencucian uang");
    });

    it("returns [] for empty input", () => {
      expect(fallbackPoints("")).toEqual([]);
    });
  });

  describe("parseSummaryPoints", () => {
    it("strips bullets/numbering and caps at 3", () => {
      const raw = "- Imunitas hukum Pasal 50A\n2. Risiko pencucian uang\n• Kritik transparansi\n4. Poin berlebih";
      expect(parseSummaryPoints(raw)).toEqual([
        "Imunitas hukum Pasal 50A",
        "Risiko pencucian uang",
        "Kritik transparansi",
      ]);
    });

    it("ignores blank lines", () => {
      expect(parseSummaryPoints("Poin satu\n\n\nPoin dua")).toEqual(["Poin satu", "Poin dua"]);
    });
  });

  describe("summaryPrompt", () => {
    it("embeds the title and explanation in the user message", () => {
      const { system, user } = summaryPrompt("Judul Ancaman", "Penjelasan panjang.");
      expect(system).toContain("CEO");
      expect(user).toContain("Judul Ancaman");
      expect(user).toContain("Penjelasan panjang.");
    });
  });
});
