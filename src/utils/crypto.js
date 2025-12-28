// --- Helpers ---
const enc = new TextEncoder();
const dec = new TextDecoder();

// Generate AES key
export async function generateChatKey() {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
}

// Export / import
export async function exportKey(key) {
  const raw = await crypto.subtle.exportKey("raw", key);
  return btoa(String.fromCharCode(...new Uint8Array(raw)));
}

export async function importKey(base64) {
  const raw = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  return crypto.subtle.importKey(
    "raw",
    raw,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
}

// Encrypt text
export async function encryptText(text, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(text)
  );
  return {
    iv: Array.from(iv),
    data: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
  };
}

// Decrypt text
export async function decryptText(payload, key) {
  const iv = new Uint8Array(payload.iv);
  const data = Uint8Array.from(atob(payload.data), c => c.charCodeAt(0));
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return dec.decode(decrypted);
}