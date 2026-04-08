import { create } from 'zustand';
import { apiFetch } from '../api/client';

// ==============================
// Auth Store
// ==============================
export const useAuthStore = create((set, get) => ({
  currentUser: null,
  loading: true,
  error: null,

  initialize: () => {
    const sessionStr = localStorage.getItem('cardcomposer_session');
    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        if (session.token && session.username && session.userId) {
          set({ currentUser: { id: session.userId, username: session.username }, loading: false });
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
    try {
      const res = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      return { success: true, ...res };
    } catch (err) {
      set({ error: err.message });
      return { success: false };
    }
  },

  completeLogin: (token, user) => {
    localStorage.setItem('cardcomposer_session', JSON.stringify({ 
      token, 
      userId: user.id, 
      username: user.username 
    }));
    set({ currentUser: user, error: null });
  },

  login: async (username, password) => {
    set({ error: null });
    try {
      const res = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password })
      });
      localStorage.setItem('cardcomposer_session', JSON.stringify({ 
        token: res.token, 
        userId: res.user.id, 
        username: res.user.username 
      }));
      set({ currentUser: res.user, error: null });
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },
  
  recoverPassword: async (username, recoveryCode, newPassword) => {
    set({ error: null });
    try {
      await apiFetch('/auth/recover', {
        method: 'POST',
        body: JSON.stringify({ username, recoveryCode, newPassword })
      });
      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
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

  loadCards: async () => {
    set({ loading: true });
    try {
      const cards = await apiFetch('/cards');
      
      // We don't fetch full Blobs anymore. The images will just use the API streams.
      // But we map them so the frontend interface remains mostly similar.
      const mappedCards = cards.map(c => ({
        ...c,
        frontThumbUrl: `/api/cards/${c.id}/front/thumb`,
        backThumbUrl: `/api/cards/${c.id}/back/thumb`,
        frontImageUrl: `/api/cards/${c.id}/front`,
        backImageUrl: `/api/cards/${c.id}/back`,
        // We shim frontThumb to avoid breaking existing React code expecting a Blob URL,
        // though Ideally React components should just render <img src={card.frontThumbUrl} />
        // Wait, the client code expects frontThumb to be a property, let's just keep the API URL
      }));
      set({ cards: mappedCards, loading: false });
    } catch (err) {
      console.error(err);
      set({ loading: false });
    }
  },

  addCard: async ({ type, customType, label, frontImage, backImage }) => {
    try {
      const formData = new FormData();
      formData.append('type', type);
      if (customType) formData.append('customType', customType);
      formData.append('label', label);
      formData.append('front', frontImage);
      formData.append('back', backImage);

      const session = JSON.parse(localStorage.getItem('cardcomposer_session'));

      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}` // let fetch generate multipart boundaries
        },
        body: formData
      });
      
      if (!res.ok) throw new Error(await res.text());
      const card = await res.json();
      
      const mappedCard = {
        ...card,
        frontThumbUrl: `/api/cards/${card.id}/front/thumb`,
        backThumbUrl: `/api/cards/${card.id}/back/thumb`,
        frontImageUrl: `/api/cards/${card.id}/front`,
        backImageUrl: `/api/cards/${card.id}/back`,
      };

      set((state) => ({ cards: [mappedCard, ...state.cards] }));
      return mappedCard;
    } catch (err) {
      console.error(err);
      throw err;
    }
  },

  deleteCard: async (cardId) => {
    await apiFetch(`/cards/${cardId}`, { method: 'DELETE' });
    set((state) => ({ cards: state.cards.filter((c) => c.id !== cardId) }));
  },

  getCard: async (cardId) => {
    const card = await apiFetch(`/cards/${cardId}`);
    return {
      ...card,
      frontThumbUrl: `/api/cards/${card.id}/front/thumb`,
      backThumbUrl: `/api/cards/${card.id}/back/thumb`,
      frontImageUrl: `/api/cards/${card.id}/front`,
      backImageUrl: `/api/cards/${card.id}/back`,
    };
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
    try {
      const templates = await apiFetch('/templates');
      set({ templates, loading: false });
    } catch (err) {
      console.error(err);
      set({ loading: false });
    }
  },
}));

// ==============================
// Documents Store
// ==============================
export const useDocumentsStore = create((set, get) => ({
  documents: [],
  loading: false,

  loadDocuments: async () => {
    set({ loading: true });
    try {
      const documents = await apiFetch('/documents');
      set({ documents, loading: false });
    } catch(err) {
      console.error(err);
      set({ loading: false });
    }
  },

  addDocument: async (doc) => {
    const document = await apiFetch('/documents', {
      method: 'POST',
      body: JSON.stringify(doc)
    });
    set((state) => ({ documents: [document, ...state.documents] }));
    return document;
  },

  updateDocument: async (docId, updates) => {
    const document = await apiFetch(`/documents/${docId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
    set((state) => ({
      documents: state.documents.map((d) => (d.id === docId ? document : d)),
    }));
  },

  deleteDocument: async (docId) => {
    await apiFetch(`/documents/${docId}`, { method: 'DELETE' });
    set((state) => ({ documents: state.documents.filter((d) => d.id !== docId) }));
  },

  getDocument: async (docId) => {
    // We can just find it in the state instead of network call for now
    const state = get();
    return state.documents.find(d => d.id === docId) || null;
  },
}));

// ==============================
// Toast Store (Unchanged)
// ==============================
export const useToastStore = create((set) => ({
  toasts: [],

  addToast: (message, type = 'info') => {
    const id = Date.now().toString() + Math.random().toString();
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
