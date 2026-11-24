import { useState } from 'react';
import { Store } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { toast } from '../lib/util';
import { Sheet } from './Sheet';
import type { CategoryDef, TagGroup } from '../types';
import type { ColorKey } from '../lib/palette';
import { ColorPill, Dot, SwatchPicker } from './Color';

function newId() {
  return crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function GroupsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const db = useDb();
  const [tab, setTab] = useState<'categories' | 'groups' | 'tags'>('categories');
  const counts = Store.tagCounts();
  const catCounts = Store.categoryCounts();

  function addCategory() {
    const name = prompt('Category name');
    if (!name?.trim()) return;
    Store.upsertCategory({
      id: newId(),
      name: name.trim(),
      color: Store.nextColor(db.categories.map((c) => c.color)),
    });
    toast('Category added');
  }

  function editCategory(cat: CategoryDef) {
    const name = prompt('Rename category', cat.name);
    if (!name?.trim() || name.trim() === cat.name) return;
    Store.upsertCategory({ ...cat, name: name.trim() });
    toast('Category renamed');
  }

  function setColor(cat: CategoryDef, color: ColorKey) {
    Store.upsertCategory({ ...cat, color });
  }

  function addGroup() {
    const name = prompt('Tag group name (e.g. Relationship)');
    if (!name?.trim()) return;
    Store.upsertTagGroup({ id: newId(), name: name.trim(), tags: [], color: Store.nextColor(db.tagGroups.map((g) => g.color)) });
    toast('Group added');
  }

  function renameGroup(g: TagGroup) {
    const name = prompt('Rename group', g.name);
    if (!name?.trim() || name.trim() === g.name) return;
    Store.upsertTagGroup({ ...g, name: name.trim() });
    toast('Group renamed');
  }

  function addTagToGroup(g: TagGroup) {
    const tag = prompt(`Add tag to “${g.name}”`);
    if (!tag?.trim()) return;
    const t = tag.trim();
    if (g.tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    Store.upsertTagGroup({ ...g, tags: [...g.tags, t] });
    toast('Tag added to group');
  }

  function removeTagFromGroup(g: TagGroup, tag: string) {
    Store.upsertTagGroup({ ...g, tags: g.tags.filter((t) => t !== tag) });
  }

  return (
    <Sheet open={open} title="Categories & groups" onClose={onClose}>
      <div className="seg" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
        <button type="button" className={tab === 'categories' ? 'on' : ''} onClick={() => setTab('categories')}>
          Categories
        </button>
        <button type="button" className={tab === 'groups' ? 'on' : ''} onClick={() => setTab('groups')}>
          Tag groups
        </button>
        <button type="button" className={tab === 'tags' ? 'on' : ''} onClick={() => setTab('tags')}>
          All tags
        </button>
      </div>

      {tab === 'categories' && (
        <>
          <p className="muted">Each contact has one primary category — like a folder.</p>
          {db.categories.map((cat) => {
            const n = catCounts.find(([id]) => id === cat.id)?.[1] || 0;
            return (
              <div key={cat.id} className="tag-group-block">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div>
                    <div className="row-name cat-line">
                      <Dot color={cat.color} />
                      {cat.name}
                    </div>
                    <div className="row-meta">
                      {n} contact{n === 1 ? '' : 's'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button type="button" className="btn" onClick={() => editCategory(cat)}>
                      Rename
                    </button>
                    <button
                      type="button"
                      className="btn danger"
                      onClick={() => {
                        if (confirm(`Delete category “${cat.name}”? Contacts keep their other data.`)) {
                          Store.removeCategory(cat.id);
                          toast('Category deleted');
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <div style={{ marginTop: 10 }}>
                  <SwatchPicker label={`Color for ${cat.name}`} value={cat.color} onChange={(c) => setColor(cat, c)} />
                </div>
              </div>
            );
          })}
          <button type="button" className="btn primary wide" onClick={addCategory}>
            Add category
          </button>
        </>
      )}

      {tab === 'groups' && (
        <>
          <p className="muted">Organize tags into groups. Contacts can use tags from many groups.</p>
          {db.tagGroups.map((g) => (
            <div key={g.id} className="tag-group-block">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <h4 style={{ margin: 0 }} className="cat-line">
                  <Dot color={g.color} />
                  {g.name}
                </h4>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button type="button" className="btn" onClick={() => renameGroup(g)}>
                    Rename
                  </button>
                  <button
                    type="button"
                    className="btn danger"
                    onClick={() => {
                      if (confirm(`Delete group “${g.name}”? Tags on contacts stay.`)) {
                        Store.removeTagGroup(g.id);
                        toast('Group deleted');
                      }
                    }}
                  >
                    Delete
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 10 }}>
                <SwatchPicker
                  label={`Color for ${g.name}`}
                  value={g.color}
                  onChange={(c) => Store.upsertTagGroup({ ...g, color: c })}
                />
              </div>
              <div className="pills" style={{ marginTop: 10 }}>
                {g.tags.map((t) => (
                  <ColorPill key={t} color={g.color} onClick={() => removeTagFromGroup(g, t)} title={`Remove ${t} from ${g.name}`}>
                    {t} ×
                  </ColorPill>
                ))}
              </div>
              <button type="button" className="link" onClick={() => addTagToGroup(g)}>
                + Add tag to group
              </button>
            </div>
          ))}
          <button type="button" className="btn primary wide" onClick={addGroup}>
            Add tag group
          </button>
        </>
      )}

      {tab === 'tags' && (
        <>
          {!counts.length ? (
            <p className="muted">No tags yet. Add tags on contacts or in a tag group.</p>
          ) : (
            counts.map(([t, n]) => (
              <div key={t} className="row" style={{ gridTemplateColumns: '1fr auto auto', margin: '0 0 8px' }}>
                <div>
                  <div className="row-name cat-line">
                    <Dot color={Store.tagColor(t)} />
                    {t}
                  </div>
                  <div className="row-meta">
                    {n} contact{n === 1 ? '' : 's'}
                    {' · '}
                    {db.tagGroups.find((g) => g.tags.includes(t))?.name ?? 'no group (color from its name)'}
                  </div>
                </div>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    const next = prompt('Rename tag', t);
                    if (next && next.trim() && next.trim() !== t) {
                      Store.renameTag(t, next.trim());
                      toast('Tag renamed');
                    }
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="btn danger"
                  onClick={() => {
                    if (confirm(`Remove tag “${t}” from everyone?`)) {
                      Store.deleteTag(t);
                      toast('Tag removed');
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            ))
          )}
        </>
      )}
    </Sheet>
  );
}
