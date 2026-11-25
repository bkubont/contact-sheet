import { useState } from 'react';
import { Store } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { toast, uid } from '../lib/util';
import { askConfirm, askText } from '../lib/dialogs';
import type { CategoryDef, TagGroup } from '../types';
import { ColorPill, Dot, SwatchPicker } from '../components/Color';

type Tab = 'groups' | 'categories' | 'tags';

/**
 * Tags tab: tag groups (and their colors), categories, and every tag in one
 * place. Replaces Menu → "Categories & tag groups" and "Manage tags".
 */
export function TagsScreen({ onShowTag }: { onShowTag: (tag: string) => void }) {
  const db = useDb();
  const [tab, setTab] = useState<Tab>('groups');
  const counts = Store.tagCounts();
  const catCounts = Store.categoryCounts();
  const countOf = (t: string) => counts.find(([x]) => x === t)?.[1] ?? 0;

  async function addCategory() {
    const name = await askText({ title: 'New category', label: 'Name', placeholder: 'e.g. Neighbors', confirmLabel: 'Add' });
    if (!name) return;
    Store.upsertCategory({ id: uid(), name, color: Store.nextColor(db.categories.map((c) => c.color)) });
    toast('Category added');
  }
  async function renameCategory(cat: CategoryDef) {
    const name = await askText({ title: 'Rename category', label: 'Name', initial: cat.name });
    if (!name || name === cat.name) return;
    Store.upsertCategory({ ...cat, name });
  }
  async function deleteCategory(cat: CategoryDef) {
    const n = catCounts.find(([id]) => id === cat.id)?.[1] ?? 0;
    const ok = await askConfirm({
      title: `Delete the category “${cat.name}”?`,
      message: n ? `${n} contact${n === 1 ? '' : 's'} will have no category. Nothing else about them changes.` : undefined,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    Store.removeCategory(cat.id);
    toast('Category deleted');
  }

  async function addGroup() {
    const name = await askText({ title: 'New tag group', label: 'Name', placeholder: 'e.g. Hobbies', confirmLabel: 'Add' });
    if (!name) return;
    Store.upsertTagGroup({ id: uid(), name, tags: [], color: Store.nextColor(db.tagGroups.map((g) => g.color)) });
    toast('Group added');
  }
  async function renameGroup(g: TagGroup) {
    const name = await askText({ title: 'Rename group', label: 'Name', initial: g.name });
    if (!name || name === g.name) return;
    Store.upsertTagGroup({ ...g, name });
  }
  async function deleteGroup(g: TagGroup) {
    const ok = await askConfirm({
      title: `Delete the group “${g.name}”?`,
      message: 'Its tags stay on your contacts. They’ll get a color from their name instead.',
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    Store.removeTagGroup(g.id);
    toast('Group deleted');
  }
  async function addTagToGroup(g: TagGroup) {
    const t = await askText({ title: `Add a tag to ${g.name}`, label: 'Tag', placeholder: 'e.g. Golf', confirmLabel: 'Add' });
    if (!t) return;
    if (g.tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    // Reuse the spelling already on contacts, so it's one tag, not two.
    const existing = counts.find(([x]) => x.toLowerCase() === t.toLowerCase())?.[0] ?? t;
    Store.upsertTagGroup({ ...g, tags: [...g.tags, existing] });
  }
  function moveTag(tag: string, toGroupId: string) {
    for (const g of db.tagGroups) {
      if (g.tags.includes(tag) && g.id !== toGroupId) Store.upsertTagGroup({ ...g, tags: g.tags.filter((x) => x !== tag) });
    }
    const to = db.tagGroups.find((g) => g.id === toGroupId);
    if (to && !to.tags.includes(tag)) Store.upsertTagGroup({ ...to, tags: [...to.tags, tag] });
  }
  async function renameTag(t: string) {
    const next = await askText({ title: 'Rename tag', label: 'Tag', initial: t });
    if (!next || next === t) return;
    const merging = counts.some(([x]) => x !== t && x.toLowerCase() === next.toLowerCase());
    if (merging) {
      const ok = await askConfirm({ title: `Merge “${t}” into “${next}”?`, message: 'Everyone tagged with either will have just one tag.', confirmLabel: 'Merge' });
      if (!ok) return;
    }
    Store.renameTag(t, next);
    toast(merging ? 'Tags merged' : 'Tag renamed');
  }
  async function deleteTag(t: string) {
    const n = countOf(t);
    const ok = await askConfirm({
      title: `Delete the tag “${t}”?`,
      message: `It’s removed from ${n} contact${n === 1 ? '' : 's'}${db.tagGroups.some((g) => g.tags.includes(t)) ? ' and from its group' : ''}.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    Store.deleteTag(t);
    toast('Tag deleted');
  }

  // Every tag: on contacts or in a group (a group tag may not be used yet).
  const allTags = [...new Set([...counts.map(([t]) => t), ...db.tagGroups.flatMap((g) => g.tags)])].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' }),
  );

  return (
    <>
      <header className="topbar">
        <div className="topbar-row">
          <span className="logo-tile" aria-hidden="true" />
          <h1 className="brand">
            Tags
            <span>{allTags.length || ''}</span>
          </h1>
          <button
            className="icon-btn accent"
            aria-label={tab === 'categories' ? 'New category' : 'New tag group'}
            onClick={tab === 'categories' ? addCategory : addGroup}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
        <div className="seg" style={{ marginTop: 12 }} role="tablist">
          {(
            [
              ['groups', 'Groups'],
              ['categories', 'Categories'],
              ['tags', 'All tags'],
            ] as [Tab, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="page">
        {tab === 'groups' && (
          <>
            <p className="muted page-note">Tags take their group’s color. A tag in no group gets a color from its name.</p>
            {db.tagGroups.map((g) => (
              <section key={g.id} className="card">
                <div className="card-head">
                  <h3 className="cat-line">
                    <Dot color={g.color} />
                    {g.name}
                  </h3>
                  <button type="button" className="link" onClick={() => renameGroup(g)}>
                    Rename
                  </button>
                  <button type="button" className="link danger" onClick={() => deleteGroup(g)}>
                    Delete
                  </button>
                </div>
                <SwatchPicker label={`Color for ${g.name}`} value={g.color} onChange={(c) => Store.upsertTagGroup({ ...g, color: c })} />
                <div className="pills" style={{ marginTop: 12 }}>
                  {g.tags.map((t) => (
                    <ColorPill key={t} color={g.color} onClick={() => Store.upsertTagGroup({ ...g, tags: g.tags.filter((x) => x !== t) })} title={`Take ${t} out of ${g.name}`}>
                      {t} ×
                    </ColorPill>
                  ))}
                  <button type="button" className="pill add" onClick={() => addTagToGroup(g)}>
                    + Add tag
                  </button>
                </div>
              </section>
            ))}
            {!db.tagGroups.length && <p className="muted">No groups yet. Tap + to make one.</p>}
          </>
        )}

        {tab === 'categories' && (
          <>
            <p className="muted page-note">Each contact can have one category. It colors their row in Contacts.</p>
            {db.categories.map((cat) => {
              const n = catCounts.find(([id]) => id === cat.id)?.[1] || 0;
              return (
                <section key={cat.id} className="card">
                  <div className="card-head">
                    <h3 className="cat-line">
                      <Dot color={cat.color} />
                      {cat.name}
                      <span className="muted card-count">{n}</span>
                    </h3>
                    <button type="button" className="link" onClick={() => renameCategory(cat)}>
                      Rename
                    </button>
                    <button type="button" className="link danger" onClick={() => deleteCategory(cat)}>
                      Delete
                    </button>
                  </div>
                  <SwatchPicker label={`Color for ${cat.name}`} value={cat.color} onChange={(c) => Store.upsertCategory({ ...cat, color: c })} />
                </section>
              );
            })}
            {!db.categories.length && <p className="muted">No categories. Tap + to add one.</p>}
          </>
        )}

        {tab === 'tags' && (
          <>
            {!allTags.length ? (
              <p className="muted page-note">No tags yet. Add tags on a contact, or in a group.</p>
            ) : (
              <div className="settings-group">
                {allTags.map((t) => {
                  const g = db.tagGroups.find((x) => x.tags.includes(t));
                  const n = countOf(t);
                  return (
                    <div key={t} className="tag-row">
                      <Dot color={Store.tagColor(t)} />
                      <div className="tag-row-main">
                        <b>{t}</b>
                        <button type="button" className="link small" disabled={!n} onClick={() => onShowTag(t)}>
                          {n} contact{n === 1 ? '' : 's'}
                        </button>
                      </div>
                      <select aria-label={`Group for ${t}`} value={g?.id ?? ''} onChange={(e) => moveTag(t, e.target.value)}>
                        <option value="">No group</option>
                        {db.tagGroups.map((x) => (
                          <option key={x.id} value={x.id}>
                            {x.name}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="icon-btn small" aria-label={`Rename ${t}`} onClick={() => renameTag(t)}>
                        <svg viewBox="0 0 24 24">
                          <path d="M4 20h4l10-10-4-4L4 16v4z" />
                        </svg>
                      </button>
                      <button type="button" className="icon-btn small danger" aria-label={`Delete ${t}`} onClick={() => deleteTag(t)}>
                        <svg viewBox="0 0 24 24">
                          <path d="M6 7h12M9 7V5h6v2M8 7l1 12h6l1-12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
