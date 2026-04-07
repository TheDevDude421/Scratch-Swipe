(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  const SESSION_KEY = "scratchswipe_index";

  async function initIndex() {
    const datingContent = document.querySelector(".dating-content"),
      app = document.querySelector(".app");
    if (!datingContent || !app) return;
    window.ScratchSwipe.injectDetailsSection();
    const detailsSection = app.querySelector(".details-section");
    window.ScratchSwipe.applyAllAppearanceSettings();
    const btnContainer = datingContent.querySelector(
      ".dating-card-button-container",
    );
    if (btnContainer) btnContainer.style.display = "none";
    window.ScratchSwipe.showPageLoading(
      datingContent,
      "Loading in progress",
      "Wait a moment while profiles are being fetched from the database",
    );

    var urlParams = new URLSearchParams(window.location.search);
    var fromSearch = urlParams.get("from") === "search";
    var searchQuery = urlParams.get("q") || "";
    var searchFilter = urlParams.get("filter") || "";
    var searchSection = urlParams.get("section") || "";

    const SEARCH_FILTERS_KEY = "scratchswipe_search_filters";
    var searchFilters = { sort: "relevant", tags: "" };
    try {
      var saved = sessionStorage.getItem(SEARCH_FILTERS_KEY);
      if (saved) searchFilters = JSON.parse(saved);
    } catch (_) {}

    if (fromSearch) {
      var topbar = app.querySelector(".topbar");
      if (topbar) {
        topbar.innerHTML =
          '<p class="topbar-header">Discover Results</p>' +
          '<div style="display: flex; gap: 7.5px;">' +
          '<button class="circular-btn" id="search-filter-btn"><i class="fa-solid fa-sliders"></i></button>' +
          '<button class="circular-btn" id="settings-btn"><i class="fa-solid fa-gear icon"></i></button>' +
          '</div>';
      }
    }

    async function initDiscoverFilters() {
      // Use fromSearch to decide which button to look for, as the topbar replacement depends on it
      const filterBtn = document.getElementById(fromSearch ? "search-filter-btn" : "discover-filter-btn");
      if (!filterBtn) return;

      const isSearchRes = fromSearch && searchQuery;
      const popover = document.createElement("div");
      popover.className = "search-filter-popover discover-filter-popover";
      
      if (isSearchRes) {
        // Search filter UI in Discover Results
        popover.innerHTML =
          '<p class="sf-label">Sort Order</p>' +
          '<div class="search-filter-sort">' +
          '<div class="search-filter-sort-option' + (searchFilters.sort === "relevant" ? " selected" : "") + '" data-sort="relevant">Most Relevant</div>' +
          '<div class="search-filter-sort-option' + (searchFilters.sort === "least-relevant" ? " selected" : "") + '" data-sort="least-relevant">Least Relevant</div>' +
          '</div>' +
          '<div style="margin-top:10px;">' +
          '<p class="sf-label">Country</p>' +
          '<div id="popover-country-wrap" style="margin-top:6px;"></div>' +
          '</div>' +
          '<div style="margin-top:2px;">' +
          '<div id="search-filter-builder-wrap" style="margin-top:6px; display: flex; flex-direction: row; gap: 10px; align-items: center;"></div>' +
          '</div>' +
          '<div class="settings-btn-group" style="margin-top:2px;">' +
          '<button class="btn-clear" id="popover-clear">Clear</button>' +
          '<button class="btn-apply" id="popover-apply">Apply</button>' +
          '</div>';
      } else {
        // Normal Discover filter UI
        popover.innerHTML =
          '<div class="discover-filter-loading">Loading options\u2026</div>' +
          '<div class="discover-filter-content" style="display:none; flex-direction:column; gap:12px;">' +
          '<div><p class="sf-label">Country</p><div id="popover-country-wrap" style="margin-top:6px;"></div></div>' +
          '<div style="margin-top:2px;">' +
          '<div id="search-filter-builder-wrap" style="margin-top:6px; display: flex; flex-direction: row; gap: 10px; align-items: center;"></div>' +
          '</div>' +
          '<div class="settings-btn-group" style="margin-top:2px;">' +
          '<button class="btn-clear" id="popover-clear">Clear</button>' +
          '<button class="btn-apply" id="popover-apply">Apply</button>' +
          '</div>' +
          '</div>';
      }
      
      const topbar = app.querySelector(".topbar");
      if (topbar) {
        topbar.style.position = "relative";
        topbar.appendChild(popover);
      }

      let countrySelect = null;
      let currentTags = isSearchRes ? searchFilters.tags : currentFilters.filterTags || "";
      let tagsEnabled = isSearchRes ? (searchFilters.tagsEnabled !== false) : (currentFilters.filterTagsEnabled !== false);

      function togglePopover(open) {
        if (open) popover.classList.add("open");
        else popover.classList.remove("open");
      }

      filterBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePopover(!popover.classList.contains("open"));
      });

      document.addEventListener("click", (e) => {
        if (!popover.contains(e.target) && e.target !== filterBtn && !e.target.closest("#discover-filter-btn") && !e.target.closest("#search-filter-btn")) {
          togglePopover(false);
        }
      });

      const tagsToggle = window.ScratchSwipe.createToggleSwitch(tagsEnabled, (val) => {
        tagsEnabled = val;
        updateTriggerLabel();
      });

      const db = await window.ScratchSwipe.loadDatabase();
      const allUsers = window.ScratchSwipe.getDBValues();
      const uniqueCountries = [
        ...new Set(allUsers.map((u) => u.country).filter(Boolean)),
      ].sort();
      const opts = [{ value: "All", label: "All Everywhere" }].concat(
        uniqueCountries.map((c) => ({ value: c, label: c })),
      );
      const countryWrap = popover.querySelector("#popover-country-wrap");
      const initialCountry = isSearchRes ? (searchFilters.country || "All") : currentFilters.country;
      
      countrySelect = window.ScratchSwipe.createCustomSelect(opts, initialCountry, () => {
        updateTriggerLabel();
      });
      if (countryWrap) countryWrap.appendChild(countrySelect);

      if (isSearchRes) {
        // Sort options for search results
        const opts = popover.querySelectorAll(".search-filter-sort-option");
        opts.forEach(opt => {
          opt.onclick = () => {
            opts.forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
            searchFilters.sort = opt.dataset.sort;
            updateTriggerLabel();
          };
        });
      }

      const fbWrap = popover.querySelector("#search-filter-builder-wrap");
      const triggerBtn = document.createElement("button");
      triggerBtn.className = "filter-trigger-btn";
      triggerBtn.id = "filter-trigger-btn";
      
      function updateTriggerLabel() {
        const parsed = window.ScratchSwipe.parseFilterTags(currentTags);
        const count = parsed.required.length + parsed.optional.length + parsed.exclude.length;
        triggerBtn.innerHTML = `<span>Edit Filter Tags</span>` + (count > 0 ? `<span class="count-badge">${count} Groups</span>` : `<i class="fa-solid fa-chevron-right" style="font-size:10px; opacity:0.5;"></i>`);
        
      let hasActive = false;
      if (tagsEnabled) {
        hasActive = count > 0;
        if (isSearchRes) {
          hasActive = hasActive || searchFilters.sort !== "relevant" || (searchFilter && searchFilter !== "All") || (searchSection && searchSection !== "All");
        }
      }
      const countryVal = countrySelect ? countrySelect.getValue() : "All";
      hasActive = hasActive || countryVal !== "All";

      filterBtn.classList.toggle("has-active-filters", hasActive);
        triggerBtn.style.opacity = tagsEnabled ? "1" : "0.5";
        triggerBtn.style.pointerEvents = tagsEnabled ? "" : "none";
      }
      
      function applyFilters() {
        const countryVal = countrySelect.getValue();
        if (isSearchRes) {
          searchFilters.tags = currentTags.trim();
          searchFilters.tagsEnabled = tagsEnabled;
          searchFilters.country = countryVal;
          sessionStorage.setItem(SEARCH_FILTERS_KEY, JSON.stringify(searchFilters));
        } else {
          currentFilters = {
            country: countryVal,
            filterTags: currentTags.trim(),
            filterTagsEnabled: tagsEnabled
          };
          window.ScratchSwipe.saveSettings("discover", currentFilters);
        }
        updateTriggerLabel();
        togglePopover(false);
        applyCurrentFilters();
        currentIndex = 0;
        sessionStorage.setItem(SESSION_KEY, "0");
        generateShuffleState();
        renderStack(false);
        window.ScratchSwipe.showToast("Filters applied");
      }

      triggerBtn.onclick = () => {
        togglePopover(false);
        window.ScratchSwipe.showFilterPopup(currentTags, (newTags) => {
          currentTags = newTags;
          applyFilters();
        });
      };
      
      updateTriggerLabel();
      fbWrap.appendChild(triggerBtn);
      fbWrap.appendChild(tagsToggle);

      popover.querySelector("#popover-clear").onclick = () => {
        if (isSearchRes) {
          searchFilters = { sort: "relevant", tags: "", tagsEnabled: true };
          sessionStorage.setItem(SEARCH_FILTERS_KEY, JSON.stringify(searchFilters));
          currentTags = "";
          tagsEnabled = true;
          tagsToggle.setChecked(true);
          popover.querySelectorAll(".search-filter-sort-option").forEach(o => {
            o.classList.toggle("selected", o.dataset.sort === "relevant");
          });
        } else {
          currentFilters = { country: "All", filterTags: "", filterTagsEnabled: true };
          window.ScratchSwipe.saveSettings("discover", currentFilters);
          countrySelect.setValue("All");
          currentTags = "";
          tagsEnabled = true;
          tagsToggle.setChecked(true);
        }
        updateTriggerLabel();
        togglePopover(false);
        applyCurrentFilters();
        currentIndex = 0;
        sessionStorage.setItem(SESSION_KEY, "0");
        generateShuffleState();
        renderStack(false);
        window.ScratchSwipe.showToast("Filters cleared");
      };

      popover.querySelector("#popover-apply").onclick = applyFilters;

      const loading = popover.querySelector(".discover-filter-loading");
      if (loading) loading.style.display = "none";
      const content = popover.querySelector(".discover-filter-content");
      if (content) content.style.display = "flex";
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
    var preloadedQueue = [];
    const MAX_PRELOAD_DOM_SIZE = 40; // Keep only 40 images in DOM at once

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
        preloadedQueue.push({ src: src, el: img });

        // Maintain DOM size
        if (preloadedQueue.length > MAX_PRELOAD_DOM_SIZE) {
          var oldest = preloadedQueue.shift();
          if (oldest && oldest.el.parentNode) {
            oldest.el.remove();
            // We don't necessarily remove from preloadedSet because 
            // the browser might still have it in its internal cache,
            // but removing from DOM helps the renderer/memory.
          }
        }
      }
    }
    
    var db = await window.ScratchSwipe.loadDatabase();
    // Use cached values array to avoid re-creating Object.values on 10k entries
    var users = [];
    var currentFilters = window.ScratchSwipe.settings.discover;
    var isSearchMode = !!(fromSearch && searchQuery);

    initDiscoverFilters();

    function applyCurrentFilters() {
      // Clear users array efficiently
      users.length = 0;
      
      // Use the cached values array instead of creating a new one each time
      const allEntries = window.ScratchSwipe.getDBValues();

      if (isSearchMode) {
        var effectiveFilter = searchSection || searchFilter || "All";
        var parsedTags = window.ScratchSwipe.parseFilterTags(searchFilters.tags || "");
        var tagsEnabled = searchFilters.tagsEnabled !== false;
        var targetCountry = searchFilters.country || "All";
        
        var queryRegex = null;
        if (searchQuery) {
          queryRegex = new RegExp("\\b" + searchQuery.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
        }
        
        users = allEntries
          .map(function (u) {
            return {
              user: u,
              score: window.ScratchSwipe.scoreUserByQuery(u, searchQuery, effectiveFilter, queryRegex),
            };
          })
          .filter(function (e) {
            if (e.score <= 0) return false;
            if (targetCountry !== "All" && e.user.country !== targetCountry) return false;
            if (tagsEnabled && !window.ScratchSwipe.filterUserByTags(e.user, parsedTags)) return false;
            return true;
          })
          .sort(function (a, b) {
            return searchFilters.sort === "least-relevant"
              ? a.score - b.score
              : b.score - a.score;
          })
          .map(function (e) {
            return e.user;
          });
      } else {
        var parsed = window.ScratchSwipe.parseFilterTags(currentFilters.filterTags || "");
        var tagsEnabled = currentFilters.filterTagsEnabled !== false;
        
        // Use a simple loop for better memory efficiency with large datasets
        for (let i = 0; i < allEntries.length; i++) {
          const u = allEntries[i];
          if (currentFilters.country !== "All" && u.country !== currentFilters.country) continue;
          if (tagsEnabled && !window.ScratchSwipe.filterUserByTags(u, parsed)) continue;
          users.push(u);
        }
      }
    }

    applyCurrentFilters();

    var SHUFFLE_KEY = "scratchswipe_shuffle_seed";
    var shuffleSeed = null;
    
    // Seeded pseudo-random for reproducible shuffles without storing 10k usernames
    function seededRandom(seed) {
      var x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    }
    
    function shuffleWithSeed(arr, seed) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(seededRandom(seed + i) * (i + 1));
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
    }
    
    function generateShuffleState() {
      if (!users.length) return;
      shuffleSeed = Date.now();
      shuffleWithSeed(users, shuffleSeed);
      try {
        sessionStorage.setItem(SHUFFLE_KEY, String(shuffleSeed));
      } catch (_) {}
    }
    
    try {
      var rawSeed = sessionStorage.getItem(SHUFFLE_KEY);
      if (rawSeed) shuffleSeed = parseInt(rawSeed, 10);
    } catch (_) {}
    
    if (!shuffleSeed) {
      generateShuffleState();
    } else {
      shuffleWithSeed(users, shuffleSeed);
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
        window.ScratchSwipe.escapeHtml(user.username) +
        '">' +
        '<div class="gradient-overlay"></div>' +
        '<div class="dating-card-content">' +
        '<p class="name">' +
        window.ScratchSwipe.escapeHtml(user.username) +
        " <span>" +
        window.ScratchSwipe.getRelativeYear(user.joined) +
        "</span></p>" +
        '<div class="country-container"><i class="fa-solid fa-location-dot icon"></i><p class="country">' +
        window.ScratchSwipe.escapeHtml(user.country) +
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
      var wrapper = datingContent.querySelector(".card-stack-wrapper");
      var es = datingContent.querySelector(".search-empty-state");
      if (es) es.remove();
      
      if (!users.length) {
        clearAmbient();
        if (wrapper) wrapper.remove();
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
      
      const user0 = users[currentIndex % users.length];
      const user1 = users[(currentIndex + 1) % users.length];
      const user2 = users[(currentIndex + 2) % users.length];

      if (!wrapper) {
        wrapper = document.createElement("div");
        wrapper.className = "card-stack-wrapper";
        wrapper.innerHTML = `
          <div class="ghost-card ghost-2"></div>
          <div class="ghost-card ghost-1"></div>
          <div class="dating-card" style="z-index: 10;"></div>
        `;
        datingContent.insertBefore(wrapper, btnContainer);
      }

      const g2 = wrapper.querySelector(".ghost-2");
      const g1 = wrapper.querySelector(".ghost-1");
      const tc = wrapper.querySelector(".dating-card");

      g2.className = "ghost-card ghost-2" + (ng2 ? " fade-in" : "");
      g2.innerHTML = buildCardContent(user2);
      
      g1.className = "ghost-card ghost-1";
      g1.innerHTML = buildCardContent(user1);
      
      tc.dataset.username = user0.username;
      tc.style.animation = "";
      tc.style.transform = "";
      tc.style.transition = "";
      tc.innerHTML = buildCardContent(user0);
      
      wrapper.classList.remove("swiping");

      window.ScratchSwipe.populateDetailsPanel(
        detailsSection,
        user0,
      );
      updateAmbient(user0.profile_pic);
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
      if (detailsSection && users.length) {
        detailsSection.classList.add("open");
        app.classList.add("details-open");
      }
    }
    function closeDetails() {
      if (detailsSection) {
        detailsSection.classList.remove("open");
        app.classList.remove("details-open");
      }
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
        if (!sA && (Math.abs(dx) > 5 || Math.abs(dy) > 5))
          sA = Math.abs(dx) > Math.abs(dy) ? "h" : "v";
        if (sA === "h") {
          dC.style.transition = "none";
          dC.style.transform = "translateX(" + dx + "px)";
          var w = datingContent.querySelector(".card-stack-wrapper");
          if (w && Math.abs(dx) > 10) w.classList.add("swiping");
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
        if (sA === "v" && Math.abs(dy) > 30) {
          dy < 0 ? openDetails() : closeDetails();
          if (w) w.classList.remove("swiping");
        } else if (sA === "h") {
          if (Math.abs(dx) > 40) swipe(dx > 0 ? "right" : "left");
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
          if (e.changedTouches[0].clientY - dtY > 40) closeDetails();
          dtY = null;
        },
        { passive: true },
      );
    }
    window.ScratchSwipe.hidePageLoading(datingContent);
    renderStack(false);
    initDiscoverFilters();
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    initIndex,
  });
})();
