This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

## Nexorus AI layer

The dashboard ships with **Nexorus AI**, an AI layer served from `/api/v1/ai/*`:

- **Copilot** — ask-the-data chat in the ⌘K bar.
- **Executive briefing** — one-click SITREP from every widget.
- **Per-widget Ask** — a spark button on each tile (explain / drivers / talking points).
- **Forecast & early-warning** — escalation trajectories + anomaly alerts in the bell menu.

Nexorus AI runs **hybrid**: with no key configured it answers from deterministic,
data-grounded fallbacks (reliable and zero-cost for demos). Configure a key to switch
the chat/briefing/widget endpoints to a live model:

```bash
# .env.local
NEXORUS_AI_KEY=...           # enables the live path
NEXORUS_AI_MODEL=...         # optional model override
```

No key is required to run or demo the dashboard.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
