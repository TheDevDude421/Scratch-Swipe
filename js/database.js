(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  let _dbCache = null;

  async function loadDatabase() {
    if (_dbCache) return _dbCache;
    const res = await fetch("database.json");
    _dbCache = await res.json();
    return _dbCache;
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    loadDatabase,
  });
})();
