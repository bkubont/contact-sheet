# Contact Sheet (React)

Personal contact directory: master list with tags, saved directories, and printable PDFs.

This is the **active product** for this repo. The older vanilla PWA at the repository root is kept only for reference / migration of existing Home Screen installs; new work happens here.

## Features

- **Master contacts list** — search, tag chips, multi-select
- **Tags** — per contact, bulk tag, rename/delete, filter including Untagged
- **Directories** — smart lists (by tags) or saved selections you can reopen
- **PDF** — cover page, list / cards / table layouts, field toggles, share or download
- **Import / export** — `.vcf` / `.csv` in, `.vcf` out, JSON backup/restore
- Migrates contacts from the legacy `contactSheet.contacts.v1` localStorage key

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
