# Contact Sheet — Redesign Plan

_Reviewed 2026-11-23 against `main` at `cc360a8` ("Royal blue/gold tablet redesign, categories, and remove legacy PWA"). Walkthrough done at phone (390×844), tablet (820×1180) and desktop (1280×800) sizes, with 14 sample contacts, categories, tags and 2 directories._

The owner wants:
1. **Theme**: the Romulus logo's royal blue and gold, used with more restraint than now.
2. **Tags**: tags should add color to the app.
3. **Menus**: replace the current menu setup.

Bug fixes come first because they are cheap and affect everything after.

---

## 0. Where the app is now

`cc360a8` already moved to blue and gold, added **categories** (one per contact, with a color) and **tag groups** (named sets of tags), an install banner, PDF color themes, and a two-column tablet layout. It also deleted the legacy root app. Those are good foundations. What still doesn't work:

### Bugs (seen in the running app)
| # | Where | Problem | Cause |
|---|---|---|---|
| B1 | Contact editor (phone) | Form is **wider than the screen** and scrolls sideways. Name, title, phone and email fields, and the tag-group chips, are cut off. | Inputs in `.grid2` / `.mrow` have no `min-width:0`, and `.suggest` doesn't wrap inside the fieldset. |
| B2 | Contact list | The **selected checkbox shows a small dark blob**, not a check. | `.pick svg` sets no `fill:none; stroke:currentColor`. |
| B3 | Contact list (phone) | **Only about 1.5 contacts are visible** on first load. The install banner (~100px), header with search and two filter rows (~280px), the always-on "14 shown / PDF these" bar and the tab bar (~180px) use most of an 844px screen. | Too many fixed layers. See §3. |
| B4 | Contact list | The last rows are hidden behind the action bar and tab bar. | `body` padding-bottom 88px is less than the bars' height. |
| B5 | Make PDF sheet | Each **checkbox sits on its own line above its label** ("Cover page…", every "Include" option). | `.sheet-body label{display:grid}` has higher specificity than `.check`. |
| B6 | Menu → any item → Cancel | Returns you to the **Menu**, not the app, so you have to cancel twice. | `MenuSheet` hides itself while a child sheet is open, then reappears. |
| B7 | Tablet/desktop | The tab bar is a narrow floating pill that covers list content. The "PDF these" bar overlaps the grid. | `@media (min-width:720px)` rules. |
| B8 | Install banner | Sits above the sticky header on every screen size, including desktop. After "Not now" it can return through Menu → Add to Home Screen, which is fine, but it shouldn't show on desktop browsers that can't install. | `InstallBanner.tsx`. |
| B9 | Dialogs | **18 browser `prompt()`/`confirm()` calls**, including 7 new ones in `GroupsSheet` for adding and renaming categories, groups and tags. They look out of place in an installed app and can be blocked in iOS standalone mode. | — |
| B10 | Default data | New installs get a **"Family" category and a "Family" tag**, so a contact shows two "Family" pills in different colors (seen on Anna Bauer). | `DEFAULT_CATEGORIES` and `DEFAULT_TAG_GROUPS` overlap. |
| B11 | Deploy | The **`deploy` branch holds a Nov 18 build of the old "Canopy Clients" CRM**, built from `claude/zen-hypatia-6nyh7z`. If Hostinger serves that branch, the live site is not Contact Sheet at all. | Needs a build-and-publish step from `main`. |

### Theme: why it isn't "tasteful" yet
- **The gold is orange.** `--gold:#d97706` is Tailwind amber-600. The logo's gold is a warmer metallic yellow (`#C9962E` mid, `#EEB33F` highlight). Category presets and the "Gold" PDF theme are orange-brown too.
- **Gold is everywhere.** `var(--gold)` appears about 30 times in `styles.css`. Every active chip, button, tab, letter rule, sheet top edge and section label gets a gold underline or border. When everything is gold, nothing stands out.
- Background still uses **radial gradients** (light blue plus amber glow), frosted-glass top bar, and shadowed cards. That's busy next to a logo that is clean blue and gold on black.
- The blue is Tailwind blue-900/700 (`#1e3a8a`/`#1d4ed8`), close to the logo but slightly grey-purple. The logo is a purer royal: `#012579` deep, `#1E46C0`-ish glow.
- The app doesn't use the logo itself. The icons were regenerated as small flat PNGs (667 bytes).
- No dark mode, though the logo is designed on black and a dark mode would suit it well.

