// crypto.js: Web Crypto API wrapper for Zero-Knowledge End-to-End Encryption

const PBKDF2_ITERATIONS = 100000;
const AES_KEY_LENGTH = 256;

function getWebCrypto() {
  const webCrypto = globalThis.crypto;
  if (!webCrypto || !webCrypto.subtle) {
    throw new Error('Web Crypto unavailable. Use HTTPS (or localhost) in a modern browser.');
  }
  return webCrypto;
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex) {
  const pairs = hex?.match(/.{1,2}/g) || [];
  return new Uint8Array(pairs.map((byte) => parseInt(byte, 16)));
}

/**
 * Derives an AES-GCM 256-bit Vault Key from a password and salt using PBKDF2.
 */
export async function deriveVaultKey(password, saltHex) {
  const wc = getWebCrypto();
  const enc = new TextEncoder();
  const passwordKey = await wc.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return wc.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function generateVaultKey() {
  const wc = getWebCrypto();
  return wc.subtle.generateKey(
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

export async function exportVaultKey(vaultKey) {
  const wc = getWebCrypto();
  const raw = new Uint8Array(await wc.subtle.exportKey('raw', vaultKey));
  return bytesToHex(raw);
}

export async function importVaultKey(rawHex) {
  const wc = getWebCrypto();
  return wc.subtle.importKey(
    'raw',
    hexToBytes(rawHex),
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a Blob/File using the Vault Key.
 * Returns { encryptedBlob, ivHex }
 */
export async function encryptBlob(blob, vaultKey) {
  const wc = getWebCrypto();
  const iv = wc.getRandomValues(new Uint8Array(12));
  const buffer = await blob.arrayBuffer();
  const encryptedBuffer = await wc.subtle.encrypt({ name: 'AES-GCM', iv }, vaultKey, buffer);
  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
    ivHex: bytesToHex(iv),
  };
}

/**
 * Decrypts a Blob using the Vault Key and IV.
 */
export async function decryptBlob(encryptedBlob, ivHex, vaultKey) {
  const wc = getWebCrypto();
  const buffer = await encryptedBlob.arrayBuffer();
  const decryptedBuffer = await wc.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(ivHex) },
    vaultKey,
    buffer
  );
  return new Blob([decryptedBuffer], { type: 'image/jpeg' });
}

async function deriveRecoveryWrappingKey(recoveryCode, saltHex) {
  const wc = getWebCrypto();
  const baseKey = await wc.subtle.importKey(
    'raw',
    new TextEncoder().encode(recoveryCode),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return wc.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: hexToBytes(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts an exportable vault key with a key derived from recovery code.
 * Returns an envelope safe for DB/localStorage persistence.
 */
export async function createVaultKeyEnvelope(vaultKey, recoveryCode) {
  const wc = getWebCrypto();
  const rawVaultKey = new Uint8Array(await wc.subtle.exportKey('raw', vaultKey));
  const iv = wc.getRandomValues(new Uint8Array(12));
  const recoverySalt = wc.getRandomValues(new Uint8Array(16));
  const wrappingKey = await deriveRecoveryWrappingKey(recoveryCode, bytesToHex(recoverySalt));
  const encrypted = await wc.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, rawVaultKey);

  return {
    encryptedVaultKey: bytesToHex(new Uint8Array(encrypted)),
    encryptedVaultKeyIv: bytesToHex(iv),
    encryptedVaultKeySalt: bytesToHex(recoverySalt),
  };
}

/**
 * Restores a vault key CryptoKey from an encrypted envelope and recovery code.
 */
export async function decryptVaultKeyEnvelope(envelope, recoveryCode) {
  const wc = getWebCrypto();
  if (!envelope?.encryptedVaultKey || !envelope?.encryptedVaultKeyIv || !envelope?.encryptedVaultKeySalt) {
    throw new Error('Encrypted vault key envelope is incomplete');
  }

  const wrappingKey = await deriveRecoveryWrappingKey(recoveryCode, envelope.encryptedVaultKeySalt);
  const decrypted = await wc.subtle.decrypt(
    { name: 'AES-GCM', iv: hexToBytes(envelope.encryptedVaultKeyIv) },
    wrappingKey,
    hexToBytes(envelope.encryptedVaultKey)
  );

  return wc.subtle.importKey(
    'raw',
    decrypted,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Resizes an image file locally in the browser to avoid sending raw high-res files.
 */
export function resizeImageLocally(file, maxWidth) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width);
        width = maxWidth;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob((blob) => resolve({ blob, width, height }), 'image/jpeg', 0.85);
    };

    img.onerror = () => reject(new Error('Failed to load image for resizing'));
    img.src = url;
  });
}
