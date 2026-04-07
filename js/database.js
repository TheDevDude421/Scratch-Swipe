(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  let _dbCache = null;
  let _dbValuesCache = null;
  const DB_NAME = "ScratchSwipeDB";
  const STORE_NAME = "UsersStore";
  const DB_VERSION = 1;

  async function openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e) => resolve(e.target.result);
      request.onerror = (e) => reject(e.target.error);
    });
  }

  async function getCachedDB() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get("full_db");
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("IndexedDB error:", e);
      return null;
    }
  }

  async function saveCachedDB(data) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, "full_db");
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (e) {
      console.error("IndexedDB save error:", e);
    }
  }

  function getDBValues() {
    if (_dbValuesCache) return _dbValuesCache;
    if (_dbCache) {
      _dbValuesCache = Object.values(_dbCache);
      return _dbValuesCache;
    }
    return [];
  }

  async function loadDatabase() {
    if (_dbCache) return _dbCache;

    // Try loading from IndexedDB first
    const cached = await getCachedDB();
    if (cached) {
      _dbCache = cached;
      _dbValuesCache = null; // Will be lazily created
      // Fetch in background to check for updates
      checkForUpdates(); 
      return _dbCache;
    }

    const res = await fetch("database.json");
    _dbCache = await res.json();
    _dbValuesCache = null;
    await saveCachedDB(_dbCache);
    return _dbCache;
  }

  async function checkForUpdates() {
    try {
      // Small delay to let the page render
      await new Promise(r => setTimeout(r, 3000));
      
      // Use a HEAD request first to check content-length without downloading
      const headRes = await fetch("database.json", { method: "HEAD" });
      const contentLength = headRes.headers.get("content-length");
      
      // If we can't determine size difference, do a lightweight check
      if (contentLength) {
        // Store the last known size
        const lastSize = localStorage.getItem("scratchswipe_db_size");
        if (lastSize === contentLength) return; // No change
        localStorage.setItem("scratchswipe_db_size", contentLength);
      }
      
      const res = await fetch("database.json");
      const fresh = await res.json();
      
      // Compare by key count instead of expensive JSON.stringify
      const freshKeys = Object.keys(fresh);
      const cachedKeys = Object.keys(_dbCache);
      if (freshKeys.length !== cachedKeys.length) {
        _dbCache = fresh;
        _dbValuesCache = null;
        await saveCachedDB(_dbCache);
        console.log("Database updated in background");
      }
    } catch(e) {}
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    loadDatabase,
    getDBValues,
    get _dbCache() { return _dbCache; },
  });
})();