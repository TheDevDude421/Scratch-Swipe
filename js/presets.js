(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  var DEFAULT_PRESETS = [
    { name: "Only Females", tag: "+{female|woman|girl|lady|she|her|she/her|her/she|herself|queen}" },
    { name: "Only Males", tag: "+{male|man|boy|gentleman|guy|he|him|he/him|him/he|himself}" },
    { name: "Only Christian", tag: "+{christian|christ|jesus|follower of christ|man of god|woman of god|bible|church|believer|faith|jesus follower|godfaith|jesus follower|god}" },
    { name: "Only Hindu", tag: "+{hindu|sanatan|sanatani|dharma|dharma follower} {vishnu|shiva|krishna|rama|ganesh|hanuman|lakshmi|saraswati|durga|kali|parvati|indra|brahma|moksha|karma|spiritual}" },
  ];

  function openPresetsPopup(filterTagsInput) {
    var overlay = document.createElement("div");
    overlay.className = "presets-overlay";

    var userPresets = [];
    try {
      userPresets = JSON.parse(
        localStorage.getItem("scratchswipe_presets") || "[]",
      );
    } catch (_) {}

    function renderPresets() {
      var list = overlay.querySelector(".presets-list");
      list.innerHTML = "";

      if (DEFAULT_PRESETS.length) {
        var label1 = document.createElement("div");
        label1.className = "presets-section-label";
        label1.textContent = "Built-in";
        list.appendChild(label1);
        DEFAULT_PRESETS.forEach(function (p) {
          list.appendChild(createPresetItem(p, false, -1));
        });
      }

      if (userPresets.length) {
        var label2 = document.createElement("div");
        label2.className = "presets-section-label";
        label2.textContent = "Custom";
        list.appendChild(label2);
        userPresets.forEach(function (p, i) {
          list.appendChild(createPresetItem(p, true, i));
        });
      }

      if (!DEFAULT_PRESETS.length && !userPresets.length) {
        var empty = document.createElement("div");
        empty.className = "presets-empty";
        empty.textContent =
          "No presets yet. Add one using the + button above.";
        list.appendChild(empty);
      }
    }

    function createPresetItem(preset, canDelete, index) {
      var item = document.createElement("div");
      item.className = "preset-item";
      var info = document.createElement("div");
      info.className = "preset-info";
      var nameEl = document.createElement("span");
      nameEl.className = "preset-name";
      nameEl.textContent = preset.name;
      
      var summaryEl = window.ScratchSwipe.createFilterSummary(preset.tag);
      
      info.appendChild(nameEl);
      info.appendChild(summaryEl);
      item.appendChild(info);
      if (canDelete) {
        var delBtn = document.createElement("button");
        delBtn.className = "preset-delete-btn";
        delBtn.title = "Remove preset";
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.addEventListener("click", function (e) {
          e.stopPropagation();
          window.ScratchSwipe.showConfirm(
            'Remove "' + preset.name + '" preset?',
            function () {
              userPresets.splice(index, 1);
              try {
                localStorage.setItem(
                  "scratchswipe_presets",
                  JSON.stringify(userPresets),
                );
              } catch (_) {}
              renderPresets();
              window.ScratchSwipe.showToast("Preset removed");
            },
          );
        });
        item.appendChild(delBtn);
      }
      item.addEventListener("click", function () {
        currentFilterValue = preset.tag;
        updateTriggerLabel();
        if (filterTagsInput) filterTagsInput.value = preset.tag;
        closePresets();
      });
      return item;
    }

    var stickyHeader = document.createElement("div");
    stickyHeader.className = "presets-sticky-header";

    var currentFilterValue = filterTagsInput ? (filterTagsInput.value || "") : "";
    
    var inputRow = document.createElement("div");
    inputRow.className = "presets-input-row";
    
    const triggerBtn = document.createElement("button");
    triggerBtn.className = "filter-trigger-btn";
    triggerBtn.style.flex = "1";
    
    function updateTriggerLabel() {
      const parsed = window.ScratchSwipe.parseFilterTags(currentFilterValue);
      const count = parsed.required.length + parsed.optional.length + parsed.exclude.length;
      triggerBtn.innerHTML = `<span>Edit Filter Tags</span>` + (count > 0 ? `<span class="count-badge">${count} Groups</span>` : `<i class="fa-solid fa-chevron-right" style="font-size:10px; opacity:0.5;"></i>`);
    }
    
    triggerBtn.onclick = () => {
      window.ScratchSwipe.showFilterPopup(currentFilterValue, (newTags) => {
        currentFilterValue = newTags;
        updateTriggerLabel();
        if (filterTagsInput) filterTagsInput.value = newTags;
      });
    };
    
    updateTriggerLabel();

    var addBtn = document.createElement("button");
    addBtn.className = "presets-add-btn";
    addBtn.title = "Save as preset";
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    inputRow.appendChild(triggerBtn);
    inputRow.appendChild(addBtn);

    var headerActions = document.createElement("div");
    headerActions.className = "presets-header-actions";
    var titleSpan = document.createElement("span");
    titleSpan.className = "presets-title";
    titleSpan.textContent = "Presets";
    var closeBtn = document.createElement("button");
    closeBtn.className = "presets-close-btn";
    closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    headerActions.appendChild(titleSpan);
    headerActions.appendChild(closeBtn);

    stickyHeader.appendChild(inputRow);
    stickyHeader.appendChild(headerActions);

    var listWrap = document.createElement("div");
    listWrap.className = "presets-list";

    var modal = document.createElement("div");
    modal.className = "presets-modal";
    modal.appendChild(stickyHeader);
    modal.appendChild(listWrap);
    overlay.appendChild(modal);

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));

    function closePresets() {
      overlay.classList.remove("visible");
      setTimeout(() => overlay.remove(), 220);
    }

    closeBtn.addEventListener("click", closePresets);
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closePresets();
    });

    addBtn.addEventListener("click", function () {
      var tagValue = currentFilterValue.trim();
      if (!tagValue) {
        window.ScratchSwipe.showToast("Add some filter tags first");
        return;
      }
      window.ScratchSwipe.showPrompt("Name this preset", "", function (name) {
        userPresets.push({ name: name, tag: tagValue });
        try {
          localStorage.setItem(
            "scratchswipe_presets",
            JSON.stringify(userPresets),
          );
        } catch (_) {}
        renderPresets();
        window.ScratchSwipe.showToast("Preset added");
      });
    });

    document.addEventListener("keydown", function h(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        closePresets();
        document.removeEventListener("keydown", h);
      }
    });

    renderPresets();
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    DEFAULT_PRESETS,
    openPresetsPopup,
  });
})();