### Tags: why they still don't add color
- **Color lives only on categories.** Tags all render as the same pale blue pill. Tag groups have no color.
- The category color presets are 8 swatches, mostly blues and oranges, that **collide with the brand colors**. A blue "Work" edge reads as theme, not information.
- **Three overlapping concepts**: category (one per contact), tag groups, and free tags. The editor shows a category dropdown, three tag-group chip sections, *and* a custom-tag input with suggestions. That's a lot to process when adding one person.
- Filtering: one category *and* one tag at a time, each in its own sideways-scrolling row with no hint that more exist.
- Tag management is split across **Menu → Categories & tag groups → All tags** and **Menu → Manage tags**, which are two screens doing the same job.

### Menus: why they feel wrong
- The hamburger menu grew to **10 items**: Import, Categories & tag groups, Manage tags, Add to Home Screen, Export, Back up, Restore, Account, Delete all data. Everyday, rare and destructive actions sit together.
- Directories has no menu button; the Contacts and Directories tabs behave differently.
- The "N shown · Select all · Export shown · PDF these" bar floats over the list all the time.
- Every row has a select checkbox all the time. With 2 selected, the selection bar grows to **two rows of six buttons**.
- Sheet header actions are inconsistent ("Create" on Make PDF, "Replace" in both header and body on Restore).

---

## 1. Theme: logo blue and gold, used with restraint

### Source: the Romulus logo
Colors sampled from the logo (`app/public/romulus-logo.jpg`):

| Logo region | Sampled |
|---|---|
| Royal blue, deep body | `#012579` / `#001F68` |
| Royal blue, highlight/glow | `#0028A2` to about `#1E46C0` |
| Gold, highlight | `#EEB33F` |
| Gold, mid | `#C9962E` |
| Gold, shadow | `#A9711A` |

### Principle
Royal blue is the structure and gold is the accent. **Gold should cover under 5% of any screen.** Use it for exactly these: the active-tab indicator, the A–Z letter index, focus rings, and the PDF cover rule. Remove the gold underline from chips, buttons, sheet edges and section labels. Never use gold for button fills, large areas, or small body text. Backgrounds are flat: warm paper in light mode, near-black navy in dark mode, matching the logo's black field. No gradients.

### Tokens (replace the `:root` block in `app/src/styles.css`)
| Token | Light | Dark | Use | Contrast |
|---|---|---|---|---|
| `--ink` | `#0A1A4A` | `#E6EBF7` | Primary text, headings | 15:1 |
| `--royal` | `#0F2A7A` | `#2B55D6` | Primary buttons, + button | white on it 12.9:1 |
| `--royal-bright` | `#1E46C0` | `#7FA0F0` | Links, "Select", initials, interactive text | 7.8:1 / 7.1:1 |
| `--gold` | `#C9962E` | `#D4A53A` | Accent only (list above) | ≈3:1 in light mode, so large/bold use only; 8:1 in dark |
| `--gold-text` | `#8A6418` | `#D4A53A` | When gold must be small text | 5.4:1 |
| `--gold-soft` | `#FBF3E0` | `#1C1A12` | Very subtle highlight (selected row) | — |
| `--paper` | `#FAF8F3` | `#070E24` | App background | — |
| `--surface` | `#FFFFFF` | `#0D1834` | Lists and sheets | — |
| `--line` | `#E7E2D6` | `#1D2A4D` | Hairlines | — |
| `--muted` | `#646B80` | `#8D97B3` | Meta text | AA |
| `--danger` | `#A6342B` | `#E8857C` | Destructive only | AA |

Mockup of the Contacts screen in both modes: `docs/theme-mock.png` (source `docs/theme-mock.html`).

