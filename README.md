# My Todo & Deadline Tracker

A personal productivity system with three components:

- **Python CLI** — simple command-line todo app
- **Deadline Sync Daemon** — aggregates deadlines from Canvas (GT + UCF), Gmail, and Microsoft, serves them over a local REST API
- **React Native Web App** — Todos, Deadlines, and Board tabs; runs in the browser via `MyTodo.app`
- **macOS Menu Bar App** — live deadline countdown in your menu bar, emergency alerts, auto-refreshes every 2 minutes

---

## Interface

<table>
  <tr>
    <td align="center"><b>Todos</b></td>
    <td align="center"><b>Deadlines</b></td>
    <td align="center"><b>Board</b></td>
  </tr>
  <tr>
    <td><img src="docs/screenshots/todos.png" width="220" alt="Todos tab"/></td>
    <td><img src="docs/screenshots/deadlines.png" width="220" alt="Deadlines tab"/></td>
    <td><img src="docs/screenshots/board.png" width="220" alt="Board tab"/></td>
  </tr>
  <tr>
    <td>Add todos with optional due dates. Dates are color-coded: 🔴 overdue · 🟠 today · 🔵 future.</td>
    <td>Deadlines grouped by date, sourced from Canvas GT/UCF, Microsoft, and Gmail. Pull to refresh.</td>
    <td>Drag-and-drop Kanban board with month calendar. Day view shows emergency deadlines, deadlines, and todos for the selected date.</td>
  </tr>
</table>

---

## Architecture

```
Canvas GT (iCal) + Canvas UCF (API) + Gmail + Microsoft
           ↓  polls every 15–30 min
      deadlines.db  (SQLite, on Mac)
           ↓
    FastAPI server  (localhost:8765)
           ↓
  React Native Web App  +  Menu Bar App (reads DB directly)
```

---

## Project Structure

```
my-todo/
├── todo.py                        # Python CLI todo app
├── deadline-sync/                 # Python daemon
│   ├── main.py                    # Entry point: FastAPI + APScheduler
│   ├── config.example.json        # Config template (copy to config.json)
│   ├── db.py                      # SQLite schema & CRUD
│   ├── normalizer.py              # Raw API → unified schema
│   ├── scheduler.py               # Polling intervals
│   ├── server.py                  # FastAPI endpoints
│   ├── notifier.py                # macOS notifications via osascript
│   ├── menubar.py                 # macOS menu bar app (rumps)
│   ├── setup.py                   # One-time auth setup
│   ├── sources/
│   │   ├── canvas.py              # Canvas REST API (UCF)
│   │   ├── ical.py                # iCal feed parser (GT + others)
│   │   ├── microsoft.py           # Microsoft Graph (calendar + tasks)
│   │   └── gmail.py               # Gmail keyword search
│   └── auth/
│       ├── microsoft_oauth.py     # MSAL device code flow
│       └── gmail_oauth.py         # Google OAuth2
├── my-todo-app/                   # Expo React Native app
│   ├── App.js                     # Tab navigator
│   ├── screens/
│   │   ├── TodoScreen.js
│   │   └── DeadlinesScreen.js
│   ├── components/
│   │   ├── DeadlineCard.js        # Source badge + countdown
│   │   └── DateSectionHeader.js
│   ├── hooks/
│   │   ├── useDeadlines.js        # Fetch + AsyncStorage cache
│   │   └── useNotifications.js    # Local push notifications
│   └── constants/config.js        # Backend URL
└── deadline-menubar/              # SwiftUI menu bar app (Xcode)
    └── deadline-menubar/
        ├── DeadlineMenuBarApp.swift
        ├── Models.swift
        ├── DatabaseReader.swift
        ├── DeadlineStore.swift
        ├── MenuBarView.swift
        ├── DeadlineRow.swift
        └── NotificationScheduler.swift
```

---

## Setup

### 1. Python Daemon

**Requirements:** Python 3.8+, conda recommended

```bash
conda create -n deadline-sync python=3.11 -y
conda activate deadline-sync
cd deadline-sync
pip install -r requirements.txt
```

**Configure:**

```bash
cp config.example.json config.json
# Edit config.json — add your Canvas tokens, iCal URL, etc.
```

**Authenticate Gmail & Microsoft (one-time):**

```bash
python setup.py --gmail        # opens browser for consent
python setup.py --microsoft    # prints device code to enter at aka.ms/devicelogin
```

**Run:**

```bash
python main.py
# Server starts at http://localhost:8765
```

**Auto-start on login:**

```bash
cp com.changliu.deadline-sync.plist ~/Library/LaunchAgents/
cp com.changliu.deadline-menubar.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.changliu.deadline-sync.plist
launchctl load ~/Library/LaunchAgents/com.changliu.deadline-menubar.plist
```

---

### 2. Menu Bar App

```bash
conda activate deadline-sync
cd deadline-sync
python menubar.py
```

A 📅 icon appears in the menu bar showing upcoming deadlines grouped by date with countdown timers. Urgent deadlines (< 24h) are highlighted in red.

---

### 3. React Native Web App

```bash
cd my-todo-app
npm install
# Edit constants/config.js → set BACKEND_URL to your Mac's LAN IP
npx expo start --web
# Press 'w' to open in browser
```

---

### 4. Canvas Setup

| School | Method | Where to get token |
|--------|--------|--------------------|
| UCF (webcourses.ucf.edu) | API token | Account → Settings → + New Access Token |
| Georgia Tech | iCal feed | Canvas → Calendar → feed icon (bottom-left) → copy URL |

Add to `config.json`:

```json
{
  "canvas_instances": [
    { "id": "canvas_ucf", "base_url": "https://webcourses.ucf.edu", "api_token": "YOUR_TOKEN" }
  ],
  "ical_feeds": [
    { "id": "canvas_gt", "name": "Georgia Tech", "url": "YOUR_ICAL_URL" }
  ]
}
```

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Server status + last sync time |
| `GET` | `/deadlines?days=30` | List upcoming deadlines |
| `POST` | `/sync` | Trigger immediate sync |
| `POST` | `/deadlines/{id}/dismiss` | Dismiss a deadline |

---

## Source Color Coding

| Source | Color | Label |
|--------|-------|-------|
| Canvas GT | 🟡 `#B3A369` | GT Canvas |
| Canvas UCF | 🟡 `#FFC904` | UCF Canvas |
| Microsoft | 🔵 `#0078D4` | Microsoft |
| Gmail | 🔴 `#EA4335` | Gmail |

---

## CLI Todo App

```bash
python todo.py add "Buy groceries"
python todo.py list
python todo.py done 1
python todo.py delete 1
```

Todos are stored locally in `todos.json`.

---

## Logs

```
~/Library/Logs/deadline-sync.log
~/Library/Logs/deadline-menubar.log
```
