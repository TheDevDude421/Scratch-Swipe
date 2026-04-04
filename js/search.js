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

    var db = await window.ScratchSwipe.loadDatabase();
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
        window.ScratchSwipe.populateDetailsPanel(detailsSection, user);
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
          return window.ScratchSwipe.bioHasWord(bio, t);
        }))
          return 0;
      }
      return window.ScratchSwipe.scoreUserByQuery(user, query, filter);
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