### Surfaces and type
- The contact list becomes **grouped surfaces with hairline dividers** (one card per letter section) instead of a card per person. Remove per-row shadows and the per-row `rise` animation. On tablet, keep two columns, but of letter groups, not individual cards.
- Top bar: solid `--paper` with a hairline. Drop the blur and glass.
- Letter headers: small uppercase letters in `--gold` with no gradient rule.
- Fraunces only for screen titles and the PDF cover. Everything else uses Outfit.
- Corner radius: 12–14px on surfaces and 999px on chips. The current 6px makes everything look like form fields.
- Dark mode via `prefers-color-scheme` plus a Light/Dark/System setting.

### Brand mark and icon
- Use the **logo as the app icon**. It already sits on black, so it works as a maskable icon. Regenerate `icon-192/512`, `apple-touch-icon`, `favicon-32`, and add a maskable 512 with safe-zone padding.
- Show a small rounded logo tile beside the screen title, as in the mockup.
- `theme-color`: `#070E24` (dark) / `#FAF8F3` (light) via media-qualified meta tags. Manifest `background_color` `#070E24`.
- Install banner restyled as a quiet card (logo, one line, "Install" / "Not now"), not a full-width blue and orange bar.

### PDF
- Keep the color-theme picker but redefine the themes. **Royal** (default) uses deep royal headings with a thin gold rule. **Classic** is ink on white with a gold rule. **Charcoal** stays. Remove the all-orange "Gold" theme, or make it ink headings with gold rules only.
- Logo on the cover (optional toggle).
- Tag dots and group colors in the body when "Tags" is included (see §2).

### Files
`app/src/styles.css` (token block, remove gradients, cut gold uses to the list above), `app/src/types.ts` (`PDF_THEMES`, category presets), `app/src/lib/pdf.ts`, `app/index.html`, `app/public/manifest.webmanifest`, `app/public/*.png`, `app/src/components/InstallBanner.tsx`.

---

## 2. Tags with color

Build on the model that's already in `cc360a8` rather than replacing it.

### Model changes (Db v4)
```ts
interface TagGroup { id; name; tags: string[]; color: TagColor }   // + color
interface CategoryDef { id; name; color: TagColor }                   // color becomes a palette key, not free hex
interface Db { …; tagColors?: Record<string, TagColor> }              // optional per-tag override
```
- **Tags take their color from their group.** "Relationship" tags are one hue, "Circle" another. Tags outside any group are neutral stone. A per-tag override is optional for people who want it. This gives color to everything without asking the user to pick a color for each tag.
- **Categories use the same palette** (a palette key, not hex), so category and tag colors look like one system and never collide with brand blue or gold.
- **Migration v3 → v4**: assign palette colors to existing groups in order. Map existing category hex values to the nearest palette key. Sync needs no change, because `tagGroups` and `categories` already travel in the taxonomy row (`DIRS_SYNC_ID`).
- Fix B10: default categories become **Family, Friends, Work, Community, Other** and the default "Relationship" group drops "Family" (it becomes Spouse, Partner, Child, Parent, Sibling, Neighbor). Existing data is not rewritten.

### Palette: 10 muted hues kept apart from brand blue and gold
Each color has a `dot`, a `tint` (chip background) and an `ink` (chip text), in light and dark variants. All `ink`-on-`tint` pairs must meet AA contrast.

`denim` · `teal` · `sage` · `olive` · `terracotta` · `rose` · `plum` · `lavender` · `sand` · `stone`

There is no pure royal blue (reserved for brand) and no metallic gold (reserved for accent). `denim` is greyer and lighter than `--royal-bright`, and `sand` is paler than `--gold`. Defined once in `lib/palette.ts` and used by CSS custom properties, the PDF, and swatch pickers.

