import Dexie from 'dexie';

const db = new Dexie('CardComposerDB');

db.version(1).stores({
  users: 'id, username',
  cards: 'id, userId, type, createdAt',
  templates: 'id, isBuiltin',
  documents: 'id, userId, cardId, templateId, createdAt',
});

// Built-in templates
const BUILTIN_TEMPLATES = [
  {
    id: 'tpl-standard-vertical',
    name: 'Standard Vertical',
    description: 'Front on top, back on bottom — fits most use cases',
    isBuiltin: true,
    layout: {
      pageSize: 'A4',
      orientation: 'portrait',
      margins: { top: 15, right: 15, bottom: 15, left: 15 },
      slots: [
        { type: 'front', x: 15, y: 15, maxWidth: 180, maxHeight: 120 },
        { type: 'back', x: 15, y: 145, maxWidth: 180, maxHeight: 120 },
      ],
    },
  },
  {
    id: 'tpl-side-by-side',
    name: 'Side by Side',
    description: 'Front left, back right — landscape-style layout',
    isBuiltin: true,
    layout: {
      pageSize: 'A4',
      orientation: 'portrait',
      margins: { top: 15, right: 15, bottom: 15, left: 15 },
      slots: [
        { type: 'front', x: 15, y: 15, maxWidth: 87, maxHeight: 267 },
        { type: 'back', x: 108, y: 15, maxWidth: 87, maxHeight: 267 },
      ],
    },
  },
  {
    id: 'tpl-compact',
    name: 'Compact (Small)',
    description: 'Smaller card prints centered on A4',
    isBuiltin: true,
    layout: {
      pageSize: 'A4',
      orientation: 'portrait',
      margins: { top: 20, right: 30, bottom: 20, left: 30 },
      slots: [
        { type: 'front', x: 30, y: 20, maxWidth: 150, maxHeight: 100 },
        { type: 'back', x: 30, y: 130, maxWidth: 150, maxHeight: 100 },
      ],
    },
  },
];

export async function seedTemplates() {
  const count = await db.templates.count();
  if (count === 0) {
    await db.templates.bulkAdd(BUILTIN_TEMPLATES);
  }
}

export { db, BUILTIN_TEMPLATES };
