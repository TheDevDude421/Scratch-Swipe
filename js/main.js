(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

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
      const app = document.querySelector(".app");
      if (app) app.appendChild(bottomArea);
    }

    if (bottomArea) {
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
    }

    const app = document.querySelector(".app");
    let detailsSectionCached = null;
    if (app) {
      app.addEventListener("click", function (e) {
        if (e.target.closest(".settings-overlay") || e.target.closest(".presets-overlay") || e.target.closest(".confirm-overlay") || e.target.closest(".pfp-overlay")) return;
        if (e.target.closest(".dating-card") || e.target.closest(".liked-grid-item") || e.target.closest(".leaderboard-search-result")) return;
        if (!detailsSectionCached) detailsSectionCached = document.querySelector(".details-section");
        var ds = detailsSectionCached;
        if (ds && ds.classList.contains("open") && !ds.contains(e.target)) {
          ds.classList.remove("open");
        }
      });
    }

    window.ScratchSwipe.createSettingsModal();
    window.ScratchSwipe.injectDetailsSection();

    if (onDiscover) window.ScratchSwipe.initIndex().catch(console.error);
    if (onSearch) window.ScratchSwipe.initSearch().catch(console.error);
    if (onLeaderboard) window.ScratchSwipe.initLeaderboard().catch(console.error);
    if (onLiked) window.ScratchSwipe.initLiked().catch(console.error);
  });
})();