### Where color appears
| Place | Treatment |
|---|---|
| Contact row | **Avatar circle tinted with the category color** (replaces the 3px left edge). Up to 3 **tag dots** after the name, plus "+N". No pills in the list. |
| Filter chips | Dot plus name. Selected: tint background, ink text and border. No gold underline. |
| Editor | Category as a row of colored chips (not a `<select>`). Tags as colored chips grouped by tag group, with selected ones filled. One "Add tag" field at the bottom. |
| Tags screen | Group headers with a swatch; each tag shows its color and count. |
| Directories | Smart list cards show their tags' dots. |
| PDF | Category color on the name or initials; tag dots; a small legend on the cover. |

### Workflows
- **One filter row**: a "Filter" button opens a sheet with Categories and Tag groups as checkable colored lists, plus an Any/All toggle when 2 or more tags are picked. Active filters show as removable chips under the search field. This replaces the two scrolling rows (fixes B3).
- **Bulk tag sheet**: a checklist of all tags, grouped and colored, with **tri-state** boxes (all / some / none of the selected people have it).
- "Save this filter as a smart list" shortcut when filters are active.
- Removing a tag from its last contact no longer deletes it if it belongs to a group. Free tags still disappear with their last use; offer to "Add to a group" from the Tags screen to keep one.

### Files
New: `lib/palette.ts`, `components/TagDots.tsx`, `components/ColorChip.tsx`, `components/FilterSheet.tsx`, `components/TagChecklist.tsx`, `screens/TagsScreen.tsx` (replaces `GroupsSheet.tsx` and the Manage tags sheet).
Changed: `types.ts`, `lib/store.ts` (v4 migration, defaults), `lib/pdf.ts`, `ContactsScreen.tsx`, `ContactEditor.tsx`, `DirectoriesScreen.tsx`.

---

## 3. Navigation and menus

### Four tabs, no hamburger
```
[ Contacts ]  [ Lists ]  [ Tags ]  [ Settings ]
```
- **Contacts**: browse, search, filter, add.
- **Lists** (renamed from "Directories"): smart and saved lists, PDF.
- **Tags**: categories, tag groups and tags in one place, with colors. Replaces "Categories & tag groups" and "Manage tags".
- **Settings** (replaces the 10-item menu), in grouped sections:
  - *Data*: Import · Export all (.vcf) · Back up · Restore
  - *Account*: sync status (the status dot moves to the Settings tab icon) · sign in/out
  - *App*: Add to Home Screen · Appearance (Light / Dark / System)
  - *About*: version, privacy
  - *Danger zone* (separated, at the bottom): Delete all data, with a typed in-app confirmation

Tab bar: muted icons. The active tab gets a **2px gold bar above the icon** and an `--ink` label. On tablet and desktop (≥900px) it becomes a **left sidebar** with the logo at the top, and Contacts gets a detail pane on the right (fixes B7).

### Contacts header
```
[logo] Contacts              Select  [ + ]
[ Search…                      ] [Filter]
 • Family ×   • School ×                     ← only when filters are active
```
- **Select** turns on selection mode. Checkboxes appear only then, and the header becomes "Cancel · N selected · Select all".
- Remove the always-on "N shown / PDF these" bar. A **PDF/share button** appears in the header when a filter or search is active, and in Select mode.

### Selection bar (Select mode)
One row of icon-and-label buttons that fits 390px: **Tag · Category · List · PDF · More** (Export, Delete). Delete is never next to the primary action. Fixes the two-row bar.

### Sheets and dialogs
- One `Sheet` pattern: **Cancel left, title centered, one primary action right**. No duplicate action buttons in the body.
- Sheets opened from Settings close back to Settings (fixes B6).
- Replace all 18 `prompt()`/`confirm()` calls with `<ConfirmSheet>` and `<TextPromptSheet>` (fixes B9).
- Add focus trap, Escape to close, and focus return to the trigger in `Sheet.tsx`.

### Files
New: `screens/SettingsScreen.tsx`, `screens/TagsScreen.tsx`, `components/TabBar.tsx`, `components/ConfirmSheet.tsx`, `components/TextPromptSheet.tsx`, `components/SelectionBar.tsx`.
Changed: `App.tsx` (4 tabs, sidebar layout), `Sheet.tsx`, `ContactsScreen.tsx` (now ~640 lines; split into `ContactList`, `FilterSheet`, `SelectionBar`), `DirectoriesScreen.tsx` → `ListsScreen.tsx`.
Removed: `MenuSheet.tsx`, `GroupsSheet.tsx`.

