# Scratch Swipe

Scratch Swipe is a Tinder-inspired interface for discovering Scratch.mit.edu users. Swipe through profiles with filtering, search by interests, leaderboards, and likes management using vanilla JavaScript.

## Features

- Tinder-style swiping with card animations
- Search by username, interests, countries, user IDs
- Filter by country, tags, exclude keywords
- Filter presets system
- Leaderboards (followers/following)
- Likes management grid
- Profile details with auto-translation
- Full settings panel
- Touch/keyboard support
- Lazy loading, localStorage persistence

## Quick Start

1. Download all files
2. Open index.html in browser
3. Start swiping (mouse, touch, keyboard)

## Controls

Discover:
- Left/Right swipe: dislike/like
- Up/Down arrow: profile details
- Gear icon: settings

Search supports users, interests, places, IDs with infinite scroll.

## Structure

```
Scratch Swipe/
├── index.html     # Discover/swiping
├── search.html    # Search
├── leaderboard.html # Leaderboard
├── styles.css     # Styling
├── popup.js       # Main logic
├── database.json  # User data
└── README.md
```

## Tech

Vanilla HTML/CSS/JavaScript. Uses localStorage and MyMemory translation API.

## 🔧 Customization

All settings persist in browser localStorage:

**Appearance**:
- Ambient background blur glow ✓/✗
- Entry animations ✓/✗

**Advanced**:
- Lazy loading ✓/✗
- Preload count (1-20 images)

**Filters** (Discover only):
- Country filter
- Filter tags / Exclude tags
- Custom presets

Database contains ~10,000 Scratch users.