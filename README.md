# Contact Sheet

A small web app you can add to your phone's Home Screen. It holds your contact list,
lets you tag contacts and add new ones, and makes a printable PDF of whichever
contacts you pick.

> **Company CRM is not this repo.** The Canopy Clients prototype under [`app/`](app/) is **retired / frozen**. Company customer CRM lives in [Canopy Estimate](https://github.com/bkubont/canopy-estimate). This **root** Contact Sheet app remains the continuing personal / App Store product.

## Features
- **Import** your existing contacts from a `.vcf` (iPhone / vCard) or `.csv` (Google, Outlook) file — duplicates are skipped.
- **Add / edit / delete** contacts: name, company, title, multiple phones & emails, address, birthday, notes.
- **Tags**: add tags per contact, tag many at once, filter the list by tag, rename or delete tags.
- **Make PDF** of the selected contacts in three layouts — *Cards*, *List* (A–Z directory), or *Table* — choose which fields to include, sort order and paper size. Share it, print it or save it.
- **Optional account**: sign in with email + password and your contacts sync across every device (phone, tablet, computer). Without an account, everything stays on the device.
- Works **offline** once installed; changes sync when you're back online.
- Delete-my-account and a privacy policy, ready for the App Store (see [docs/APP_STORE.md](docs/APP_STORE.md)).
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

## Turn on accounts (sign in anywhere)
Accounts use [Supabase](https://supabase.com) (free to start). One-time setup, about 10 minutes:
1. Create a free account at supabase.com → **New project** (pick a region near you, save the database password somewhere safe).
2. In the project: **SQL Editor → New query**, paste everything from [`supabase/schema.sql`](supabase/schema.sql), click **Run**.
3. **Authentication → URL Configuration**: set *Site URL* to your app's address (e.g. `https://<your-username>.github.io/contact-sheet/`) and add the same address under *Redirect URLs*.
4. **Project Settings → API**: copy the *Project URL* and the *anon public* key into [`js/config.js`](js/config.js).
5. Commit and push. The menu now shows **Sign in or create account**.

The anon key is designed to be public. Each person can only read and change their own contacts because of the database's row-level security rules in `schema.sql`.

## Notes
- Without an account, data lives only in the installed app. Deleting it from the Home Screen deletes the data, so use **Back up** occasionally (or sign in).
- Signing out removes contacts from that device (they stay in your account), so shared devices are safe.
- The PDF uses standard fonts, so emoji and non-Latin scripts (e.g. Chinese, Arabic) are left out of the PDF.

## Files
- `index.html`, `styles.css` — the page
- `js/store.js` — on-device storage + change tracking
- `js/sync.js`, `js/config.js` — accounts and cloud sync (Supabase)
- `supabase/schema.sql` — database table and security rules
- `privacy.html` — privacy policy (draft — fill in the bracketed parts)
- `docs/APP_STORE.md` — roadmap to the App Store
- `js/importers.js` — vCard/CSV import, vCard export
- `js/pdf.js` — PDF layouts (uses bundled [jsPDF](https://github.com/parallax/jsPDF), MIT)
- `sw.js`, `manifest.webmanifest`, `icons/` — offline + Home Screen install
