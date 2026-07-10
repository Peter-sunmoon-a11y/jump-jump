const DEVICE_KEY = 'jump-star-device-id-v1';
const TOKEN_KEY = 'jump-star-device-token-v1';

function openIdentityDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('jump-star-identity', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('identity');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet(key: string) {
  try {
    const db = await openIdentityDb();
    return await new Promise<string | null>((resolve) => {
      const request = db.transaction('identity').objectStore('identity').get(key);
      request.onsuccess = () => resolve(request.result ?? null);
      request.onerror = () => resolve(null);
    });
  } catch { return null; }
}

async function idbSet(key: string, value: string) {
  try {
    const db = await openIdentityDb();
    await new Promise<void>((resolve) => {
      const request = db.transaction('identity', 'readwrite').objectStore('identity').put(value, key);
      request.onsuccess = () => resolve(); request.onerror = () => resolve();
    });
  } catch { /* localStorage remains the fallback */ }
}

export async function getDeviceId() {
  let id = localStorage.getItem(DEVICE_KEY) ?? await idbGet(DEVICE_KEY);
  if (!id) id = crypto.randomUUID();
  localStorage.setItem(DEVICE_KEY, id); await idbSet(DEVICE_KEY, id);
  return id;
}

export function getDeviceToken() { return localStorage.getItem(TOKEN_KEY); }
export function setDeviceToken(token: string) { localStorage.setItem(TOKEN_KEY, token); void idbSet(TOKEN_KEY, token); }
