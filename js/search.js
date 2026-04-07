(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  async function initSearch() {
    var searchSection = document.querySelector(".search");
    if (!searchSection) return;
    var chipContainer = searchSection.querySelector(".chip-container");
    var searchInput = document.querySelector(".search-input");
    var resultsContainer = searchSection.querySelector(".search-results");
    var detailsSection = document.querySelector(".details-section");
    if (!chipContainer || !resultsContainer) return;

    window.ScratchSwipe.showPageLoading(
      searchSection,
      "Loading in progress",
      "Fetching user data from the database",
    );

    var stickyControls = document.createElement("div");
    stickyControls.className = "search-controls-sticky";
    if (chipContainer.parentNode)
      chipContainer.parentNode.removeChild(chipContainer);
    stickyControls.appendChild(chipContainer);

    var filterBtn = document.getElementById("search-filter-btn");
    var popover = document.createElement("div");
    popover.className = "search-filter-popover search-page-popover";
    popover.innerHTML =
      '<p class="sf-label">Sort Order</p>' +
      '<div class="search-filter-sort">' +
      '<div class="search-filter-sort-option selected" data-sort="relevant">Most Relevant</div>' +
      '<div class="search-filter-sort-option" data-sort="least-relevant">Least Relevant</div>' +
      '</div>' +
      '<div style="margin-top:10px;">' +
      '<p class="sf-label">Country</p>' +
      '<div id="search-country-wrap" style="margin-top:6px;"></div>' +
      '</div>' +
      '<div style="margin-top:2px;">' +
      '<div id="search-filter-builder-wrap" style="margin-top:6px; display: flex; flex-direction: row; gap: 10px; align-items: center;"></div>' +
      '</div>' +
      '<div class="settings-btn-group" style="margin-top:2px;">' +
      '<button class="btn-clear" id="sf-clear">Clear</button>' +
      '<button class="btn-apply" id="sf-apply">Apply</button>' +
      '</div>';

    var topbar = document.querySelector(".topbar");
    if (topbar) {
      topbar.style.position = "relative";
      topbar.appendChild(popover);
    }

    // Prevent clicks inside the popover from bubbling to the document
    popover.addEventListener("click", function (e) {
      e.stopPropagation();
    });
    popover.addEventListener("mousedown", function (e) {
      e.stopPropagation();
    });

    var topbarOrig =
      searchSection.querySelector(".topbar-container") ||
      searchSection.querySelector(".topbar");
    if (topbarOrig && topbarOrig.nextSibling) {
      searchSection.insertBefore(stickyControls, topbarOrig.nextSibling);
    } else {
      searchSection.prepend(stickyControls);
    }

    const SEARCH_FILTERS_KEY = "scratchswipe_search_filters";
    var urlParams = new URLSearchParams(window.location.search);
    var urlFilter = urlParams.get("filter") || "All";
    var activeFilter = urlFilter;
    var sortDirection = "relevant",
      currentTags = "",
      tagsEnabled = true,
      countryFilter = "All";

    try {
      var savedFilters = JSON.parse(sessionStorage.getItem(SEARCH_FILTERS_KEY) || "{}");
      sortDirection = savedFilters.sort || "relevant";
      currentTags = savedFilters.tags || "";
      tagsEnabled = savedFilters.tagsEnabled !== false;
      countryFilter = savedFilters.country || "All";
    } catch (_) {}

    const sortOptions = popover.querySelectorAll(".search-filter-sort-option");
    sortOptions.forEach(function (opt) {
      opt.classList.toggle("selected", opt.dataset.sort === sortDirection);
      opt.addEventListener("click", function () {
        sortOptions.forEach((o) => o.classList.remove("selected"));
        opt.classList.add("selected");
        sortDirection = opt.dataset.sort;
        updateTriggerLabel();
      });
    });

    function saveSearchFilters() {
      sessionStorage.setItem(SEARCH_FILTERS_KEY, JSON.stringify({
        sort: sortDirection,
        tags: currentTags,
        tagsEnabled: tagsEnabled,
        country: countryFilter
      }));
    }

    const fbWrap = popover.querySelector("#search-filter-builder-wrap");
    const tagsToggle = window.ScratchSwipe.createToggleSwitch(tagsEnabled, (val) => {
      tagsEnabled = val;
      updateTriggerLabel();
    });

    const triggerBtn = document.createElement("button");
    triggerBtn.className = "filter-trigger-btn";
    triggerBtn.id = "filter-trigger-btn";
    
    function updateTriggerLabel() {
      const parsed = window.ScratchSwipe.parseFilterTags(currentTags);
      const count = parsed.required.length + parsed.optional.length + parsed.exclude.length;
      triggerBtn.innerHTML = `<span>Edit Filter Tags</span>` + (count > 0 ? `<span class="count-badge">${count} Groups</span>` : `<i class="fa-solid fa-chevron-right" style="font-size:10px; opacity:0.5;"></i>`);
      
      const hasActive = (tagsEnabled && (count > 0 || sortDirection !== "relevant" || activeFilter !== "All")) || countryFilter !== "All";
      if (filterBtn) filterBtn.classList.toggle("has-active-filters", hasActive);
      
      triggerBtn.style.opacity = tagsEnabled ? "1" : "0.5";
      triggerBtn.style.pointerEvents = tagsEnabled ? "" : "none";
    }
    
    var countrySelect = null;
    function applyFilters() {
      sortDirection = popover.querySelector(
        ".search-filter-sort-option.selected",
      ).dataset.sort;
      if (countrySelect) countryFilter = countrySelect.getValue();
      saveSearchFilters();
      updateTriggerLabel();
      togglePopover(false);
      updateURLState(searchInput ? searchInput.value.trim() : "");
      runSearch(searchInput ? searchInput.value.trim() : "");
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

    function togglePopover(open) {
      if (open) popover.classList.add("open");
      else popover.classList.remove("open");
    }

    if (filterBtn) {
      filterBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        togglePopover(!popover.classList.contains("open"));
      });
    }

    document.addEventListener("click", function (e) {
      var isInsidePopover = e.target.closest(".search-filter-popover");
      var isCustomSelect = e.target.closest(".custom-select") || e.target.closest(".custom-select-dropdown");
      var isFilterBtn = e.target === filterBtn || e.target.closest("#search-filter-btn");
      
      if (!isInsidePopover && !isCustomSelect && !isFilterBtn) {
        togglePopover(false);
      }
    });

    popover.querySelector("#sf-clear").addEventListener("click", function () {
      sortDirection = "relevant";
      sortOptions.forEach(function (o) {
        o.classList.remove("selected");
      });
      sortOptions[0].classList.add("selected");
      currentTags = "";
      tagsEnabled = true;
      tagsToggle.setChecked(true);
      countryFilter = "All";
      if (countrySelect) countrySelect.setValue("All");
      saveSearchFilters();
      updateTriggerLabel();
      togglePopover(false);
      updateURLState(searchInput ? searchInput.value.trim() : "");
      runSearch(searchInput ? searchInput.value.trim() : "");
    });

    popover.querySelector("#sf-apply").addEventListener("click", applyFilters);

    var db = await window.ScratchSwipe.loadDatabase();
    var users = window.ScratchSwipe.getDBValues();

    (function initCountryFilter() {
      const uniqueCountries = [
        ...new Set(users.map((u) => u.country).filter(Boolean)),
      ].sort();
      const opts = [{ value: "All", label: "All Everywhere" }].concat(
        uniqueCountries.map((c) => ({ value: c, label: c })),
      );
      const wrap = popover.querySelector("#search-country-wrap");
      countrySelect = window.ScratchSwipe.createCustomSelect(opts, countryFilter, () => {
        updateTriggerLabel();
      });
      wrap.appendChild(countrySelect);
    })();
    var urlParams = new URLSearchParams(window.location.search);
    var urlQuery = urlParams.get("q") || "";
    var urlFilter = urlParams.get("filter") || "All";

    if (searchInput && urlQuery) searchInput.value = urlQuery;

    var searchInputEl =
      document.getElementById("search-input") || searchInput;
    if (searchInputEl)
      setTimeout(function () {
        try {
          searchInputEl.focus();
        } catch (_) {}
      }, 80);

    var chips = Array.from(chipContainer.querySelectorAll(".chip-info"));
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
      updateTriggerLabel();
    }
    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        chips.forEach(function (c) {
          c.classList.remove("selected");
        });
        chip.classList.add("selected");
        activeFilter = chip.textContent.trim();
        updateTriggerLabel();
        var q = searchInput ? searchInput.value.trim() : "";
        updateURLState(q, activeFilter);
        runSearch(q);
      });
    });
    var searchTimeout = null;
    if (searchInput) {
      searchInput.addEventListener("input", function () {
        var q = searchInput.value.trim();
        updateURLState(q, activeFilter);
        
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(function() {
          runSearch(q);
        }, 300); // 300ms debounce
      });
      searchInput.addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          if (searchTimeout) clearTimeout(searchTimeout);
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
      history.replaceState(
        null,
        "",
        window.location.pathname + (p.toString() ? "?" + p.toString() : ""),
      );
    }
    const app = document.querySelector(".app");
    function openDetails(user) {
      if (!detailsSection) detailsSection = document.querySelector(".details-section");
      if (detailsSection) {
        window.ScratchSwipe.populateDetailsPanel(detailsSection, user);
        detailsSection.classList.add("open");
        if (app) app.classList.add("details-open");
      }
    }
    function closeDetails() {
      if (!detailsSection) detailsSection = document.querySelector(".details-section");
      if (detailsSection) {
        detailsSection.classList.remove("open");
        if (app) app.classList.remove("details-open");
      }
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
        window.ScratchSwipe.escapeHtml(user.username) +
        '"><div class="dating-card-content"><p class="name">' +
        window.ScratchSwipe.escapeHtml(user.username) +
        " <span>" +
        window.ScratchSwipe.getRelativeYear(user.joined) +
        '</span></p><div class="country-container"><i class="fa-solid fa-location-dot icon"></i><p class="country">' +
        window.ScratchSwipe.escapeHtml(user.country) +
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
      var parsedTags = (currentTags && tagsEnabled) ? window.ScratchSwipe.parseFilterTags(currentTags) : null;
      var targetCountry = countryFilter;

      function getScore(user, filter) {
        if (targetCountry !== "All" && user.country !== targetCountry) return 0;
        if (parsedTags && !window.ScratchSwipe.filterUserByTags(user, parsedTags)) return 0;
        return window.ScratchSwipe.scoreUserByQuery(user, query, filter);
      }

      if (activeFilter === "All") {
        const sections = [
          { label: "Users", filter: "Users", results: [] },
          { label: "Interests", filter: "Interests", results: [] },
          { label: "Places", filter: "Places", results: [] },
          { label: "IDs", filter: "IDs", results: [] },
        ];

        // One pass over all users
        for (let i = 0; i < users.length; i++) {
          const u = users[i];
          for (let s = 0; s < sections.length; s++) {
            const sc = getScore(u, sections[s].filter);
            if (sc > 0) {
              sections[s].results.push({ user: u, score: sc });
            }
          }
        }

        sections.forEach(function(sec) {
          if (!sec.results.length) return;
          sec.results.sort((a, b) => sd === "least-relevant" ? a.score - b.score : b.score - a.score);
          
          _allResults.push({
            type: "header",
            label: sec.label,
            count: sec.results.length,
            users: sec.results.map(r => r.user),
            query: query
          });
          sec.results.forEach(r => _allResults.push({ type: "card", user: r.user }));
        });
      } else {
        const results = [];
        for (let i = 0; i < users.length; i++) {
          const u = users[i];
          const sc = getScore(u, activeFilter);
          if (sc > 0) results.push({ user: u, score: sc });
        }
        
        if (results.length) {
          results.sort((a, b) => sd === "least-relevant" ? a.score - b.score : b.score - a.score);
          _allResults.push({
            type: "header",
            label: activeFilter,
            count: results.length,
            users: results.map(r => r.user),
            query: query
          });
          results.forEach(r => _allResults.push({ type: "card", user: r.user }));
        }
      }
      if (!_allResults.length) {
        showEmptyState(
          "No results found",
          'Nothing matched "' +
            window.ScratchSwipe.escapeHtml(query) +
            '" try a different spelling or filter',
        );
        return;
      }
      renderNextBatch();
    }

    window.ScratchSwipe.hidePageLoading(searchSection);
    runSearch(urlQuery);
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    initSearch,
  });
})();