---

## 4. Phasing

Each phase can ship on its own. The app stays usable between phases.

| Phase | Scope | Size |
|---|---|---|
| **1. Fixes** | B1, B2, B4, B5, B7, B10 (defaults only) **— done 2026-11-23**; B11 publishing (see §5) | S |
| **2. Theme** | §1 tokens, cut gold uses, flat surfaces, grouped list, logo icons, dark mode, PDF themes, install banner | M |
| **3. Tag color model** | Db v4, palette, migration, group colors, category palette keys | M |
| **4. Navigation** | 4 tabs, Settings, Tags screen, Select mode, selection bar, filter sheet (B3), sheet pattern, Confirm/Prompt sheets (B6, B9), sidebar on tablet | L |
| **5. Tag UI** | Colored avatars and dots, editor chips, tri-state bulk tag, multi-filter, PDF legend | M |
| **6. Polish** | Accessibility pass, empty states, README/Contacts.md update | S |

### Testing
- There are **no tests**. Add Vitest for `store.ts`: v2→v3→v4 migration, rename/delete tag across groups and directories, category removal, backup round-trip with v2/v3/v4 files.
- Add a Playwright smoke script for phone, tablet and desktop in light and dark. It should check that **no page or sheet scrolls horizontally** (would have caught B1) and that at least 5 contacts are visible on a phone on first load (B3).

### Housekeeping
- Set up the `deploy` branch (or a GitHub Action) to build `app/` from `main` and publish `app/dist/`. Confirm which branch Hostinger pulls (B11).
- `cursor/royal-tablet-redesign-e129` is merged into `main` and can be deleted.

---

## 5. Decisions
Answered 2026-11-23: **go with the recommendations** (Lists rename, keep categories, tag color from group, dark mode in phase 2, Select mode). Hostinger serves **`main`**.

### Hostinger and `main`: action needed
Hostinger's Git deploy copies the repo as-is. Since `cc360a8` removed the legacy app, the repo root has **no `index.html`**, and the React app exists only as source in `app/`. The next Hostinger deploy of `main` will serve a blank site. Options:
- **A (recommended):** A GitHub Action builds `app/` on every push to `main` and publishes `app/dist/` to the `deploy` branch. Hostinger's Git setting switches from `main` to `deploy` (one change in hPanel → Advanced → Git). This **replaces** what's on `deploy` now (an old Canopy Clients build). Needs owner approval.
- **B:** Commit the built files into the repo root on `main`. No Hostinger change, but every app change also needs a rebuild commit, and the history fills with generated files.

`app/public/.htaccess` (HTTPS redirect, caching) is added, so either option ships with the right server settings.

---

## 6. Connecting to Canopy Estimate

**Goal:** from a contact in Contact Sheet, see that person's **completed jobs**, with a **copy of the estimate and the invoice** for each.

### What Canopy Estimate has today (`bkubont/canopy-estimate`, `0043d00`)
- Supabase backend with organizations and members (roles: owner / office / crew).
- `customers` (plus `customer_phones`, `customer_emails`, `customer_properties`), `jobs` (stage `estimate → work_order → invoice → paid`, status `… → done`), `invoices`, `payments`.
- Row-level security: **invoices are readable only by owner/office**. Crew can see jobs but not prices.
- **Estimate and invoice PDFs are not stored.** They're drawn in the browser from React components (`EstimateDoc`, `InvoiceDoc`) each time someone opens them. Customer-facing pages use share tokens.
- It already has its own CRM screens (contacts, tag groups, smart lists). Contact Sheet's `Contacts.md` describes the split: personal contacts here, company customers there.

### Recommended design: Canopy is the record, Contact Sheet reads it
Canopy stays the only place jobs, estimates and invoices are created or changed. Contact Sheet **links** a personal contact to a Canopy customer and **reads** their history. Personal contacts are never uploaded to Canopy.

