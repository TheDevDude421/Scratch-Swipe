(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

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
        window.ScratchSwipe.openPfpViewer(pfpSrc, user.username),
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
      window.ScratchSwipe.applyBioToggle(bioEl);
    }

    /* ── Translate button ── */
    var headerRow = detailsSection.querySelector(".about-me-header-row");
    if (headerRow) {
      var existingBtn = headerRow.querySelector(".translate-bio-btn");
      if (existingBtn) existingBtn.remove();

      if (window.ScratchSwipe.isLikelyNonEnglish(originalBio) && originalBio.length >= 10) {
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
            window.ScratchSwipe.applyBioToggle(bioEl);
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
            window.ScratchSwipe.applyBioToggle(bioEl);
            return;
          }
          var spinIcon = translateBtn.querySelector("i");
          translateBtn.classList.add("translating");
          translateBtn.title = "Translating\u2026";
          if (spinIcon) spinIcon.className = "fa-solid fa-spinner fa-spin";
          window.ScratchSwipe.translateToEnglish(bioEl._originalBio)
            .then(function (translated) {
              _translationCache.translated = translated;
              bioEl.textContent = translated;
              bioEl._isTranslated = true;
              translateBtn.classList.remove("translating");
              translateBtn.classList.add("translated");
              translateBtn.title = "Show original";
              if (spinIcon) spinIcon.className = "fa-solid fa-language";
              window.ScratchSwipe.applyBioToggle(bioEl);
            })
            .catch(function () {
              translateBtn.classList.remove("translating");
              if (spinIcon) spinIcon.className = "fa-solid fa-language";
              window.ScratchSwipe.showToast("Translation failed");
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
      joinDateEl.textContent = "Joined " + window.ScratchSwipe.formatJoinDate(user.joined);
    const countryEl = detailsSection.querySelector(
      ".country-container .country",
    );
    if (countryEl) countryEl.textContent = user.country || "Unknown";
    const heartBtn = detailsSection.querySelector(".like-heart-btn");
    if (heartBtn) {
      const fresh = heartBtn.cloneNode(true);
      heartBtn.parentNode.replaceChild(fresh, heartBtn);
      if (window.ScratchSwipe.isUserLiked(user.username))
        fresh.className = "fa-solid fa-heart like-heart-btn liked";
      fresh.addEventListener("click", () => {
        const u = _detailsPanelUser;
        if (!u) return;
        const nowLiked = window.ScratchSwipe.toggleUserLike(u);
        fresh.className = nowLiked
          ? "fa-solid fa-heart like-heart-btn liked"
          : "fa-regular fa-heart like-heart-btn";
      });
    }
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    injectDetailsSection,
    populateDetailsPanel,
  });
})();
