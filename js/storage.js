(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  const DEFAULTS = {
    discover: { country: "All", filterTags: "", filterTagsEnabled: true },
    appearance: { ambientBackground: true, entryAnimations: true },
    advanced: { lazyLoading: true, preloadCount: 8 },
  };

  const SETTINGS_KEYS = {
    discover: "scratchswipe_filters",
    appearance: "scratchswipe_appearance",
    advanced: "scratchswipe_advanced",
  };

  function loadSettings(category) {
    try {
      const raw = localStorage.getItem(SETTINGS_KEYS[category]);
      if (raw) return { ...DEFAULTS[category], ...JSON.parse(raw) };
    } catch (_) {}
    return { ...DEFAULTS[category] };
  }

  function saveSettings(category, data) {
    try {
      localStorage.setItem(SETTINGS_KEYS[category], JSON.stringify(data));
    } catch (_) {}
  }

  let _likedCache = null;
  function getLikedSet() {
    if (_likedCache) return _likedCache;
    try {
      const liked = JSON.parse(localStorage.getItem("scratchswipe_liked") || "[]");
      _likedCache = new Set(liked.map(u => u.username));
    } catch(_) {
      _likedCache = new Set();
    }
    return _likedCache;
  }

  function isUserLiked(username) {
    return getLikedSet().has(username);
  }

  function toggleUserLike(user) {
    try {
      let liked = JSON.parse(
        localStorage.getItem("scratchswipe_liked") || "[]",
      );
      const set = getLikedSet();
      const idx = liked.findIndex((l) => l.username === user.username);
      if (idx !== -1) {
        liked.splice(idx, 1);
        set.delete(user.username);
      } else {
        const u = {
          username: user.username,
          profile_pic: user.profile_pic,
          country: user.country,
          joined: user.joined,
        };
        liked.unshift(u);
        set.add(user.username);
      }
      localStorage.setItem("scratchswipe_liked", JSON.stringify(liked));
      return idx === -1;
    } catch (_) {
      return false;
    }
  }

  function migrate() {
    const d = window.ScratchSwipe.settings.discover;
    if (d.include !== undefined && d.includeAny === undefined) {
      d.includeAny = d.include;
      delete d.include;
      saveSettings("discover", d);
    }
    if (d.filterTags === undefined) {
      var parts = [];
      if (d.mustInclude) {
        d.mustInclude
          .split("+")
          .map(function (t) {
            return t.trim();
          })
          .filter(Boolean)
          .forEach(function (t) {
            parts.push("+" + t);
          });
      }
      if (d.includeAny) {
        var anyTerms = d.includeAny
          .split(",")
          .map(function (t) {
            return t.trim();
          })
          .filter(Boolean);
        if (anyTerms.length > 1) parts.push(anyTerms.join("|"));
        else if (anyTerms.length === 1) parts.push(anyTerms[0]);
      }
      d.filterTags = parts.join(" ");
      delete d.mustInclude;
      delete d.includeAny;
      saveSettings("discover", d);
    }
    if (d.exclude) {
      var excTerms = d.exclude
        .split(",")
        .map(function (t) {
          return t.trim();
        })
        .filter(Boolean);
      if (excTerms.length > 0) {
        var excStr = excTerms
          .map(function (t) {
            return "-" + t;
          })
          .join(" ");
        d.filterTags = (d.filterTags ? d.filterTags + " " : "") + excStr;
      }
      delete d.exclude;
      saveSettings("discover", d);
    }
  }

  // Initialize settings
  window.ScratchSwipe.settings = {
    discover: loadSettings("discover"),
    appearance: loadSettings("appearance"),
    advanced: loadSettings("advanced"),
  };

  // Run migration
  migrate();

  // Export
  Object.assign(window.ScratchSwipe, {
    DEFAULTS,
    SETTINGS_KEYS,
    loadSettings,
    saveSettings,
    isUserLiked,
    toggleUserLike,
  });
})();