**1. Frozen document copies (Canopy change).** When an estimate is **signed**, a change order is signed, or an invoice is **sent** (and again when **paid**), Canopy renders the PDF and saves it:
```sql
create table public.documents (
  id uuid primary key,
  org_id uuid not null references organizations,
  job_id uuid not null references jobs,
  customer_id uuid references customers,
  kind text check (kind in ('estimate','change_order','invoice','receipt')),
  number text, total numeric(12,2),
  path text not null,            -- private storage bucket "documents"
  created_at timestamptz default now(), created_by uuid
);  -- insert-only: copies are never edited
```
RLS: owner/office read, same as invoices. These are true copies: they show exactly what the customer signed or received, even if prices or the template change later. That's useful inside Canopy as a record too.

**2. One read call (Canopy change).** An RPC `customer_history(p_customer uuid)` returns the customer's completed jobs (status `done` or stage `invoice`/`paid`): job number, work date, property, total, paid/balance, and the related document rows. One call keeps Contact Sheet from depending on Canopy's internal table layout.

**3. Contact Sheet side.**
- **Settings → Connections → Canopy Estimate**: sign in with the Canopy account (owner or office role). If Contact Sheet's sync uses the same Supabase project, this is the same sign-in.
- **Link a contact**: on a contact, "Link to Canopy customer" suggests matches by phone or email and asks to confirm. Only the Canopy customer ID is stored on the contact (`contact.canopy = { orgId, customerId }`). It syncs like any other field.
- **Contact detail** gets a **Work history** section: each completed job with date, job number, property, total and Paid/Balance badge, plus **Estimate** and **Invoice** buttons that open the stored PDF.
- PDFs are fetched by short-lived signed URL and **cached on the device** (IndexedDB) so they open offline. "Remove downloaded copies" in Settings.
- A filter chip "Canopy customers" shows linked contacts.
- Job details never go into Contact Sheet's own cloud sync and never appear in Contact Sheet's directory PDFs.

### Considered and not recommended
- **Link to Canopy's customer-facing share pages.** Cheap, but those pages are meant for customers, they show live data rather than a copy, and anyone holding the link can open them.
- **Copy jobs and invoices into Contact Sheet's database.** Two copies of business records drift apart, and personal and business data get mixed in one store.
- **Merge Contact Sheet into Canopy.** Canopy already has a CRM, but it's shared with the team, and personal contacts (family, church) don't belong there.

### Work and order
| Step | Repo | Size |
|---|---|---|
| C1. `documents` table, private bucket, RLS, tests | canopy-estimate | S |
| C2. Save PDF copies on estimate signed / change order signed / invoice sent / paid, plus a one-time backfill for existing signed estimates and sent invoices | canopy-estimate | M |
| C3. `customer_history` RPC, tests | canopy-estimate | S |
| C4. Canopy connection in Settings, linking flow, match suggestions | contact-sheet | M |
| C5. Contact detail screen with Work history, PDF cache | contact-sheet | M |



### Answers (2026-11-23)
Same Supabase project · owner only · completed = Done (or invoiced/paid) with a Paid/Balance badge · OK to change `canopy-estimate`.

### Status
- **C1–C3 built** in `canopy-estimate` on branch `claude/happy-brahmagupta-vtle1a`: migrations `20261126000000_documents.sql` and `20261126000100_documents_storage.sql`, the copy saver (`web/src/lib/documents.ts`, runs after each sync for owner/office, a few at a time, which also covers past jobs), database and unit tests.
  - A change from the first sketch: copies are drawn **after sync**, not at the moment of signing, because customers can sign remotely through their link. Signed estimates and sent invoices are locked by the server, so the copy matches what was signed or sent.
- **C4–C5 built** in Contact Sheet ahead of the navigation work: Menu → *Canopy Estimate* (company, linked count, clear downloads), and a *Canopy Estimate* section in each contact (link with suggestions/search, work history, PDF copies kept on the device). These move into Settings and the contact detail screen in phase 4.
- Shared login: Contact Sheet's "Delete account" became "Delete my Contact Sheet data" so it can never delete the Canopy login.
