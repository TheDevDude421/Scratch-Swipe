(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  async function initLeaderboard() {
    var leaderboardContent = document.querySelector(".leaderboard-content");
    if (!leaderboardContent) return;
    window.ScratchSwipe.showPageLoading(
      leaderboardContent,
      "Loading in progress",
      "Fetching leaderboard data from the database",
    );
    var db = await window.ScratchSwipe.loadDatabase();
    var users = window.ScratchSwipe.getDBValues();

    const LEADERBOARD_FILTERS_KEY = "scratchswipe_leaderboard_filters";
    var countryFilter = "All";
    try {
      var saved = JSON.parse(sessionStorage.getItem(LEADERBOARD_FILTERS_KEY) || "{}");
      countryFilter = saved.country || "All";
    } catch (_) {}

    var countrySelect = null;
    var filterBtn = document.getElementById("leaderboard-filter-btn");
    var popover = document.createElement("div");
        if (filterBtn && countryFilter !== "All") {
      filterBtn.classList.add("has-active-filters");
    }
    
    popover.className = "search-filter-popover";
    popover.innerHTML =
      '<div style="margin-top:0px;">' +
      '<p class="sf-label">Country</p>' +
      '<div id="leaderboard-country-wrap" style="margin-top:6px;"></div>' +
      '</div>' +
      '<div class="settings-btn-group" style="margin-top:10px;">' +
      '<button class="btn-clear" id="lf-clear">Clear</button>' +
      '<button class="btn-apply" id="lf-apply">Apply</button>' +
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
      var isFilterBtn = e.target === filterBtn || e.target.closest("#leaderboard-filter-btn");
      
      if (!isInsidePopover && !isCustomSelect && !isFilterBtn) {
        togglePopover(false);
      }
    });

    function saveFilters() {
      sessionStorage.setItem(LEADERBOARD_FILTERS_KEY, JSON.stringify({
        country: countryFilter
      }));
    }

    function applyFilters() {
      if (countrySelect) countryFilter = countrySelect.getValue();
        if (filterBtn) filterBtn.classList.toggle("has-active-filters", countryFilter !== "All");
      saveFilters();
      togglePopover(false);
      switchTab(tabs.find(t => t.classList.contains("selected")), true);
    }

    popover.querySelector("#lf-clear").addEventListener("click", function () {
      countryFilter = "All";
      if (countrySelect) countrySelect.setValue("All");
      if (filterBtn) filterBtn.classList.remove("has-active-filters");
      saveFilters();
      togglePopover(false);
      switchTab(tabs.find(t => t.classList.contains("selected")), true);
    });

    popover.querySelector("#lf-apply").addEventListener("click", applyFilters);

    (function initCountryFilter() {
      const uniqueCountries = [
        ...new Set(users.map((u) => u.country).filter(Boolean)),
      ].sort();
      const opts = [{ value: "All", label: "All Everywhere" }].concat(
        uniqueCountries.map((c) => ({ value: c, label: c })),
      );
      const wrap = popover.querySelector("#leaderboard-country-wrap");
      countrySelect = window.ScratchSwipe.createCustomSelect(opts, countryFilter, () => {});
      wrap.appendChild(countrySelect);
    })();

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
        window.ScratchSwipe.populateDetailsPanel(detailsSection, user);
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
        window.ScratchSwipe.escapeHtml(user.username) +
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
          window.ScratchSwipe.escapeHtml(u.username) +
          '"><div class="info"><p class="name">' +
          window.ScratchSwipe.escapeHtml(u.username) +
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
          '"' + window.ScratchSwipe.escapeHtml(query) + '" not found in leaderboard.';
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
      if (!tabEl) return;
      tabs.forEach(function (t) {
        t.classList.remove("selected");
      });
      tabEl.classList.add("selected");
      activeTabLabel = tabEl.textContent.trim();
      activeKey = tabMap[activeTabLabel] || "followers_count";
      activeSuffix = tabSuffix[activeTabLabel] || "followers";

      var filtered = users;
      if (countryFilter !== "All") {
        filtered = users.filter(function (u) {
          return u.country === countryFilter;
        });
      }

      sortedUsers = filtered.slice().sort(function (a, b) {
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
    window.ScratchSwipe.hidePageLoading(leaderboardContent);
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    initLeaderboard,
  });
})();
