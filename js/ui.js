(function() {
  "use strict";
  window.ScratchSwipe = window.ScratchSwipe || {};

  /* ----------------------------------------------------------
     Injected styles
  ---------------------------------------------------------- */
  const sharedStyle = document.createElement("style");
  sharedStyle.textContent = `
    @keyframes slideUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
    .result-animate { animation: slideUp 0.32s cubic-bezier(0.22, 1, 0.36, 1) both; }
    .no-animations .result-animate { animation: none !important; }

    .card-stack-wrapper { position: relative; width: 90%; max-width: 400px; aspect-ratio: 1 / 1; margin-bottom: 20px; }
    .card-stack-wrapper .dating-card, .card-stack-wrapper .ghost-card {
      position: absolute !important; top: 0 !important; left: 0 !important;
      width: 100% !important; max-width: 100% !important; height: 100% !important;
      border-radius: 12px; transform-origin: center bottom; overflow: hidden;
    }
    .card-stack-wrapper .dating-card { z-index: 10; display: flex; flex-direction: column; justify-content: flex-end; }
    .card-stack-wrapper .ghost-card {
      background-color: rgba(255,255,255,0.1); pointer-events: none;
      display: flex; flex-direction: column; justify-content: flex-end;
      transition: transform 0.34s cubic-bezier(0.32, 0.72, 0, 1), opacity 0.34s ease;
    }
    .card-stack-wrapper .ghost-card .profile-picture, .card-stack-wrapper .ghost-card .dating-card-content { clip-path: inset(0 100% 0 0); transition: clip-path 0.01s; }
    .card-stack-wrapper .ghost-card .gradient-overlay { visibility: hidden; }
    .card-stack-wrapper.swiping .ghost-card.ghost-1 .profile-picture, .card-stack-wrapper.swiping .ghost-card.ghost-1 .dating-card-content { clip-path: none; transition: clip-path 0.01s; }
    .card-stack-wrapper.swiping .ghost-card.ghost-1 .gradient-overlay { visibility: visible; }
    .card-stack-wrapper .ghost-card .profile-picture { position: absolute; top: 0; left: 0; width: 100%; height: 100%; border-radius: 12px; object-fit: cover; z-index: 0; background-color: black; }
    .card-stack-wrapper .ghost-card.ghost-1 { z-index: 9; transform: scale(0.95) translateY(10px); opacity: 0.7; }
    .card-stack-wrapper .ghost-card.ghost-2 { z-index: 8; transform: scale(0.90) translateY(20px); opacity: 0.45; }
    @keyframes ghostFadeIn { from { opacity: 0; } to { opacity: 0.45; } }
    .card-stack-wrapper .ghost-card.ghost-2.fade-in { animation: ghostFadeIn 0.4s ease forwards; }
    .card-stack-wrapper.swiping .ghost-card.ghost-1 { transform: scale(1) translateY(0); opacity: 1; }
    .card-stack-wrapper.swiping .ghost-card.ghost-2 { transform: scale(0.95) translateY(10px); opacity: 0.7; }

    @keyframes swipeRight { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(800px); opacity: 0; } }
    @keyframes swipeLeft { 0% { transform: translateX(0); opacity: 1; } 100% { transform: translateX(-800px); opacity: 0; } }
    .swipe-right-anim { animation: swipeRight 0.34s cubic-bezier(0.55, 0, 0.85, 1) forwards !important; transition: none !important; }
    .swipe-left-anim { animation: swipeLeft 0.34s cubic-bezier(0.55, 0, 0.85, 1) forwards !important; transition: none !important; }

    .ambient-layer { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(45px) saturate(3); z-index: 0; pointer-events: none; border-radius: inherit; transition: opacity 0.35s ease; }
    .ambient-layer.hidden { opacity: 0; } .ambient-layer.visible { opacity: 0.25; }
    .ambient-off .ambient-layer { display: none !important; }
    .preload-pool { position: fixed; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; left: -9999px; top: -9999px; }
    .search-results .dating-card { cursor: pointer; }
    .bio-truncated { display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden; }
    .bio-read-toggle { all: unset; color: #0088ff; font-size: 12px; cursor: pointer; display: block; margin-top: 4px; }

    .search-section-header { display: flex; align-items: center; gap: 6px; font-size: 13px; margin: 12px 0 4px; }
    .search-section-header .section-count { color: var(--white3); font-weight: normal; }
    .search-section-discover-btn { margin-left: auto; cursor: pointer; color: var(--white3); font-size: 13px; transition: color 0.2s; flex-shrink: 0; padding: 2px; }
    .search-section-discover-btn:hover { color: var(--primary); }

    .search-load-sentinel { width: 100%; display: flex; justify-content: center; padding: 20px 0 12px; }
    @keyframes spinLoader { to { transform: rotate(360deg); } }
    .search-load-sentinel img { width: 26px; height: 26px; animation: spinLoader 0.7s linear infinite; }

    .leaderboard-results { display: flex; flex-direction: column; gap: 4px; margin-top: 10px; }
    .leaderboard-results .dating-card { width: 100%; height: 54px; display: flex; flex-direction: row; align-items: center; gap: 10px; cursor: pointer; }
    .leaderboard-results .dating-card-rank { font-size: 16px; font-weight: bold; color: #868686; min-width: 28px; text-align: right; flex-shrink: 0; }
    .leaderboard-results .dating-card-rank.rank-1 { color: #f9c53a; } .leaderboard-results .dating-card-rank.rank-2 { color: #b0b8c8; } .leaderboard-results .dating-card-rank.rank-3 { color: #d18e31; }
    .leaderboard-results .profile-picture { height: 80%; aspect-ratio: 1 / 1; border-radius: 360px; object-fit: cover; flex-shrink: 0; }
    .leaderboard-results .dating-card-content { display: flex; flex-direction: column; justify-content: center; gap: 3px; overflow: hidden; }
    .leaderboard-results .name { font-size: 14px; font-weight: bold; color: #dedede; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .leaderboard-results .stats { font-size: 11px; color: #868686; }
    .leaderboard-highlight { background-color: var(--bg1); border-radius: 10px; }
    .leaderboard-search-result { margin-bottom: 12px; padding: 12px; border-radius: 10px; background-color: var(--bg1); display: flex; align-items: center; gap: 10px; cursor: pointer; }
    .leaderboard-search-result .rank-badge { font-size: 22px; font-weight: bold; color: #dedede; min-width: 40px; text-align: center; }
    .leaderboard-search-result .profile-picture { width: 40px; height: 40px; border-radius: 360px; object-fit: cover; }
    .leaderboard-search-result .info .name { font-size: 14px; font-weight: bold; color: #dedede; }
    .leaderboard-search-result .info .stats { font-size: 11px; color: #868686; margin-top: 2px; }
    .leaderboard-not-found { color: #868686; font-size: 13px; margin-bottom: 12px; text-align: center; }

    .liked-content { height: 100%; padding: 15px; padding-top: 0; box-sizing: border-box; overflow-y: auto; padding-bottom: 100px; }
    .liked-content::-webkit-scrollbar { width: 10px; background-color: black; }
    .liked-content::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.15); border-radius: 360px; }
    .liked-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
    .liked-grid-item { position: relative; aspect-ratio: 1 / 1; border-radius: 8px; overflow: hidden; cursor: pointer; }
    .liked-grid-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .liked-grid-item .liked-grid-name { position: absolute; bottom: 0; left: 0; right: 0; padding: 8px 10px; font-size: 12px; font-weight: bold; color: #fff; background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .remove-like-btn { position: absolute; top: 8px; right: 8px; width: 26px; height: 26px; border-radius: 360px; background: rgba(0, 0, 0, 0.5); backdrop-filter: blur(4px); border: none; color: white; display: flex; align-items: center; justify-content: center; cursor: pointer; z-index: 10; transition: background 0.2s ease, transform 0.1s ease; }
    .remove-like-btn:hover { background: rgba(255, 50, 50, 0.8); transform: scale(1.1); }

    .pfp-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.75); z-index: 9999; display: flex; align-items: center; justify-content: center; animation: pfpOverlayIn 0.22s ease forwards; }
    @keyframes pfpOverlayIn { from { opacity: 0; } to { opacity: 1; } }
    .pfp-overlay img { width: min(80vw, 80vh, 340px); height: min(80vw, 80vh, 340px); aspect-ratio: 1 / 1; object-fit: cover; border-radius: 8px; animation: pfpImgIn 0.26s cubic-bezier(0.32, 0.72, 0, 1) forwards; }
    @keyframes pfpImgIn { from { transform: scale(0.55); opacity: 0; } to { transform: scale(1); opacity: 1; } }
    @keyframes pfpImgOut { from { transform: scale(1); opacity: 1; } to { transform: scale(0.55); opacity: 0; } }
    @keyframes pfpOverlayOut { from { opacity: 1; } to { opacity: 0; } }

    .details-section .profile-header .profile-picture { cursor: pointer; }
    .id-container { display: flex; flex-direction: row; align-items: center; gap: 5px; font-size: 14px; }
    .id-container .icon { color: var(--white4); font-size: 12px; } .id-container .id { color: var(--white3); }

    .search-empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px 20px; gap: 10px; text-align: center; position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); }
    .search-empty-state img { opacity: 0.4; width: 330px; margin-bottom: 6px; user-select: none; }
    .search-empty-state .empty-title { color: var(--white1, #dedede); font-size: 16px; font-weight: bold; }
    .search-empty-state .empty-subtitle { color: var(--white3, #868686); font-size: 12px; }

    .page-loader { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; z-index: 50; }
    .page-loader-spinner { width: 36px; height: 36px; animation: spinLoader 0.7s linear infinite; }
    .page-loader-msg { color: var(--white1); font-size: 15px; font-weight: bold; margin: 0; }
    .page-loader-sub { color: var(--white3); font-size: 12px; margin: 0; text-align: center; max-width: 220px; line-height: 1.4; }

    .details-section .like-heart-btn { flex-shrink: 0; cursor: pointer; font-size: 15px; color: var(--white3); transition: color 0.2s, transform 0.15s; margin-left: 8px; }
    .details-section .like-heart-btn:hover { color: #ff4d6a; } .details-section .like-heart-btn:active { transform: scale(0.8); }
    .details-section .like-heart-btn.liked { color: #ff4d6a; }

    .about-me-header-row { display: flex; align-items: center; gap: 8px; }
    .translate-bio-btn { background: none; border: none; color: var(--white3); font-size: 13px; cursor: pointer; padding: 2px 6px; border-radius: 4px; transition: color 0.2s, background 0.15s; display: flex; align-items: center; flex-shrink: 0; }
    .translate-bio-btn:hover { color: var(--primary); background: rgba(255,255,255,0.06); }
    .translate-bio-btn.translating { color: var(--primary); pointer-events: none; }
    .translate-bio-btn.translated { color: var(--primary); }
    .translate-bio-btn .fa-spin { animation-duration: 0.5s; }

    /* ── Search Sticky Controls ── */
    .search-controls-sticky {
      position: sticky; top: 0; z-index: 999;
      background-color: black; padding-bottom: 10px;
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
    }
    .search-controls-sticky .chip-container { position: static !important; background: transparent !important; padding-bottom: 0 !important; }
    .search-filter-btn { background: none; border: none; color: var(--white3); font-size: 15px; cursor: pointer; padding: 8px; border-radius: 8px; transition: color 0.2s, background 0.15s; flex-shrink: 0; }
    .search-filter-btn:hover { color: var(--white1); background: rgba(255,255,255,0.06); }
    .search-filter-btn.has-active-filters { color: var(--primary); }
    .search-filter-popover { position: absolute; top: calc(100% + 6px); right: 0; width: 260px; background: var(--bg2); border: 1px solid var(--bg4); border-radius: 14px; padding: 16px; z-index: 10001; display: flex; flex-direction: column; gap: 12px; box-shadow: 0 12px 40px rgba(0,0,0,0.5); opacity: 0; transform: translateY(-8px) scale(0.97); pointer-events: none; transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
    .search-filter-popover.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .search-filter-sort { display: flex; gap: 3px; background: var(--bg1); border-radius: 8px; padding: 3px; }
    .search-filter-sort-option { flex: 1; padding: 7px 0; text-align: center; font-size: 11px; font-weight: bold; color: var(--white3); border-radius: 6px; cursor: pointer; transition: background 0.2s, color 0.2s; user-select: none; }
    .search-filter-sort-option.selected { background: var(--bg4); color: var(--white1); }
    .search-filter-popover input[type="text"] { width: 100%; background: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 9px 11px; border-radius: 8px; font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .search-filter-popover input[type="text"]:focus { border-color: var(--primary); }
    .search-filter-popover input[type="text"]::placeholder { color: var(--white3); }
    .search-filter-popover .sf-label { color: var(--white3); font-size: 11px; font-weight: bold; margin: 0; }
    .search-filter-popover .sf-desc { color: var(--white3); font-size: 10px; margin: 0; opacity: 0.7; }

    /* ── Discover Back-to-Search Banner ── */
    .discover-back-banner {
        width: 100%;
        box-sizing: border-box;
        padding: 12px 16px;
        padding-top: 0;
        margin-left: 5px;
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--white3);
        font-size: 13px;
        cursor: pointer;
        flex-shrink: 0;
        z-index: 20;
    }

    /* ── Filter Presets Popup ── */
    .presets-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); z-index: 10001; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }
    .presets-overlay.visible { opacity: 1; pointer-events: auto; }
    .presets-modal { background: var(--bg2); width: 90%; max-width: 340px; max-height: 480px; border-radius: 16px; display: flex; flex-direction: column; overflow: hidden; transform: translateY(16px) scale(0.97); transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1); box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
    .presets-overlay.visible .presets-modal { transform: translateY(0) scale(1); }
    .presets-sticky-header { padding: 16px; background: var(--bg2); position: sticky; top: 0; z-index: 1; display: flex; flex-direction: column; gap: 10px; border-bottom: 1px solid var(--bg4); flex-shrink: 0; }
    .presets-input-row { display: flex; align-items: center; gap: 8px; }
    .presets-input-row input { flex: 1; background: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 9px 11px; border-radius: 8px; font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .presets-input-row input::placeholder { color: var(--white3); }
    .presets-input-row input:focus { border-color: var(--primary); }
    .presets-add-btn { width: 34px; height: 34px; border-radius: 8px; background: var(--bg1); border: 1px solid var(--bg4); color: var(--white3); cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0; transition: background 0.2s, color 0.2s, border-color 0.2s; }
    .presets-add-btn:hover { background: var(--primary); color: #fff; border-color: var(--primary); }
    .presets-header-actions { display: flex; align-items: center; justify-content: space-between; }
    .presets-header-actions .presets-title { color: var(--white1); font-size: 14px; font-weight: bold; }
    .presets-close-btn { background: none; border: none; color: var(--white3); font-size: 14px; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: background 0.15s; }
    .presets-close-btn:hover { background: rgba(255,255,255,0.08); }
    .presets-list { flex: 1; overflow-y: auto; padding: 4px 0; }
    .presets-list::-webkit-scrollbar { width: 5px; } .presets-list::-webkit-scrollbar-track { background: transparent; } .presets-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    .presets-section-label { color: var(--white3); font-size: 10px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px; padding: 10px 16px 4px; }
    .preset-item { padding: 10px 16px; cursor: pointer; transition: background 0.12s; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .preset-item:hover { background: rgba(255,255,255,0.05); }
    .preset-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .preset-name { color: var(--white1); font-size: 13px; font-weight: 600; }
    .preset-tag { color: var(--white3); font-size: 11px; font-family: monospace; overflow-wrap: break-word; }
    .preset-delete-btn { background: none; border: none; color: var(--white3); font-size: 12px; cursor: pointer; padding: 4px 6px; border-radius: 4px; transition: color 0.2s, background 0.15s; flex-shrink: 0; }
    .preset-delete-btn:hover { color: #ff6b6b; background: rgba(255,80,80,0.1); }
    .presets-empty { padding: 30px 16px; text-align: center; color: var(--white3); font-size: 13px; }
    .view-presets-link { color: var(--primary); font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 7.5px; transition: opacity 0.2s; user-select: none; flex-shrink: 0; }
    .view-presets-link:hover { opacity: 0.8; }
        @media (hover: none) and (pointer: coarse) {
      input[type="text"], input[type="number"], input[type="search"], .prompt-input, .custom-select-search-input, .search-input { font-size: 16px !important; }
    }

    /* ══════════════════════════════════════════════════════
       Settings Modal
       ══════════════════════════════════════════════════════ */
    .settings-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.75); z-index: 10000; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.25s ease; }
    .settings-overlay.visible { opacity: 1; pointer-events: auto; }
    .settings-modal { background-color: var(--bg2); width: 90%; max-width: 340px; height: 560px; border-radius: 16px; padding: 20px; box-sizing: border-box; transform: translateY(20px) scale(0.95); transition: transform 0.25s cubic-bezier(0.32, 0.72, 0, 1); display: flex; flex-direction: column; gap: 14px; overflow: hidden; }
    .settings-overlay.visible .settings-modal { transform: translateY(0) scale(1); }
    .settings-modal-header { display: flex; justify-content: space-between; align-items: center; flex-shrink: 0; }
    .settings-modal-header h3 { color: var(--white1); font-size: 18px; margin: 0; }
    .close-settings { background: none; border: none; color: var(--white3); font-size: 16px; cursor: pointer; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; transition: background 0.15s; }
    .close-settings:hover { background: rgba(255,255,255,0.08); }
    .settings-tabs { display: flex; gap: 3px; background: var(--bg1); border-radius: 10px; padding: 3px; flex-shrink: 0; }
    .settings-tab { flex: 1; padding: 8px 0; text-align: center; font-size: 11px; font-weight: bold; color: var(--white3); border-radius: 8px; cursor: pointer; transition: background 0.25s ease, color 0.25s ease; user-select: none; }
    .settings-tab:hover { color: var(--white1); } .settings-tab.active { background: var(--bg4); color: var(--white1); }
    .settings-tab-content { display: none; flex-direction: column; gap: 14px; overflow-y: auto; flex: 1; min-height: 0; padding-right: 2px; }
    .settings-tab-content.active { display: flex; }
    .settings-tab-content::-webkit-scrollbar { width: 4px; } .settings-tab-content::-webkit-scrollbar-track { background: transparent; } .settings-tab-content::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
    .settings-modal label.field-label { color: var(--white3); font-size: 12px; font-weight: bold; margin: 0; }
    .settings-modal input[type="text"] { width: 100%; background-color: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 10px 12px; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .settings-modal input[type="text"]:focus { border-color: var(--primary); }
    .settings-modal input[type="number"] { width: 100%; background-color: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 10px 12px; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.2s; -moz-appearance: textfield; }
    .settings-modal input[type="number"]:focus { border-color: var(--primary); }
    .settings-modal input[type="number"]::-webkit-inner-spin-button, .settings-modal input[type="number"]::-webkit-outer-spin-button { display: none; }
    .toggle-switch { position: relative; width: 44px; height: 24px; background: var(--bg4, #2a2a2a); border-radius: 12px; cursor: pointer; transition: background 0.3s cubic-bezier(0.4, 0, 0.2, 1); flex-shrink: 0; }
    .toggle-switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 20px; height: 20px; background: #fff; border-radius: 50%; transition: transform 0.3s cubic-bezier(0.68, -0.3, 0.265, 1.3); box-shadow: 0 1px 3px rgba(0,0,0,0.3); }
    .toggle-switch.active { background: var(--primary, #0088ff); } .toggle-switch.active::after { transform: translateX(20px); }
    .setting-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .setting-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .setting-label { color: var(--white1); font-size: 13px; font-weight: 600; } .setting-desc { color: var(--white3); font-size: 11px; line-height: 1.35; }
    .custom-select { position: relative; width: 100%; }
    .custom-select-trigger { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; background: var(--bg1); border: 1px solid var(--bg4); border-radius: 10px; cursor: pointer; color: var(--white1); font-size: 14px; transition: border-color 0.2s; user-select: none; }
    .custom-select-trigger.open { border-color: var(--primary); }
    .custom-select-chevron { font-size: 11px; color: var(--white3); transition: transform 0.25s ease; flex-shrink: 0; } .custom-select-trigger.open .custom-select-chevron { transform: rotate(180deg); }
    .custom-select-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; background: var(--bg1); border: 1px solid var(--bg4); border-radius: 12px; z-index: 200; opacity: 0; transform: translateY(-8px) scale(0.98); pointer-events: none; transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); overflow: hidden; box-shadow: 0 12px 40px rgba(0,0,0,0.5); }
    .custom-select-dropdown.open { opacity: 1; transform: translateY(0) scale(1); pointer-events: auto; }
    .custom-select-search-wrap { padding: 6px 6px 0; position: sticky; top: 0; z-index: 1; }
    .custom-select-search-input { width: 100%; background: var(--bg2); border: 1px solid var(--bg4); color: var(--white1); padding: 8px 10px; border-radius: 8px; font-size: 13px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .custom-select-search-input::placeholder { color: var(--white3); } .custom-select-search-input:focus { border-color: var(--primary); }
    .custom-select-options { max-height: 180px; overflow-y: auto; padding: 4px 6px 6px; }
    .custom-select-options::-webkit-scrollbar { width: 5px; } .custom-select-options::-webkit-scrollbar-track { background: transparent; margin: 4px 0; } .custom-select-options::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
    .custom-select-option { padding: 8px 10px; border-radius: 8px; color: var(--white3); font-size: 13px; cursor: pointer; transition: background 0.12s, color 0.12s; }
    .custom-select-option:hover { background: rgba(255,255,255,0.07); color: var(--white1); }
    .custom-select-option.selected { background: var(--primary, #0088ff); color: #fff; font-weight: 600; }
    .custom-select-empty { padding: 16px 10px; text-align: center; color: var(--white3); font-size: 12px; }
    .settings-btn-group { display: flex; gap: 10px; margin-top: 4px; }
    .settings-btn-group button { flex: 1; padding: 12px; border-radius: 10px; border: none; font-size: 14px; font-weight: bold; cursor: pointer; transition: filter 0.2s ease, transform 0.1s; }
    .settings-btn-group button:active { transform: scale(0.97); } .settings-btn-group button:hover { filter: brightness(1.15); }
    .btn-clear { background-color: var(--bg4); color: var(--white1); } .btn-apply { background-color: var(--primary); color: #fff; }
    .btn-danger { width: 100%; padding: 11px; border-radius: 10px; border: 1px solid rgba(255,80,80,0.3); background: rgba(255,80,80,0.1); color: #ff6b6b; font-size: 13px; font-weight: 600; cursor: pointer; transition: background 0.2s, border-color 0.2s; }
    .btn-danger:hover { background: rgba(255,80,80,0.2); border-color: rgba(255,80,80,0.5); }
    .settings-note { color: var(--white3); font-size: 11px; text-align: center; opacity: 0.7; line-height: 1.4; }
    .discover-loading { color: var(--white3); font-size: 12px; text-align: center; padding: 12px 0; }
    .confirm-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); z-index: 10002; display: flex; align-items: center; justify-content: center; opacity: 0; pointer-events: none; transition: opacity 0.2s ease; }
    .confirm-overlay.visible { opacity: 1; pointer-events: auto; }
    .confirm-modal { background: var(--bg2); border-radius: 14px; padding: 22px; width: 80%; max-width: 280px; box-sizing: border-box; display: flex; flex-direction: column; gap: 16px; transform: scale(0.92); transition: transform 0.2s cubic-bezier(0.32, 0.72, 0, 1); }
    .confirm-overlay.visible .confirm-modal { transform: scale(1); }
    .confirm-message { color: var(--white1); font-size: 14px; font-weight: 600; text-align: center; margin: 0; line-height: 1.4; }
    .confirm-buttons { display: flex; gap: 10px; }
    .confirm-buttons button { flex: 1; padding: 10px; border-radius: 10px; border: none; font-size: 13px; font-weight: bold; cursor: pointer; transition: filter 0.2s ease, transform 0.1s; }
    .confirm-buttons button:active { transform: scale(0.97); } .confirm-buttons button:hover { filter: brightness(1.15); }
    .confirm-cancel { background: var(--bg4); color: var(--white1); } .confirm-yes { background: rgba(255,80,80,0.8); color: #fff; }
    .prompt-input { width: 100%; background: var(--bg1); border: 1px solid var(--bg4); color: var(--white1); padding: 10px 12px; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; transition: border-color 0.2s; }
    .prompt-input::placeholder { color: var(--white3); }
    .prompt-input:focus { border-color: var(--primary); }
    .ss-toast { position: fixed; bottom: 90px; left: 50%; transform: translateX(-50%) translateY(12px); background: var(--bg4, #2a2a2a); color: var(--white1); padding: 10px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; z-index: 99999; opacity: 0; pointer-events: none; transition: opacity 0.25s ease, transform 0.25s ease; box-shadow: 0 4px 20px rgba(0,0,0,0.4); white-space: nowrap; }
    .ss-toast.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
    .zoom-stepper { display: flex; align-items: center; gap: 0; background: var(--bg1); border-radius: 10px; border: 1px solid var(--bg4); overflow: hidden; }
    .zoom-stepper-btn { width: 40px; height: 38px; background: none; border: none; color: var(--white3); font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: background 0.15s, color 0.15s; }
    .zoom-stepper-btn:hover { background: rgba(255,255,255,0.06); color: var(--white1); }
    .zoom-stepper-btn:active { background: rgba(255,255,255,0.1); }
    .zoom-stepper-btn:disabled { opacity: 0.3; pointer-events: none; }
    .zoom-stepper-value { width: 52px; text-align: center; font-size: 14px; font-weight: bold; color: var(--white1); border-left: 1px solid var(--bg4); border-right: 1px solid var(--bg4); padding: 8px 0; user-select: none; }
  `;
  document.head.appendChild(sharedStyle);

  function showPageLoading(container, message, sub) {
    if (container.querySelector(".page-loader")) return;
    const loader = document.createElement("div");
    loader.className = "page-loader";
    loader.innerHTML =
      '<img src="loading.svg" alt="Loading" class="page-loader-spinner">' +
      '<p class="page-loader-msg">' +
      (message || "Loading in progress") +
      "</p>" +
      '<p class="page-loader-sub">' +
      (sub || "Please wait while data is being fetched") +
      "</p>";
    container.style.position = "relative";
    container.appendChild(loader);
  }

  function hidePageLoading(container) {
    const loader = container.querySelector(".page-loader");
    if (loader) loader.remove();
  }

  function createCustomSelect(options, selectedValue, onChange) {
    const container = document.createElement("div");
    container.className = "custom-select";
    const trigger = document.createElement("div");
    trigger.className = "custom-select-trigger";
    const current =
      options.find((o) => o.value === selectedValue) || options[0];
    const valueSpan = document.createElement("span");
    valueSpan.className = "custom-select-value";
    valueSpan.textContent = current ? current.label : "";
    const chevron = document.createElement("i");
    chevron.className = "fa-solid fa-chevron-down custom-select-chevron";
    trigger.appendChild(valueSpan);
    trigger.appendChild(chevron);
    const dropdown = document.createElement("div");
    dropdown.className = "custom-select-dropdown";
    const searchWrap = document.createElement("div");
    searchWrap.className = "custom-select-search-wrap";
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.placeholder = "Search\u2026";
    searchInput.className = "custom-select-search-input";
    searchInput.setAttribute("autocomplete", "off");
    searchWrap.appendChild(searchInput);
    const optionsWrap = document.createElement("div");
    optionsWrap.className = "custom-select-options";
    let currentValue = selectedValue;

    function renderOptions(filter) {
      filter = (filter || "").toLowerCase();
      optionsWrap.innerHTML = "";
      const filtered = options.filter((o) =>
        o.label.toLowerCase().includes(filter),
      );
      if (!filtered.length) {
        const empty = document.createElement("div");
        empty.className = "custom-select-empty";
        empty.textContent = "No results found";
        optionsWrap.appendChild(empty);
        return;
      }
      filtered.forEach((opt) => {
        const el = document.createElement("div");
        el.className =
          "custom-select-option" +
          (opt.value === currentValue ? " selected" : "");
        el.textContent = opt.label;
        el.addEventListener("mousedown", (e) => {
          e.preventDefault();
          currentValue = opt.value;
          valueSpan.textContent = opt.label;
          closeDropdown();
          optionsWrap
            .querySelectorAll(".custom-select-option")
            .forEach((x) => x.classList.remove("selected"));
          el.classList.add("selected");
          onChange(opt.value);
        });
        optionsWrap.appendChild(el);
      });
    }

    renderOptions("");
    searchInput.addEventListener("input", () =>
      renderOptions(searchInput.value),
    );
    dropdown.appendChild(searchWrap);
    dropdown.appendChild(optionsWrap);
    container.appendChild(trigger);
    container.appendChild(dropdown);
    let isOpen = false;

    function openDropdown() {
      isOpen = true;
      trigger.classList.add("open");
      dropdown.classList.add("open");
      renderOptions("");
      setTimeout(() => searchInput.focus(), 60);
    }
    function closeDropdown() {
      isOpen = false;
      trigger.classList.remove("open");
      dropdown.classList.remove("open");
      searchInput.value = "";
    }
    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      if (isOpen) closeDropdown();
      else openDropdown();
    });
    document.addEventListener("click", (e) => {
      if (isOpen && !container.contains(e.target)) closeDropdown();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isOpen) closeDropdown();
    });
    container.setValue = function (val) {
      currentValue = val;
      const f = options.find((o) => o.value === val);
      if (f) valueSpan.textContent = f.label;
      renderOptions("");
    };
    container.getValue = function () {
      return currentValue;
    };
    return container;
  }

  function createToggleSwitch(checked, onChange) {
    const toggle = document.createElement("div");
    toggle.className = "toggle-switch" + (checked ? " active" : "");
    toggle.setAttribute("role", "switch");
    toggle.setAttribute("aria-checked", String(checked));
    toggle.setAttribute("tabindex", "0");
    function flip() {
      checked = !checked;
      toggle.classList.toggle("active", checked);
      toggle.setAttribute("aria-checked", String(checked));
      onChange(checked);
    }
    toggle.addEventListener("click", flip);
    toggle.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        flip();
      }
    });
    toggle.setChecked = function (v) {
      checked = !!v;
      toggle.classList.toggle("active", checked);
      toggle.setAttribute("aria-checked", String(checked));
    };
    return toggle;
  }

  function showConfirm(message, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    const modal = document.createElement("div");
    modal.className = "confirm-modal";
    const msg = document.createElement("p");
    msg.className = "confirm-message";
    msg.textContent = message;
    const btnWrap = document.createElement("div");
    btnWrap.className = "confirm-buttons";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "confirm-cancel";
    cancelBtn.textContent = "Cancel";
    const yesBtn = document.createElement("button");
    yesBtn.className = "confirm-yes";
    yesBtn.textContent = "Yes";
    btnWrap.appendChild(cancelBtn);
    btnWrap.appendChild(yesBtn);
    modal.appendChild(msg);
    modal.appendChild(btnWrap);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));
    function close(cb) {
      overlay.classList.remove("visible");
      setTimeout(() => {
        overlay.remove();
        if (cb) cb();
      }, 200);
    }
    cancelBtn.addEventListener("click", () => close());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    yesBtn.addEventListener("click", () => close(onConfirm));
    document.addEventListener("keydown", function h(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
        document.removeEventListener("keydown", h);
      }
    });
  }

  function showPrompt(message, defaultValue, onConfirm) {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    const modal = document.createElement("div");
    modal.className = "confirm-modal";
    modal.style.gap = "12px";
    const msg = document.createElement("p");
    msg.className = "confirm-message";
    msg.textContent = message;
    const input = document.createElement("input");
    input.type = "text";
    input.className = "prompt-input";
    input.value = defaultValue || "";
    input.placeholder = "Name\u2026";
    const btnWrap = document.createElement("div");
    btnWrap.className = "confirm-buttons";
    const cancelBtn = document.createElement("button");
    cancelBtn.className = "confirm-cancel";
    cancelBtn.textContent = "Cancel";
    const yesBtn = document.createElement("button");
    yesBtn.className = "confirm-yes";
    yesBtn.textContent = "Add";
    btnWrap.appendChild(cancelBtn);
    btnWrap.appendChild(yesBtn);
    modal.appendChild(msg);
    modal.appendChild(input);
    modal.appendChild(btnWrap);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("visible"));
    setTimeout(() => {
      try {
        input.focus();
        input.select();
      } catch (_) {}
    }, 120);
    function close(cb) {
      overlay.classList.remove("visible");
      setTimeout(() => {
        overlay.remove();
        if (cb) cb();
      }, 200);
    }
    cancelBtn.addEventListener("click", () => close());
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
    function doConfirm() {
      var val = input.value.trim();
      if (val) close(() => onConfirm(val));
      else showToast("Please enter a name");
    }
    yesBtn.addEventListener("click", doConfirm);
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") doConfirm();
    });
    document.addEventListener("keydown", function h(e) {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        close();
        document.removeEventListener("keydown", h);
      }
    });
  }

  function showToast(message, duration) {
    duration = duration || 2000;
    const existing = document.querySelector(".ss-toast");
    if (existing) existing.remove();
    const toast = document.createElement("div");
    toast.className = "ss-toast";
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("visible"));
    setTimeout(() => {
      toast.classList.remove("visible");
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  const BIO_LINE_LIMIT = 4;
  function applyBioToggle(bioEl) {
    if (!bioEl) return;
    const prev = bioEl.nextElementSibling;
    if (prev && prev.classList.contains("bio-read-toggle")) prev.remove();
    bioEl.classList.remove("bio-truncated");
    requestAnimationFrame(() => {
      const lh = parseFloat(getComputedStyle(bioEl).lineHeight) || 19.2;
      if (bioEl.scrollHeight > lh * BIO_LINE_LIMIT + 4) {
        bioEl.classList.add("bio-truncated");
        let open = false;
        const btn = document.createElement("button");
        btn.className = "bio-read-toggle";
        btn.textContent = "...read more";
        btn.addEventListener("click", () => {
          open = !open;
          bioEl.classList.toggle("bio-truncated", !open);
          btn.textContent = open ? "read less" : "...read more";
        });
        bioEl.insertAdjacentElement("afterend", btn);
      }
    });
  }

  function openPfpViewer(src, alt) {
    const overlay = document.createElement("div");
    overlay.className = "pfp-overlay";
    const img = document.createElement("img");
    img.src = src.replace(/_\d+x\d+/, "_200x200");
    img.alt = alt || "";
    overlay.appendChild(img);
    document.body.appendChild(overlay);
    let closing = false;
    function closePfp() {
      if (closing) return;
      closing = true;
      img.style.animation =
        "pfpImgOut 0.24s cubic-bezier(0.32, 0.72, 0, 1) forwards";
      overlay.style.animation = "pfpOverlayOut 0.24s ease forwards";
      setTimeout(() => overlay.remove(), 260);
    }
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closePfp();
    });
    function onKey(e) {
      if (e.key === "Escape") {
        closePfp();
        document.removeEventListener("keydown", onKey);
      }
    }
    document.addEventListener("keydown", onKey);
  }

  // Export
  Object.assign(window.ScratchSwipe, {
    showPageLoading,
    hidePageLoading,
    createCustomSelect,
    createToggleSwitch,
    showConfirm,
    showPrompt,
    showToast,
    applyBioToggle,
    openPfpViewer,
  });

  /* ----------------------------------------------------------
     Refresh Blocker & Swipe to Close
  ---------------------------------------------------------- */
  function initRefreshBlocker() {
    if (document.querySelector(".refresh-blocker")) return;
    const blocker = document.createElement("div");
    blocker.className = "refresh-blocker";
    blocker.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;overflow:auto;pointer-events:none;z-index:-1;";
    const inner = document.createElement("div");
    inner.style.height = "200px";
    blocker.appendChild(inner);
    document.body.appendChild(blocker);
    blocker.scrollTop = 200;

    window.addEventListener("touchstart", function() {
      if (blocker.scrollTop < 100) blocker.scrollTop = 200;
    }, { passive: true });
  }

  function initSwipeToClose() {
    let startY = 0;
    let currentY = 0;
    let isDragging = false;
    const threshold = 100;

    // Use a capturing listener for touchstart to catch it before scroll starts
    document.addEventListener("touchstart", function(e) {
      const ds = document.querySelector(".details-section.open");
      if (!ds) return;
      if (ds.contains(e.target)) {
        startY = e.touches[0].clientY;
        currentY = startY;
      }
    }, { passive: true, capture: true });

    document.addEventListener("touchmove", function(e) {
      const ds = document.querySelector(".details-section.open");
      if (!ds) { isDragging = false; return; }
      
      const touchY = e.touches[0].clientY;
      const diff = touchY - startY;

      // START DRAGGING condition: at the top of scroll and moving down
      if (!isDragging && ds.scrollTop <= 0 && diff > 5 && ds.contains(e.target)) {
        isDragging = true;
        startY = touchY; // Reset to avoid jump
      }

      if (isDragging) {
        currentY = touchY;
        const currentDiff = currentY - startY;
        
        if (currentDiff > 0) {
          // BLOCK browser overscroll/refresh
          if (e.cancelable) e.preventDefault();
          ds.style.transition = "none";
          ds.style.transform = `translateY(${currentDiff}px)`;
          
          // Reposition blocker to bottom
          const blocker = document.querySelector(".refresh-blocker");
          if (blocker && blocker.scrollTop < 100) blocker.scrollTop = 200;
        } else {
          // If they swipe back up past the start point, stop dragging and allow scrolling
          isDragging = false;
          ds.style.transition = "";
          ds.style.transform = "";
        }
      }
    }, { passive: false });

    function handleEnd() {
      if (!isDragging) return;
      const ds = document.querySelector(".details-section.open");
      if (ds) {
        const diff = currentY - startY;
        ds.style.transition = ""; // Restore transition for snap
        if (diff > threshold) {
          ds.classList.remove("open");
          ds.style.transform = "";
        } else {
          ds.style.transform = "translateY(0%)";
          // Cleanup inline style after snap animation
          setTimeout(() => {
            if (ds.classList.contains("open")) ds.style.transform = "";
          }, 400);
        }
      }
      isDragging = false;
      startY = 0;
      currentY = 0;
    }

    document.addEventListener("touchend", handleEnd, { passive: true });
    document.addEventListener("touchcancel", handleEnd, { passive: true });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function() {
      initRefreshBlocker();
      initSwipeToClose();
    });
  } else {
    initRefreshBlocker();
    initSwipeToClose();
  }
})();
