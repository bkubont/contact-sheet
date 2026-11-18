# Contact Sheet

A small web app you can add to your phone's Home Screen. It holds your contact list,
lets you tag contacts and add new ones, and makes a printable PDF of whichever
contacts you pick.

## Features
- **Import** your existing contacts from a `.vcf` (iPhone / vCard) or `.csv` (Google, Outlook) file — duplicates are skipped.
- **Add / edit / delete** contacts: name, company, title, multiple phones & emails, address, birthday, notes.
- **Tags**: add tags per contact, tag many at once, filter the list by tag, rename or delete tags.
- **Make PDF** of the selected contacts in three layouts — *Cards*, *List* (A–Z directory), or *Table* — choose which fields to include, sort order and paper size. Share it, print it or save it.
- Works **offline** once installed. Your contacts are stored **only on your device** (nothing is uploaded anywhere).
- Back up / restore (`.json`) and export everything as `.vcf`.

## Typical use
1. Tap a tag chip (e.g. *Family*) to filter → **Select all** → **Make PDF**.
2. Or tick contacts one by one with the circles on the left.

## Getting your contacts in
- **iPhone:** Contacts app → *Lists* → press and hold *All Contacts* → *Export* → save to Files. Then in Contact Sheet: ☰ → *Import*.
- **Google / Android:** contacts.google.com → *Export* → vCard or Google CSV.

## Putting it on your Home Screen
The app is static files (no server code), so any HTTPS host works. With GitHub Pages:
1. In the repo on GitHub: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, choose the branch and `/ (root)`, Save.
2. After a minute it's live at `https://<your-username>.github.io/contact-sheet/`.
3. On iPhone open that link in **Safari** → Share button → **Add to Home Screen**. (Android/Chrome: menu → *Install app*.)

> GitHub Pages on a private repository needs a paid GitHub plan; otherwise make the repo public
> (your contacts are never in the repo — they live only on your phone) or use another static host such as Netlify or Cloudflare Pages.

## Notes
- Data lives in the browser storage of the installed app. Deleting the app from the Home Screen deletes its data — use **Back up** occasionally.
- The PDF uses standard fonts, so emoji and non-Latin scripts (e.g. Chinese, Arabic) are left out of the PDF.

## Files
- `index.html`, `styles.css` — the page
- `js/store.js` — on-device storage
- `js/importers.js` — vCard/CSV import, vCard export
- `js/pdf.js` — PDF layouts (uses bundled [jsPDF](https://github.com/parallax/jsPDF), MIT)
- `sw.js`, `manifest.webmanifest`, `icons/` — offline + Home Screen install
