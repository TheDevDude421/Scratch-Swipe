(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  function formatJoinDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }

  function getRelativeYear(isoString) {
    return new Date(isoString).getFullYear();
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isNonLatinScript(code) {
    if (code >= 0x0400 && code <= 0x04ff) return true; // Cyrillic
    if (code >= 0x0600 && code <= 0x06ff) return true; // Arabic
    if (code >= 0x4e00 && code <= 0x9fff) return true; // CJK
    if (code >= 0x3040 && code <= 0x309f) return true; // Hiragana
    if (code >= 0x30a0 && code <= 0x30ff) return true; // Katakana
    if (code >= 0x0e00 && code <= 0x0e7f) return true; // Thai
    if (code >= 0x0900 && code <= 0x097f) return true; // Devanagari
    if (code >= 0xac00 && code <= 0xd7af) return true; // Korean
    if (code >= 0x1100 && code <= 0x11ff) return true; // Hangul Jamo
    if (code >= 0x0370 && code <= 0x03ff) return true; // Greek
    if (code >= 0x0590 && code <= 0x05ff) return true; // Hebrew
    if (code >= 0x0980 && code <= 0x09ff) return true; // Bengali
    if (code >= 0x0a00 && code <= 0x0a7f) return true; // Gurmukhi
    if (code >= 0x0a80 && code <= 0x0aff) return true; // Gujarati
    if (code >= 0x0b00 && code <= 0x0b7f) return true; // Oriya
    if (code >= 0x0b80 && code <= 0x0bff) return true; // Tamil
    if (code >= 0x0c00 && code <= 0x0c7f) return true; // Telugu
    if (code >= 0x0c80 && code <= 0x0cff) return true; // Kannada
    if (code >= 0x0d00 && code <= 0x0d7f) return true; // Malayalam
    if (code >= 0x0d80 && code <= 0x0dff) return true; // Sinhala
    if (code >= 0x1000 && code <= 0x109f) return true; // Myanmar
    if (code >= 0x1780 && code <= 0x17ff) return true; // Khmer
    if (code >= 0x18b0 && code <= 0x18ff) return true; // Mongolian
    if (code >= 0xaa00 && code <= 0xaa5f) return true; // Cham
    return false;
  }

  function isLikelyNonEnglish(text) {
    if (!text || text.length < 10) return false;
    var nonLatinCount = 0;
    for (var i = 0; i < text.length; i++) {
      if (isNonLatinScript(text.charCodeAt(i))) nonLatinCount++;
    }
    return nonLatinCount / text.length > 0.1;
  }

  function translateToEnglish(text) {
    return fetch(
      "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(text.substring(0, 500)) +
        "&langpair=autodetect|en",
    )
      .then(function (r) {
        return r.json();
      })
      .then(function (data) {
        if (
          data.responseStatus === 200 &&
          data.responseData &&
          data.responseData.translatedText
        ) {
          return data.responseData.translatedText;
        }
        throw new Error("Translation failed");
      });
  }

  function bioHasWord(bio, word) {
    if (!bio || !word) return false;
    // Fast path: if the word isn't in the bio at all, we're done
    const idx = bio.indexOf(word);
    if (idx === -1) return false;
    
    // Check if it's a standalone word using character boundaries to avoid RegExp overhead
    const before = idx === 0 ? " " : bio[idx - 1];
    const after = idx + word.length === bio.length ? " " : bio[idx + word.length];
    
    const isAlphanumeric = /[a-zA-Z0-9]/;
    if (!isAlphanumeric.test(before) && !isAlphanumeric.test(after)) return true;
    
    // Fallback only if the first occurrence wasn't a standalone word
    var escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp("\\b" + escaped + "\\b").test(bio);
  }

  function parseFilterTags(input) {
    if (!input || !input.trim()) return { required: [], optional: [], exclude: [] };
    var required = [];
    var optional = [];
    var exclude = [];
    var tokens = [];
    var current = "";
    var inGroup = false;

    for (var i = 0; i < input.length; i++) {
      var ch = input[i];
      if (ch === "{") {
        inGroup = true;
        current += ch;
      } else if (ch === "}") {
        inGroup = false;
        current += ch;
      } else if (ch === " " && !inGroup) {
        if (current.trim()) tokens.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    if (current.trim()) tokens.push(current.trim());

    tokens.forEach(function (token) {
      var type = "optional";
      if (token.startsWith("+")) {
        type = "required";
        token = token.substring(1);
      } else if (token.startsWith("-")) {
        type = "exclude";
        token = token.substring(1);
      }

      var terms = [];
      var regex = null;

      // Literal Regex Support: /pattern/
      if (token.startsWith("/") && token.lastIndexOf("/") > 0) {
        var lastIdx = token.lastIndexOf("/");
        var pattern = token.substring(1, lastIdx);
        var flags = token.substring(lastIdx + 1) || "i";
        try {
          regex = new RegExp(pattern, flags);
          terms = [token];
        } catch(e) {
          // Fallback if invalid
          console.warn("Invalid regex:", token);
        }
      }

      if (!regex) {
        if (token.startsWith("{") && token.endsWith("}")) {
          terms = token
            .slice(1, -1)
            .split("|")
            .map(function (t) { return t.trim().toLowerCase(); })
            .filter(Boolean);
        } else if (token.includes("|")) {
          terms = token
            .split("|")
            .map(function (t) { return t.trim().toLowerCase(); })
            .filter(Boolean);
        } else {
          var t = token.trim().toLowerCase();
          if (t) terms = [t];
        }

        if (terms.length) {
          // Use word boundaries \b to ensure "She" doesn't match "sheep"
          var pattern = terms.map(function(t) {
            return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          }).join("|");
          regex = new RegExp("\\b(" + pattern + ")\\b", "i");
        }
      }

      if (!regex) return;
      
      var entry = { terms: terms, regex: regex };
      if (type === "required") required.push(entry);
      else if (type === "exclude") exclude.push(entry);
      else optional.push(entry);
    });

    return { required: required, optional: optional, exclude: exclude };
  }

  function filterUserByTags(user, parsed) {
    if (!parsed.required.length && !parsed.optional.length && !parsed.exclude.length) return true;
    var bio = user.bio || "";
    
    // Exclude check
    for (var i = 0; i < parsed.exclude.length; i++) {
      if (parsed.exclude[i].regex.test(bio)) return false;
    }

    // Required check
    for (var i = 0; i < parsed.required.length; i++) {
      if (!parsed.required[i].regex.test(bio)) return false;
    }

    // Optional check
    if (parsed.optional.length > 0) {
      var anyMatch = false;
      for (var j = 0; j < parsed.optional.length; j++) {
        if (parsed.optional[j].regex.test(bio)) {
          anyMatch = true;
          break;
        }
      }
      if (!anyMatch) return false;
    }
    return true;
  }

  function scoreUserByQuery(user, query, filter, precompiledRegex) {
    var q = query.toLowerCase();
    if (!q) return 0;
    var score = 0;
    if (filter === "Users" || filter === "All") {
      var n = user.username.toLowerCase();
      if (n === q) score += 100;
      else if (n.startsWith(q)) score += 60;
      else if (n.includes(q)) score += 30;
    }
    if (filter === "Interests" || filter === "All") {
      var bio = user.bio || "";
      var re = precompiledRegex || new RegExp("\\b" + q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      if (re.test(bio)) score += 20;
      if (user.username.toLowerCase().includes(q)) score += 15;
    }
    if (filter === "Places" || filter === "All") {
      var c = (user.country || "").toLowerCase();
      if (c === q) score += 80;
      else if (c.includes(q)) score += 40;
    }
    if (filter === "IDs" || filter === "All") {
      var id = String(user.id || "");
      if (id === q) score += 100;
      else if (id.startsWith(q)) score += 60;
      else if (id.includes(q)) score += 30;
    }
    return score;
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    formatJoinDate,
    getRelativeYear,
    escapeHtml,
    isLikelyNonEnglish,
    translateToEnglish,
    bioHasWord,
    parseFilterTags,
    filterUserByTags,
    scoreUserByQuery,
  });
})();
