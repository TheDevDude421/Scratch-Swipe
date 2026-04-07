(function() {
  "use strict";

  // Path to your placeholder image
  var FALLBACK_SRC = "profile_placeholder.png";
  var FALLBACK_APPLIED_ATTR = "data-fallback-active";

  function applyFallback(img) {
    // Prevent infinite loops if the placeholder itself fails
    if (img.getAttribute(FALLBACK_APPLIED_ATTR)) return;
    
    // Mark as fallback so we never try to fallback a fallback
    img.setAttribute(FALLBACK_APPLIED_ATTR, "true");
    img.src = FALLBACK_SRC;
    img.classList.add("img-fallback-active");
  }

  function checkImageStatus(img) {
    // Make sure we are only handling <img> elements
    if (img.tagName !== "IMG") return;
    if (img.getAttribute(FALLBACK_APPLIED_ATTR)) return;

    // 1. Handle standard network failures (no wifi, 404, etc.)
    // The browser naturally sets width/height to 0 when it fails to fetch.
    var isNetworkError = !img.complete || (img.complete && img.naturalWidth === 0);

    // 2. Handle CDN "Ghost" payloads (200 OK but returns empty/transparent pixel)
    // Scratch CDN sometimes does this when offline or for deleted users (?v=).
    // We assume valid profile pictures are at least a few pixels wide. 
    var isGhostPayload = img.complete && img.naturalWidth > 0 && img.naturalWidth <= 1 && img.naturalHeight <= 1;

    if (isNetworkError || isGhostPayload) {
      applyFallback(img);
    }
  }

  // Listen for BOTH load and error events using capturing phase
  // This ensures dynamically injected swipe/search cards are caught immediately.
  document.addEventListener("load", function(event) {
    checkImageStatus(event.target);
  }, true);

  document.addEventListener("error", function(event) {
    checkImageStatus(event.target);
  }, true);

  // Scan images that are already in the DOM when the script first loads
  var existingImages = document.querySelectorAll("img");
  for (var i = 0; i < existingImages.length; i++) {
    checkImageStatus(existingImages[i]);
  }

})();