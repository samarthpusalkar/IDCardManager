import { create } from 'zustand';
import { db, seedTemplates } from '../db';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

// ==============================
// Auth Store
// ==============================
export const useAuthStore = create((set, get) => ({
  currentUser: null,
  loading: true,
  error: null,

  initialize: async () => {
    const sessionStr = localStorage.getItem('cardcomposer_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        const user = await db.users.get(session.userId);
        if (user) {
          set({ currentUser: { id: user.id, username: user.username }, loading: false });
          return;
        }
      } catch (e) {
        localStorage.removeItem('cardcomposer_session');
      }
    }
    set({ loading: false });
  },

  register: async (username, password) => {
    set({ error: null });
    const trimmed = username.trim().toLowerCase();
    if (!trimmed || !password) {
      set({ error: 'Username and password are required' });
      return false;
    }
    if (password.length < 4) {
      set({ error: 'Password must be at least 4 characters' });
      return false;
    }
    const existing = await db.users.where('username').equals(trimmed).first();
    if (existing) {
      set({ error: 'Username already exists' });
      return false;
    }
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    const user = {
      id: uuidv4(),
      username: trimmed,
      passwordHash: hash,
      createdAt: Date.now(),
    };
    await db.users.add(user);
    localStorage.setItem('cardcomposer_session', JSON.stringify({ userId: user.id }));
    set({ currentUser: { id: user.id, username: user.username }, error: null });
    return true;
  },

  login: async (username, password) => {
    set({ error: null });
    const trimmed = username.trim().toLowerCase();
    const user = await db.users.where('username').equals(trimmed).first();
    if (!user) {
      set({ error: 'Invalid username or password' });
      return false;
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      set({ error: 'Invalid username or password' });
      return false;
    }
    localStorage.setItem('cardcomposer_session', JSON.stringify({ userId: user.id }));
    set({ currentUser: { id: user.id, username: user.username }, error: null });
    return true;
  },

  logout: () => {
    localStorage.removeItem('cardcomposer_session');
    set({ currentUser: null, error: null });
  },
}));

// ==============================
// Cards Store
// ==============================
export const useCardsStore = create((set, get) => ({
  cards: [],
  loading: false,

  loadCards: async (userId) => {
    set({ loading: true });
    const cards = await db.cards.where('userId').equals(userId).reverse().sortBy('createdAt');
    set({ cards, loading: false });
  },

  addCard: async ({ userId, type, customType, label, frontImage, backImage }) => {
    const frontThumb = await createThumbnail(frontImage, 200);
    const backThumb = await createThumbnail(backImage, 200);
    const aspectRatio = await getImageAspectRatio(frontImage);

    const card = {
      id: uuidv4(),
      userId,
      type,
      customType: customType || null,
      label,
      frontImage,
      backImage,
      frontThumb,
      backThumb,
      aspectRatio,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.cards.add(card);
    set((state) => ({ cards: [card, ...state.cards] }));
    return card;
  },

  deleteCard: async (cardId) => {
    await db.cards.delete(cardId);
    // Also delete documents referencing this card
    await db.documents.where('cardId').equals(cardId).delete();
    set((state) => ({ cards: state.cards.filter((c) => c.id !== cardId) }));
  },

  getCard: async (cardId) => {
    return await db.cards.get(cardId);
  },
}));

// ==============================
// Templates Store
// ==============================
export const useTemplatesStore = create((set, get) => ({
  templates: [],
  loading: false,

  loadTemplates: async () => {
    set({ loading: true });
    await seedTemplates();
    const templates = await db.templates.toArray();
    set({ templates, loading: false });
  },
}));

// ==============================
// Documents Store
// ==============================
export const useDocumentsStore = create((set, get) => ({
  documents: [],
  loading: false,

  loadDocuments: async (userId) => {
    set({ loading: true });
    const documents = await db.documents.where('userId').equals(userId).reverse().sortBy('createdAt');
    set({ documents, loading: false });
  },

  addDocument: async (doc) => {
    const document = {
      id: uuidv4(),
      ...doc,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.documents.add(document);
    set((state) => ({ documents: [document, ...state.documents] }));
    return document;
  },

  updateDocument: async (docId, updates) => {
    await db.documents.update(docId, { ...updates, updatedAt: Date.now() });
    set((state) => ({
      documents: state.documents.map((d) =>
        d.id === docId ? { ...d, ...updates, updatedAt: Date.now() } : d
      ),
    }));
  },

  deleteDocument: async (docId) => {
    await db.documents.delete(docId);
    set((state) => ({ documents: state.documents.filter((d) => d.id !== docId) }));
  },

  getDocument: async (docId) => {
    return await db.documents.get(docId);
  },
}));

// ==============================
// Toast Store
// ==============================
export const useToastStore = create((set) => ({
  toasts: [],

  addToast: (message, type = 'info') => {
    const id = uuidv4();
    set((state) => ({
      toasts: [...state.toasts, { id, message, type }],
    }));
    setTimeout(() => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    }, 4000);
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },
}));

// ==============================
// Utility Functions
// ==============================
function createThumbnail(blob, maxWidth) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const scale = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob((thumbBlob) => {
        URL.revokeObjectURL(url);
        resolve(thumbBlob);
      }, 'image/jpeg', 0.7);
    };
    img.src = url;
  });
}

function getImageAspectRatio(blob) {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img.width / img.height);
    };
    img.src = url;
  });
}
