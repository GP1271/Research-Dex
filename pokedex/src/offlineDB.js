import { openDB } from "idb";

const DB_NAME = "pokedex-offline";
const DB_VERSION = 1;

let dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains("api-cache")) {
      db.createObjectStore("api-cache");
    }
  },
});

export async function saveToCache(key, data) {
  const db = await dbPromise;
  return db.put("api-cache", data, key);
}

export async function getFromCache(key) {
  const db = await dbPromise;
  return db.get("api-cache", key);
}

export async function clearCache() {
  const db = await dbPromise;
  return db.clear("api-cache");
}
