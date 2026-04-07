(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  let _detailsPanelUser = null;
  let _translationCache = { username: null, translated: null };

  let _detailsEls = {};

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

    // Cache elements
    _detailsEls = {
      pfp: ds.querySelector(".profile-header .profile-picture"),
      name: ds.querySelector(".profile-header .name-text"),
      chips: ds.querySelector(".profile-header .chip-container"),
      bio: ds.querySelector(".bio"),
      headerRow: ds.querySelector(".about-me-header-row"),
      profileLink: ds.querySelector(".profile-link"),
      id: ds.querySelector(".id-container .id"),
      joinDate: ds.querySelector(".join-date"),
      country: ds.querySelector(".country-container .country"),
      heartBtn: ds.querySelector(".like-heart-btn"),
    };

    // Global listeners for cached elements
    if (_detailsEls.pfp) {
      _detailsEls.pfp.addEventListener("click", () => {
        if (_detailsPanelUser) {
          const pfpSrc = (_detailsPanelUser.profile_pic || "").replace(/_\d+x\d+/, "_200x200");
          window.ScratchSwipe.openPfpViewer(pfpSrc, _detailsPanelUser.username);
        }
      });
    }

    if (_detailsEls.heartBtn) {
      _detailsEls.heartBtn.addEventListener("click", () => {
        const u = _detailsPanelUser;
        if (!u) return;
        const nowLiked = window.ScratchSwipe.toggleUserLike(u);
        _detailsEls.heartBtn.className = nowLiked
          ? "fa-solid fa-heart like-heart-btn liked"
          : "fa-regular fa-heart like-heart-btn";
      });
    }
  }

  function populateDetailsPanel(detailsSection, user) {
    if (!detailsSection || !user) return;
    _detailsPanelUser = user;
    if (_translationCache.username !== user.username) {
      _translationCache = { username: user.username, translated: null };
    }

    const els = _detailsEls;
    const pfpSrc = (user.profile_pic || "").replace(/_\d+x\d+/, "_200x200");
    
    if (els.pfp) {
      els.pfp.src = pfpSrc;
      els.pfp.alt = user.username;
    }
    if (els.name) els.name.textContent = user.username;
    if (els.chips)
      els.chips.innerHTML =
        '<div class="chip-info">' +
        user.followers_count +
        " followers</div><div class=\"chip-info\">" +
        user.following_count +
        " following</div>";
    
    const originalBio = user.bio || "";
    if (els.bio) {
      els.bio.textContent = originalBio;
      els.bio._originalBio = originalBio;
      els.bio._isTranslated = false;
      window.ScratchSwipe.applyBioToggle(els.bio);
    }

    /* ── Translate button ── */
    if (els.headerRow) {
      var existingBtn = els.headerRow.querySelector(".translate-bio-btn");
      if (existingBtn) existingBtn.remove();

      if (window.ScratchSwipe.isLikelyNonEnglish(originalBio) && originalBio.length >= 10) {
        var translateBtn = document.createElement("button");
        translateBtn.className = "translate-bio-btn";
        translateBtn.title = "Translate to English";
        translateBtn.innerHTML =
          '<i class="fa-solid fa-language"></i>';
        translateBtn.addEventListener("click", function () {
          const bioEl = els.bio;
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
        els.headerRow.appendChild(translateBtn);
      }
    }

    if (els.profileLink) {
      els.profileLink.textContent = "@" + user.username;
      els.profileLink.href =
        "https://scratch.mit.edu/users/" + user.username + "/";
    }
    if (els.id) els.id.textContent = user.id || "";
    if (els.joinDate)
      els.joinDate.textContent = "Joined " + window.ScratchSwipe.formatJoinDate(user.joined);
    if (els.country) els.country.textContent = user.country || "Unknown";
    
    if (els.heartBtn) {
      if (window.ScratchSwipe.isUserLiked(user.username))
        els.heartBtn.className = "fa-solid fa-heart like-heart-btn liked";
      else
        els.heartBtn.className = "fa-regular fa-heart like-heart-btn";
    }
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    injectDetailsSection,
    populateDetailsPanel,
  });
})();
