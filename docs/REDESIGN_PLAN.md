# Contact Sheet — Redesign Plan

_Reviewed 2026-11-23 against `app/` (React) at `f58f1f8`. Walkthrough done in a 390×844 phone viewport and a 1280px desktop viewport with 14 sample contacts, 7 tags, 2 directories._

Three goals from the owner:
1. **Theme**: use the Romulus royal blue and gold (from the logo), with more restraint than the current look.
2. **Tags**: tags should add color to the app, and the tag system needs a rework.
3. **Menus**: replace the current menu setup.

There are also correctness and layout bugs found during the walkthrough. These go first because they are cheap and affect everything after.

---

## 0. What I found

### Bugs (seen in the running app)
| # | Where | Problem | Cause |
|---|---|---|---|
| B1 | Contact editor (phone) | Form is **wider than the screen** and scrolls sideways. Last name, Job title, and the phone/email inputs are cut off on the right. | Inputs in `.grid2` / `.mrow` have no `min-width: 0`, so the grid columns can't shrink below the inputs' natural width. |
| B2 | Contact list | The selection **checkmark is a small dark blob**, not a check. | `.pick svg` sets no `fill:none; stroke:currentColor`, so the path is filled. |
| B3 | Contact list | The **last rows are hidden** behind the floating action bar plus the tab bar. | `body` padding-bottom is 88px, but the two bars together take about 170px. |
| B4 | Selection bar (phone) | With 1+ selected, the **actions overflow**: "Make PDF" is cut off at the right edge and the buttons wrap into tall boxes. | Five full-size buttons in one row. |
| B5 | Make PDF sheet | Each **checkbox sits on its own line above its label**. | `.sheet-body label {display:grid}` has higher specificity than `.check {display:flex}`. |
| B6 | Menu → Manage tags → Cancel | Returns you to the **Menu**, not the app, so you have to cancel twice. Same for Import, Restore, Account. | `MenuSheet` hides itself while a child sheet is open, then shows again when the child closes. |
| B7 | Desktop | The tab bar is a narrow floating pill and covers list content. The action bar sits above it, so the list looks cut off. | Width rules in `@media (min-width:720px)`. |
| B8 | Editor tag suggestions | Suggestion chips run off the right edge. | Same overflow as B1. |
| B9 | Rename / delete tag, delete contact, wipe | Uses browser `prompt()` / `confirm()` (11 places). These look out of place in an installed PWA and are blocked in some iOS standalone contexts. | — |
| B10 | Tags | A tag **only exists while at least one contact has it**. You can't create a tag ahead of time, for example to set up a smart directory. Removing a tag from its last contact deletes it silently. | Tags are derived from `contact.tags` strings, and there is no tag table. |

### Theme: why it doesn't feel right
- The current palette is **teal and cream** (`--accent:#0f4c51`, mint radial gradients). Nothing in it is blue or gold.
- Too much is decorated at once. There's a radial gradient background, glass blur on the top bar, shadows on every card, a "rise" animation on every row, and serif Fraunces for every heading. Nothing gets to stand out.
- Every row is a separate floating card with a border and shadow. With 200+ contacts that is a lot of visual noise for what is basically a list.
- `theme-color`, the manifest, and the icons are all hard-coded teal.
- There is no dark mode. The legacy vanilla app had one; the React rewrite dropped it.

### Tags: why they don't add anything
- Every tag looks the same: mint pill, teal text. Tags carry no visual information.
- Filter chips scroll sideways with no hint that there are more. On a phone, 4 of 8 tags are hidden.
- You can only filter by **one** tag at a time. Directories support any/all matching, so the two screens don't agree.
- The bulk "Tag…" sheet is a free-text box plus Add/Remove buttons. It doesn't show which selected people already have which tags.
- Tag management is buried at Menu → Manage tags. Rename and delete use `prompt()`. There is no merge, no color, and no ordering.

### Menus: why they feel wrong
- The hamburger opens one bottom sheet that mixes everyday actions (Import, Manage tags) with rare ones (Backup, Restore), account, and a destructive "Delete all data".
- Directories has no menu button at all (an empty 42px spacer), so the two tabs behave differently.
- A permanent "14 shown · Select all · Export shown · PDF these" bar floats over the list even when you're only browsing.
- Selection mode is always on: every row has a select circle. That clutters browsing and makes taps easy to miss.
- Sheet header buttons are inconsistent: "Cancel / Create" on Make PDF, "Cancel / Replace" on restore, plus another big Replace button in the body.

