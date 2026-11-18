# Canopy Clients (app)

The new Canopy Clients app (Phase 1 in progress). React + TypeScript + Vite; builds to static
files that Hostinger serves. The older prototype at the repo root stays until this replaces it.

```bash
cd app
npm install
npm run dev            # local development
npm run build          # production build → app/dist (upload to Hostinger)
npm run build:preview  # single-file build → app/preview-dist/index.html
```

## Milestones
1. **People & customer cards** ✅: tree-service tags, properties with hazards/access, timeline, import, Today basics
2. **Job calendar** ✅: estimates + jobs, day/week, multi-day, crew & equipment, double-booking warnings
3. Accounts, cloud sync & Quo texting: send/receive from your Quo number, import Quo contacts
4. Smart lists, follow-ups, tag editor
5. Printouts (crew job sheet, estimate route, labels) and deploy to Hostinger

## Layout
- `src/types.ts`: data model (customers, properties, tag groups, activity)
- `src/lib/store.ts`: on-device database (works offline; cloud sync plugs in at milestone 3)
- `src/lib/starter.ts`: tree-service starter tags and sample customers
- `src/lib/importers.ts`: .vcf / .csv contact import
- `src/screens/*`: Today, People, customer card, edit form, More

## Deploying to Hostinger
Every push that changes `app/` runs `.github/workflows/deploy.yml`, which builds the app and
publishes the finished files to the **`deploy`** branch. Point Hostinger's Git deployment at
the `deploy` branch (install path empty = `public_html`).
