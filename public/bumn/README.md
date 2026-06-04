# BUMN logos

Drop one logo image per BUMN here, named **`{id}.png`** (square works best — it
is rendered at 40×40, `object-contain` on a white tile). When a file is missing,
the board shows a monogram fallback (ticker on a sector-tinted tile), so the demo
is always complete; real logos appear automatically once added.

Expected files (ids from `lib/danantara/ceo/data.ts`):

| id | BUMN | file |
|----|------|------|
| garuda | Garuda Indonesia | `garuda.png` |
| waskita | Waskita Karya | `waskita.png` |
| wika | Wijaya Karya | `wika.png` |
| pln | PLN | `pln.png` |
| bulog | Perum Bulog | `bulog.png` |
| krakatau | Krakatau Steel | `krakatau.png` |
| pertamina | Pertamina | `pertamina.png` |
| kai | Kereta Api Indonesia | `kai.png` |
| pelindo | Pelindo | `pelindo.png` |
| ptba | Bukit Asam | `ptba.png` |
| pupuk | Pupuk Indonesia | `pupuk.png` |
| injourney | InJourney | `injourney.png` |
| biofarma | Bio Farma | `biofarma.png` |
| jasamarga | Jasa Marga | `jasamarga.png` |
| semen | Semen Indonesia | `semen.png` |
| antam | Aneka Tambang | `antam.png` |
| mindid | MIND ID | `mindid.png` |
| telkom | Telkom Indonesia | `telkom.png` |
| mandiri | Bank Mandiri | `mandiri.png` |
| bri | Bank Rakyat Indonesia | `bri.png` |

To use a different format (e.g. `.svg`), update the `src` in
`components/danantara/ceo/BumnHeatboard.tsx` (`BumnLogo`).
