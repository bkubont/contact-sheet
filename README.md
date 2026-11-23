# Contact Sheet

A personal contact directory you can add to your phone’s Home Screen. Keep a master
list of contacts, tag them for filtering, save named directories, and make a printable PDF
of whoever you pick.

## Active app (React)

The product lives in [`app/`](app/):

```bash
cd app
npm install
npm run dev      # local development
npm run build    # static files → app/dist/
```

### Features
- **Master list** — add / edit / delete contacts; search by name, company, phone, tag
- **Tags** — per contact, bulk tag selected people, filter chips (including Untagged), rename / delete tags
- **Directories** — smart lists driven by tags (always up to date) or saved selections you can reopen
- **Make PDF** — cover page with letter index, plus Cards / List / Table layouts; choose fields, sort, paper size; share or download
- **Import** `.vcf` / `.csv` (dupes skipped); **export** `.vcf`; JSON backup / restore
- Migrates data from the older vanilla app’s `localStorage` keys automatically

### Typical use
1. Import contacts → tag them (e.g. *Family*)
2. Filter by tag → **PDF these**, or select → **Save list** / **Make PDF**
3. Or open **Directories** → create a smart list from tags → **Make PDF**

## Putting it on the web
Deploy the contents of `app/dist/` to any static host (GitHub Pages, Netlify, Cloudflare Pages, Hostinger). On iPhone: open the URL in Safari → Share → **Add to Home Screen**.

## Legacy vanilla app
The root `index.html` + `js/` PWA is the previous Contact Sheet. It still works offline for existing installs. New development happens in `app/`. Cloud sync (Supabase) from the vanilla app is documented under [`supabase/`](supabase/) and can be re-wired into the React app later.

## App Store path
See [`docs/APP_STORE.md`](docs/APP_STORE.md) for Capacitor wrapping and review notes.

## Privacy
[`privacy.html`](privacy.html) — draft; fill in the bracketed parts before shipping.
