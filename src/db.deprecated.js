import Dexie from 'dexie';

const db = new Dexie('CardComposerDB');

db.version(1).stores({
  users: 'id, username',
  cards: 'id, userId, type, createdAt',
  templates: 'id, isBuiltin',
  documents: 'id, userId, cardId, templateId, createdAt',
});

// Built-in templates using percentage of A4 page (0-100)
const BUILTIN_TEMPLATES = [
  {
    id: 'tpl-standard-vertical',
    name: 'Standard Vertical',
    description: 'Front on top (25%), back on bottom (75%)',
    isBuiltin: true,
    layout: {
      pageSize: 'A4',
      orientation: 'portrait',
      slots: [
        { type: 'front', cx: 50, cy: 25, maxW: 90, maxH: 45 },
        { type: 'back', cx: 50, cy: 75, maxW: 90, maxH: 45 },
      ],
    },
  },
  {
    id: 'tpl-side-by-side',
    name: 'Side by Side',
    description: 'Front left (25%), back right (75%)',
    isBuiltin: true,
    layout: {
      pageSize: 'A4',
      orientation: 'portrait',
      slots: [
        { type: 'front', cx: 25, cy: 50, maxW: 45, maxH: 90 },
        { type: 'back', cx: 75, cy: 50, maxW: 45, maxH: 90 },
      ],
    },
  },
  {
    id: 'tpl-compact',
    name: 'Compact (Centered)',
    description: 'Smaller card prints clustered in center',
    isBuiltin: true,
    layout: {
      pageSize: 'A4',
      orientation: 'portrait',
      slots: [
        { type: 'front', cx: 50, cy: 35, maxW: 60, maxH: 25 },
        { type: 'back', cx: 50, cy: 65, maxW: 60, maxH: 25 },
      ],
    },
  },
];

export async function seedTemplates() {
  // Always ensure built-in templates are present and updated, and remove orphaned ones.
  await db.transaction('rw', db.templates, async () => {
    const allTemplates = await db.templates.toArray();
    const validIds = BUILTIN_TEMPLATES.map(t => t.id);
    
    // Purge removed builtin templates (like tpl-actual-id)
    for (const tpl of allTemplates) {
      if (tpl.isBuiltin && !validIds.includes(tpl.id)) {
        await db.templates.delete(tpl.id);
      }
    }
    
    // Insert / update current ones
    for (const tpl of BUILTIN_TEMPLATES) {
      await db.templates.put(tpl);
    }
  });
}

export { db, BUILTIN_TEMPLATES };
