# TrueCount — Blackjack Card Counting Trainer

A browser-based practice tool for blackjack card counting, built with **plain HTML5, CSS3 and vanilla JavaScript** — no frameworks, no build step, no back end.

TrueCount is a *web application*, not a static site: almost everything on screen is generated and updated by JavaScript in response to what the user does. You tap cards into a live count engine and the whole interface — count, edge, bet advice, active deviations — reacts continuously.

---

## Table of contents

- [Project overview](#project-overview)
- [Running the app](#running-the-app)
- [Demo login](#demo-login)
- [Pages](#pages)
- [Features](#features)
- [External API](#external-api)
- [Project structure](#project-structure)
- [The blackjack maths](#the-blackjack-maths)
- [Accessibility](#accessibility)
- [Browser support](#browser-support)
- [Requirements checklist](#requirements-checklist)
- [Credits](#credits)

---

## Project overview

Card counting is a real, well-documented skill: you assign a small positive or negative value to every card you see, keep a running total, and use that total to work out when the remaining shoe favours the player. TrueCount is a trainer for that skill.

It does two things:

1. **Counts a live shoe for you** — tap each card as it is dealt and it maintains a running count, converts it into a true count, tracks deck penetration, estimates your edge and tells you what to bet.
2. **Explains the theory** — five counting systems compared tag by tag, a full basic-strategy chart, and the "Illustrious 18" index plays that change how you play a hand.

Everything is stored in the browser's `localStorage`. Nothing is sent to a server, and there is no account system beyond a deliberately simulated one.

> **Note:** this is an educational tool about the mathematics of a game. It is not gambling advice.

---

## Running the app

The app is plain static files — nothing to install, nothing to build.

### Recommended — serve it over HTTP

Run one of these from the project folder, whichever you have available:

```bash
python -m http.server 8080
```

```bash
npx serve .
```

Then open **http://localhost:8080/login.html**.

This is the way the app was developed and tested.

### Also possible — open the file directly

Double-clicking **`login.html`** generally works too: the app deliberately uses classic `<script>` tags rather than ES modules, so nothing is blocked by the module loader, and the external card API sends `Access-Control-Allow-Origin: *` so `fetch` still succeeds from a `file://` page.

One caveat: some browsers treat `file://` pages as an opaque origin and refuse `localStorage`. Because the simulated session is stored there, signing in may not persist and the app will bounce you back to the login page. If that happens, use the HTTP option above. Every storage call is wrapped in a `try/catch`, so the app degrades rather than crashing.

---

## Demo login

The login is **simulated** — there is no server and no real authentication.

| Field | Value |
|---|---|
| Username | `dealer` |
| Password | `blackjack21` |

There is a **"Fill them in"** button on the login page that enters these for you.

Any username is accepted as long as the password is `blackjack21`, so you can sign in under your own name. Entering a different password demonstrates the failure path (inline error, red field, error toast).

---

## Pages

The app has **four content pages plus a separate login page**.

| File | Page | What it does |
|---|---|---|
| `login.html` | **Sign in** | The simulated login form. The only page reachable while logged out. |
| `index.html` | **Dashboard** | Greeting, lifetime statistics, the shoe you left in progress, a system overview and a filterable activity feed. |
| `counter.html` | **Live Count** | The core tool. A 13-key card pad driving a running count, true count, penetration meter, bet advice and live index plays. |
| `learn.html` | **Systems & Strategy** | Tag comparison table, basic-strategy charts (hard / soft / pairs), a searchable Illustrious 18, and a live card draw from the API. |
| `profile.html` | **Profile** | Your identity, practice record, a settings form, a feedback form and local-data controls. |

Every page except `login.html` is guarded: visiting one while signed out redirects to the login page and remembers where you were heading (`login.html?next=counter.html`).

---

## Features

### The live count engine (`counter.html`)

- **13 rank keys** (A, 2–10, J, Q, K), each labelled with its point value in the currently selected system and with how many of that rank are left in the shoe. Keys grey out when a rank is exhausted.
- **Running count**, updated on every card.
- **True count** — the running count divided by the decks remaining, which is the number that actually matters.
- **Deck penetration** meter, with a nudge when you pass 75%.
- **Player edge** estimate and a **bet recommendation** in both units and euros, driven by your betting unit.
- **Live index plays** — the deviations from basic strategy that the current true count switches on, added to and removed from the list as the count moves.
- **Undo** (removes the last card and recomputes) and **New shoe**.
- **Full keyboard control**: `A`, `2`–`9`, `0`/`T`, `J`, `Q`, `K` to deal, `Backspace` to undo, `R` for a new shoe.
- The shoe is **saved as you go**, so you can leave and come back to the same count.

### Reference (`learn.html`)

- A **tag comparison table** across all five systems, filterable to one system.
- **Basic strategy charts** for hard totals, soft totals and pairs, generated from data and switched with tabs.
- The **Illustrious 18**, searchable by hand or dealer upcard, with a true-count preview slider that shows which deviations are live.
- **Draw a card** — fetches a real card and shows what every system calls it.

### Account & profile (`profile.html`)

- Editable display name, email, avatar, default counting system, bankroll and betting unit.
- A live bankroll/unit analysis that reacts as you type.
- A feedback form with topic and a character-counted message.
- Export your data to the console, reset your statistics, or delete everything.

### Throughout

- **Toast notifications** for every meaningful action, plus persistent inline alerts on forms.
- **Two UI states** — the header shows a *Guest / Sign in* chip when logged out and your avatar, name and a *Sign out* button when logged in.
- A responsive navigation menu that collapses to a hamburger below 900px.

---

## External data (Fetch API)

The app consumes the free, public **[Deck of Cards API](https://deckofcardsapi.com)**.

| Where | Request | Purpose |
|---|---|---|
| `learn.html` — *Tag a real card* | `GET /api/deck/new/draw/?count=1` | Shuffles a fresh deck and draws one card, which is then tagged in all five counting systems. |

The request goes through one helper (`TC.fetchJSON`) that adds a **timeout via `AbortController`** and turns failures into readable messages.

**Graceful degradation:** if the network is unavailable, the request times out, or the API returns an error, the app falls back to a card from a locally generated Fisher–Yates-shuffled deck, tells the user which source was used, and carries on. The page never breaks because you are offline.

---

## Project structure

```
WebDev_exam_Sep26/
├── index.html          Dashboard
├── login.html          Simulated login
├── counter.html        Live count engine
├── learn.html          Systems & strategy reference
├── profile.html        Profile, settings, feedback
│
├── css/
│   └── style.css       Design tokens, Flexbox layout, components,
│                       animations and media queries
│
├── js/
│   ├── app.js          Shared module (window.TC): storage, simulated auth,
│   │                   header/nav rendering, toasts, validation helpers,
│   │                   counting-system data, fetch helper
│   ├── login.js        Login form + validation
│   ├── dashboard.js    Stats, shoe status, activity feed
│   ├── counter.js      The count engine
│   ├── strategy.js     Basic-strategy data tables
│   ├── learn.js        Reference page rendering
│   └── profile.js      Profile + feedback forms
│
└── README.md
```

`js/app.js` is loaded first on every page and exposes a single global, `window.TC`. Page scripts are classic scripts (not modules) purely so the app also works when opened directly from disk.

---

## The blackjack maths

### Counting systems

| System | Level | Balanced | Notes |
|---|---|---|---|
| **Hi-Lo** | 1 | Yes | The standard. 2–6 = +1, 7–9 = 0, 10–A = −1. |
| **KO (Knock-Out)** | 1 | **No** | Adds the 7 to the +1 group. Needs no true-count division. |
| **Hi-Opt I** | 1 | Yes | Aces neutral — better playing accuracy, weaker betting. |
| **Zen Count** | 2 | Yes | Level-2 with partial ace information. |
| **Omega II** | 2 | Yes | The strongest playing efficiency of the five. |

### Running count → true count

For a **balanced** system, the running count on its own is meaningless without knowing how much shoe is left:

```
true count = running count ÷ decks remaining
```

For an **unbalanced** system such as KO, that division is deliberately unnecessary. Instead the count starts at an **Initial Running Count** and the player gains the edge at a fixed **pivot**:

```
IRC   = 4 − (4 × number of decks)     e.g. −20 for a 6-deck shoe
pivot = +4
```

The app reflects this: with KO selected, the big readout is relabelled **"Pivot distance"** rather than "True count", and the running-count note shows the IRC and the pivot.

To keep the edge estimate, the bet ramp and the index plays comparable across both kinds of system, the app converts an unbalanced count into Hi-Lo-equivalent terms by shifting the pivot distance by +2 — because reaching KO's pivot puts the player roughly +0.5% ahead, which is where a Hi-Lo true count of +2 sits. This figure is also clamped, so a count divided by the last quarter-deck (or a KO shoe that starts 20 below its pivot) cannot produce a nonsensical edge.

### Edge and bet sizing

The rule of thumb used is that each true-count point above +1 is worth about **0.5%** to the player:

```
player edge ≈ (true count − 1) × 0.5%
```

The bet ramp climbs 1 → 2 → 4 → 8 → 12 units as the true count rises through +2 to +5.

### Basic strategy

The charts in `js/strategy.js` are for a **multi-deck game where the dealer stands on soft 17, doubling after a split is allowed, and surrender is not offered**. Codes: `H` hit, `S` stand, `D` double (else hit), `Ds` double (else stand), `P` split.

---

## Accessibility

- Semantic HTML5 throughout: `<header>`, `<nav>`, `<main>`, `<section>`, `<article>`, `<aside>`, `<footer>`, plus `<table>` with `<caption>` and scoped `<th>`.
- A **skip link** to the main content on every page.
- `aria-live` regions on the count readout, the activity feed, form errors and toasts.
- `aria-current="page"` on the active navigation link; `aria-expanded` / `aria-controls` on the menu toggle.
- Every form field has a real `<label>`, and errors are linked via `aria-describedby` and flagged with `aria-invalid`.
- Progress bars expose `role="progressbar"` with live `aria-valuenow`.
- Visible focus outlines, and a `prefers-reduced-motion` block that disables every animation.

---

## Browser support

Tested in current Chromium-based browsers. Requires `fetch`, `Promise`, `localStorage`, CSS custom properties and Flexbox — all standard in any browser from the last several years.

---

## Requirements checklist

| Requirement | Where it is met |
|---|---|
| Web application, not a static site | Every page renders and updates its content through JavaScript |
| Original theme, no clones | A blackjack card-counting trainer |
| Semantic HTML5 | `header`/`nav`/`main`/`section`/`article`/`aside`/`footer`, `table`+`caption`, `figure`-free semantic lists |
| At least four pages plus a login page | 4 content pages + `login.html` |
| Flexbox for layout | The entire layout system (`.row`, `.stack`, `.stat-row`, `.readout`, `.cardpad`, header, footer). No CSS Grid is used |
| Responsive design with media queries | Breakpoints at 900px, 640px and 400px, plus `prefers-reduced-motion` and `print` |
| Consistent colour scheme and typography | CSS custom properties in `:root` — one palette, one type scale, one spacing scale |
| Event listeners on every page, DOM added/removed/updated | Card pad, undo, filters, chips, tabs, search, sliders, toggles, keyboard handlers; lists have items added and removed continuously |
| Navigation menu between pages | Shared header built by `app.js`, with a mobile hamburger and `aria-current` |
| Feedback to the user | Toast system + inline alerts + per-field error messages |
| At least two forms with validation, submission simulated | **Three** forms: login, profile settings, feedback. All validated; all print their payload with `console.log` |
| Fetch API for external data | Deck of Cards API on `learn.html`, with an `AbortController` timeout and an offline fallback |
| Simulated user login system | `TC.Auth` in `app.js` — session in `localStorage`, route guard, redirect-back |
| Different UI states logged in / logged out | Header auth chip swaps entirely; guarded pages redirect |
| User profile page | `profile.html` |
| README | This file |
| *Bonus:* CSS animations | Page fade-in, card deal, count pulse, toast slide, spinner, hover transitions |
| *Bonus:* SEO metadata | Per-page `description`, `keywords`, `author`, `robots`, `theme-color`, `canonical` and Open Graph tags |

---

## Credits

- Created by Andrei Bertea
- Card data: **[Deck of Cards API](https://deckofcardsapi.com)** — a free public API, no key required.
- Counting-system tag values, the true-count conversion and the Illustrious 18 index plays are standard published blackjack material.
- All code, styling and copy written for this project. No CSS or JS frameworks, no external fonts, no build tooling.
