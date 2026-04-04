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
    var db = await window.ScratchSwipe.loadDatabase();
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
            score: window.ScratchSwipe.scoreUserByQuery(u, searchQuery, effectiveFilter),
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
              return window.ScratchSwipe.bioHasWord(bio, tag);
            });
          });
        }
      }
    }

    function applyCurrentFilters() {
      if (isSearchMode) return;
      var parsed = window.ScratchSwipe.parseFilterTags(currentFilters.filterTags || "");
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
        if (!window.ScratchSwipe.filterUserByTags(u, parsed)) return false;
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
      window.ScratchSwipe.populateDetailsPanel(
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
    window.ScratchSwipe.hidePageLoading(datingContent);
    renderStack(false);
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    initIndex,
  });
})();
