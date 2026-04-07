(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  let _settingsModalCreated = false,
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
      '<div class="settings-tabs"><div class="settings-tab active" data-tab="appearance">Appearance</div><div class="settings-tab" data-tab="advanced">Advanced</div></div>' +
      '<div class="settings-tab-content active" data-tab="appearance">' +
      '<div class="setting-row"><div class="setting-info"><span class="setting-label">Zoom Level</span><span class="setting-desc">Scale the entire app interface</span></div><div class="zoom-stepper" id="zoom-stepper"><button class="zoom-stepper-btn" id="zoom-decrease"><i class="fa-solid fa-minus"></i></button><div class="zoom-stepper-value" id="zoom-value">100%</div><button class="zoom-stepper-btn" id="zoom-increase"><i class="fa-solid fa-plus"></i></button></div></div>' +
      '<div class="setting-row"><div class="setting-info"><span class="setting-label">Card Blur</span><span class="setting-desc">Frosted glass blur effect on card overlay</span></div><div id="toggle-card-blur"></div></div>' +
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
      });
    });

    function closeSettings() {
      overlay.classList.remove("visible");
    }

    overlay.querySelector(".close-settings").addEventListener("click", closeSettings);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeSettings();
    });

    const as = window.ScratchSwipe.settings.appearance;
    const cbt = window.ScratchSwipe.createToggleSwitch(as.cardBlur !== false, (val) => {
      window.ScratchSwipe.settings.appearance.cardBlur = val;
      window.ScratchSwipe.saveSettings(
        "appearance",
        window.ScratchSwipe.settings.appearance,
      );
      applyAppearanceSetting("cardBlur", val);
    });
    document.getElementById("toggle-card-blur").appendChild(cbt);
    _toggleRefs.cardBlur = cbt;
    const at = window.ScratchSwipe.createToggleSwitch(as.ambientBackground, (val) => {
      window.ScratchSwipe.settings.appearance.ambientBackground = val;
      window.ScratchSwipe.saveSettings(
        "appearance",
        window.ScratchSwipe.settings.appearance,
      );
      applyAppearanceSetting("ambientBackground", val);
    });
    document.getElementById("toggle-ambient").appendChild(at);
    _toggleRefs.ambient = at;
    const et = window.ScratchSwipe.createToggleSwitch(as.entryAnimations !== false, (val) => {
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
        document.body.style.zoom = level;
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
    const lt = window.ScratchSwipe.createToggleSwitch(adv.lazyLoading, (val) => {
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
      window.ScratchSwipe.showConfirm(
        "Are you sure you want to clear all app data? This cannot be undone.",
        () => {
          Object.values(window.ScratchSwipe.SETTINGS_KEYS).forEach((k) =>
            localStorage.removeItem(k),
          );
          localStorage.removeItem("scratchswipe_liked");
          localStorage.removeItem("scratchswipe_presets");
          sessionStorage.removeItem("scratchswipe_shuffle");
          sessionStorage.removeItem("scratchswipe_index");
          window.ScratchSwipe.showToast("All data cleared");
          closeSettings();
        },
      );
    });
    document
      .getElementById("btn-reset-settings")
      .addEventListener("click", () => {
        window.ScratchSwipe.showConfirm(
          "Are you sure you want to reset all settings to their defaults?",
          () => {
            window.ScratchSwipe.saveSettings("discover", window.ScratchSwipe.DEFAULTS.discover);
            window.ScratchSwipe.saveSettings("appearance", window.ScratchSwipe.DEFAULTS.appearance);
            window.ScratchSwipe.saveSettings("advanced", window.ScratchSwipe.DEFAULTS.advanced);
            window.ScratchSwipe.settings.discover = { ...window.ScratchSwipe.DEFAULTS.discover };
            window.ScratchSwipe.settings.appearance = {
              ...window.ScratchSwipe.DEFAULTS.appearance,
            };
            window.ScratchSwipe.settings.advanced = { ...window.ScratchSwipe.DEFAULTS.advanced };
            _toggleRefs.cardBlur.setChecked(true);
            _toggleRefs.ambient.setChecked(true);
            _toggleRefs.entryAnimations.setChecked(true);
            _toggleRefs.lazyLoading.setChecked(true);
            pi.value = 8;
            applyAllAppearanceSettings();
            window.ScratchSwipe.showToast("Settings reset to defaults");
          },
        );
      });

    document.addEventListener("click", (e) => {
      if (e.target.closest("#settings-btn")) {
        e.stopPropagation();
        openSettingsModal();
      }
    });
  }

  function openSettingsModal() {
    const overlay = document.querySelector(".settings-overlay");
    if (!overlay) return;
    overlay.classList.add("visible");
  }

  function applyAppearanceSetting(key, value) {
    const app = document.querySelector(".app");
    if (!app) return;
    if (key === "cardBlur") {
      if (value === false) {
        app.classList.add("card-blur-off");
      } else {
        app.classList.remove("card-blur-off");
      }
    }
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
    applyAppearanceSetting("cardBlur", s.cardBlur !== false);
    applyAppearanceSetting("ambientBackground", s.ambientBackground !== false);
    applyAppearanceSetting("entryAnimations", s.entryAnimations !== false);
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    createSettingsModal,
    openSettingsModal,
    applyAppearanceSetting,
    applyAllAppearanceSettings,
  });
})();
