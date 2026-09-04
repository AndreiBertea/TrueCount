/* ==========================================================================
   TrueCount — shared application module
   Loaded on every page. Exposes a single global namespace: window.TC
   Handles: storage, simulated auth, navigation, toasts, validation helpers
            and the card-counting domain data.
   Written as a classic script (no ES modules) so the app also runs when the
   HTML files are opened directly from disk with the file:// protocol.
   ========================================================================== */
(function (window, document) {
  'use strict';

  /* ------------------------------------------------------------------------
     Storage — a thin, fail-safe wrapper around localStorage
     ------------------------------------------------------------------------ */
  var KEYS = {
    session: 'tc.session',
    profile: 'tc.profile',
    stats:   'tc.stats',
    activity:'tc.activity',
    counter: 'tc.counter'
  };

  var Store = {
    get: function (key, fallback) {
      try {
        var raw = window.localStorage.getItem(key);
        return raw === null ? fallback : JSON.parse(raw);
      } catch (err) {
        console.warn('[TrueCount] Could not read "' + key + '":', err);
        return fallback;
      }
    },
    set: function (key, value) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
        return true;
      } catch (err) {
        console.warn('[TrueCount] Could not write "' + key + '":', err);
        return false;
      }
    },
    remove: function (key) {
      try { window.localStorage.removeItem(key); } catch (err) { /* ignore */ }
    }
  };

  /* ------------------------------------------------------------------------
     Small DOM helpers
     ------------------------------------------------------------------------ */
  function $(selector, scope) { return (scope || document).querySelector(selector); }
  function $$(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (name) {
        var value = attrs[name];
        if (value === null || value === undefined || value === false) return;
        if (name === 'class') node.className = value;
        else if (name === 'text') node.textContent = value;
        else if (name === 'html') node.innerHTML = value;
        else if (name === 'dataset') {
          Object.keys(value).forEach(function (k) { node.dataset[k] = value[k]; });
        } else if (name.indexOf('on') === 0 && typeof value === 'function') {
          node.addEventListener(name.slice(2).toLowerCase(), value);
        } else {
          node.setAttribute(name, value === true ? '' : value);
        }
      });
    }
    (children || []).forEach(function (child) {
      if (child === null || child === undefined) return;
      node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  /** Remove every child of a node (used a lot when re-rendering lists). */
  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /* ------------------------------------------------------------------------
     Formatting
     ------------------------------------------------------------------------ */
  function signed(n, decimals) {
    var value = decimals ? Number(n).toFixed(decimals) : String(n);
    return Number(n) > 0 ? '+' + value : value;
  }

  /* Currency — defined once here so the whole app stays consistent.
     Euro amounts are grouped with commas (1,000) to match the number
     formatting used everywhere else in the interface. */
  var CURRENCY = '€';

  function money(amount) {
    return CURRENCY + Number(amount).toLocaleString('en-IE');
  }

  function relativeTime(timestamp) {
    var diff = Math.round((Date.now() - timestamp) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + ' min ago';
    if (diff < 86400) return Math.floor(diff / 3600) + ' h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + ' d ago';
    return new Date(timestamp).toLocaleDateString();
  }

  /* ------------------------------------------------------------------------
     Toast notifications — the app-wide "feedback to the user" channel
     ------------------------------------------------------------------------ */
  var ICONS = { success: '✓', error: '✕', warn: '!', info: 'i' };

  function toast(message, type, timeout) {
    type = type || 'info';
    var stack = $('.toast-stack');
    if (!stack) {
      stack = el('div', { class: 'toast-stack', role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(stack);
    }

    var node = el('div', { class: 'toast toast--' + type }, [
      el('span', { class: 'toast__icon', 'aria-hidden': 'true', text: ICONS[type] || 'i' }),
      el('span', { class: 'toast__body', text: message })
    ]);
    stack.appendChild(node);

    var remove = function () {
      node.classList.add('is-leaving');
      node.addEventListener('animationend', function () {
        if (node.parentNode) node.parentNode.removeChild(node);
      });
    };
    window.setTimeout(remove, timeout || 3600);
    node.addEventListener('click', remove);
    return node;
  }

  /** Inline alert inside a form/section (a persistent counterpart to toast). */
  function showAlert(node, message, type) {
    if (!node) return;
    node.className = 'alert alert--' + (type || 'info');
    node.textContent = message;
    node.hidden = false;
  }
  function hideAlert(node) { if (node) node.hidden = true; }

  /* ------------------------------------------------------------------------
     Simulated authentication
     There is no back end: credentials are validated client-side and the
     "session" is a localStorage record. This is intentional — the brief asks
     for a *simulated* login system.
     ------------------------------------------------------------------------ */
  var DEMO_USER = { username: 'dealer', password: 'blackjack21' };

  var Auth = {
    demo: DEMO_USER,

    current: function () { return Store.get(KEYS.session, null); },
    isLoggedIn: function () { return this.current() !== null; },

    login: function (username, remember) {
      var profile = Store.get(KEYS.profile, {});
      var session = {
        username: username,
        displayName: profile.displayName || username,
        avatar: profile.avatar || '🂡',
        loggedInAt: Date.now(),
        remember: !!remember
      };
      Store.set(KEYS.session, session);
      Stats.bump('logins', 1);
      Activity.add('Signed in as ' + username, 'auth');
      console.log('[TrueCount] Simulated login submitted:', {
        username: username, remember: !!remember, at: new Date().toISOString()
      });
      return session;
    },

    logout: function () {
      var session = this.current();
      if (session) Activity.add('Signed out', 'auth');
      Store.remove(KEYS.session);
      console.log('[TrueCount] Session cleared.');
    },

    /** Redirect to the login page if no session exists. */
    requireAuth: function () {
      if (this.isLoggedIn()) return true;
      var here = window.location.pathname.split('/').pop() || 'index.html';
      try {
        window.sessionStorage.setItem('tc.redirect', here);
      } catch (err) { /* ignore */ }
      window.location.replace('login.html?next=' + encodeURIComponent(here));
      return false;
    },

    updateSession: function (patch) {
      var session = this.current();
      if (!session) return null;
      Object.keys(patch).forEach(function (k) { session[k] = patch[k]; });
      Store.set(KEYS.session, session);
      return session;
    }
  };

  /* ------------------------------------------------------------------------
     Stats & activity feed (shared across pages)
     ------------------------------------------------------------------------ */
  var DEFAULT_STATS = {
    logins: 0,
    cardsCounted: 0,
    sessions: 0,
    peakTrueCount: 0
  };

  var Stats = {
    all: function () {
      var saved = Store.get(KEYS.stats, {});
      var out = {};
      Object.keys(DEFAULT_STATS).forEach(function (k) {
        out[k] = typeof saved[k] === 'number' ? saved[k] : DEFAULT_STATS[k];
      });
      return out;
    },
    bump: function (key, by) {
      var stats = this.all();
      stats[key] = (stats[key] || 0) + (by === undefined ? 1 : by);
      Store.set(KEYS.stats, stats);
      return stats[key];
    },
    setMax: function (key, value) {
      var stats = this.all();
      if (value > stats[key]) { stats[key] = value; Store.set(KEYS.stats, stats); }
      return stats[key];
    },
    set: function (key, value) {
      var stats = this.all();
      stats[key] = value;
      Store.set(KEYS.stats, stats);
      return value;
    },
    reset: function () {
      Store.set(KEYS.stats, Object.assign({}, DEFAULT_STATS));
    }
  };

  var Activity = {
    MAX: 40,
    all: function () { return Store.get(KEYS.activity, []); },
    add: function (label, kind, detail) {
      var items = this.all();
      items.unshift({
        id: 'a' + Date.now() + Math.random().toString(36).slice(2, 7),
        label: label,
        kind: kind || 'info',
        detail: detail || '',
        at: Date.now()
      });
      Store.set(KEYS.activity, items.slice(0, this.MAX));
    },
    remove: function (id) {
      Store.set(KEYS.activity, this.all().filter(function (i) { return i.id !== id; }));
    },
    clear: function () { Store.set(KEYS.activity, []); }
  };

  /* ------------------------------------------------------------------------
     Card-counting domain data
     ------------------------------------------------------------------------ */
  var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

  /**
   * Counting systems.
   *  tags    — point value assigned to each rank
   *  balanced— a balanced system sums to 0 over a full deck, so it needs a
   *            true-count conversion. Unbalanced systems (KO) instead start
   *            from an Initial Running Count and use a pivot.
   *  level   — magnitude of the largest tag (harder = higher level)
   */
  var SYSTEMS = {
    'hi-lo': {
      id: 'hi-lo',
      name: 'Hi-Lo',
      level: 1,
      balanced: true,
      efficiency: 'Betting 0.97 · Playing 0.51',
      blurb: 'The standard. Level-1, balanced, and the base for almost every published index chart. Best starting point.',
      tags: { A: -1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 0, '8': 0, '9': 0, '10': -1, J: -1, Q: -1, K: -1 }
    },
    'ko': {
      id: 'ko',
      name: 'KO (Knock-Out)',
      level: 1,
      balanced: false,
      pivot: 4,
      efficiency: 'Betting 0.98 · Playing 0.55',
      blurb: 'Unbalanced, so you never divide by decks remaining. You start at an Initial Running Count and bet up past the pivot.',
      tags: { A: -1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 1, '8': 0, '9': 0, '10': -1, J: -1, Q: -1, K: -1 },
      irc: function (decks) { return 4 - (4 * decks); }
    },
    'hi-opt-i': {
      id: 'hi-opt-i',
      name: 'Hi-Opt I',
      level: 1,
      balanced: true,
      efficiency: 'Betting 0.88 · Playing 0.61',
      blurb: 'Aces are neutral, which sharpens playing decisions but costs betting accuracy unless you side-count aces.',
      tags: { A: 0, '2': 0, '3': 1, '4': 1, '5': 1, '6': 1, '7': 0, '8': 0, '9': 0, '10': -1, J: -1, Q: -1, K: -1 }
    },
    'zen': {
      id: 'zen',
      name: 'Zen Count',
      level: 2,
      balanced: true,
      efficiency: 'Betting 0.96 · Playing 0.63',
      blurb: 'A level-2 balanced count that keeps partial ace information. Strong all-round, noticeably harder to run at speed.',
      tags: { A: -1, '2': 1, '3': 1, '4': 2, '5': 2, '6': 2, '7': 1, '8': 0, '9': 0, '10': -2, J: -2, Q: -2, K: -2 }
    },
    'omega-ii': {
      id: 'omega-ii',
      name: 'Omega II',
      level: 2,
      balanced: true,
      efficiency: 'Betting 0.92 · Playing 0.67',
      blurb: 'The strongest playing efficiency here. Aces are neutral, so pair it with an ace side-count for betting.',
      tags: { A: 0, '2': 1, '3': 1, '4': 2, '5': 2, '6': 2, '7': 1, '8': 0, '9': -1, '10': -2, J: -2, Q: -2, K: -2 }
    }
  };

  var SYSTEM_ORDER = ['hi-lo', 'ko', 'hi-opt-i', 'zen', 'omega-ii'];

  /**
   * The "Illustrious 18" — the playing deviations worth the most money.
   * `when: 'gte'` means the deviation switches on at or above the index.
   */
  var INDEX_PLAYS = [
    { hand: 'Insurance',   vs: 'A',  index: 3,  when: 'gte', action: 'Take insurance' },
    { hand: '16',          vs: '10', index: 0,  when: 'gte', action: 'Stand' },
    { hand: '15',          vs: '10', index: 4,  when: 'gte', action: 'Stand' },
    { hand: '10,10',       vs: '5',  index: 5,  when: 'gte', action: 'Split' },
    { hand: '10,10',       vs: '6',  index: 4,  when: 'gte', action: 'Split' },
    { hand: '10',          vs: '10', index: 4,  when: 'gte', action: 'Double' },
    { hand: '12',          vs: '3',  index: 2,  when: 'gte', action: 'Stand' },
    { hand: '12',          vs: '2',  index: 3,  when: 'gte', action: 'Stand' },
    { hand: '11',          vs: 'A',  index: 1,  when: 'gte', action: 'Double' },
    { hand: '9',           vs: '2',  index: 1,  when: 'gte', action: 'Double' },
    { hand: '10',          vs: 'A',  index: 4,  when: 'gte', action: 'Double' },
    { hand: '9',           vs: '7',  index: 3,  when: 'gte', action: 'Double' },
    { hand: '16',          vs: '9',  index: 5,  when: 'gte', action: 'Stand' },
    { hand: '13',          vs: '2',  index: -1, when: 'lte', action: 'Hit' },
    { hand: '12',          vs: '4',  index: 0,  when: 'lte', action: 'Hit' },
    { hand: '12',          vs: '5',  index: -2, when: 'lte', action: 'Hit' },
    { hand: '12',          vs: '6',  index: -1, when: 'lte', action: 'Hit' },
    { hand: '13',          vs: '3',  index: -2, when: 'lte', action: 'Hit' }
  ];

  /** Which index plays are live at the given true count. */
  function activeIndexPlays(trueCount) {
    return INDEX_PLAYS.filter(function (p) {
      return p.when === 'gte' ? trueCount >= p.index : trueCount <= p.index;
    });
  }

  /** Bet spread advice, expressed in betting units. */
  function betAdvice(trueCount) {
    if (trueCount < 1)  return { units: 1,  label: 'Table minimum', tone: 'bad',  note: 'No edge — bet the minimum or sit out.' };
    if (trueCount < 2)  return { units: 1,  label: '1 unit',        tone: 'warn', note: 'Roughly break-even. Hold your minimum.' };
    if (trueCount < 3)  return { units: 2,  label: '2 units',       tone: 'warn', note: 'Slight edge. Start ramping up.' };
    if (trueCount < 4)  return { units: 4,  label: '4 units',       tone: 'good', note: 'Real edge. Raise the bet.' };
    if (trueCount < 5)  return { units: 8,  label: '8 units',       tone: 'good', note: 'Strong shoe. Press hard.' };
    return                     { units: 12, label: '12 units',      tone: 'good', note: 'Maximum spread. This is the money.' };
  }

  /** Approximate player edge in percent (Hi-Lo rule of thumb: ~0.5%/TC). */
  function playerEdge(trueCount) { return (trueCount - 1) * 0.5; }

  /* ------------------------------------------------------------------------
     Deck helpers — a local shoe, used as a fallback when the network is down
     ------------------------------------------------------------------------ */
  var SUITS = [
    { code: 'S', symbol: '♠', name: 'SPADES',   red: false },
    { code: 'H', symbol: '♥', name: 'HEARTS',   red: true },
    { code: 'D', symbol: '♦', name: 'DIAMONDS', red: true },
    { code: 'C', symbol: '♣', name: 'CLUBS',    red: false }
  ];

  function buildShoe(deckCount) {
    var shoe = [];
    for (var d = 0; d < deckCount; d++) {
      SUITS.forEach(function (suit) {
        RANKS.forEach(function (rank) {
          shoe.push({ rank: rank, suit: suit.symbol, red: suit.red, code: rank + suit.code });
        });
      });
    }
    // Fisher–Yates shuffle
    for (var i = shoe.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = shoe[i]; shoe[i] = shoe[j]; shoe[j] = tmp;
    }
    return shoe;
  }

  /** Normalise a card from the Deck of Cards API into our own shape. */
  function normaliseApiCard(apiCard) {
    var valueMap = { ACE: 'A', KING: 'K', QUEEN: 'Q', JACK: 'J' };
    var rank = valueMap[apiCard.value] || apiCard.value;
    var suit = SUITS.filter(function (s) { return s.name === apiCard.suit; })[0] || SUITS[0];
    return {
      rank: rank,
      suit: suit.symbol,
      red: suit.red,
      code: apiCard.code,
      image: apiCard.image
    };
  }

  /* ------------------------------------------------------------------------
     Fetch helper — timeout + friendly errors
     ------------------------------------------------------------------------ */
  var API_BASE = 'https://deckofcardsapi.com/api/deck';

  function fetchJSON(url, timeoutMs) {
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = window.setTimeout(function () {
      if (controller) controller.abort();
    }, timeoutMs || 9000);

    return fetch(url, controller ? { signal: controller.signal } : undefined)
      .then(function (response) {
        window.clearTimeout(timer);
        if (!response.ok) {
          throw new Error('The card server replied with status ' + response.status + '.');
        }
        return response.json();
      })
      .catch(function (err) {
        window.clearTimeout(timer);
        if (err.name === 'AbortError') throw new Error('The card server took too long to respond.');
        throw err;
      });
  }

  /* ------------------------------------------------------------------------
     Validation helpers used by every form on the site
     ------------------------------------------------------------------------ */
  var Validate = {
    /** Attach an error message to a field and mark it invalid. */
    fail: function (input, errorNode, message) {
      input.classList.add('is-invalid');
      input.setAttribute('aria-invalid', 'true');
      if (errorNode) errorNode.textContent = message;
      return false;
    },
    pass: function (input, errorNode) {
      input.classList.remove('is-invalid');
      input.removeAttribute('aria-invalid');
      if (errorNode) errorNode.textContent = '';
      return true;
    },
    /** Run a list of rules; returns true only if every rule passes. */
    run: function (rules) {
      var ok = true;
      var firstBad = null;
      rules.forEach(function (rule) {
        var errorNode = document.getElementById(rule.input.id + '-error');
        var message = rule.check();
        if (message) {
          Validate.fail(rule.input, errorNode, message);
          if (!firstBad) firstBad = rule.input;
          ok = false;
        } else {
          Validate.pass(rule.input, errorNode);
        }
      });
      if (firstBad) firstBad.focus();
      return ok;
    },
    isEmail: function (value) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim()); }
  };

  /* ------------------------------------------------------------------------
     Header: navigation, active link, mobile toggle, auth chip
     ------------------------------------------------------------------------ */
  var NAV_LINKS = [
    { href: 'index.html',   label: 'Dashboard' },
    { href: 'counter.html', label: 'Live Count' },
    { href: 'learn.html',   label: 'Learn' },
    { href: 'profile.html', label: 'Profile' }
  ];

  function currentPage() {
    var file = window.location.pathname.split('/').pop();
    return file === '' ? 'index.html' : file;
  }

  function renderHeader() {
    var mount = $('[data-site-header]');
    if (!mount) return;

    var page = currentPage();
    var session = Auth.current();

    var list = el('ul', { class: 'site-nav__list' },
      NAV_LINKS.map(function (link) {
        var attrs = { class: 'site-nav__link', href: link.href };
        if (link.href === page) attrs['aria-current'] = 'page';
        return el('li', null, [el('a', attrs, [link.label])]);
      })
    );

    // The auth chip is the visible difference between the logged-in and
    // logged-out UI states.
    var chip;
    if (session) {
      chip = el('div', { class: 'auth-chip' }, [
        el('a', { class: 'avatar', href: 'profile.html', title: 'Open your profile',
                  'aria-label': 'Profile of ' + session.displayName }, [session.avatar || '🂡']),
        el('span', { class: 'auth-chip__name', text: session.displayName }),
        el('button', {
          class: 'btn btn--sm btn--ghost',
          type: 'button',
          onclick: function () {
            Auth.logout();
            toast('Signed out. See you at the tables.', 'info');
            window.setTimeout(function () { window.location.href = 'login.html'; }, 700);
          }
        }, ['Sign out'])
      ]);
    } else {
      chip = el('div', { class: 'auth-chip' }, [
        el('span', { class: 'pill', text: 'Guest' }),
        el('a', { class: 'btn btn--sm btn--primary', href: 'login.html' }, ['Sign in'])
      ]);
    }

    var nav = el('nav', { class: 'site-nav', id: 'site-nav', 'aria-label': 'Main' }, [list, chip]);

    var toggle = el('button', {
      class: 'nav-toggle',
      type: 'button',
      'aria-expanded': 'false',
      'aria-controls': 'site-nav',
      'aria-label': 'Toggle navigation menu'
    }, ['☰']);

    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', String(open));
      toggle.textContent = open ? '✕' : '☰';
    });

    var brand = el('a', { class: 'brand', href: session ? 'index.html' : 'login.html' }, [
      el('span', { class: 'brand__mark', 'aria-hidden': 'true', text: '♠' }),
      el('span', { class: 'brand__name', html: 'True<em>Count</em>' })
    ]);

    clear(mount).appendChild(
      el('div', { class: 'container site-header__inner' }, [brand, toggle, nav])
    );
  }

  function renderFooter() {
    var mount = $('[data-site-footer]');
    if (!mount) return;
    clear(mount).appendChild(
      el('div', { class: 'container site-footer__inner' }, [
        el('span', { text: '© ' + new Date().getFullYear() + ' TrueCount by Andrei Bertea — a card-counting trainer built for the Web Development final exam.' }),
        el('span', { class: 'row row--tight row--middle' }, [
          el('span', { class: 'pill pill--info', text: 'Practice tool' }),
          el('span', { text: 'Play responsibly.' })
        ])
      ])
    );
  }

  /* ------------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------------ */
  function init(options) {
    options = options || {};
    if (options.requireAuth && !Auth.requireAuth()) return false;
    renderHeader();
    renderFooter();
    return true;
  }

  /* ------------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------------ */
  window.TC = {
    KEYS: KEYS,
    Store: Store,
    Auth: Auth,
    Stats: Stats,
    Activity: Activity,
    Validate: Validate,
    // DOM
    $: $, $$: $$, el: el, clear: clear,
    // feedback
    toast: toast, showAlert: showAlert, hideAlert: hideAlert,
    // formatting
    signed: signed, relativeTime: relativeTime,
    CURRENCY: CURRENCY, money: money,
    // domain
    RANKS: RANKS, SUITS: SUITS, SYSTEMS: SYSTEMS, SYSTEM_ORDER: SYSTEM_ORDER,
    INDEX_PLAYS: INDEX_PLAYS, activeIndexPlays: activeIndexPlays,
    betAdvice: betAdvice, playerEdge: playerEdge,
    buildShoe: buildShoe, normaliseApiCard: normaliseApiCard,
    // network
    API_BASE: API_BASE, fetchJSON: fetchJSON,
    // lifecycle
    init: init
  };
})(window, document);