---

## 1. Theme: Romulus royal blue and gold, used with restraint

### Source: the Romulus logo
Colors sampled from the logo (`IMG_0452.jpeg`, crown and R on black):

| Logo region | Sampled |
|---|---|
| Royal blue, deep body | `#012579` / `#001F68` |
| Royal blue, highlight/glow | `#0028A2` to about `#1E46C0` |
| Gold, highlight | `#EEB33F` |
| Gold, mid | `#C9962E` |
| Gold, shadow | `#A9711A` |

The logo is **saturated royal blue on black with metallic gold**. Used at full strength across an app it would look loud. Below, the deep blue does the structural work, the bright blue marks interactive elements only, and gold is a thin accent.

### Principle
Royal blue is the structure and gold is the accent. **Gold should cover under 5% of any screen**: the active-tab bar, the A–Z letter index, focus rings, and the PDF cover rule. Never use it for button fills, large areas, or small body text. Backgrounds are flat (warm paper in light mode, near-black navy in dark mode, matching the logo's black field). No gradients.

### Tokens
| Token | Light | Dark | Use | Contrast |
|---|---|---|---|---|
| `--ink` | `#0A1A4A` | `#E6EBF7` | Primary text, headings | 15:1 |
| `--royal` | `#0F2A7A` | `#2B55D6` | Primary buttons, + button | white on it 12.9:1 |
| `--royal-bright` | `#1E46C0` | `#7FA0F0` | Links, "Select", initials, interactive text | 7.8:1 / 7.1:1 |
| `--gold` | `#C9962E` | `#D4A53A` | Accent only: tab indicator, letter index, focus ring, rules | 8:1 in dark; in light ≈3:1, so large/bold use only |
| `--gold-text` | `#8A6418` | `#D4A53A` | When gold must be small text | 5.4:1 |
| `--gold-soft` | `#FBF3E0` | `#1C1A12` | Very subtle highlight (selected row) | — |
| `--paper` | `#FAF8F3` | `#070E24` | App background | — |
| `--surface` | `#FFFFFF` | `#0D1834` | Lists and sheets | — |
| `--line` | `#E7E2D6` | `#1D2A4D` | Hairlines | — |
| `--muted` | `#646B80` | `#8D97B3` | Meta text | AA |
| `--danger` | `#A6342B` | `#E8857C` | Destructive only | AA |

A reference mockup of the Contacts screen in both modes is at `docs/theme-mock.png` (built from `docs/theme-mock.html`).

### Brand mark and icon
- Use the logo as the **app icon** (it already sits on black, so it works as a maskable icon). Regenerate `icon-192/512`, `apple-touch-icon`, `favicon-32`, and a maskable variant with safe-zone padding.
- Show a small rounded logo tile beside the screen title in the header, as in the mockup.
- `theme-color` is `#070E24` (dark) / `#FAF8F3` (light) via media-qualified meta tags. The manifest `background_color` is `#070E24`.
- Tag colors (§2) must stay clearly apart from brand royal blue. In the mockup, "Family" uses slate-blue and sits too close; the final palette shifts that hue toward denim/grey or drops it.

### Type and surfaces
- Keep **Fraunces only for the brand wordmark and the PDF cover title**. Everything else uses Outfit (or Inter) with a clear weight scale: 600 for names, 400 for meta, 700 uppercase tracking for section labels.
- The contact list becomes **one grouped surface with hairline dividers** (iOS inset-grouped style) instead of separate cards. Remove per-row shadows and the per-row `rise` animation.
- Top bar: solid `--paper` with a hairline. Drop the blur and glass.
- Letter headers: small caps in `--gold`. This is where gold reads as "tasteful."
- Add dark mode via `prefers-color-scheme` plus a manual override in Settings.
- PDF (`lib/pdf.ts`): logo on the cover, `--ink` headings, a thin gold rule under the cover title and section letters, and colored tag dots (see §2) when "Tags" is included.

### Files
`app/src/styles.css` (rewrite into token, base, and component sections), `app/index.html`, `app/public/manifest.webmanifest`, `app/public/*.png`, `app/src/lib/pdf.ts`.

---

## 2. Tags with color

### Data model (Db v3)
```ts
interface Tag {
  id: string;          // stable, so renames don't touch every contact
  name: string;
  color: TagColor;     // key into the palette below
  order: number;       // user-defined ordering for chips and filters
  created: number; updated: number;
}
interface Db { version: 3; contacts: Contact[]; directories: Directory[]; tags: Tag[] }
```
- **Contacts keep storing tag names** (`contact.tags: string[]`) for now. This keeps the change small and leaves vCard/CSV import, search, and sync untouched. `Tag` is the registry of metadata. (Optional later step: switch contacts to tag IDs.)
- **Migration v2 → v3** (`lib/store.ts` load path): build `tags[]` from every distinct name in contacts and directories. Assign colors with a stable hash of the lowercased name so colors don't change between devices. Order alphabetically.
- Tags now **exist on their own**. Removing a tag from its last contact keeps it (B10). "Delete tag" is explicit.
- Case-insensitive uniqueness is enforced in one place (`Store.ensureTag(name)`), used by the editor, bulk tag, import, and directories.
- **Sync**: store the tag registry in a reserved row next to the existing `DIRS_SYNC_ID` (for example `TAGS_SYNC_ID`), using the same last-write-wins approach. No schema change is needed because `data` is jsonb.
- Backup/restore: include `tags` and accept v2 backups by running the same migration.

### Palette: 10 muted hues that sit next to royal blue and gold
Each color has a `dot`, a `tint` (chip background), and an `ink` (chip text), with light and dark variants. The hues are muted on purpose, so the app gets color without fighting the brand:

`slate-blue` · `teal` · `sage` · `olive` · `ochre` · `terracotta` · `rose` · `plum` · `lavender` · `stone`

(Ochre is kept clearly apart from brand gold: more orange and lighter.) The palette is defined once in `lib/tagColors.ts` and used by CSS custom properties, the PDF, and the color picker. Check every `ink` on `tint` for AA.

### Where tag color appears
| Place | Treatment |
|---|---|
| Filter chips | 8px color dot plus name. Selected: tinted background, ink text, 1px ink border. |
| Contact rows | Up to 3 small colored dots after the name, with "+2" overflow. Full pills only in the detail view. Tag colors are the main color on the list screen. |
| Contact detail/editor | Tinted pills with an × to remove. |
| Tags screen | A swatch and count for each tag. |
| Directories | Smart directory cards show the dots of their tags. Manual ones show a royal "Saved" badge. |
| PDF | Optional colored dots next to names, plus a small legend on the cover. |

### Tag workflows
- **Multi-tag filter**: tap several chips. A small "Any / All" toggle appears when 2 or more are on, matching how directories work. "Untagged" stays as a special chip.
- **Chip overflow**: show the user's top tags (by `order`, then count), then a "More…" chip that opens a searchable tag picker sheet. No hidden horizontal scroll.
- **Bulk tag sheet** becomes a checklist of every tag with **tri-state** boxes (all / some / none of the selected people have it). Tap to toggle, "New tag" at the top, Apply at the bottom.
- **Editor tag field**: a tag picker (search plus colored list plus "Create 'xyz'"). Replaces the free-text input with its overflowing suggestion row.
- **Tags screen** (see §3): list with swatch, name, and count. Tap to edit name and color, merge into another tag, or delete with an in-app confirm. Drag to reorder. Tapping the count opens Contacts filtered by that tag.
- "Save these as a smart directory" shortcut whenever a tag filter is active.

### Files
New: `lib/tagColors.ts`, `components/TagChip.tsx`, `components/TagPicker.tsx`, `components/TagDots.tsx`, `screens/TagsScreen.tsx`.
Changed: `types.ts`, `lib/store.ts` (v3 migration, tag CRUD, `ensureTag`, merge), `lib/sync.ts` (tags row), `lib/importers.ts` (import tag goes through `ensureTag`), `lib/pdf.ts`, `ContactsScreen.tsx`, `ContactEditor.tsx`, `DirectoriesScreen.tsx`, `MenuSheet.tsx` (removed, see §3).

---

## 3. Navigation and menus

### New structure: four tabs, no hamburger
```
[ Contacts ]  [ Lists ]  [ Tags ]  [ Settings ]
```
- **Contacts**: browse, search, filter, add.
- **Lists** (rename "Directories" → "Lists"; shorter, and it's what people call them): smart and saved lists, PDF.
- **Tags**: the tag manager, now a first-class screen and the place to set colors.
- **Settings**: replaces the hamburger sheet, as grouped sections:
  - *Data*: Import contacts · Export all (.vcf) · Back up · Restore from backup
  - *Account*: sync status (the green/amber dot moves here and onto the Settings tab icon) · sign in/out
  - *Appearance*: Light / Dark / System
  - *About*: version, privacy
  - *Danger zone* (visually separated, at the bottom): Delete all data, with an in-app typed confirmation ("type DELETE")

Tab bar: muted icons. The active tab gets a **2px gold bar above the icon** and an `--ink` label. That is the one bit of gold on most screens. On desktop (≥900px) the tab bar becomes a **left sidebar** and the list gets a detail pane on the right (fixes B7).

### Contacts screen header
```
Contact Sheet                [Select] [ + ]
[ Search…                               ]
[• Family] [• School] [• Church] [More…]
```
- **Select** turns on selection mode, iOS-style. Select circles appear only in this mode (they're hidden while browsing), and the header changes to "Cancel · N selected · Select all".
- Remove the always-on "N shown / PDF these" bar. "Make PDF of these 14" moves to a **share/PDF icon** in the header that appears when a filter or search is active, and into Select mode.

### Selection action bar (Select mode)
Compact icon-and-label buttons in one row, sized to fit 390px (fixes B4):
`Tag · List · PDF · More (Export, Delete)`. Delete sits behind "More" so it's never next to the primary action.

### Sheets
- One `Sheet` pattern: **Cancel left, title centered, one primary action right** (royal-bright, bold). No duplicate action buttons in the body.
- Sheets opened from Settings go back to Settings, not to another sheet (fixes B6).
- Replace all `prompt()` / `confirm()` with `<ConfirmSheet>` and `<TextPromptSheet>` (fixes B9).
- Add focus trap, Escape to close, and focus return to the trigger. `Sheet.tsx` currently has none of these.

### Files
New: `screens/SettingsScreen.tsx`, `screens/TagsScreen.tsx`, `components/ConfirmSheet.tsx`, `components/TextPromptSheet.tsx`, `components/TabBar.tsx`.
Changed: `App.tsx` (4 tabs, per-tab state, desktop sidebar), `Sheet.tsx`, `ContactsScreen.tsx` (split: `ContactList`, `FilterBar`, `SelectionBar`), `DirectoriesScreen.tsx` → `ListsScreen.tsx`.
Removed: `components/MenuSheet.tsx` (its logic moves into Settings).

`ContactsScreen.tsx` is 554 lines with 12 `useState`s. Split it into focused components as part of this work, not as a separate refactor.

---

## 4. Phasing

Each phase can ship on its own. The app stays usable between phases.

| Phase | Scope | Size | Notes |
|---|---|---|---|
| **1. Fixes** | B1–B8 | S | CSS and small TSX fixes only. Ship first. |
| **2. Theme** | §1 tokens, flat surfaces, grouped list, dark mode, logo-based icons, PDF colors | M | Colors sampled from the logo. |
| **3. Tag model** | Db v3, migration, tag registry, sync row, backup compatibility | M | No UI change yet. Write migration tests first. |
| **4. Tag UI** | Palette, chips/dots, TagPicker, tri-state bulk tag, multi-filter, Tags screen | L | |
| **5. Navigation** | 4 tabs, Settings, Select mode, action bar, sheet pattern, Confirm/Prompt sheets (B9), desktop sidebar | L | Tags screen from phase 4 slots into a tab. |
| **6. Polish** | Accessibility pass (focus, labels, contrast), empty states, PDF legend, README update | S | |

### Testing
- There are **no tests today**. Add Vitest for `store.ts` (v2→v3 migration, `renameTag`/merge, `deleteTag`, `ensureTag` case handling, backup round-trip) and `importers.ts`.
- Add a Playwright smoke script: phone and desktop screenshots of each tab, light and dark, plus a check that **no page scrolls horizontally** (catches B1/B8-type bugs).

### Housekeeping
- The repo root still has the **legacy vanilla app** (`index.html`, `js/`, `styles.css`, `sw.js`, `vendor/`). Confirm which build Hostinger is serving (`.hostinger/site.json` is `static`). If it's the root, the React app isn't live yet. Decide whether to move the legacy app into `legacy/` once existing installs have migrated.
- `Contacts.md` says the React CRM under `app/` was replaced, and the README says `app/` is active. Make the docs agree.

---

## 5. Decisions needed from you
1. ~~Exact Romulus colors~~: sampled from the logo (§1).
2. Rename **Directories → Lists**? (Recommended.)
3. **Dark mode**: in scope for phase 2, or later?
4. **Tag colors**: auto-assigned with user override (recommended), or the user picks a color every time a tag is created?
5. OK to **remove the always-visible select circles** in favor of a Select mode?
