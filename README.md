# Contact Sheet

A personal contact directory you can add to your tablet or phone’s Home Screen. Keep a
master list of contacts, organize them with categories and tag groups, save named
directories, and make a printable PDF of whoever you pick.

## App

Everything lives in [`app/`](app/) (React + Vite):

```bash
cd app
npm install
npm run dev      # local development
npm run build    # static files → app/dist/
```

### Features
- **Master list** — add / edit / delete; search; bulk category / tag / delete / export
- **Categories** — one primary category per contact (folder-like)
- **Tag groups** — organized tags (e.g. Relationship, Role, Circle) plus free tags
- **Lists** — smart lists (by tags) or saved selections
- **Make PDF** — Royal/Gold themes, portrait/landscape, columns, cover, preview
- **Import** with preview; **export** `.vcf`; JSON backup / restore
- **Optional sync** — Supabase (`VITE_SUPABASE_*` when building `app/`)
- **Offline PWA** — Add to Home Screen (iPad Edge/Safari guided install)

### Typical use
1. Import contacts → assign a category and tags
2. Filter → the PDF button in the header, or **Select** people → **List** / **PDF**
3. Or open **Lists** → smart list from tags → **Make PDF**

## Deploy
Deploy the contents of `app/dist/` to any static host. Hostinger target is in
[`.hostinger/site.json`](.hostinger/site.json).

On iPad (Edge or Safari): open the URL → **Add to Home Screen** (banner, or Settings → Add to Home Screen).

## Sync schema
[`supabase/schema.sql`](supabase/schema.sql) — run once in a Supabase project for optional cloud sync.

## App Store path
See [`docs/APP_STORE.md`](docs/APP_STORE.md). Privacy draft: [`privacy.html`](privacy.html).
