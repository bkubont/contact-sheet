# Contact Sheet (React)

Personal contact directory: master list with tags, saved directories, and printable PDFs.

This is the **active product** for this repo. The older vanilla PWA at the repository root is kept only for reference / migration of existing Home Screen installs; new work happens here.

## Features

- **Master contacts list** — search, tag chips, multi-select, bulk delete / export
- **Tags** — per contact, bulk tag, rename/delete, filter including Untagged
- **Directories** — smart lists (editable tags/match) or saved selections; merge/replace on save
- **PDF** — cover page, preview in tab, list / cards / table layouts, field toggles
- **Import / export** — `.vcf` / `.csv` with preview, `.vcf` out, JSON backup/restore with confirm
- **Optional cloud sync** — Supabase email/password (see below); works offline without an account
- **Offline PWA** — service worker + manifest for Home Screen install
- Migrates contacts from the legacy `contactSheet.contacts.v1` localStorage key

## Optional accounts / sync

1. Create a Supabase project and run [`../supabase/schema.sql`](../supabase/schema.sql).
2. Build with env vars (or set them in a local `.env`):

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

Static output is in `app/dist/` (relative asset paths, works on GitHub Pages or any static host).

## Typical use

1. Import contacts (menu → Import)
2. Tag people (Family, School, …)
3. Filter → **PDF these**, or select → **Save list** / **Make PDF**
4. Or open **Directories** → new smart list from tags → Make PDF
