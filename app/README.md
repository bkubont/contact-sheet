# Contact Sheet (React)

Personal contact directory: master list with categories and tags, saved directories, and printable PDFs.

This is the **only** web app in the repository. Build output goes to `dist/` for static hosting.

## Features

- **Master contacts list** — search, category + tag chips, multi-select, bulk actions
- **Categories & tag groups** — one primary category; tags organized into groups
- **Lists** — smart lists (editable tags/match) or saved selections
- **PDF** — themes, orientation, card columns, header/footer, cover, preview
- **Import / export** — `.vcf` / `.csv` with preview, JSON backup/restore
- **Optional cloud sync** — Supabase email/password (see below)
- **Offline PWA** — service worker + Add to Home Screen guide
- Migrates from older `localStorage` keys (`contactSheet.contacts.v1`, Db v2 → v3)

## Optional accounts / sync

1. Create a Supabase project and run [`../supabase/schema.sql`](../supabase/schema.sql).
2. Build with env vars (or a local `.env`):

```bash
VITE_SUPABASE_URL=https://YOUR.supabase.co \
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY \
npm run build
```

Leave them empty for on-device-only mode.

## Develop

```bash
cd app
npm install
npm run dev
```

## Build

```bash
cd app
npm run build
```

Static output is in `app/dist/` (relative asset paths).
