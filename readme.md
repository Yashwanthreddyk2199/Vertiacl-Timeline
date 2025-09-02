# Timeline Story — Vertical Portfolio Timeline

Animated, front-end-only timeline for roles, projects, releases, and awards. Add/Edit/Delete entries in the UI; data is stored in `localStorage`.

## Features
- Start month → End month or **Present**
- Filters: All / Role / Project / Release / Award
- Auto left/right placement + manual override
- Year markers with scroll highlight
- Smooth reveal animations
- No backend, pure HTML/CSS/JS

## Quick Start
1. Clone and open `index.html` (or `python -m http.server` and visit `http://localhost:8000`).
2. Click **Add Entry** and fill the form. Edit/Delete from each card’s menu.

## Files
- `index.html` – layout & modal
- `style.css` – styles & animations
- `script.js` – CRUD, sorting, rendering

## Data
Saved in browser under key `ts_custom_entries_v1`:
```json
{ "id": "...", "type": "project|role|release|award", "startYm": "YYYY-MM", "endYm": "", "ongoing": true, "title": "", "desc": "", "url": "", "urlText": "", "side": "left|right|auto" }
