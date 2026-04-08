import { create } from 'zustand';
import { apiFetch } from '../api/client';
import * as crypto from '../api/crypto';

// Cache for decrypted images to avoid re-decrypting
const imageCache = new Map();
const SESSION_VAULT_KEY = 'cardcomposer_session_vault_key';

function normalizeCard(card) {
  return {
    ...card,
    customType: card.customType ?? card.custom_type ?? null,
    createdAt: card.createdAt ?? card.created_at,
    updatedAt: card.updatedAt ?? card.updated_at,
    frontIv: card.frontIv ?? card.front_iv,
    backIv: card.backIv ?? card.back_iv,
    frontThumbIv: card.frontThumbIv ?? card.front_thumb_iv,
    backThumbIv: card.backThumbIv ?? card.back_thumb_iv,
    frontThumbUrl: `/api/cards/${card.id}/front/thumb`,
    backThumbUrl: `/api/cards/${card.id}/back/thumb`,
    frontImageUrl: `/api/cards/${card.id}/front`,
    backImageUrl: `/api/cards/${card.id}/back`,
  };
}

// ==============================
// Auth Store
// ==============================
export const useAuthStore = create((set, get) => ({
  currentUser: null,
  vaultKey: null,
  encryptedVaultKey: null,
  loading: true,
  error: null,

  // Initialize persisted session/envelope state.
  initialize: async () => {
    const sessionStr = localStorage.getItem('cardcomposer_session');
    const vaultEnvelopeStr = localStorage.getItem('cardcomposer_vault_envelope');
    const sessionVaultKeyRaw = sessionStorage.getItem(SESSION_VAULT_KEY);

    if (sessionStr) {
      try {
        const session = JSON.parse(sessionStr);
        const envelope = vaultEnvelopeStr ? JSON.parse(vaultEnvelopeStr) : null;
        if (session.token && session.username && session.userId) {
          let vaultKey = null;
          if (sessionVaultKeyRaw) {
            try {
              vaultKey = await crypto.importVaultKey(sessionVaultKeyRaw);
            } catch (err) {
              console.error('Failed to import session vault key:', err);
              sessionStorage.removeItem(SESSION_VAULT_KEY);
            }
          }
          set({
            currentUser: { id: session.userId, username: session.username },
            vaultKey,
            encryptedVaultKey: envelope,
            loading: false,
          });
          return;
        }
      } catch (e) {
        console.error('Failed to initialize vault:', e);
        localStorage.removeItem('cardcomposer_session');
        localStorage.removeItem('cardcomposer_vault_envelope');
        localStorage.removeItem('cardcomposer_recovery_code');
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
      const vaultKey = await crypto.generateVaultKey();
      const envelope = await crypto.createVaultKeyEnvelope(vaultKey, password);
      const recoveryEnvelope = await crypto.createVaultKeyEnvelope(vaultKey, res.recoveryCode);
      await apiFetch('/auth/vault-key', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${res.token}` },
        body: JSON.stringify({
          ...envelope,
          recoveryEncryptedVaultKey: recoveryEnvelope.encryptedVaultKey,
          recoveryEncryptedVaultKeyIv: recoveryEnvelope.encryptedVaultKeyIv,
          recoveryEncryptedVaultKeySalt: recoveryEnvelope.encryptedVaultKeySalt,
        }),
      });

      localStorage.setItem('cardcomposer_vault_envelope', JSON.stringify(envelope));
      sessionStorage.setItem(SESSION_VAULT_KEY, await crypto.exportVaultKey(vaultKey));
      set({ vaultKey, encryptedVaultKey: envelope, error: null });

      return { success: true, ...res };
    } catch (err) {
      set({ error: err.message });
      return { success: false };
    }
  },

  completeLogin: async (token, user) => {
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

      const envelope = {
        encryptedVaultKey: res.encryptedVaultKey,
        encryptedVaultKeyIv: res.encryptedVaultKeyIv,
        encryptedVaultKeySalt: res.encryptedVaultKeySalt,
      };
      const vaultKey = await crypto.decryptVaultKeyEnvelope(envelope, password);

      localStorage.setItem('cardcomposer_vault_envelope', JSON.stringify(envelope));
      sessionStorage.setItem(SESSION_VAULT_KEY, await crypto.exportVaultKey(vaultKey));
      set({ currentUser: res.user, vaultKey, encryptedVaultKey: envelope, error: null });

      return true;
    } catch (err) {
      set({ error: err.message });
      return false;
    }
  },

  recoverPassword: async (username, recoveryCode, newPassword) => {
    set({ error: null });
    try {
      const res = await apiFetch('/auth/recover', {
        method: 'POST',
        body: JSON.stringify({ username, recoveryCode, newPassword })
      });

      const envelope = {
        encryptedVaultKey: res.recoveryEncryptedVaultKey,
        encryptedVaultKeyIv: res.recoveryEncryptedVaultKeyIv,
        encryptedVaultKeySalt: res.recoveryEncryptedVaultKeySalt,
      };
      const vaultKey = await crypto.decryptVaultKeyEnvelope(envelope, recoveryCode);
      const passwordEnvelope = await crypto.createVaultKeyEnvelope(vaultKey, newPassword);
      await apiFetch('/auth/vault-key', {
        method: 'PUT',
        headers: { Authorization: `Bearer ${res.token}` },
        body: JSON.stringify({
          ...passwordEnvelope,
          recoveryEncryptedVaultKey: envelope.encryptedVaultKey,
          recoveryEncryptedVaultKeyIv: envelope.encryptedVaultKeyIv,
          recoveryEncryptedVaultKeySalt: envelope.encryptedVaultKeySalt,
        }),
      });
      localStorage.setItem('cardcomposer_vault_envelope', JSON.stringify(passwordEnvelope));
      localStorage.setItem('cardcomposer_session', JSON.stringify({
        token: res.token,
        userId: res.user.id,
        username: res.user.username,
      }));
      sessionStorage.setItem(SESSION_VAULT_KEY, await crypto.exportVaultKey(vaultKey));
      set({ currentUser: res.user, vaultKey, encryptedVaultKey: passwordEnvelope, error: null });
      return { success: true, vaultKey };
    } catch (err) {
      set({ error: err.message });
      return { success: false };
    }
  },

  // Getter to retrieve the current vault key
  getVaultKey: () => get().vaultKey,

  logout: () => {
    localStorage.removeItem('cardcomposer_session');
    localStorage.removeItem('cardcomposer_vault_envelope');
    sessionStorage.removeItem(SESSION_VAULT_KEY);
    // Revoke all cached blob URLs
    imageCache.forEach((url) => URL.revokeObjectURL(url));
    imageCache.clear();
    set({ currentUser: null, vaultKey: null, encryptedVaultKey: null, error: null });
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
      const mappedCards = cards.map(normalizeCard);
      set({ cards: mappedCards, loading: false });
    } catch (err) {
      console.error(err);
      set({ loading: false });
    }
  },

  // Decrypt a thumbnail image from the API and return a Blob URL
  decryptThumbnail: async (cardId, side, iv) => {
    const vaultKey = useAuthStore.getState().vaultKey;
    if (!vaultKey) {
      throw new Error('Vault key not available');
    }

    const cacheKey = `${cardId}_${side}_thumb_${iv}`;
    if (imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey);
    }

    const res = await apiFetch(`/cards/${cardId}/${side}/thumb`);
    const encryptedBlob = await res.blob();
    const decryptedBlob = await crypto.decryptBlob(encryptedBlob, iv, vaultKey);
    const blobUrl = URL.createObjectURL(decryptedBlob);

    imageCache.set(cacheKey, blobUrl);
    return blobUrl;
  },

  // Decrypt a full image from the API and return a Blob URL
  decryptFullImage: async (cardId, side, iv) => {
    const vaultKey = useAuthStore.getState().vaultKey;
    if (!vaultKey) {
      throw new Error('Vault key not available');
    }

    const cacheKey = `${cardId}_${side}_${iv}`;
    if (imageCache.has(cacheKey)) {
      return imageCache.get(cacheKey);
    }

    const res = await apiFetch(`/cards/${cardId}/${side}`);
    const encryptedBlob = await res.blob();
    const decryptedBlob = await crypto.decryptBlob(encryptedBlob, iv, vaultKey);
    const blobUrl = URL.createObjectURL(decryptedBlob);

    imageCache.set(cacheKey, blobUrl);
    return blobUrl;
  },

  addCard: async ({ type, customType, label, frontImage, backImage }) => {
    const vaultKey = useAuthStore.getState().vaultKey;
    if (!vaultKey) {
      throw new Error('Vault key not available. Please log in again.');
    }

    try {
      // Resize and encrypt images on the client
      const resizeWidth = 2000; // Max width for resized images

      // Process front image
      const frontResized = await crypto.resizeImageLocally(frontImage, resizeWidth);
      const frontEncrypted = await crypto.encryptBlob(frontResized.blob, vaultKey);

      // Process back image
      const backResized = await crypto.resizeImageLocally(backImage, resizeWidth);
      const backEncrypted = await crypto.encryptBlob(backResized.blob, vaultKey);

      // Create thumbnails from resized images (smaller max width for thumbnails)
      const thumbResized = await crypto.resizeImageLocally(frontResized.blob, 100);
      const frontThumbEncrypted = await crypto.encryptBlob(thumbResized.blob, vaultKey);

      const backThumbResized = await crypto.resizeImageLocally(backResized.blob, 100);
      const backThumbEncrypted = await crypto.encryptBlob(backThumbResized.blob, vaultKey);

      const formData = new FormData();
      formData.append('type', type);
      if (customType) formData.append('customType', customType);
      formData.append('label', label);
      formData.append('frontIv', frontEncrypted.ivHex);
      formData.append('backIv', backEncrypted.ivHex);
      formData.append('frontThumbIv', frontThumbEncrypted.ivHex);
      formData.append('backThumbIv', backThumbEncrypted.ivHex);

      // Append encrypted blobs as files
      formData.append('frontImg', frontEncrypted.encryptedBlob, 'front.enc');
      formData.append('backImg', backEncrypted.encryptedBlob, 'back.enc');
      formData.append('frontThumb', frontThumbEncrypted.encryptedBlob, 'front_thumb.enc');
      formData.append('backThumb', backThumbEncrypted.encryptedBlob, 'back_thumb.enc');

      const session = JSON.parse(localStorage.getItem('cardcomposer_session'));

      const res = await fetch('/api/cards', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.token}`
        },
        body: formData
      });

      if (!res.ok) throw new Error(await res.text());
      const card = await res.json();

      const mappedCard = normalizeCard(card);

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
    return normalizeCard(card);
  },

  // Get a card with decrypted front image as a Blob URL
  getCardWithFrontImage: async (cardId) => {
    const card = normalizeCard(await apiFetch(`/cards/${cardId}`));
    const vaultKey = useAuthStore.getState().vaultKey;
    if (!vaultKey) {
      throw new Error('Vault key not available');
    }

    // Check cache first
    const cacheKey = `${cardId}_front_${card.frontIv}`;
    if (imageCache.has(cacheKey)) {
      return { ...card, frontImageBlobUrl: imageCache.get(cacheKey) };
    }

    // Fetch and decrypt
    const res = await apiFetch(`/cards/${cardId}/front`);
    const encryptedBlob = await res.blob();
    const decryptedBlob = await crypto.decryptBlob(encryptedBlob, card.frontIv, vaultKey);
    const blobUrl = URL.createObjectURL(decryptedBlob);

    // Cache for future use
    imageCache.set(cacheKey, blobUrl);

    return { ...card, frontImageBlobUrl: blobUrl };
  },

  // Get a card with decrypted back image as a Blob URL
  getCardWithBackImage: async (cardId) => {
    const card = normalizeCard(await apiFetch(`/cards/${cardId}`));
    const vaultKey = useAuthStore.getState().vaultKey;
    if (!vaultKey) {
      throw new Error('Vault key not available');
    }

    // Check cache first
    const cacheKey = `${cardId}_back_${card.backIv}`;
    if (imageCache.has(cacheKey)) {
      return { ...card, backImageBlobUrl: imageCache.get(cacheKey) };
    }

    // Fetch and decrypt
    const res = await apiFetch(`/cards/${cardId}/back`);
    const encryptedBlob = await res.blob();
    const decryptedBlob = await crypto.decryptBlob(encryptedBlob, card.backIv, vaultKey);
    const blobUrl = URL.createObjectURL(decryptedBlob);

    // Cache for future use
    imageCache.set(cacheKey, blobUrl);

    return { ...card, backImageBlobUrl: blobUrl };
  },
}));

// ==============================
// Templates Store
// ==============================
export const useTemplatesStore = create((set) => ({
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
