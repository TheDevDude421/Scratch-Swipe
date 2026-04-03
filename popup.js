/* ============================================================
   popup.js — Scratch Swipe interaction layer
   ============================================================ */

(function () {
  "use strict";

  /* ----------------------------------------------------------
     Helpers
  ---------------------------------------------------------- */

  function formatJoinDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function getRelativeYear(isoString) {
    return new Date(isoString).getFullYear();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ----------------------------------------------------------
     Language Detection & Translation
  ---------------------------------------------------------- */

  function isNonLatinScript(code) {
    if (code >= 0x0400 && code <= 0x04ff) return true; // Cyrillic
    if (code >= 0x0600 && code <= 0x06ff) return true; // Arabic
    if (code >= 0x4e00 && code <= 0x9fff) return true; // CJK
    if (code >= 0x3040 && code <= 0x309f) return true; // Hiragana
    if (code >= 0x30a0 && code <= 0x30ff) return true; // Katakana
    if (code >= 0x0e00 && code <= 0x0e7f) return true; // Thai
    if (code >= 0x0900 && code <= 0x097f) return true; // Devanagari
    if (code >= 0xac00 && code <= 0xd7af) return true; // Korean
    if (code >= 0x1100 && code <= 0x11ff) return true; // Hangul Jamo
    if (code >= 0x0370 && code <= 0x03ff) return true; // Greek
    if (code >= 0x0590 && code <= 0x05ff) return true; // Hebrew
    if (code >= 0x0980 && code <= 0x09ff) return true; // Bengali
    if (code >= 0x0a00 && code <= 0x0a7f) return true; // Gurmukhi
    if (code >= 0x0a80 && code <= 0x0aff) return true; // Gujarati
    if (code >= 0x0b00 && code <= 0x0b7f) return true; // Oriya
    if (code >= 0x0b80 && code <= 0x0bff) return true; // Tamil
    if (code >= 0x0c00 && code <= 0x0c7f) return true; // Telugu
    if (code >= 0x0c80 && code <= 0x0cff) return true; // Kannada
    if (code >= 0x0d00 && code <= 0x0d7f) return true; // Malayalam
    if (code >= 0x0d80 && code <= 0x0dff) return true; // Sinhala
    if (code >= 0x1000 && code <= 0x109f) return true; // Myanmar
    if (code >= 0x1780 && code <= 0x17ff) return true; // Khmer
    if (code >= 0x18b0 && code <= 0x18ff) return true; // Mongolian
    if (code >= 0xaa00 && code <= 0xaa5f) return true; // Cham
    return false;
  }

  function isLikelyNonEnglish(text) {
    if (!text || text.length < 10) return false;
    var nonLatinCount = 0;
    for (var i = 0; i < text.length; i++) {
      if (isNonLatinScript(text.charCodeAt(i))) nonLatinCount++;
    }
    return nonLatinCount / text.length > 0.1;
  }

  function translateToEnglish(text) {
    return fetch(
      "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(text.substring(0, 500)) +
        "&langpair=autodetect|en",
    )
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (
          data.responseStatus === 200 &&
          data.responseData &&
          data.responseData.translatedText
        ) {
          return data.responseData.translatedText;
        }
        throw new Error("Translation failed");
      });
  }

  /* ----------------------------------------------------------
     Filter Tags Parser
  ---------------------------------------------------------- */

  function bioHasWord(bio, word) {
    var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("\\b" + escaped + "\\b").test(bio);
  }

  function parseFilterTags(input) {
    if (!input || !input.trim()) return { required: [], optional: [] };
    var required = [];
    var optional = [];
    var tokens = [];
    var current = "";
    var inGroup = false;

    for (var i = 0; i < input.length; i++) {
      var ch = input[i];
      if (ch === "{") {
        inGroup = true;
        current += ch;
      } else if (ch === "}") {
        inGroup = false;
        current += ch;
      } else if (ch === " " && !inGroup) {
        if (current.trim()) tokens.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    tokens.forEach(function (token) {
      var isRequired = false;
      if (token.startsWith("+")) {
        isRequired = true;
        token = token.substring(1);
      }
      var terms = [];
      if (token.startsWith("{") && token.endsWith("}")) {
        terms = token
          .slice(1, -1)
          .split("|")
          .map(function (t) {
            return t.trim().toLowerCase();
          })
          .filter(Boolean);
      } else if (token.includes("|")) {
        terms = token
          .split("|")
          .map(function (t) {
            return t.trim().toLowerCase();
          })
          .filter(Boolean);
      } else {
        var t = token.trim().toLowerCase();
        if (t) terms = [t];
      }
      if (!terms.length) return;
      if (isRequired) required.push(terms);
      else optional.push(terms);
    });

    return { required: required, optional: optional };
  }

  function filterUserByTags(user, parsed) {
    if (!parsed.required.length && !parsed.optional.length) return true;
    var bio = (user.bio || "").toLowerCase();
    for (var i = 0; i < parsed.required.length; i++) {
      var group = parsed.required[i];
      if (
        !group.some(function (tag) {
          return bioHasWord(bio, tag);
        })
      )
        return false;
    }
    if (parsed.optional.length > 0) {
      var anyMatch = parsed.optional.some(function (group) {
        return group.some(function (tag) {
          return bioHasWord(bio, tag);
        });
      });
      if (!anyMatch) return false;
    }
    return true;
  }

  /* ----------------------------------------------------------
     Settings infrastructure
  ---------------------------------------------------------- */

  const DEFAULTS = {
    discover: { country: "All", filterTags: "", exclude: "" },
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

  window.ScratchSwipe = window.ScratchSwipe || {};
  window.ScratchSwipe.settings = {
    discover: loadSettings("discover"),
    appearance: loadSettings("appearance"),
    advanced: loadSettings("advanced"),
  };
  window.ScratchSwipe.loadSettings = loadSettings;
  window.ScratchSwipe.saveSettings = saveSettings;

  (function migrate() {
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
  })();

  /* ----------------------------------------------------------
     Like helpers
  ---------------------------------------------------------- */

  function isUserLiked(username) {
    try {
      return JSON.parse(
        localStorage.getItem("scratchswipe_liked") || "[]",
      ).some((l) => l.username === username);
    } catch (_) {
      return false;
    }
  }

  function toggleUserLike(user) {
    try {
      let liked = JSON.parse(
        localStorage.getItem("scratchswipe_liked") || "[]",
      );
      const idx = liked.findIndex((l) => l.username === user.username);
      if (idx !== -1) {
        liked.splice(idx, 1);
      } else {
        liked.unshift({
          username: user.username,
          profile_pic: user.profile_pic,
          country: user.country,
          joined: user.joined,
        });
      }
      localStorage.setItem("scratchswipe_liked", JSON.stringify(liked));
      return idx === -1;
    } catch (_) {
      return false;
    }
  }

  /* ----------------------------------------------------------
     Page loading screen
  ---------------------------------------------------------- */

  function showPageLoading(container, message, sub) {
    if (container.querySelector(".page-loader")) return;
    const loader = document.createElement("div");
    loader.className = "page-loader";
    loader.innerHTML =
      '<img src="loading.svg" alt="Loading" class="page-loader-spinner">' +
      '<p class="page-loader-msg">' +
      (message || "Loading in progress") +
      "</p>" +
      '<p class="page-loader-sub">' +
      (sub || "Please wait while data is being fetched") +
      "</p>";
    container.style.position = "relative";
    container.appendChild(loader);
  }

  function hidePageLoading(container) {
    const loader = container.querySelector(".page-loader");
    if (loader) loader.remove();
  }

  /* ----------------------------------------------------------
     UI Components — Custom Select
  ---------------------------------------------------------- */

  function createCustomSelect(options, selectedValue, onChange) {
    const container = document.createElement("div");
    container.className = "custom-select";
    const trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";
    const current =
      options.find((o) => o.value === selectedValue) || options[0];
    const valueSpan = document.createElement("span");
    valueSpan.className = "custom-select-value";
    valueSpan.textContent = current ? current.label : "";
    const chevron = document.createElement("i");
    chevron.className = "fa-solid fa-chevron-down custom-select-chevron";
    trigger.appendChild(valueSpan);
    trigger.appendChild(chevron);
    const dropdown = document.createElement("div");
    dropdown.className = "custom-select-dropdown";
    const searchWrap = document.createElement("div");
    searchWrap.className = "custom-select-search-wrap";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search\u2026";
    searchInput.className = "custom-select-search-input";
    searchInput.setAttribute("autocomplete", "off");
    searchWrap.appendChild(searchInput);
    const optionsWrap = document.createElement("div");
    optionsWrap.className = "custom-select-options";
    let currentValue = selectedValue;

    function renderOptions(filter) {
      filter = (filter || "").toLowerCase();
      optionsWrap.innerHTML = "";
      const filtered = options.filter((o) =>
        o.label.toLowerCase().includes(filter),
      );
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "custom-select-empty";
        empty.textContent = "No results found";
        optionsWrap.appendChild(empty);
        return;
      }
      filtered.forEach((opt) => {
        const el = document.createElement("div");
        el.className =
          "custom-select-option" +
          (opt.value === currentValue ? " selected" : "");
        el.textContent = opt.label;
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          currentValue = opt.value;
          valueSpan.textContent = opt.label;
          closeDropdown();
          optionsWrap
            .querySelectorAll(".custom-select-option")
            .forEach((x) => x.classList.remove("selected"));
          el.classList.add("selected");
          onChange(opt.value);
        });
        optionsWrap.appendChild(el);
      });
    }

    renderOptions("");
    searchInput.addEventListener("input", () =>
      renderOptions(searchInput.value),
    );
    dropdown.appendChild(searchWrap);
    dropdown.appendChild(optionsWrap);
    container.appendChild(trigger);
    container.appendChild(dropdown);
    let isOpen = false;

    function openDropdown() {
      isOpen = true;
      trigger.classList.add("open");
      dropdown.classList.add("open");
      renderOptions("");
      setTimeout(() => searchInput.focus(), 60);
    }
    function closeDropdown() {
      isOpen = false;
      trigger.classList.remove("open");
      dropdown.classList.remove("open");
      searchInput.value = "";
    }
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOpen) closeDropdown();
      else openDropdown();
    });
    document.addEventListener("click", (e) => {
      if (isOpen && !container.contains(e.target)) closeDropdown();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) closeDropdown();
    });
    container.setValue = function (val) {
      currentValue = val;
      const f = options.find((o) => o.value === val);
      if (f) valueSpan.textContent = f.label;
      renderOptions("");
    };
    container.getValue = function () {
      return currentValue;
    };
    return container;
  }

  /* ----------------------------------------------------------
     UI Components — Toggle Switch
  ---------------------------------------------------------- */

  function createToggleSwitch(checked, onChange) {
    const toggle = document.createElement("div");
    toggle.className = "toggle-switch" + (checked ? " active" : "");
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(checked));
    toggle.setAttribute("tabindex", "0");
    function flip() {
      checked = !checked;
      toggle.classList.toggle("active", checked);
      toggle.setAttribute("aria-checked", String(checked));
      onChange(checked);
    }
    toggle.addEventListener("click", flip);
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flip();
      }
    });
    toggle.setChecked = function (v) {
      checked = !!v;
      toggle.classList.toggle("active", checked);
      toggle.setAttribute("aria-checked", String(checked));
    };
    return toggle;
  }

  /* ----------------------------------------------------------
     Confirmation modal
  ---------------------------------------------------------- */

  function showConfirm(message, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    const modal = document.createElement("div");
    modal.className = "confirm-modal";
    const msg = document.createElement("p");
    msg.className = "confirm-message";
    msg.textContent = message;
    const btnWrap = document.createElement("div");
    btnWrap.className = "confirm-buttons";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "confirm-cancel";
    cancelBtn.textContent = "Cancel";
    const yesBtn = document.createElement("button");
    yesBtn.className = "confirm-yes";
    yesBtn.textContent = "Yes";
    btnWrap.appendChild(cancelBtn);
    btnWrap.appendChild(yesBtn);
    modal.appendChild(msg);
    modal.appendChild(btnWrap);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));
    function close(cb) {
      overlay.classList.remove("visible");
      setTimeout(() => {
        overlay.remove();
        if (cb) cb();
      }, 200);
    }
    cancelBtn.addEventListener("click", () => close());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    yesBtn.addEventListener("click", () => close(onConfirm));
    document.addEventListener("keydown", function h(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
        document.removeEventListener("keydown", h);
      }
    });
  }

  /* ----------------------------------------------------------
     Prompt modal (with text input)
  ---------------------------------------------------------- */

  function showPrompt(message, defaultValue, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    const modal = document.createElement("div");
    modal.className = "confirm-modal";
    modal.style.gap = "12px";
    const msg = document.createElement("p");
    msg.className = "confirm-message";
    msg.textContent = message;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "prompt-input";
    input.value = defaultValue || "";
    input.placeholder = "Name\u2026";
    const btnWrap = document.createElement("div");
    btnWrap.className = "confirm-buttons";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "confirm-cancel";
    cancelBtn.textContent = "Cancel";
    const yesBtn = document.createElement("button");
    yesBtn.className = "confirm-yes";
    yesBtn.textContent = "Add";
    btnWrap.appendChild(cancelBtn);
    btnWrap.appendChild(yesBtn);
    modal.appendChild(msg);
    modal.appendChild(input);
    modal.appendChild(btnWrap);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));
    setTimeout(() => {
      try {
        input.focus();
        input.select();
      } catch (_) {}
    }, 120);
    function close(cb) {
      overlay.classList.remove("visible");
      setTimeout(() => {
        overlay.remove();
        if (cb) cb();
      }, 200);
    }
    cancelBtn.addEventListener("click", () => close());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    function doConfirm() {
      var val = input.value.trim();
      if (val) close(() => onConfirm(val));
      else showToast("Please enter a name");
    }
    yesBtn.addEventListener("click", doConfirm);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") doConfirm();
    });
    document.addEventListener("keydown", function h(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
        document.removeEventListener("keydown", h);
      }
    });
  }

  /* ----------------------------------------------------------
     Toast
  ---------------------------------------------------------- */

  function showToast(message, duration) {
    duration = duration || 2000;
    const existing = document.querySelector(".ss-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = "ss-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("visible"));
    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  /* ----------------------------------------------------------
     Filter Presets Popup
  ---------------------------------------------------------- */

  var DEFAULT_PRESETS = [
    { name: "Only Females", tag: "+{female|woman|girl|lady|she|her|she/her|her/she|herself|queen}" },
    { name: "Only Males", tag: "+{male|man|boy|gentleman|guy|he|him|he/him|him/he|himself}" },
    { name: "Only Christian", tag: "+{Christian|Christ|Faith|Jesus|Jesus Follower|Follower of Christ|Man of God|Woman of God|God|Bible|Church|Believer}" },
    { name: "Only Hindhu", tag: "+{Hindu|Vishnu|Shiva|Krishna|Rama|Ganesh|Hanuman|Lakshmi|Saraswati|Durga|Kali|Parvati|Indra|Sanatan|Sanatani|Dharma|Dharma Follower|Spiritual|Karma|Reincarnation|Atman|Moksha|Brahma|}" },
  ];

  function openPresetsPopup(filterTagsInput) {
    var overlay = document.createElement("div");
    overlay.className = "presets-overlay";

    var userPresets = [];
    try {
      userPresets = JSON.parse(
        localStorage.getItem("scratchswipe_presets") || "[]",
      );
    } catch (_) {}

    function renderPresets() {
      var list = overlay.querySelector(".presets-list");
      list.innerHTML = "";

      if (DEFAULT_PRESETS.length) {
        var label1 = document.createElement("div");
        label1.className = "presets-section-label";
        label1.textContent = "Built-in";
        list.appendChild(label1);
        DEFAULT_PRESETS.forEach(function (p) {
          list.appendChild(createPresetItem(p, false, -1));
        });
      }

      if (userPresets.length) {
        var label2 = document.createElement("div");
        label2.className = "presets-section-label";
        label2.textContent = "Custom";
        list.appendChild(label2);
        userPresets.forEach(function (p, i) {
          list.appendChild(createPresetItem(p, true, i));
        });
      }

      if (!DEFAULT_PRESETS.length && !userPresets.length) {
        var empty = document.createElement("div");
        empty.className = "presets-empty";
        empty.textContent =
          "No presets yet. Add one using the + button above.";
        list.appendChild(empty);
      }
    }

    function createPresetItem(preset, canDelete, index) {
      var item = document.createElement("div");
      item.className = "preset-item";
      var info = document.createElement("div");
      info.className = "preset-info";
      var nameEl = document.createElement("span");
      nameEl.className = "preset-name";
      nameEl.textContent = preset.name;
      var tagEl = document.createElement("span");
      tagEl.className = "preset-tag";
      tagEl.textContent = preset.tag;
      info.appendChild(nameEl);
      info.appendChild(tagEl);
      item.appendChild(info);
      if (canDelete) {
        var delBtn = document.createElement("button");
        delBtn.className = "preset-delete-btn";
        delBtn.title = "Remove preset";
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          showConfirm(
            'Remove "' + preset.name + '" preset?',
            function () {
              userPresets.splice(index, 1);
              try {
                localStorage.setItem(
                  "scratchswipe_presets",
                  JSON.stringify(userPresets),
                );
              } catch (_) {}
              renderPresets();
              showToast("Preset removed");
            },
          );
        });
        item.appendChild(delBtn);
      }
      item.addEventListener("click", function () {
        var popupInput = overlay.querySelector(".presets-filter-input");
        if (popupInput) popupInput.value = preset.tag;
        if (filterTagsInput) filterTagsInput.value = preset.tag;
        closePresets();
      });
      return item;
    }

    var stickyHeader = document.createElement("div");
    stickyHeader.className = "presets-sticky-header";

    var inputRow = document.createElement("div");
    inputRow.className = "presets-input-row";
    var presetInput = document.createElement("input");
    presetInput.type = "text";
    presetInput.className = "presets-filter-input";
    presetInput.placeholder = "Filter tags\u2026";
    presetInput.value = filterTagsInput ? filterTagsInput.value : "";
    presetInput.setAttribute("autocomplete", "off");
    var addBtn = document.createElement("button");
    addBtn.className = "presets-add-btn";
    addBtn.title = "Save as preset";
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    inputRow.appendChild(presetInput);
    inputRow.appendChild(addBtn);

    var headerActions = document.createElement("div");
    headerActions.className = "presets-header-actions";
    var titleSpan = document.createElement("span");
    titleSpan.className = "presets-title";
    titleSpan.textContent = "Presets";
    var closeBtn = document.createElement("button");
    closeBtn.className = "presets-close-btn";
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    headerActions.appendChild(titleSpan);
    headerActions.appendChild(closeBtn);

    stickyHeader.appendChild(inputRow);
    stickyHeader.appendChild(headerActions);

    var listWrap = document.createElement("div");
    listWrap.className = "presets-list";

    var modal = document.createElement("div");
    modal.className = "presets-modal";
    modal.appendChild(stickyHeader);
    modal.appendChild(listWrap);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));

    function closePresets() {
      var popupInput = overlay.querySelector(".presets-filter-input");
      if (popupInput && filterTagsInput) {
        filterTagsInput.value = popupInput.value;
      }
      overlay.classList.remove("visible");
      setTimeout(() => overlay.remove(), 220);
    }

    closeBtn.addEventListener("click", closePresets);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closePresets();
    });

    addBtn.addEventListener("click", function () {
      var tagValue = presetInput.value.trim();
      if (!tagValue) {
        showToast("Enter a filter tag first");
        return;
      }
      showPrompt("Name this preset", "", function (name) {
        userPresets.push({ name: name, tag: tagValue });
        try {
          localStorage.setItem(
            "scratchswipe_presets",
            JSON.stringify(userPresets),
          );
        } catch (_) {}
        renderPresets();
        showToast("Preset added");
      });
    });

    document.addEventListener("keydown", function h(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        closePresets();
        document.removeEventListener("keydown", h);
      }
    });

    renderPresets();
  }

  /* ----------------------------------------------------------
     Injected styles
  ---------------------------------------------------------- */

  const sharedStyle = document.createElement("style");
  sharedStyle.textContent = `

    @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    .result-animate { animation: slideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .no-animations .result-animate { animation: none !important; }

    .card-stack-wrapper { position: relative; width: 90%; max-width: 400px; aspect-ratio: 1 / 1; margin-bottom: 20px; }
    .card-stack-wrapper .dating-card, .card-stack-wrapper .ghost-card {
      position: absolute !important; top: 0 !important; left: 0 !important;
      width: 100% !important; max-width: 100% !important; height: 100% !important;
      border-radius: 12px; transform-origin: center bottom; overflow: hidden;
    }
    .card-stack-wrapper .dating-card { z-index: 10; display: flex; flex-direction: column; justify-content: flex-end; }
    .card-stack-wrapper .ghost-card {
      background-color: rgba(255,255,255,0.1); pointer-events: none;
      display: flex; flex-direction: column; justify-content: flex-end;
      transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.34s ease;
    }
    .card-stack-wrapper .ghost-card .profile-picture, .card-stack-wrapper .ghost-card .dating-card-content { clip-path: inset(0 100% 0 0); transition: clip-path 0.01s; }
    .card-stack-wrapper .ghost-card .gradient-overlay { visibility: hidden; }
    .card-stack-wrapper.swiping .ghost-card.ghost-1 .profile-picture, .card-stack-wrapper.swiping .ghost-card.ghost-1 .dating-card-content { clip-path: none; transition: clip-path 0.01s; }
    .card-stack-wrapper.swiping .ghost-card.ghost-1 .gradient-overlay { visibility: visible; }
    .card-stack-wrapper .ghost-card .profile-picture { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 12px; object-fit: cover; z-index: 0; background-color: black; }
    .card-stack-wrapper .ghost-card.ghost-1 { z-index: 9; transform: scale(0.95) translateY(10px); opacity: 0.7; }
    .card-stack-wrapper .ghost-card.ghost-2 { z-index: 8; transform: scale(0.90) translateY(20px); opacity: 0.45; }
    @keyframes ghostFadeIn { from { opacity: 0; } to { opacity: 0.45; } }
    .card-stack-wrapper .ghost-card.ghost-2.fade-in { animation: ghostFadeIn 0.4s ease forwards; }
    .card-stack-wrapper.swiping .ghost-card.ghost-1 { transform: scale(1) translateY(0); opacity: 1; }
    .card-stack-wrapper.swiping .ghost-card.ghost-2 { transform: scale(0.95) translateY(10px); opacity: 0.7; }

    @keyframes swipeRight { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(800px); opacity: 0; } }
    @keyframes swipeLeft { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(-800px); opacity: 0; } }
    .swipe-right-anim { animation: swipeRight 0.34s cubic-bezier(0.55, 0, 0.85, 1) forwards !important; transition: none !important; }
    .swipe-left-anim { animation: swipeLeft 0.34s cubic-bezier(0.55, 0, 0.85, 1) forwards !important; transition: none !important; }

    .ambient-layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(45px) saturate(3); z-index: 0; pointer-events: none; border-radius: inherit; transition: opacity 0.35s ease; }
    .ambient-layer.hidden { opacity: 0; } .ambient-layer.visible { opacity: 0.25; }
    .ambient-off .ambient-layer { display: none !important; }
    .preload-pool { position: fixed; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; left: -9999px; top: -9999px; }
    .search-results .dating-card { cursor: pointer; }
    .bio-truncated { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .bio-read-toggle { all: unset; color: #0088ff; font-size: 12px; cursor: pointer; display: block; margin-top: 4px; }

    .search-section-header { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 12px 0 4px; }
    .search-section-header .section-count { color: var(--white3); font-weight: normal; }
    .search-section-discover-btn { margin-left: auto; cursor: pointer; color: var(--white3); font-size: 13px; transition: color 0.2s; flex-shrink: 0; padding: 2px; }
    .search-section-discover-btn:hover { color: var(--primary); }

    .search-load-sentinel { width: 100%; display: flex; justify-content: center; padding: 20px 0 12px; }
    @keyframes spinLoader { to { transform: rotate(360deg); } }
    .search-load-sentinel img { width: 26px; height: 26px; animation: spinLoader 0.7s linear infinite; }

    .leaderboard-results { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
    .leaderboard-results .dating-card { width: 100%; height: 54px; display: flex; flex-direction: row; align-items: center; gap: 10px; cursor: pointer; }
    .leaderboard-results .dating-card-rank { font-size: 16px; font-weight: bold; color: #868686; min-width: 28px; text-align: right; flex-shrink: 0; }
    .leaderboard-results .dating-card-rank.rank-1 { color: #f9c53a; } .leaderboard-results .dating-card-rank.rank-2 { color: #b0b8c8; } .leaderboard-results .dating-card-rank.rank-3 { color: #d18e31; }
    .leaderboard-results .profile-picture { height: 80%; aspect-ratio: 1 / 1; border-radius: 360px; object-fit: cover; flex-shrink: 0; }
    .leaderboard-results .dating-card-content { display: flex; flex-direction: column; justify-content: center; gap: 3px; overflow: hidden; }
    .leaderboard-results .name { font-size: 14px; font-weight: bold; color: #dedede; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .leaderboard-results .stats { font-size: 11px; color: #868686; }
    .leaderboard-highlight { background-color: var(--bg1); border-radius: 10px; }
    .leaderboard-search-result { margin-bottom: 12px; padding: 12px; border-radius: 10px; background-color: var(--bg1); display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .leaderboard-search-result .rank-badge { font-size: 22px; font-weight: bold; color: #dedede; min-width: 40px; text-align: center; }
    .leaderboard-search-result .profile-picture { width: 40px; height: 40px; border-radius: 360px; object-fit: cover; }
    .leaderboard-search-result .info .name { font-size: 14px; font-weight: bold; color: #dedede; }
    .leaderboard-search-result .info .stats { font-size: 11px; color: #868686; margin-top: 2px; }
    .leaderboard-not-found { color: #868686; font-size: 13px; margin-bottom: 12px; text-align: center; }

    .liked-content { height: 100%; padding: 15px; padding-top: 0; box-sizing: border-box; overflow-y: auto; padding-bottom: 100px; }
    .liked-content::-webkit-scrollbar { width: 10px; background-color: black; }
    .liked-content::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.15); border-radius: 360px; }
    .liked-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
    .liked-grid-item { position: relative; aspect-ratio: 1 / 1; border-radius: 8px; overflow: hidden; cursor: pointer; }
    .liked-grid-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .liked-grid-item .liked-grid-name { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 10px; font-size: 12px; font-weight: bold; color: #fff; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .remove-like-btn { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 360px; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; transition: background 0.2s ease, transform 0.1s ease; }
    .remove-like-btn:hover { background: rgba(255, 50, 50, 0.8); transform: scale(1.1); }

    .pfp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; display: flex; align-items: center; justify-content: center; animation: pfpOverlayIn 0.22s ease forwards; }
    @keyframes pfpOverlayIn { from { opacity: 0; } to { opacity: 1; } }
    .pfp-overlay img { width: min(80vw, 80vh, 340px); height: min(80vw, 80vh, 340px); aspect-ratio: 1 / 1; object-fit: cover; border-radius: 8px; animation: pfpImgIn 0.26s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
    @keyframes pfpImgIn { from { transform: scale(0.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes pfpImgOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.55); opacity: 0; } }

    .details-section .profile-header .profile-picture { cursor: pointer; }
    .details-section .profile-header .profile-picture { cursor: pointer; }
    .id-container { display: flex; flex-direction: row; align-items: center; gap: 5px; font-size: 14px; }
    .id-container .icon { color: var(--white4); font-size: 12px; } .id-container .id { color: var(--white3); }

    .search-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px 20px; gap: 10px; text-align: center; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
    .search-empty-state img { opacity: 0.4; width: 330px; margin-bottom: 6px; user-select: none; }
    .search-empty-state .empty-title { color: var(--white1, #dedede); font-size: 16px; font-weight: bold; }
    .search-empty-state .empty-subtitle { color: var(--white3, #868686); font-size: 12px; }

    .page-loader { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 50; }
    .page-loader-spinner { width: 36px; height: 36px; animation: spinLoader 0.7s linear infinite; }
    .page-loader-msg { color: var(--white1); font-size: 15px; font-weight: bold; margin: 0; }
    .page-loader-sub { color: var(--white3); font-size: 12px; margin: 0; text-align: center; max-width: 220px; line-height: 1.4; }

    .details-section .like-heart-btn { flex-shrink: 0; cursor: pointer; font-size: 15px; color: var(--white3); transition: color 0.2s, transform 0.15s; margin-left: 8px; }
    .details-section .like-heart-btn:hover { color: #ff4d6a; } .details-section .like-heart-btn:active { transform: scale(0.8); }
    .details-section .like-heart-btn.liked { color: #ff4d6a; }

    .about-me-header-row { display: flex; align-items: center; gap: 8px; }
    .translate-bio-btn { background: none; border: none; color: var(--white3); font-size: 13px; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: color 0.2s, background 0.15s; display: flex; align-items: center; flex-shrink: 0; }
    .translate-bio-btn:hover { color: var(--primary); background: rgba(255,255,255,0.06); }
    .translate-bio-btn.translating { color: var(--primary); pointer-events: none; }
    .translate-bio-btn.translated { color: var(--primary); }
    .translate-bio-btn .fa-spin { animation-duration: 0.5s; }

    /* ── Search Sticky Controls ── */
    .search-controls-sticky {
      position: sticky; top: 0; z-index: 999;
      background-color: black; padding-bottom: 10px;
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .search-controls-sticky .chip-container { position: static !important; background: transparent !important; padding-bottom: 0 !important; }
    .search-filter-btn { background: none; border: none; color: var(--white3); font-size: 15px; cursor: pointer; padding: 8px; border-radius: 8px; transition: color 0.2s, background 0.15s; flex-shrink: 0; }
    .search-filter-btn:hover { color: var(--white1); background: rgba(255,255,255,0.06); }
    .search-filter-btn.has-active-filters { color: var(--primary); }
    .search-filter-popover { position: absolute; top: calc(100% + 6px); right: 0; width: 260px; background: var(--bg2); border: 1px solid var(--bg4); border-radius: 14px; padding: 16px; z-index: 10001; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); opacity: 0; transform: translateY(-8px) scale(0.97); pointer-events: none; transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
    .search-filter-popover.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .search-filter-sort { display: flex; gap: 3px; background: var(--bg1); border-radius: 8px; padding: 3px; }
    .search-filter-sort-option { flex: 1; padding: 7px 0; text-align: center; font-size: 11px; font-weight: bold; color: var(--white3); border-radius: 6px; cursor: pointer; transition: background 0.2s, color 0.2s; user-select: none; }
    .search-filter-sort-option.selected { background: var(--bg4); color: var(--white1); }
    .search-filter-popover input[type="text"] { width: 100%; background: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 9px 11px; border-radius: 8px; font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .search-filter-popover input[type="text"]:focus { border-color: var(--primary); }
    .search-filter-popover input[type="text"]::placeholder { color: var(--white3); }
    .search-filter-popover .sf-label { color: var(--white3); font-size: 11px; font-weight: bold; margin: 0; }
    .search-filter-popover .sf-desc { color: var(--white3); font-size: 10px; margin: 0; opacity: 0.7; }

    /* ── Discover Back-to-Search Banner ── */
    .discover-back-banner {
        width: 100%;
        box-sizing: border-box;
        padding: 12px 16px;
        padding-top: 0;
        margin-left: 5px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--white3);
        font-size: 13px;
        cursor: pointer;
        flex-shrink: 0;
        z-index: 20;
    }

    /* ── Filter Presets Popup ── */
    .presets-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); z-index: 10001; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }
    .presets-overlay.visible { opacity: 1; pointer-events: auto; }
    .presets-modal { background: var(--bg2); width: 90%; max-width: 340px; max-height: 480px; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; transform: translateY(16px) scale(0.97); transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1); box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
    .presets-overlay.visible .presets-modal { transform: translateY(0) scale(1); }
    .presets-sticky-header { padding: 16px; background: var(--bg2); position: sticky; top: 0; z-index: 1; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--bg4); flex-shrink: 0; }
    .presets-input-row { display: flex; align-items: center; gap: 8px; }
    .presets-input-row input { flex: 1; background: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 9px 11px; border-radius: 8px; font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .presets-input-row input::placeholder { color: var(--white3); }
    .presets-input-row input:focus { border-color: var(--primary); }
    .presets-add-btn { width: 34px; height: 34px; border-radius: 8px; background: var(--bg1); border: 1px solid var(--bg4); color: var(--white3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; transition: background 0.2s, color 0.2s, border-color 0.2s; }
    .presets-add-btn:hover { background: var(--primary); color: #fff; border-color: var(--primary); }
    .presets-header-actions { display: flex; align-items: center; justify-content: space-between; }
    .presets-header-actions .presets-title { color: var(--white1); font-size: 14px; font-weight: bold; }
    .presets-close-btn { background: none; border: none; color: var(--white3); font-size: 14px; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: background 0.15s; }
    .presets-close-btn:hover { background: rgba(255,255,255,0.08); }
    .presets-list { flex: 1; overflow-y: auto; padding: 4px 0; }
    .presets-list::-webkit-scrollbar { width: 5px; } .presets-list::-webkit-scrollbar-track { background: transparent; } .presets-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    .presets-section-label { color: var(--white3); font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 16px 4px; }
    .preset-item { padding: 10px 16px; cursor: pointer; transition: background 0.12s; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .preset-item:hover { background: rgba(255,255,255,0.05); }
    .preset-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .preset-name { color: var(--white1); font-size: 13px; font-weight: 600; }
    .preset-tag { color: var(--white3); font-size: 11px; font-family: monospace; overflow-wrap: break-word; }
    .preset-delete-btn { background: none; border: none; color: var(--white3); font-size: 12px; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: color 0.2s, background 0.15s; flex-shrink: 0; }
    .preset-delete-btn:hover { color: #ff6b6b; background: rgba(255,80,80,0.1); }
    .presets-empty { padding: 30px 16px; text-align: center; color: var(--white3); font-size: 13px; }
    .view-presets-link { color: var(--primary); font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 7.5px; transition: opacity 0.2s; user-select: none; flex-shrink: 0; }
    .view-presets-link:hover { opacity: 0.8; }
        @media (hover: none) and (pointer: coarse) {
      input[type="text"], input[type="number"], input[type="search"], .prompt-input, .custom-select-search-input, .search-input { font-size: 16px !important; }
    }

    /* ══════════════════════════════════════════════════════
       Settings Modal
       ══════════════════════════════════════════════════════ */
    .settings-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); z-index: 10000; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
    .settings-overlay.visible { opacity: 1; pointer-events: auto; }
    .settings-modal { background-color: var(--bg2); width: 90%; max-width: 340px; height: 560px; border-radius: 16px; padding: 20px; box-sizing: border-box; transform: translateY(20px) scale(0.95); transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1); display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
    .settings-overlay.visible .settings-modal { transform: translateY(0) scale(1); }
    .settings-modal-header { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
    .settings-modal-header h3 { color: var(--white1); font-size: 18px; margin: 0; }
    .close-settings { background: none; border: none; color: var(--white3); font-size: 16px; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: background 0.15s; }
    .close-settings:hover { background: rgba(255,255,255,0.08); }
    .settings-tabs { display: flex; gap: 3px; background: var(--bg1); border-radius: 10px; padding: 3px; flex-shrink: 0; }
    .settings-tab { flex: 1; padding: 8px 0; text-align: center; font-size: 11px; font-weight: bold; color: var(--white3); border-radius: 8px; cursor: pointer; transition: background 0.25s ease, color 0.25s ease; user-select: none; }
    .settings-tab:hover { color: var(--white1); } .settings-tab.active { background: var(--bg4); color: var(--white1); }
    .settings-tab-content { display: none; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1; min-height: 0; padding-right: 2px; }
    .settings-tab-content.active { display: flex; }
    .settings-tab-content::-webkit-scrollbar { width: 4px; } .settings-tab-content::-webkit-scrollbar-track { background: transparent; } .settings-tab-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    .settings-modal label.field-label { color: var(--white3); font-size: 12px; font-weight: bold; margin: 0; }
    .settings-modal input[type="text"] { width: 100%; background-color: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 10px 12px; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .settings-modal input[type="text"]:focus { border-color: var(--primary); }
    .settings-modal input[type="number"] { width: 100%; background-color: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 10px 12px; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.2s; -moz-appearance: textfield; }
    .settings-modal input[type="number"]:focus { border-color: var(--primary); }
    .settings-modal input[type="number"]::-webkit-inner-spin-button, .settings-modal input[type="number"]::-webkit-outer-spin-button { display: none; }
    .toggle-switch { position: relative; width: 44px; height: 24px; background: var(--bg4, #2a2a2a); border-radius: 12px; cursor: pointer; transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0; }
    .toggle-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: #fff; border-radius: 50%; transition: transform 0.3s cubic-bezier(0.68, -0.3, 0.265, 1.3); box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    .toggle-switch.active { background: var(--primary, #0088ff); } .toggle-switch.active::after { transform: translateX(20px); }
    .setting-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .setting-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .setting-label { color: var(--white1); font-size: 13px; font-weight: 600; } .setting-desc { color: var(--white3); font-size: 11px; line-height: 1.35; }
    .custom-select { position: relative; width: 100%; }
    .custom-select-trigger { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg1); border: 1px solid var(--bg4); border-radius: 10px; cursor: pointer; color: var(--white1); font-size: 14px; transition: border-color 0.2s; user-select: none; }
    .custom-select-trigger.open { border-color: var(--primary); }
    .custom-select-chevron { font-size: 11px; color: var(--white3); transition: transform 0.25s ease; flex-shrink: 0; } .custom-select-trigger.open .custom-select-chevron { transform: rotate(180deg); }
    .custom-select-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: var(--bg1); border: 1px solid var(--bg4); border-radius: 12px; z-index: 200; opacity: 0; transform: translateY(-8px) scale(0.98); pointer-events: none; transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
    .custom-select-dropdown.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .custom-select-search-wrap { padding: 6px 6px 0; position: sticky; top: 0; z-index: 1; }
    .custom-select-search-input { width: 100%; background: var(--bg2); border: 1px solid var(--bg4); color: var(--white1); padding: 8px 10px; border-radius: 8px; font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .custom-select-search-input::placeholder { color: var(--white3); } .custom-select-search-input:focus { border-color: var(--primary); }
    .custom-select-options { max-height: 180px; overflow-y: auto; padding: 4px 6px 6px; }
    .custom-select-options::-webkit-scrollbar { width: 5px; } .custom-select-options::-webkit-scrollbar-track { background: transparent; margin: 4px 0; } .custom-select-options::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
    .custom-select-option { padding: 8px 10px; border-radius: 8px; color: var(--white3); font-size: 13px; cursor: pointer; transition: background 0.12s, color 0.12s; }
    .custom-select-option:hover { background: rgba(255,255,255,0.07); color: var(--white1); }
    .custom-select-option.selected { background: var(--primary, #0088ff); color: #fff; font-weight: 600; }
    .custom-select-empty { padding: 16px 10px; text-align: center; color: var(--white3); font-size: 12px; }
    .settings-btn-group { display: flex; gap: 10px; margin-top: 4px; }
    .settings-btn-group button { flex: 1; padding: 12px; border-radius: 10px; border: none; font-size: 14px; font-weight: bold; cursor: pointer; transition: filter 0.2s ease, transform 0.1s; }
    .settings-btn-group button:active { transform: scale(0.97); } .settings-btn-group button:hover { filter: brightness(1.15); }
    .btn-clear { background-color: var(--bg4); color: var(--white1); } .btn-apply { background-color: var(--primary); color: #fff; }
    .btn-danger { width: 100%; padding: 11px; border-radius: 10px; border: 1px solid rgba(255,80,80,0.3); background: rgba(255,80,80,0.1); color: #ff6b6b; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s, border-color 0.2s; }
    .btn-danger:hover { background: rgba(255,80,80,0.2); border-color: rgba(255,80,80,0.5); }
    .settings-note { color: var(--white3); font-size: 11px; text-align: center; opacity: 0.7; line-height: 1.4; }
    .discover-loading { color: var(--white3); font-size: 12px; text-align: center; padding: 12px 0; }
    .confirm-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); z-index: 10002; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }
    .confirm-overlay.visible { opacity: 1; pointer-events: auto; }
    .confirm-modal { background: var(--bg2); border-radius: 14px; padding: 22px; width: 80%; max-width: 280px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; transform: scale(0.92); transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
    .confirm-overlay.visible .confirm-modal { transform: scale(1); }
    .confirm-message { color: var(--white1); font-size: 14px; font-weight: 600; text-align: center; margin: 0; line-height: 1.4; }
    .confirm-buttons { display: flex; gap: 10px; }
    .confirm-buttons button { flex: 1; padding: 10px; border-radius: 10px; border: none; font-size: 13px; font-weight: bold; cursor: pointer; transition: filter 0.2s ease, transform 0.1s; }
    .confirm-buttons button:active { transform: scale(0.97); } .confirm-buttons button:hover { filter: brightness(1.15); }
    .confirm-cancel { background: var(--bg4); color: var(--white1); } .confirm-yes { background: rgba(255,80,80,0.8); color: #fff; }
    .prompt-input { width: 100%; background: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 10px 12px; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .prompt-input::placeholder { color: var(--white3); }
    .prompt-input:focus { border-color: var(--primary); }
    .ss-toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%) translateY(12px); background: var(--bg4, #2a2a2a); color: var(--white1); padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; z-index: 99999; opacity: 0; pointer-events: none; transition: opacity 0.25s ease, transform 0.25s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.4); white-space: nowrap; }
    .ss-toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
    .zoom-stepper { display: flex; align-items: center; gap: 0; background: var(--bg1); border-radius: 10px; border: 1px solid var(--bg4); overflow: hidden; }
    .zoom-stepper-btn { width: 40px; height: 38px; background: none; border: none; color: var(--white3); font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s; }
    .zoom-stepper-btn:hover { background: rgba(255,255,255,0.06); color: var(--white1); }
    .zoom-stepper-btn:active { background: rgba(255,255,255,0.1); }
    .zoom-stepper-btn:disabled { opacity: 0.3; pointer-events: none; }
    .zoom-stepper-value { width: 52px; text-align: center; font-size: 14px; font-weight: bold; color: var(--white1); border-left: 1px solid var(--bg4); border-right: 1px solid var(--bg4); padding: 8px 0; user-select: none; }
  `;
  document.head.appendChild(sharedStyle);

  /* ----------------------------------------------------------
     Database loader
  ---------------------------------------------------------- */
  let _dbCache = null;
  async function loadDatabase() {
    if (_dbCache) return _dbCache;
    const res = await fetch("database.json");
    _dbCache = await res.json();
    return _dbCache;
  }

  /* ----------------------------------------------------------
     Shared search scoring
  ---------------------------------------------------------- */
  function scoreUserByQuery(user, query, filter) {
    var q = query.toLowerCase();
    if (!q) return 0;
    var score = 0;
    if (filter === "Users" || filter === "All") {
      var n = user.username.toLowerCase();
      if (n === q) score += 100;
      else if (n.startsWith(q)) score += 60;
      else if (n.includes(q)) score += 30;
    }
    if (filter === "Interests" || filter === "All") {
      if ((user.bio || "").toLowerCase().includes(q)) score += 20;
      if (user.username.toLowerCase().includes(q)) score += 15;
    }
    if (filter === "Places" || filter === "All") {
      var c = (user.country || "").toLowerCase();
      if (c === q) score += 80;
      else if (c.includes(q)) score += 40;
    }
    if (filter === "IDs" || filter === "All") {
      var id = String(user.id || "");
      if (id === q) score += 100;
      else if (id.startsWith(q)) score += 60;
      else if (id.includes(q)) score += 30;
    }
    return score;
  }

  /* ----------------------------------------------------------
     Bio read-more / read-less
  ---------------------------------------------------------- */
  const BIO_LINE_LIMIT = 4;
  function applyBioToggle(bioEl) {
    if (!bioEl) return;
    const prev = bioEl.nextElementSibling;
    if (prev && prev.classList.contains("bio-read-toggle")) prev.remove();
    bioEl.classList.remove("bio-truncated");
    requestAnimationFrame(() => {
      const lh = parseFloat(getComputedStyle(bioEl).lineHeight) || 19.2;
      if (bioEl.scrollHeight > lh * BIO_LINE_LIMIT + 4) {
        bioEl.classList.add("bio-truncated");
        let open = false;
        const btn = document.createElement("button");
        btn.className = "bio-read-toggle";
        btn.textContent = "...read more";
        btn.addEventListener("click", () => {
          open = !open;
          bioEl.classList.toggle("bio-truncated", !open);
          btn.textContent = open ? "read less" : "...read more";
        });
        bioEl.insertAdjacentElement("afterend", btn);
      }
    });
  }

  /* ----------------------------------------------------------
     Inject details section HTML
  ---------------------------------------------------------- */
  let _detailsPanelUser = null;
  let _translationCache = { username: null, translated: null };
  function injectDetailsSection() {
    const app = document.querySelector(".app");
    if (!app || app.querySelector(".details-section")) return;
    const ds = document.createElement("div");
    ds.className = "details-section";
    ds.innerHTML =
      '<div class="details-normal-content">' +
      '<div class="profile-header">' +
      '<img src="" class="profile-picture" alt="">' +
      '<div class="profile-text-container">' +
      '<div class="name"><span class="name-text"></span><i class="fa-regular fa-heart like-heart-btn" aria-label="Like"></i></div>' +
      '<div class="chip-container"></div>' +
      "</div></div>" +
      '<div class="about-me-header-row"><p class="header about-me-header">About Me</p></div>' +
      '<p class="bio"></p>' +
      '<div class="profile-meta-container">' +
      '<div class="profile-link-container"><i class="fa-solid fa-link icon"></i><a class="profile-link" target="_blank" rel="noopener noreferrer"></a></div>' +
      '<div class="id-container"><i class="fa-solid fa-hashtag icon"></i><p class="id"></p></div>' +
      '<div class="join-date-container"><i class="fa-solid fa-calendar-days icon"></i><p class="join-date"></p></div>' +
      '<div class="country-container"><i class="fa-solid fa-location-dot icon"></i><p class="country"></p></div>' +
      "</div></div>";
    app.appendChild(ds);
  }

  /* ----------------------------------------------------------
     Profile picture full-view overlay
  ---------------------------------------------------------- */
  function openPfpViewer(src, alt) {
    const overlay = document.createElement("div");
    overlay.className = "pfp-overlay";
    const img = document.createElement("img");
    img.src = src.replace(/_\d+x\d+/, "_200x200");
    img.alt = alt || "";
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    let closing = false;
    function closePfp() {
      if (closing) return;
      closing = true;
      img.style.animation =
        "pfpImgOut 0.24s cubic-bezier(0.32, 0.72, 0, 1) forwards";
      overlay.style.animation = "pfpOverlayOut 0.24s ease forwards";
      setTimeout(() => overlay.remove(), 260);
    }
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePfp();
    });
    function onKey(e) {
      if (e.key === "Escape") {
        closePfp();
        document.removeEventListener("keydown", onKey);
      }
    }
    document.addEventListener("keydown", onKey);
  }

  /* ----------------------------------------------------------
     Shared: populate details panel
  ---------------------------------------------------------- */
  function populateDetailsPanel(detailsSection, user) {
    if (!detailsSection || !user) return;
    _detailsPanelUser = user;
        if (_translationCache.username !== user.username) {
      _translationCache = { username: user.username, translated: null };
    }
    const pfpSrc = (user.profile_pic || "").replace(/_\d+x\d+/, "_200x200");
    const pfp = detailsSection.querySelector(
      ".profile-header .profile-picture",
    );
    const nameEl = detailsSection.querySelector(".profile-header .name-text");
    const chips = detailsSection.querySelector(
      ".profile-header .chip-container",
    );
    if (pfp) {
      pfp.src = pfpSrc;
      pfp.alt = user.username;
      const freshPfp = pfp.cloneNode(true);
      pfp.parentNode.replaceChild(freshPfp, pfp);
      freshPfp.addEventListener("click", () =>
        openPfpViewer(pfpSrc, user.username),
      );
    }
    if (nameEl) nameEl.textContent = user.username;
    if (chips)
      chips.innerHTML =
        '<div class="chip-info">' +
        user.followers_count +
        " followers</div><div class=\"chip-info\">" +
        user.following_count +
        " following</div>";
    const bioEl = detailsSection.querySelector(".bio");
    const originalBio = user.bio || "";
    if (bioEl) {
      bioEl.textContent = originalBio;
      bioEl._originalBio = originalBio;
      bioEl._isTranslated = false;
      applyBioToggle(bioEl);
    }

    /* ── Translate button ── */
    var headerRow = detailsSection.querySelector(".about-me-header-row");
    if (headerRow) {
      var existingBtn = headerRow.querySelector(".translate-bio-btn");
      if (existingBtn) existingBtn.remove();

      if (isLikelyNonEnglish(originalBio) && originalBio.length >= 10) {
        var translateBtn = document.createElement("button");
        translateBtn.className = "translate-bio-btn";
        translateBtn.title = "Translate to English";
        translateBtn.innerHTML =
          '<i class="fa-solid fa-language"></i>';
        translateBtn.addEventListener("click", function () {
          if (bioEl._isTranslated) {
            bioEl.textContent = bioEl._originalBio;
            bioEl._isTranslated = false;
            translateBtn.classList.remove("translated");
            translateBtn.classList.remove("translating");
            translateBtn.title = "Translate to English";
            var resetIcon = translateBtn.querySelector("i");
            if (resetIcon) resetIcon.className = "fa-solid fa-language";
            applyBioToggle(bioEl);
            return;
          }
          if (_translationCache.translated) {
            bioEl.textContent = _translationCache.translated;
            bioEl._isTranslated = true;
            translateBtn.classList.remove("translating");
            translateBtn.classList.add("translated");
            translateBtn.title = "Show original";
            var cacheIcon = translateBtn.querySelector("i");
            if (cacheIcon) cacheIcon.className = "fa-solid fa-language";
            applyBioToggle(bioEl);
            return;
          }
          var spinIcon = translateBtn.querySelector("i");
          translateBtn.classList.add("translating");
          translateBtn.title = "Translating\u2026";
          if (spinIcon) spinIcon.className = "fa-solid fa-spinner fa-spin";
          translateToEnglish(bioEl._originalBio)
            .then(function (translated) {
              _translationCache.translated = translated;
              bioEl.textContent = translated;
              bioEl._isTranslated = true;
              translateBtn.classList.remove("translating");
              translateBtn.classList.add("translated");
              translateBtn.title = "Show original";
              if (spinIcon) spinIcon.className = "fa-solid fa-language";
              applyBioToggle(bioEl);
            })
            .catch(function () {
              translateBtn.classList.remove("translating");
              if (spinIcon) spinIcon.className = "fa-solid fa-language";
              showToast("Translation failed");
            });
        });
        headerRow.appendChild(translateBtn);
      }
    }

    const profileLink = detailsSection.querySelector(".profile-link");
    if (profileLink) {
      profileLink.textContent = "@" + user.username;
      profileLink.href =
        "https://scratch.mit.edu/users/" + user.username + "/";
    }
    const idEl = detailsSection.querySelector(".id-container .id");
    if (idEl) idEl.textContent = user.id || "";
    const joinDateEl = detailsSection.querySelector(".join-date");
    if (joinDateEl)
      joinDateEl.textContent = "Joined " + formatJoinDate(user.joined);
    const countryEl = detailsSection.querySelector(
      ".country-container .country",
    );
    if (countryEl) countryEl.textContent = user.country || "Unknown";
    const heartBtn = detailsSection.querySelector(".like-heart-btn");
    if (heartBtn) {
      const fresh = heartBtn.cloneNode(true);
      heartBtn.parentNode.replaceChild(fresh, heartBtn);
      if (isUserLiked(user.username))
        fresh.className = "fa-solid fa-heart like-heart-btn liked";
      fresh.addEventListener("click", () => {
        const u = _detailsPanelUser;
        if (!u) return;
        const nowLiked = toggleUserLike(u);
        fresh.className = nowLiked
          ? "fa-solid fa-heart like-heart-btn liked"
          : "fa-regular fa-heart like-heart-btn";
      });
    }
  }

  /* ----------------------------------------------------------
     Global Settings Modal
  ---------------------------------------------------------- */
  let _settingsModalCreated = false,
    _countrySelectRef = null,
    _filterTagsRef = null,
    _excludeInputRef = null,
    _toggleRefs = {};

  function createSettingsModal() {
    if (_settingsModalCreated) return;
    _settingsModalCreated = true;
    const app = document.querySelector(".app");
    if (!app) return;
    const overlay = document.createElement("div");
    overlay.className = "settings-overlay";
    overlay.innerHTML =
      '<div class="settings-modal">' +
      '<div class="settings-modal-header"><h3>Settings</h3><button class="close-settings" aria-label="Close settings"><i class="fa-solid fa-xmark"></i></button></div>' +
      '<div class="settings-tabs"><div class="settings-tab active" data-tab="discover">Discover</div><div class="settings-tab" data-tab="appearance">Appearance</div><div class="settings-tab" data-tab="advanced">Advanced</div></div>' +
      '<div class="settings-tab-content active" data-tab="discover">' +
      '<div class="discover-loading" id="discover-tab-loading">Loading options\u2026</div>' +
      '<div id="discover-tab-fields" style="display:none; flex-direction:column; gap:14px;">' +
      '<div><label class="field-label">Country</label><div id="settings-country-wrap" style="margin-top:6px;"></div></div>' +
      '<div>' +
      '<div style="display:flex; align-items:center; justify-content:space-between;"><label class="field-label">Filter Tags</label><span class="view-presets-link" id="view-presets-link"><i class="fa-solid fa-bookmark"></i> View presets</span></div>' +
      '<input type="text" id="filter-tags" placeholder=\'e.g. +{anime|art} +music\' autocomplete="off" style="margin-top:6px;">' +
      '<p class="setting-desc" style="margin-top:4px; line-height:1.5;">+tag = required \u00b7 {a|b} = optional group \u00b7 +{a|b} = required group</p>' +
      "</div>" +
      '<div><label class="field-label">Exclude Tags (comma separated)</label><input type="text" id="filter-exclude" placeholder="e.g. f4f, spam" autocomplete="off" style="margin-top:6px;"></div>' +
      '<div class="settings-btn-group"><button class="btn-clear" id="filter-clear">Clear All</button><button class="btn-apply" id="filter-apply">Apply Filters</button></div>' +
      '<p class="settings-note" id="discover-note"></p>' +
      "</div></div>" +
      '<div class="settings-tab-content" data-tab="appearance">' +
      '<div class="setting-row"><div class="setting-info"><span class="setting-label">Zoom Level</span><span class="setting-desc">Scale the entire app interface</span></div><div class="zoom-stepper" id="zoom-stepper"><button class="zoom-stepper-btn" id="zoom-decrease"><i class="fa-solid fa-minus"></i></button><div class="zoom-stepper-value" id="zoom-value">100%</div><button class="zoom-stepper-btn" id="zoom-increase"><i class="fa-solid fa-plus"></i></button></div></div>' +
      '<div class="setting-row"><div class="setting-info"><span class="setting-label">Ambient Background</span><span class="setting-desc">Blurred colour glow behind cards</span></div><div id="toggle-ambient"></div></div>' +
      '<div class="setting-row"><div class="setting-info"><span class="setting-label">Entry Animations</span><span class="setting-desc">Slide-up animation for new results</span></div><div id="toggle-entry-anim"></div></div>' +
      "</div>" +
      '<div class="settings-tab-content" data-tab="advanced">' +
      '<div class="setting-row"><div class="setting-info"><span class="setting-label">Lazy Loading</span><span class="setting-desc">Preload images ahead for smoother swiping</span></div><div id="toggle-lazy-loading"></div></div>' +
      '<div><label class="field-label">Preload Count</label><input type="number" id="setting-preload-count" min="1" max="20" value="8" style="margin-top:6px;"><span class="setting-desc" style="display:block; margin-top:4px;">Images to preload ahead (1\u201320)</span></div>' +
      '<div style="border-top: 1px solid var(--bg4); padding-top: 14px; display:flex; flex-direction:column; gap:8px;"><button class="btn-danger" id="btn-clear-data">Clear All App Data</button><button class="btn-danger" id="btn-reset-settings">Reset All Settings</button></div>' +
      "</div></div>";
    app.appendChild(overlay);

    const tabs = overlay.querySelectorAll(".settings-tab"),
      panels = overlay.querySelectorAll(".settings-tab-content");
    tabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        const target = tab.dataset.tab;
        tabs.forEach((t) => t.classList.remove("active"));
        panels.forEach((p) => p.classList.remove("active"));
        tab.classList.add("active");
        overlay
          .querySelector('.settings-tab-content[data-tab="' + target + '"]')
          .classList.add("active");
        if (target === "discover" && !overlay.querySelector(".custom-select"))
          populateDiscoverTab();
      });
    });

    function closeSettings() {
      overlay.classList.remove("visible");
    }
    overlay
      .querySelector(".close-settings")
      .addEventListener("click", closeSettings);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSettings();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && overlay.classList.contains("visible"))
        closeSettings();
    });

    /* View presets link */
    overlay
      .querySelector("#view-presets-link")
      .addEventListener("click", function () {
        var ftInput = overlay.querySelector("#filter-tags");
        openPresetsPopup(ftInput);
      });

    const as = window.ScratchSwipe.settings.appearance;
    const at = createToggleSwitch(as.ambientBackground, (val) => {
      window.ScratchSwipe.settings.appearance.ambientBackground = val;
      window.ScratchSwipe.saveSettings(
        "appearance",
        window.ScratchSwipe.settings.appearance,
      );
      applyAppearanceSetting("ambientBackground", val);
    });
    document.getElementById("toggle-ambient").appendChild(at);
    _toggleRefs.ambient = at;
    const et = createToggleSwitch(as.entryAnimations !== false, (val) => {
      window.ScratchSwipe.settings.appearance.entryAnimations = val;
      window.ScratchSwipe.saveSettings(
        "appearance",
        window.ScratchSwipe.settings.appearance,
      );
      applyAppearanceSetting("entryAnimations", val);
    });
    document.getElementById("toggle-entry-anim").appendChild(et);
    (function initZoomStepper() {
      var ZOOM_KEY = "scratchswipe_zoom";
      var MIN = 0.5, MAX = 2, STEP = 0.1;
      var valEl = document.getElementById("zoom-value");
      var decBtn = document.getElementById("zoom-decrease");
      var incBtn = document.getElementById("zoom-increase");
      var level = 1;
      try { level = parseFloat(localStorage.getItem(ZOOM_KEY)) || 1; } catch(_) {}
      level = Math.max(MIN, Math.min(MAX, level));
      function update() {
        valEl.textContent = Math.round(level * 100) + "%";
        decBtn.disabled = level <= MIN;
        incBtn.disabled = level >= MAX;
        var app = document.querySelector(".app");
        if (app) app.style.zoom = level;
        try { localStorage.setItem(ZOOM_KEY, String(level)); } catch(_) {}
      }
      decBtn.addEventListener("click", function () {
        level = Math.max(MIN, Math.round((level - STEP) * 10) / 10);
        update();
      });
      incBtn.addEventListener("click", function () {
        level = Math.min(MAX, Math.round((level + STEP) * 10) / 10);
        update();
      });
      update();
    })();
    _toggleRefs.entryAnimations = et;
    const adv = window.ScratchSwipe.settings.advanced;
    const lt = createToggleSwitch(adv.lazyLoading, (val) => {
      window.ScratchSwipe.settings.advanced.lazyLoading = val;
      window.ScratchSwipe.saveSettings(
        "advanced",
        window.ScratchSwipe.settings.advanced,
      );
    });
    document.getElementById("toggle-lazy-loading").appendChild(lt);
    _toggleRefs.lazyLoading = lt;
    const pi = document.getElementById("setting-preload-count");
    pi.value = adv.preloadCount;
    pi.addEventListener("change", () => {
      let v = Math.max(
        1,
        Math.min(
          20,
          isNaN(parseInt(pi.value, 10)) ? 8 : parseInt(pi.value, 10),
        ),
      );
      pi.value = v;
      window.ScratchSwipe.settings.advanced.preloadCount = v;
      window.ScratchSwipe.saveSettings(
        "advanced",
        window.ScratchSwipe.settings.advanced,
      );
    });

    document.getElementById("btn-clear-data").addEventListener("click", () => {
      showConfirm(
        "Are you sure you want to clear all app data? This cannot be undone.",
        () => {
          Object.values(SETTINGS_KEYS).forEach((k) =>
            localStorage.removeItem(k),
          );
          localStorage.removeItem("scratchswipe_liked");
          localStorage.removeItem("scratchswipe_presets");
          sessionStorage.removeItem("scratchswipe_shuffle");
          sessionStorage.removeItem("scratchswipe_index");
          showToast("All data cleared");
          closeSettings();
        },
      );
    });
    document
      .getElementById("btn-reset-settings")
      .addEventListener("click", () => {
        showConfirm(
          "Are you sure you want to reset all settings to their defaults?",
          () => {
            saveSettings("discover", DEFAULTS.discover);
            saveSettings("appearance", DEFAULTS.appearance);
            saveSettings("advanced", DEFAULTS.advanced);
            window.ScratchSwipe.settings.discover = { ...DEFAULTS.discover };
            window.ScratchSwipe.settings.appearance = {
              ...DEFAULTS.appearance,
            };
            window.ScratchSwipe.settings.advanced = { ...DEFAULTS.advanced };
            _toggleRefs.ambient.setChecked(true);
            _toggleRefs.entryAnimations.setChecked(true);
            _toggleRefs.lazyLoading.setChecked(true);
            pi.value = 8;
            if (_countrySelectRef) _countrySelectRef.setValue("All");
            if (_filterTagsRef) _filterTagsRef.value = "";
            if (_excludeInputRef) _excludeInputRef.value = "";
            applyAllAppearanceSettings();
            showToast("Settings reset to defaults");
          },
        );
      });

    document.addEventListener("click", (e) => {
      if (e.target.closest("#settings-btn")) {
        e.stopPropagation();
        openSettingsModal();
      }
    });
    overlay.querySelector("#filter-clear").addEventListener("click", () => {
      if (_countrySelectRef) _countrySelectRef.setValue("All");
      if (_filterTagsRef) _filterTagsRef.value = "";
      if (_excludeInputRef) _excludeInputRef.value = "";
    });
    overlay.querySelector("#filter-apply").addEventListener("click", () => {
      const filters = {
        country: _countrySelectRef ? _countrySelectRef.getValue() : "All",
        filterTags: _filterTagsRef ? _filterTagsRef.value.trim() : "",
        exclude: _excludeInputRef ? _excludeInputRef.value.trim() : "",
      };
      window.ScratchSwipe.settings.discover = filters;
      window.ScratchSwipe.saveSettings("discover", filters);
      closeSettings();
      var isDiscoverResults =
        new URLSearchParams(window.location.search).get("from") === "search";
      if (
        !!document.querySelector(".dating-content") &&
        !isDiscoverResults
      ) {
        document.dispatchEvent(
          new CustomEvent("scratchswipe:filters-changed", {
            detail: filters,
          }),
        );
        showToast("Filters applied");
      } else {
        showToast("Filters saved for Discover");
      }
    });

    if (_dbCache) populateDiscoverTab();
  }

  async function populateDiscoverTab() {
    const loading = document.getElementById("discover-tab-loading"),
      fields = document.getElementById("discover-tab-fields");
    if (!loading || !fields || fields.querySelector(".custom-select")) return;
    try {
      const db = await loadDatabase();
      const uniqueCountries = [
        ...new Set(
          Object.values(db)
            .map((u) => u.country)
            .filter(Boolean),
        ),
      ].sort();
      const opts = [{ value: "All", label: "All Everywhere" }].concat(
        uniqueCountries.map((c) => ({ value: c, label: c })),
      );
      const cf = window.ScratchSwipe.settings.discover;
      const wrap = document.getElementById("settings-country-wrap");
      wrap.innerHTML = "";
      const sel = createCustomSelect(opts, cf.country, () => {});
      wrap.appendChild(sel);
      _countrySelectRef = sel;
      _filterTagsRef = document.getElementById("filter-tags");
      _excludeInputRef = document.getElementById("filter-exclude");
      _filterTagsRef.value = cf.filterTags || "";
      _excludeInputRef.value = cf.exclude || "";
      loading.style.display = "none";
      fields.style.display = "flex";
    } catch (_) {
      loading.textContent = "Failed to load options";
    }
  }

  function getDiscoverNoteText() {
    var isDiscoverResults =
      new URLSearchParams(window.location.search).get("from") === "search";
    var onDiscover = !!document.querySelector(".dating-content");
    if (isDiscoverResults) return "Filters will apply when you visit Discover";
    if (onDiscover) return "Filters apply to the current page";
    return "Filters will apply when you visit Discover";
  }

  function openSettingsModal() {
    const overlay = document.querySelector(".settings-overlay");
    if (!overlay) return;
    overlay.classList.add("visible");
    if (!overlay.querySelector(".custom-select")) populateDiscoverTab();
    const note = overlay.querySelector("#discover-note");
    if (note) note.textContent = getDiscoverNoteText();
  }

  function applyAppearanceSetting(key, value) {
    const app = document.querySelector(".app");
    if (!app) return;
    if (key === "ambientBackground") {
      if (value) {
        app.classList.remove("ambient-off");
        if (
          window.ScratchSwipe._lastAmbientSrc &&
          window.ScratchSwipe._updateAmbient
        )
          window.ScratchSwipe._updateAmbient(
            window.ScratchSwipe._lastAmbientSrc,
          );
      } else app.classList.add("ambient-off");
    }
    if (key === "entryAnimations") {
      if (value) app.classList.remove("no-animations");
      else app.classList.add("no-animations");
    }
  }

  function applyAllAppearanceSettings() {
    const s = window.ScratchSwipe.settings.appearance;
    applyAppearanceSetting("ambientBackground", s.ambientBackground !== false);
    applyAppearanceSetting("entryAnimations", s.entryAnimations !== false);
  }

  /* ----------------------------------------------------------
     INDEX.HTML
  ---------------------------------------------------------- */
  const SESSION_KEY = "scratchswipe_index";
  async function initIndex() {
    const datingContent = document.querySelector(".dating-content"),
      app = document.querySelector(".app");
    if (!datingContent || !app) return;
    injectDetailsSection();
    const detailsSection = app.querySelector(".details-section");
    applyAllAppearanceSettings();
    const btnContainer = datingContent.querySelector(
      ".dating-card-button-container",
    );
    if (btnContainer) btnContainer.style.display = "none";
    showPageLoading(
      datingContent,
      "Loading in progress",
      "Wait a moment while profiles are being fetched from the database",
    );

    var urlParams = new URLSearchParams(window.location.search);
    var fromSearch = urlParams.get("from") === "search";
    var searchQuery = urlParams.get("q") || "";
    var searchFilter = urlParams.get("filter") || "";
    var searchSection = urlParams.get("section") || "";
    var searchRequired = urlParams.get("required") || "";

    if (fromSearch) {
      var topbar = app.querySelector(".topbar");
      if (topbar) {
        topbar.innerHTML =
          '<p class="topbar-header">Discover Results</p><button class="circular-btn" id="settings-btn"><i class="fa-solid fa-gear icon"></i></button>';
      }
    }

    if (fromSearch) {
      var banner = document.createElement("div");
      banner.className = "discover-back-banner";
      var label = "";
      if (searchQuery) label += "\u201c" + searchQuery + "\u201d";
      if (searchSection && searchSection !== "All")
        label += (searchQuery ? " in " : "") + searchSection;
      banner.innerHTML =
        '<i class="fa-solid fa-arrow-left"></i><span>Go back to ' +
        (label || "search") +
        "</span>";
      banner.addEventListener("click", function () {
        var p = new URLSearchParams();
        if (searchQuery) p.set("q", searchQuery);
        if (searchFilter && searchFilter !== "All")
          p.set("filter", searchFilter);
        if (searchSection && searchSection !== "All")
          p.set("section", searchSection);
        if (urlParams.get("sort")) p.set("sort", urlParams.get("sort"));
        if (urlParams.get("required"))
          p.set("required", urlParams.get("required"));
        window.location.href =
          "search.html" + (p.toString() ? "?" + p.toString() : "");
      });
      var topbarContainer =
        app.querySelector(".topbar-container") || app.querySelector(".topbar");
      if (topbarContainer && topbarContainer.nextSibling) {
        app.insertBefore(banner, topbarContainer.nextSibling);
      } else if (topbarContainer) {
        app.insertBefore(banner, topbarContainer.nextSibling);
      } else {
        app.prepend(banner);
      }
    }

    var ambientA = document.createElement("img"),
      ambientB = document.createElement("img");
    ambientA.className = "ambient-layer hidden";
    ambientB.className = "ambient-layer hidden";
    ambientA.setAttribute("aria-hidden", "true");
    ambientB.setAttribute("aria-hidden", "true");
    app.insertBefore(ambientB, app.firstChild);
    app.insertBefore(ambientA, app.firstChild);
    var activeAmbient = "A";
    function clearAmbient() {
      ambientA.className = "ambient-layer hidden";
      ambientB.className = "ambient-layer hidden";
    }
    function updateAmbient(src) {
      if (!src) return;
      window.ScratchSwipe._lastAmbientSrc = src;
      window.ScratchSwipe._updateAmbient = updateAmbient;
      if (
        window.ScratchSwipe.settings.appearance.ambientBackground === false
      )
        return;
      var incoming = activeAmbient === "A" ? ambientB : ambientA,
        outgoing = activeAmbient === "A" ? ambientA : ambientB;
      incoming.onload = function () {
        incoming.classList.replace("hidden", "visible");
        outgoing.classList.replace("visible", "hidden");
        activeAmbient = activeAmbient === "A" ? "B" : "A";
      };
      incoming.src = src.replace(/_\d+x\d+/, "_200x200");
    }
    var preloadPool = document.createElement("div");
    preloadPool.className = "preload-pool";
    document.body.appendChild(preloadPool);
    var preloadedSet = new Set();
    function preloadImages(fromIndex) {
      var s = window.ScratchSwipe.settings.advanced;
      if (s.lazyLoading === false) return;
      var count = s.preloadCount || 8;
      if (!users || !users.length) return;
      for (var i = fromIndex; i < fromIndex + count; i++) {
        var src = users[i % users.length].profile_pic.replace(
          /_\d+x\d+/,
          "_200x200",
        );
        if (preloadedSet.has(src)) continue;
        preloadedSet.add(src);
        var img = document.createElement("img");
        img.src = src;
        preloadPool.appendChild(img);
      }
    }
    var db = await loadDatabase();
    var allUsers = Object.values(db);
    var users = [];
    var currentFilters = window.ScratchSwipe.settings.discover;
    var isSearchMode = false;

    if (fromSearch && searchQuery) {
      isSearchMode = true;
      var effectiveFilter = searchSection || searchFilter || "All";
      users = allUsers
        .map(function (u) {
          return {
            user: u,
            score: scoreUserByQuery(u, searchQuery, effectiveFilter),
          };
        })
        .filter(function (e) {
          return e.score > 0;
        })
        .sort(function (a, b) {
          return b.score - a.score;
        })
        .map(function (e) {
          return e.user;
        });

      if (searchRequired) {
        var reqTerms = searchRequired
          .split("+")
          .map(function (t) {
            return t.trim().toLowerCase();
          })
          .filter(Boolean);
        if (reqTerms.length > 0) {
          users = users.filter(function (u) {
            var bio = (u.bio || "").toLowerCase();
            return reqTerms.every(function (tag) {
              return bioHasWord(bio, tag);
            });
          });
        }
      }
    }

    function applyCurrentFilters() {
      if (isSearchMode) return;
      var parsed = parseFilterTags(currentFilters.filterTags || "");
      var excTags = currentFilters.exclude
        .toLowerCase()
        .split(",")
        .map(function (t) {
          return t.trim();
        })
        .filter(Boolean);
      users = allUsers.filter(function (u) {
        if (
          currentFilters.country !== "All" &&
          u.country !== currentFilters.country
        )
          return false;
        if (!filterUserByTags(u, parsed)) return false;
        if (
          excTags.length > 0 &&
          excTags.some(function (tag) {
            return (u.bio || "").toLowerCase().includes(tag);
          })
        )
          return false;
        return true;
      });
    }

    if (!isSearchMode) applyCurrentFilters();

    document.addEventListener("scratchswipe:filters-changed", function (e) {
      if (isSearchMode) return;
      currentFilters = e.detail;
      applyCurrentFilters();
      currentIndex = 0;
      sessionStorage.setItem(SESSION_KEY, "0");
      generateShuffleState();
      renderStack(false);
    });

    var SHUFFLE_KEY = "scratchswipe_shuffle";
    var shuffled = null;
    function generateShuffleState() {
      if (!users.length) return;
      for (var i = users.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = users[i];
        users[i] = users[j];
        users[j] = tmp;
      }
      shuffled = users.map(function (u) {
        return u.username;
      });
      try {
        sessionStorage.setItem(SHUFFLE_KEY, JSON.stringify(shuffled));
      } catch (_) {}
    }
    try {
      var raw = sessionStorage.getItem(SHUFFLE_KEY);
      if (raw) shuffled = JSON.parse(raw);
    } catch (_) {}
    if (!shuffled || shuffled.length !== users.length) {
      generateShuffleState();
    } else {
      var byU = Object.fromEntries(
        users.map(function (u) {
          return [u.username, u];
        }),
      );
      users.length = 0;
      shuffled.forEach(function (n) {
        if (byU[n]) users.push(byU[n]);
      });
    }
    var currentIndex = 0;
    try {
      currentIndex =
        parseInt(sessionStorage.getItem(SESSION_KEY) || "0", 10) || 0;
    } catch (_) {}
    if (currentIndex >= users.length) currentIndex = 0;
    var isSwiping = false;
    function buildTopCard(user) {
      var el = document.createElement("div");
      el.className = "dating-card";
      el.dataset.username = user.username;
      el.innerHTML = buildCardContent(user);
      return el;
    }
    function buildCardContent(user) {
      var picSrc = user.profile_pic.replace(/_\d+x\d+/, "_200x200");
      return (
        '<img src="' +
        picSrc +
        '" class="profile-picture" alt="' +
        escapeHtml(user.username) +
        '">' +
        '<div class="gradient-overlay"></div>' +
        '<div class="dating-card-content">' +
        '<p class="name">' +
        escapeHtml(user.username) +
        " <span>" +
        getRelativeYear(user.joined) +
        "</span></p>" +
        '<div class="country-container"><i class="fa-solid fa-location-dot icon"></i><p class="country">' +
        escapeHtml(user.country) +
        "</p></div>" +
        '<div class="chip-container">' +
        '<div class="chip-info">' +
        user.followers_count +
        " followers</div>" +
        '<div class="chip-info">' +
        user.following_count +
        " following</div>" +
        "</div></div>"
      );
    }
    function buildGhostCard(user, gc, fi) {
      var el = document.createElement("div");
      el.className = "ghost-card " + gc + (fi ? " fade-in" : "");
      el.innerHTML = buildCardContent(user);
      return el;
    }
    function renderStack(ng2) {
      var o = datingContent.querySelector(".card-stack-wrapper");
      if (o) o.remove();
      var es = datingContent.querySelector(".search-empty-state");
      if (es) es.remove();
      if (!users.length) {
        clearAmbient();
        if (btnContainer) btnContainer.style.display = "none";
        var emptyMsg = isSearchMode
          ? "No search results to swipe through"
          : "No matches found";
        var emptySub = isSearchMode
          ? "Try a different search term on the search page"
          : "Try adjusting your filters in settings";
        datingContent.insertAdjacentHTML(
          "afterbegin",
          '<div class="search-empty-state" style="position: absolute; width: 100%; top: 40%; left: 50%; transform: translateX(-50%);"><img src="empty-state-illustration.svg" alt=""><p class="empty-title">' +
            emptyMsg +
            '</p><p class="empty-subtitle">' +
            emptySub +
            "</p></div>",
        );
        return;
      }
      if (btnContainer) btnContainer.style.display = "";
      var w = document.createElement("div");
      w.className = "card-stack-wrapper";
      w.appendChild(
        buildGhostCard(
          users[(currentIndex + 2) % users.length],
          "ghost-2",
          ng2,
        ),
      );
      w.appendChild(
        buildGhostCard(
          users[(currentIndex + 1) % users.length],
          "ghost-1",
          false,
        ),
      );
      var tc = buildTopCard(users[currentIndex % users.length]);
      tc.style.zIndex = "10";
      w.appendChild(tc);
      datingContent.insertBefore(w, btnContainer);
      populateDetailsPanel(
        detailsSection,
        users[currentIndex % users.length],
      );
      updateAmbient(users[currentIndex % users.length].profile_pic);
      preloadImages(currentIndex);
    }
    function swipe(direction) {
      if (isSwiping || !users.length) return;
      isSwiping = true;
      var w = datingContent.querySelector(".card-stack-wrapper"),
        tc = w && w.querySelector(".dating-card");
      if (!tc) {
        isSwiping = false;
        return;
      }
      var ct = tc.style.transform || "",
        m = ct.match(/translateX\((-?[\d.]+)px\)/),
        sx = m ? parseFloat(m[1]) : 0,
        ex = direction === "right" ? 800 : -800;
      tc.style.transition = "none";
      tc.style.transform = "";
      void tc.offsetWidth;
      var an = "sd_" + Date.now(),
        ds = document.createElement("style");
      ds.textContent =
        "@keyframes " +
        an +
        "{0%{transform:translateX(" +
        sx +
        "px);opacity:1}100%{transform:translateX(" +
        ex +
        "px);opacity:0}}";
      document.head.appendChild(ds);
      var dur = Math.round((Math.abs(ex - sx) / 800) * 340);
      tc.style.animation =
        an + " " + dur + "ms cubic-bezier(0.55,0,0.85,1) forwards";
      w.classList.add("swiping");
      setTimeout(function () {
        ds.remove();
        if (direction === "right") {
          try {
            var liked = JSON.parse(
              localStorage.getItem("scratchswipe_liked") || "[]",
            );
            var u = users[currentIndex % users.length];
            if (
              u &&
              !liked.find(function (l) {
                return l.username === u.username;
              })
            ) {
              liked.unshift({
                username: u.username,
                profile_pic: u.profile_pic,
                country: u.country,
                joined: u.joined,
              });
              localStorage.setItem(
                "scratchswipe_liked",
                JSON.stringify(liked),
              );
            }
          } catch (_) {}
        }
        currentIndex = (currentIndex + 1) % users.length;
        try {
          sessionStorage.setItem(SESSION_KEY, String(currentIndex));
        } catch (_) {}
        isSwiping = false;
        renderStack(true);
      }, dur);
    }
    function openDetails() {
      if (detailsSection && users.length)
        detailsSection.classList.add("open");
    }
    function closeDetails() {
      if (detailsSection) detailsSection.classList.remove("open");
    }
    var likeBtn = datingContent.querySelector(".like"),
      dislikeBtn = datingContent.querySelector(".dislike");
    if (likeBtn)
      likeBtn.addEventListener("click", function () {
        swipe("right");
      });
    if (dislikeBtn)
      dislikeBtn.addEventListener("click", function () {
        swipe("left");
      });
    document.addEventListener("keydown", function (e) {
      if (document.querySelector(".settings-overlay.visible")) return;
      if (document.querySelector(".presets-overlay.visible")) return;
      if (e.key === "ArrowRight") swipe("right");
      if (e.key === "ArrowLeft") swipe("left");
      if (e.key === "ArrowUp") {
        e.preventDefault();
        openDetails();
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        closeDetails();
      }
    });
    var tSX = null,
      tSY = null,
      dC = null,
      sA = null;
    datingContent.addEventListener(
      "touchstart",
      function (e) {
        tSX = e.touches[0].clientX;
        tSY = e.touches[0].clientY;
        sA = null;
        var w = datingContent.querySelector(".card-stack-wrapper");
        dC = w ? w.querySelector(".dating-card") : null;
      },
      { passive: true },
    );
    datingContent.addEventListener(
      "touchmove",
      function (e) {
        if (tSX === null || !dC || !users.length) return;
        var dx = e.touches[0].clientX - tSX,
          dy = e.touches[0].clientY - tSY;
        if (!sA && (Math.abs(dx) > 8 || Math.abs(dy) > 8))
          sA = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        if (sA === "h") {
          dC.style.transition = "none";
          dC.style.transform = "translateX(" + dx + "px)";
          var w = datingContent.querySelector(".card-stack-wrapper");
          if (w && Math.abs(dx) > 15) w.classList.add("swiping");
          e.preventDefault();
        }
      },
      { passive: false },
    );
    datingContent.addEventListener(
      "touchend",
      function (e) {
        if (tSX === null || !users.length) return;
        var dx = e.changedTouches[0].clientX - tSX,
          dy = e.changedTouches[0].clientY - tSY;
        var w = datingContent.querySelector(".card-stack-wrapper");
        if (sA === "v" && Math.abs(dy) > 50) {
          dy < 0 ? openDetails() : closeDetails();
          if (w) w.classList.remove("swiping");
        } else if (sA === "h") {
          if (Math.abs(dx) > 80) swipe(dx > 0 ? "right" : "left");
          else {
            if (w) w.classList.remove("swiping");
            if (dC) {
              dC.style.transition = "transform 0.3s ease";
              dC.style.transform = "";
            }
          }
        }
        tSX = null;
        tSY = null;
        dC = null;
        sA = null;
      },
      { passive: true },
    );
    if (detailsSection) {
      var dtY = null;
      detailsSection.addEventListener(
        "touchstart",
        function (e) {
          dtY = e.touches[0].clientY;
        },
        { passive: true },
      );
      detailsSection.addEventListener(
        "touchend",
        function (e) {
          if (dtY === null) return;
          if (e.changedTouches[0].clientY - dtY > 60) closeDetails();
          dtY = null;
        },
        { passive: true },
      );
    }
    hidePageLoading(datingContent);
    renderStack(false);
  }

  /* ----------------------------------------------------------
     SEARCH.HTML
  ---------------------------------------------------------- */
  async function initSearch() {
    var searchSection = document.querySelector(".search");
    if (!searchSection) return;
    var chipContainer = searchSection.querySelector(".chip-container");
    var searchInput = document.querySelector(".search-input");
    var resultsContainer = searchSection.querySelector(".search-results");
    var detailsSection = document.querySelector(".details-section");
    if (!chipContainer || !resultsContainer) return;

    showPageLoading(
      searchSection,
      "Loading in progress",
      "Fetching user data from the database",
    );

    var stickyControls = document.createElement("div");
    stickyControls.className = "search-controls-sticky";
    if (chipContainer.parentNode)
      chipContainer.parentNode.removeChild(chipContainer);
    stickyControls.appendChild(chipContainer);

    var filterBtn = document.createElement("button");
    filterBtn.className = "search-filter-btn";
    filterBtn.innerHTML = '<i class="fa-solid fa-sliders"></i>';
    filterBtn.setAttribute("aria-label", "Search filters");
    stickyControls.appendChild(filterBtn);

    var popover = document.createElement("div");
    popover.className = "search-filter-popover";
    popover.innerHTML =
      '<p class="sf-label">Sort Order</p><div class="search-filter-sort"><div class="search-filter-sort-option selected" data-sort="relevant">Most Relevant</div><div class="search-filter-sort-option" data-sort="least-relevant">Least Relevant</div></div><p class="sf-label" style="margin-top:2px;">Required Interests</p><p class="sf-desc">Use + to require multiple terms (AND logic)</p><input type="text" id="sf-required-terms" placeholder="e.g. anime + music + art"><div class="settings-btn-group" style="margin-top:2px;"><button class="btn-clear" id="sf-clear">Clear</button><button class="btn-apply" id="sf-apply">Apply</button></div>';
    stickyControls.appendChild(popover);

    var topbar =
      searchSection.querySelector(".topbar-container") ||
      searchSection.querySelector(".topbar");
    if (topbar && topbar.nextSibling) {
      searchSection.insertBefore(stickyControls, topbar.nextSibling);
    } else {
      searchSection.prepend(stickyControls);
    }

    var sortDirection = "relevant",
      requiredTerms = [];
    var sortOptions = popover.querySelectorAll(".search-filter-sort-option");
    var termsInput = popover.querySelector("#sf-required-terms");
    sortOptions.forEach(function (opt) {
      opt.addEventListener("click", function () {
        sortOptions.forEach(function (o) {
          o.classList.remove("selected");
        });
        opt.classList.add("selected");
        sortDirection = opt.dataset.sort;
      });
    });
    function togglePopover(open) {
      if (open) popover.classList.add("open");
      else popover.classList.remove("open");
    }
    filterBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      togglePopover(!popover.classList.contains("open"));
    });
    document.addEventListener("click", function (e) {
      if (!stickyControls.contains(e.target)) togglePopover(false);
    });
    popover.querySelector("#sf-clear").addEventListener("click", function () {
      sortDirection = "relevant";
      sortOptions.forEach(function (o) {
        o.classList.remove("selected");
      });
      sortOptions[0].classList.add("selected");
      termsInput.value = "";
      requiredTerms = [];
      filterBtn.classList.remove("has-active-filters");
      updateURLState(searchInput ? searchInput.value.trim() : "");
      runSearch(searchInput ? searchInput.value.trim() : "");
    });
    popover.querySelector("#sf-apply").addEventListener("click", function () {
      sortDirection = popover.querySelector(
        ".search-filter-sort-option.selected",
      ).dataset.sort;
      requiredTerms = termsInput.value
        .toLowerCase()
        .split("+")
        .map(function (t) {
          return t.trim();
        })
        .filter(Boolean);
      filterBtn.classList.toggle(
        "has-active-filters",
        requiredTerms.length > 0 || sortDirection !== "relevant",
      );
      togglePopover(false);
      updateURLState(searchInput ? searchInput.value.trim() : "");
      runSearch(searchInput ? searchInput.value.trim() : "");
    });

    var db = await loadDatabase();
    var users = Object.values(db);
    var urlParams = new URLSearchParams(window.location.search);
    var urlQuery = urlParams.get("q") || "";
    var urlFilter = urlParams.get("filter") || "All";
    var urlSort = urlParams.get("sort") || "relevant";
    var urlRequired = urlParams.get("required") || "";

    if (searchInput && urlQuery) searchInput.value = urlQuery;

    if (urlSort !== "relevant") {
      sortDirection = urlSort;
      sortOptions.forEach(function (o) {
        o.classList.remove("selected");
      });
      var matchSort = popover.querySelector(
        '.search-filter-sort-option[data-sort="' + urlSort + '"]',
      );
      if (matchSort) matchSort.classList.add("selected");
    }

    if (urlRequired) {
      requiredTerms = urlRequired.split("+").filter(Boolean);
      termsInput.value = requiredTerms.join(" + ");
      filterBtn.classList.add("has-active-filters");
    }

    var searchInputEl =
      document.getElementById("search-input") || searchInput;
    if (searchInputEl)
      setTimeout(function () {
        try {
          searchInputEl.focus();
        } catch (_) {}
      }, 80);

    var chips = Array.from(chipContainer.querySelectorAll(".chip-info"));
    var activeFilter = urlFilter;
    chips.forEach(function (c) {
      c.classList.remove("selected");
    });
    var targetChip =
      chips.find(function (c) {
        return c.textContent.trim() === activeFilter;
      }) || chips[0];
    if (targetChip) {
      targetChip.classList.add("selected");
      activeFilter = targetChip.textContent.trim();
    }
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) {
          c.classList.remove("selected");
        });
        chip.classList.add("selected");
        activeFilter = chip.textContent.trim();
        var q = searchInput ? searchInput.value.trim() : "";
        updateURLState(q, activeFilter);
        runSearch(q);
      });
    });
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        var q = searchInput.value.trim();
        updateURLState(q, activeFilter);
        runSearch(q);
      });
      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          var q = searchInput.value.trim();
          updateURLState(q, activeFilter);
          runSearch(q);
        }
      });
    }

    function updateURLState(query, filter) {
      var p = new URLSearchParams();
      if (query) p.set("q", query);
      if (filter && filter !== "All") p.set("filter", filter);
      if (sortDirection !== "relevant") p.set("sort", sortDirection);
      if (requiredTerms.length > 0)
        p.set("required", requiredTerms.join("+"));
      history.replaceState(
        null,
        "",
        window.location.pathname + (p.toString() ? "?" + p.toString() : ""),
      );
    }
    function openDetails(user) {
      if (detailsSection) {
        populateDetailsPanel(detailsSection, user);
        detailsSection.classList.add("open");
      }
    }
    function closeDetails() {
      if (detailsSection) detailsSection.classList.remove("open");
    }
    document.addEventListener("keydown", function (e) {
      if (
        e.key === "ArrowDown" &&
        detailsSection &&
        detailsSection.classList.contains("open")
      ) {
        e.preventDefault();
        closeDetails();
      }
    });
    if (detailsSection) {
      var dtY = null;
      detailsSection.addEventListener(
        "touchstart",
        function (e) {
          dtY = e.touches[0].clientY;
        },
        { passive: true },
      );
      detailsSection.addEventListener(
        "touchend",
        function (e) {
          if (dtY === null) return;
          if (e.changedTouches[0].clientY - dtY > 60) closeDetails();
          dtY = null;
        },
        { passive: true },
      );
    }

    function scoreUser(user, query, filter) {
      var q = query.toLowerCase();
      if (!q) return 0;
      if (requiredTerms.length > 0) {
        var bio = (user.bio || "").toLowerCase();
        if (!requiredTerms.every(function (t) {
          return bioHasWord(bio, t);
        }))
          return 0;
      }
      return scoreUserByQuery(user, query, filter);
    }

    function buildSectionHeader(label, count, sectionUsers, query) {
      var h = document.createElement("div");
      h.className = "main-header search-section-header result-animate";
      h.innerHTML =
        label +
        '<span class="section-count">(' +
        count +
        ')</span><i class="fa-solid fa-compass search-section-discover-btn icon" title="Discover these results"></i>';
      if (sectionUsers && sectionUsers.length) {
        h.querySelector(".search-section-discover-btn").addEventListener(
          "click",
          function () {
            var p = new URLSearchParams();
            p.set("from", "search");
            if (query) p.set("q", query);
            if (activeFilter && activeFilter !== "All")
              p.set("filter", activeFilter);
            if (label && label !== "All") p.set("section", label);
            if (requiredTerms.length > 0)
              p.set("required", requiredTerms.join("+"));
            if (sortDirection !== "relevant") p.set("sort", sortDirection);
            window.location.href =
              "index.html" + (p.toString() ? "?" + p.toString() : "");
          },
        );
      }
      return h;
    }

    function buildResultCard(user) {
      var card = document.createElement("div");
      card.className = "dating-card result-animate";
      card.innerHTML =
        '<img src="' +
        user.profile_pic.replace(/_\d+x\d+/, "_200x200") +
        '" class="profile-picture" alt="' +
        escapeHtml(user.username) +
        '"><div class="dating-card-content"><p class="name">' +
        escapeHtml(user.username) +
        " <span>" +
        getRelativeYear(user.joined) +
        '</span></p><div class="country-container"><i class="fa-solid fa-location-dot icon"></i><p class="country">' +
        escapeHtml(user.country) +
        "</p></div></div>";
      card.addEventListener("click", function () {
        openDetails(user);
      });
      return card;
    }

    var _allResults = [],
      _rendered = 0;
    var PAGE_SIZE = 20;
    var _sentinel = null,
      _observer = null;
    function renderNextBatch() {
      if (_rendered >= _allResults.length) {
        removeSentinel();
        return;
      }
      _allResults
        .slice(_rendered, _rendered + PAGE_SIZE)
        .forEach(function (item) {
          resultsContainer.appendChild(
            item.type === "header"
              ? buildSectionHeader(
                  item.label,
                  item.count,
                  item.users,
                  item.query,
                )
              : buildResultCard(item.user),
          );
        });
      _rendered += Math.min(PAGE_SIZE, _allResults.length - _rendered);
      if (_rendered < _allResults.length) addSentinel();
      else removeSentinel();
    }
    function addSentinel() {
      removeSentinel();
      _sentinel = document.createElement("div");
      _sentinel.className = "search-load-sentinel";
      _sentinel.innerHTML = '<img src="loading.svg" alt="Loading...">';
      resultsContainer.appendChild(_sentinel);
      _observer = new IntersectionObserver(
        function (entries) {
          if (entries[0].isIntersecting) {
            removeSentinel();
            renderNextBatch();
          }
        },
        { root: searchSection, rootMargin: "100px" },
      );
      _observer.observe(_sentinel);
    }
    function removeSentinel() {
      if (_observer) {
        _observer.disconnect();
        _observer = null;
      }
      if (_sentinel) {
        _sentinel.remove();
        _sentinel = null;
      }
    }
    function showEmptyState(title, subtitle) {
      resultsContainer.innerHTML = "";
      var el = document.createElement("div");
      el.className = "search-empty-state";
      el.innerHTML =
        '<img src="empty-state-illustration.svg" alt=""><p class="empty-title">' +
        title +
        '</p><p class="empty-subtitle">' +
        subtitle +
        "</p>";
      resultsContainer.appendChild(el);
    }

    function runSearch(query) {
      resultsContainer.innerHTML = "";
      removeSentinel();
      _allResults = [];
      _rendered = 0;
      if (!query) {
        showEmptyState(
          "Nothing searched yet",
          "Type a username, place, interest, or id to find people",
        );
        return;
      }
      var sd = sortDirection;
      if (activeFilter === "All") {
        [
          { label: "Users", filter: "Users" },
          { label: "Interests", filter: "Interests" },
          { label: "Places", filter: "Places" },
          { label: "IDs", filter: "IDs" },
        ].forEach(function (cfg) {
          var group = users
            .map(function (u) {
              return { user: u, score: scoreUser(u, query, cfg.filter) };
            })
            .filter(function (e) {
              return e.score > 0;
            })
            .sort(function (a, b) {
              return sd === "least-relevant"
                ? a.score - b.score
                : b.score - a.score;
            });
          if (!group.length) return;
          _allResults.push({
            type: "header",
            label: cfg.label,
            count: group.length,
            users: group.map(function (g) {
              return g.user;
            }),
            query: query,
          });
          group.forEach(function (entry) {
            _allResults.push({ type: "card", user: entry.user });
          });
        });
      } else {
        var group = users
          .map(function (u) {
            return { user: u, score: scoreUser(u, query, activeFilter) };
          })
          .filter(function (e) {
            return e.score > 0;
          })
          .sort(function (a, b) {
            return sd === "least-relevant"
              ? a.score - b.score
              : b.score - a.score;
          });
        if (group.length) {
          _allResults.push({
            type: "header",
            label: activeFilter,
            count: group.length,
            users: group.map(function (g) {
              return g.user;
            }),
            query: query,
          });
          group.forEach(function (entry) {
            _allResults.push({ type: "card", user: entry.user });
          });
        }
      }
      if (!_allResults.length) {
        showEmptyState(
          "No results found",
          'Nothing matched "' +
            escapeHtml(query) +
            '" try a different spelling or filter',
        );
        return;
      }
      renderNextBatch();
    }

    hidePageLoading(searchSection);
    runSearch(urlQuery);
  }

  /* ----------------------------------------------------------
     LEADERBOARD.HTML
  ---------------------------------------------------------- */
  async function initLeaderboard() {
    var leaderboardContent = document.querySelector(".leaderboard-content");
    if (!leaderboardContent) return;
    showPageLoading(
      leaderboardContent,
      "Loading in progress",
      "Fetching leaderboard data from the database",
    );
    var db = await loadDatabase();
    var users = Object.values(db);
    var detailsSection = document.querySelector(".details-section");
    var tabMap = {
        "Most Followed": "followers_count",
        "Most Following": "following_count",
      },
      tabSuffix = {
        "Most Followed": "followers",
        "Most Following": "following",
      };
    var tabs = Array.from(leaderboardContent.querySelectorAll(".tab")),
      resultsEl = leaderboardContent.querySelector(".leaderboard-results"),
      searchInput = document.getElementById("leaderboard-search-input");
    var urlParams = new URLSearchParams(window.location.search);
    var urlTab = urlParams.get("tab") || "Most Followed",
      urlSearch = urlParams.get("q") || "";
    var activeKey = tabMap[urlTab] || "followers_count",
      activeSuffix = tabSuffix[urlTab] || "followers",
      sortedUsers = [];
    if (searchInput && urlSearch) searchInput.value = urlSearch;
    function updateURL(tab, query) {
      var p = new URLSearchParams();
      if (tab && tab !== "Most Followed") p.set("tab", tab);
      if (query) p.set("q", query);
      history.replaceState(
        null,
        "",
        window.location.pathname + (p.toString() ? "?" + p.toString() : ""),
      );
    }
    function openDetails(user) {
      if (detailsSection) {
        populateDetailsPanel(detailsSection, user);
        detailsSection.classList.add("open");
      }
    }
    if (detailsSection) {
      var dtY = null;
      detailsSection.addEventListener(
        "touchstart",
        function (e) {
          dtY = e.touches[0].clientY;
        },
        { passive: true },
      );
      detailsSection.addEventListener(
        "touchend",
        function (e) {
          if (dtY === null) return;
          if (e.changedTouches[0].clientY - dtY > 60)
            detailsSection.classList.remove("open");
          dtY = null;
        },
        { passive: true },
      );
      document.addEventListener("keydown", function (e) {
        if (
          e.key === "ArrowDown" &&
          detailsSection.classList.contains("open")
        ) {
          e.preventDefault();
          detailsSection.classList.remove("open");
        }
      });
    }
    function buildRow(user, rank, hl) {
      var card = document.createElement("div");
      card.className =
        "dating-card" +
        (user.username.toLowerCase() === (hl || "").toLowerCase()
          ? " leaderboard-highlight"
          : "");
      var rankEl = document.createElement("div");
      rankEl.className =
        "dating-card-rank" + (rank <= 3 ? " rank-" + rank : "");
      rankEl.textContent = rank;
      var img = document.createElement("img");
      img.src = (user.profile_pic || "").replace(/_\d+x\d+/, "_200x200");
      img.alt = user.username;
      img.className = "profile-picture";
      var content = document.createElement("div");
      content.className = "dating-card-content";
      content.innerHTML =
        '<p class="name">' +
        escapeHtml(user.username) +
        "</p><p class=\"stats\">" +
        (user[activeKey] || 0).toLocaleString() +
        " " +
        activeSuffix +
        "</p>";
      card.appendChild(rankEl);
      card.appendChild(img);
      card.appendChild(content);
      card.addEventListener("click", function () {
        openDetails(user);
      });
      return card;
    }
    var PAGE_SIZE = 30;
    var _rendered = 0,
      _sentinel = null,
      _observer = null,
      _highlight = null;
    function addSentinel() {
      removeSentinel();
      _sentinel = document.createElement("div");
      _sentinel.className = "search-load-sentinel";
      _sentinel.innerHTML = '<img src="loading.svg" alt="Loading...">';
      resultsEl.appendChild(_sentinel);
      _observer = new IntersectionObserver(
        function (e) {
          if (e[0].isIntersecting) {
            removeSentinel();
            renderNextBatch();
          }
        },
        { root: leaderboardContent, rootMargin: "120px" },
      );
      _observer.observe(_sentinel);
    }
    function removeSentinel() {
      if (_observer) {
        _observer.disconnect();
        _observer = null;
      }
      if (_sentinel) {
        _sentinel.remove();
        _sentinel = null;
      }
    }
    function renderNextBatch() {
      var end = Math.min(_rendered + PAGE_SIZE, sortedUsers.length);
      for (var i = _rendered; i < end; i++)
        resultsEl.appendChild(buildRow(sortedUsers[i], i + 1, _highlight));
      _rendered = end;
      if (_rendered < sortedUsers.length) addSentinel();
      else removeSentinel();
    }
    function renderSearchResult(query) {
      var prev = resultsEl.querySelector(".leaderboard-search-result");
      if (prev) prev.remove();
      var prevNF = resultsEl.querySelector(".leaderboard-not-found");
      if (prevNF) prevNF.remove();
      if (!query) return;
      var idx = sortedUsers.findIndex(function (u) {
        return u.username.toLowerCase() === query.toLowerCase();
      });
      if (idx !== -1) {
        var u = sortedUsers[idx];
        var wrap = document.createElement("div");
        wrap.className = "leaderboard-search-result";
        wrap.innerHTML =
          '<div class="rank-badge">#' +
          (idx + 1) +
          '</div><img src="' +
          (u.profile_pic || "").replace(/_\d+x\d+/, "_200x200") +
          '" class="profile-picture" alt="' +
          escapeHtml(u.username) +
          '"><div class="info"><p class="name">' +
          escapeHtml(u.username) +
          "</p><p class=\"stats\">" +
          (u[activeKey] || 0).toLocaleString() +
          " " +
          activeSuffix +
          " \u00b7 Rank #" +
          (idx + 1) +
          "</p></div>";
        wrap.addEventListener("click", function () {
          openDetails(u);
        });
        resultsEl.insertBefore(wrap, resultsEl.firstChild);
      } else {
        var nf = document.createElement("p");
        nf.className = "leaderboard-not-found";
        nf.textContent =
          '"' + escapeHtml(query) + '" not found in leaderboard.';
        resultsEl.insertBefore(nf, resultsEl.firstChild);
      }
    }
    function renderAll() {
      removeSentinel();
      resultsEl.innerHTML = "";
      _rendered = 0;
      var q = searchInput ? searchInput.value.trim() : "";
      _highlight = q || null;
      if (q) renderSearchResult(q);
      renderNextBatch();
    }
    var activeTabLabel = urlTab || "Most Followed";
    function switchTab(tabEl, skipURL) {
      tabs.forEach(function (t) {
        t.classList.remove("selected");
      });
      tabEl.classList.add("selected");
      activeTabLabel = tabEl.textContent.trim();
      activeKey = tabMap[activeTabLabel] || "followers_count";
      activeSuffix = tabSuffix[activeTabLabel] || "followers";
      sortedUsers = users.slice().sort(function (a, b) {
        return (b[activeKey] || 0) - (a[activeKey] || 0);
      });
      if (!skipURL) {
        var q = searchInput ? searchInput.value.trim() : "";
        updateURL(activeTabLabel, q);
      }
      renderAll();
    }
    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        switchTab(tab, false);
      });
    });
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        var q = searchInput.value.trim();
        _highlight = q || null;
        updateURL(activeTabLabel, q);
        renderSearchResult(q);
        resultsEl.querySelectorAll(".dating-card").forEach(function (card) {
          var n = card.querySelector(".name");
          if (!n) return;
          card.classList.toggle(
            "leaderboard-highlight",
            !!q &&
              n.textContent.trim().toLowerCase() === q.toLowerCase(),
          );
        });
      });
    }
    var restoredTab =
      tabs.find(function (t) {
        return t.textContent.trim() === urlTab;
      }) || tabs[0];
    if (restoredTab) switchTab(restoredTab, true);
    if (urlSearch) renderSearchResult(urlSearch);
    hidePageLoading(leaderboardContent);
  }

  /* ----------------------------------------------------------
     LIKED.HTML
  ---------------------------------------------------------- */
  async function initLiked() {
    var likedContent = document.querySelector(".liked-content");
    if (!likedContent) return;
    showPageLoading(
      likedContent,
      "Loading in progress",
      "Fetching your liked profiles",
    );
    var detailsSection = document.querySelector(".details-section");
    var db = await loadDatabase();
    var byUsername = Object.fromEntries(
      Object.values(db).map(function (u) {
        return [u.username, u];
      }),
    );
    var liked = [];
    try {
      liked = JSON.parse(localStorage.getItem("scratchswipe_liked") || "[]");
    } catch (_) {}
    function openDetails(user) {
      if (detailsSection && user) {
        populateDetailsPanel(detailsSection, user);
        detailsSection.classList.add("open");
      }
    }
    if (detailsSection) {
      var dtY = null;
      detailsSection.addEventListener(
        "touchstart",
        function (e) {
          dtY = e.touches[0].clientY;
        },
        { passive: true },
      );
      detailsSection.addEventListener(
        "touchend",
        function (e) {
          if (dtY === null) return;
          if (e.changedTouches[0].clientY - dtY > 60)
            detailsSection.classList.remove("open");
          dtY = null;
        },
        { passive: true },
      );
      document.addEventListener("keydown", function (e) {
        if (
          e.key === "ArrowDown" &&
          detailsSection.classList.contains("open")
        ) {
          e.preventDefault();
          detailsSection.classList.remove("open");
        }
      });
    }
    function renderEmptyState() {
      likedContent.innerHTML =
        '<div class="search-empty-state" style="position: relative; height: 100%; transform: none; top: 0; left: 0; justify-content: center;"><img src="empty-state-illustration.svg" alt=""><p class="empty-title">No likes yet</p><p class="empty-subtitle">Swipe right on profiles you like and they\'ll appear here</p></div>';
    }
    if (!liked.length) {
      renderEmptyState();
      hidePageLoading(likedContent);
      return;
    }
    var grid = document.createElement("div");
    grid.className = "liked-grid";
    liked.forEach(function (likedUser) {
      var fullUser = byUsername[likedUser.username] || likedUser;
      var picSrc = (
        fullUser.profile_pic ||
        likedUser.profile_pic ||
        ""
      ).replace(/_\d+x\d+/, "_200x200");
      var item = document.createElement("div");
      item.className = "liked-grid-item result-animate";
      item.innerHTML =
        '<img src="' +
        picSrc +
        '" alt="' +
        escapeHtml(fullUser.username || likedUser.username) +
        '"><div class="liked-grid-name">' +
        escapeHtml(fullUser.username || likedUser.username) +
        '</div><button class="remove-like-btn" title="Remove"><i class="fa-solid fa-xmark"></i></button>';
      item.addEventListener("click", function () {
        openDetails(fullUser);
      });
      var removeBtn = item.querySelector(".remove-like-btn");
      removeBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        liked = liked.filter(function (u) {
          return u.username !== likedUser.username;
        });
        localStorage.setItem("scratchswipe_liked", JSON.stringify(liked));
        item.style.transition = "opacity 0.2s ease, transform 0.2s ease";
        item.style.opacity = "0";
        item.style.transform = "scale(0.9)";
        setTimeout(function () {
          item.remove();
          if (liked.length === 0) renderEmptyState();
        }, 200);
      });
      grid.appendChild(item);
    });
    likedContent.appendChild(grid);
    hidePageLoading(likedContent);
  }

  /* ----------------------------------------------------------
     Boot
  ---------------------------------------------------------- */
  document.addEventListener("DOMContentLoaded", function () {
    var onDiscover = !!document.querySelector(".dating-content"),
      onSearch = !!document.querySelector(".search"),
      onLeaderboard = !!document.querySelector(".leaderboard-content"),
      onLiked = !!document.querySelector(".liked-content");

    var isDiscoverResults =
      new URLSearchParams(window.location.search).get("from") === "search";

    var bottomArea = document.querySelector(".bottom-area");
    if (!bottomArea) {
      bottomArea = document.createElement("div");
      bottomArea.className = "bottom-area";
      document.querySelector(".app").appendChild(bottomArea);
    }

    var discoverSelected = onDiscover && !isDiscoverResults ? " selected" : "";
    var searchSelected = (onSearch || (onDiscover && isDiscoverResults)) ? " selected" : "";
    var likedSelected = onLiked ? " selected" : "";
    var lbSelected = onLeaderboard ? " selected" : "";

    bottomArea.innerHTML =
      '<div class="bottombar"><div class="nav-btn' +
      discoverSelected +
      '" id="nav-discover"><i class="fa-solid fa-compass icon"></i></div><div class="nav-btn' +
      likedSelected +
      '" id="nav-liked"><i class="fa-solid fa-heart icon"></i></div><div class="nav-btn' +
      searchSelected +
      '" id="nav-search"><i class="fa-solid fa-magnifying-glass icon"></i></div><div class="nav-btn' +
      lbSelected +
      '" id="nav-leaderboard"><i class="fa-solid fa-ranking-star icon"></i></div></div>';
    var navDiscover = document.getElementById("nav-discover"),
      navSearch = document.getElementById("nav-search"),
      navLiked = document.getElementById("nav-liked"),
      navLB = document.getElementById("nav-leaderboard");
    if (navDiscover)
      navDiscover.addEventListener("click", function () {
        if (!onDiscover || isDiscoverResults) window.location.href = "index.html";
      });
    if (navSearch)
      navSearch.addEventListener("click", function () {
        if (onSearch) {
          var i =
            document.getElementById("search-input") ||
            document.querySelector(".search-input");
          if (i) {
            i.focus();
            i.select();
          }
        } else window.location.href = "search.html";
      });
    if (navLiked)
      navLiked.addEventListener("click", function () {
        if (!onLiked) window.location.href = "Liked.html";
      });
    if (navLB)
      navLB.addEventListener("click", function () {
        if (!onLeaderboard) window.location.href = "leaderboard.html";
      });
      
      document.querySelector(".app").addEventListener("click", function (e) {
      if (e.target.closest(".settings-overlay") || e.target.closest(".presets-overlay") || e.target.closest(".confirm-overlay") || e.target.closest(".pfp-overlay")) return;
      if (e.target.closest(".dating-card") || e.target.closest(".liked-grid-item") || e.target.closest(".leaderboard-search-result")) return;
      var ds = document.querySelector(".details-section");
      if (ds && ds.classList.contains("open") && !ds.contains(e.target)) {
        ds.classList.remove("open");
      }
    });
    createSettingsModal();
    injectDetailsSection();
    if (onDiscover) initIndex().catch(console.error);
    if (onSearch) initSearch().catch(console.error);
    if (onLeaderboard) initLeaderboard().catch(console.error);
    if (onLiked) initLiked().catch(console.error);
  });
})();