import { useState } from 'react';
import { Store } from '../lib/store';
import { useDb } from '../hooks/useStore';
import { toast } from '../lib/util';
import { Sheet } from './Sheet';
import type { CategoryDef, TagGroup } from '../types';

const COLOR_PRESETS = ['#1E3A8A', '#1D4ED8', '#D97706', '#B45309', '#F59E0B', '#0F766E', '#7C3AED', '#64748B'];

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
      color: COLOR_PRESETS[db.categories.length % COLOR_PRESETS.length],
    });
    toast('Category added');
  }

  function editCategory(cat: CategoryDef) {
    const name = prompt('Rename category', cat.name);
    if (!name?.trim() || name.trim() === cat.name) return;
    Store.upsertCategory({ ...cat, name: name.trim() });
    toast('Category renamed');
  }

  function setColor(cat: CategoryDef, color: string) {
    Store.upsertCategory({ ...cat, color });
  }

  function addGroup() {
    const name = prompt('Tag group name (e.g. Relationship)');
    if (!name?.trim()) return;
    Store.upsertTagGroup({ id: newId(), name: name.trim(), tags: [] });
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
                    <div className="row-name" style={{ color: cat.color }}>
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
                <div className="suggest" style={{ marginTop: 8 }}>
                  {COLOR_PRESETS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Color ${c}`}
                      onClick={() => setColor(cat, c)}
                      style={{
                        width: 28,
                        height: 28,
                        padding: 0,
                        borderRadius: 4,
                        background: c,
                        border: cat.color === c ? '2px solid var(--text)' : '1px solid transparent',
                      }}
                    />
                  ))}
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
                <h4 style={{ margin: 0 }}>{g.name}</h4>
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
              <div className="pills" style={{ marginTop: 8 }}>
                {g.tags.map((t) => (
                  <button key={t} type="button" className="pill x" onClick={() => removeTagFromGroup(g, t)}>
                    {t}
                  </button>
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
                  <div className="row-name">{t}</div>
                  <div className="row-meta">
                    {n} contact{n === 1 ? '' : 's'}
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
