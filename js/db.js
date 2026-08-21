// IndexedDB 래퍼 (schedules / investments / diaries 저장소)
const DB = (() => {
  const DB_NAME = 'personal-tracker-db';
  const DB_VERSION = 3;
  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('schedules')) {
          const s = db.createObjectStore('schedules', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('investments')) {
          const s = db.createObjectStore('investments', { keyPath: 'id' });
          s.createIndex('dateTime', 'dateTime', { unique: false });
        }
        if (!db.objectStoreNames.contains('diaries')) {
          const s = db.createObjectStore('diaries', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('checklistItems')) {
          const s = db.createObjectStore('checklistItems', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
        if (!db.objectStoreNames.contains('ddays')) {
          const s = db.createObjectStore('ddays', { keyPath: 'id' });
          s.createIndex('date', 'date', { unique: false });
        }
      };
      req.onsuccess = (e) => resolve(e.target.result);
      req.onerror = (e) => reject(e.target.error);
    });
    return dbPromise;
  }

  async function getAll(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async function get(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function put(storeName, value) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).put(value);
      tx.oncomplete = () => resolve(value);
      tx.onerror = () => reject(tx.error);
    });
  }

  async function remove(storeName, id) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function clear(storeName) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      tx.objectStore(storeName).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async function bulkPut(storeName, values) {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const store = tx.objectStore(storeName);
      values.forEach((v) => store.put(v));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  return { getAll, get, put, remove, clear, bulkPut };
})();
