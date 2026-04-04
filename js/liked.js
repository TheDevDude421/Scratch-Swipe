(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  async function initLiked() {
    var likedContent = document.querySelector(".liked-content");
    if (!likedContent) return;
    window.ScratchSwipe.showPageLoading(
      likedContent,
      "Loading in progress",
      "Fetching your liked profiles",
    );
    var detailsSection = document.querySelector(".details-section");
    var db = await window.ScratchSwipe.loadDatabase();
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
    function renderEmptyState() {
      likedContent.innerHTML =
        '<div class="search-empty-state" style="position: relative; height: 100%; transform: none; top: 0; left: 0; justify-content: center;"><img src="empty-state-illustration.svg" alt=""><p class="empty-title">No likes yet</p><p class="empty-subtitle">Swipe right on profiles you like and they\'ll appear here</p></div>';
    }
    if (!liked.length) {
      renderEmptyState();
      window.ScratchSwipe.hidePageLoading(likedContent);
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
        window.ScratchSwipe.escapeHtml(fullUser.username || likedUser.username) +
        '"><div class="liked-grid-name">' +
        window.ScratchSwipe.escapeHtml(fullUser.username || likedUser.username) +
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
    window.ScratchSwipe.hidePageLoading(likedContent);
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    initLiked,
  });
})();
