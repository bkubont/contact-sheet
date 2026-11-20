# Canopy Clients (app) — retired

**Status: frozen / retired.** This folder is the old company CRM (Canopy Clients). It is **no longer a product** people should open or deploy.

Company CRM now lives in **[Canopy Estimate](https://github.com/bkubont/canopy-estimate)** (the Canopy company PWA). Do not add features here; keep the code only as a historical reference for the migration.

The personal **Contact Sheet** product continues at the **repo root** (App Store track). That is separate from this company CRM.

```bash
# Historical local build only — not for production deploy
cd app
npm install
npm run dev
npm run build          # → app/dist (do not upload to Hostinger)
npm run build:preview  # → app/preview-dist/index.html
```

## Former milestones (archived)
1. **People & customer cards** — tree-service tags, properties with hazards/access, timeline, import, Today basics
2. Job calendar (never shipped here — Estimate calendar is canonical)
3. Accounts, cloud sync & Quo texting
4. Smart lists, follow-ups, tag editor
5. Printouts and Hostinger deploy

## Layout (reference)
- `src/types.ts`: data model (customers, properties, tag groups, activity)
- `src/lib/store.ts`: on-device database (localStorage; never had company cloud sync)
- `src/lib/starter.ts`: tree-service starter tags and sample customers
- `src/lib/importers.ts`: .vcf / .csv contact import
- `src/screens/*`: Today, People, customer card, edit form, More
