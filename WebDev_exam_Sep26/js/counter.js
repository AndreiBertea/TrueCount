/* ==========================================================================
   counter.js — the live count engine
   Keeps a running count, converts it to a true count, tracks deck penetration
   and shows which index plays the current count switches on.
   ========================================================================== */
(function () {
  'use strict';

  var TC = window.TC;
  var $ = TC.$, el = TC.el, clear = TC.clear;

  if (!TC.init({ requireAuth: true })) return;

  /* ---------------------------------------------------------------------
     State
     --------------------------------------------------------------------- */
  var state = TC.Store.get(TC.KEYS.counter, null) || {
    systemId: 'hi-lo',
    decks: 6,
    unit: 25,
    seen: []          // array of ranks, in the order they were dealt
  };

  // Guard against a stale or hand-edited saved state.
  if (!TC.SYSTEMS[state.systemId]) state.systemId = 'hi-lo';
  if (!Array.isArray(state.seen)) state.seen = [];

  var CARDS_PER_DECK = 52;
  var COPIES_PER_DECK = 4;      // 4 of each rank per deck

  function save() { TC.Store.set(TC.KEYS.counter, state); }

  /* ---------------------------------------------------------------------
     Derived values
     --------------------------------------------------------------------- */
  function system() { return TC.SYSTEMS[state.systemId]; }

  function initialRunningCount() {
    var sys = system();
    return (!sys.balanced && typeof sys.irc === 'function') ? sys.irc(state.decks) : 0;
  }

  function countOf(rank) {
    return state.seen.filter(function (r) { return r === rank; }).length;
  }

  function runningCount() {
    var tags = system().tags;
    return state.seen.reduce(function (total, rank) {
      return total + (tags[rank] || 0);
    }, initialRunningCount());
  }

  function decksRemaining() {
    var left = (state.decks * CARDS_PER_DECK) - state.seen.length;
    return Math.max(left / CARDS_PER_DECK, 0.25);   // never divide by ~0
  }

  /**
   * The number shown in the big readout.
   * Balanced systems convert running → true by dividing by decks remaining.
   * Unbalanced systems (KO) do not divide at all: the running count is already
   * deck-scaled, so we report the distance from the pivot instead.
   */
  function trueCount() {
    var sys = system();
    if (!sys.balanced) return runningCount() - (sys.pivot || 0);
    return runningCount() / decksRemaining();
  }

  /**
   * A single comparable number used for the edge estimate, the bet ramp and
   * the index plays — all of which are defined in Hi-Lo true-count terms.
   *
   * For an unbalanced system the pivot is the point at which the player is
   * roughly +0.5% ahead, which is the same place a Hi-Lo true count of +2
   * sits. So we shift the pivot distance by +2 to put both scales in the
   * same units. It is an approximation, but a standard and consistent one.
   */
  function effectiveTrueCount() {
    var sys = system();
    var value = sys.balanced ? trueCount() : trueCount() + 2;

    // Both scales can run away at the extremes — a balanced count divided by
    // the last quarter-deck, or a KO shoe that starts 20 below its pivot.
    // Neither says anything meaningful about the real edge, so clamp the
    // figure that feeds the edge estimate, the bet ramp and the index plays.
    return Math.max(-6, Math.min(10, value));
  }

  function penetration() {
    return state.seen.length / (state.decks * CARDS_PER_DECK);
  }

  /** How many of this rank are left in the shoe. */
  function remainingOf(rank) {
    return (state.decks * COPIES_PER_DECK) - countOf(rank);
  }

  /* ---------------------------------------------------------------------
     Elements
     --------------------------------------------------------------------- */
  var systemSelect = $('#system');
  var decksSelect  = $('#decks');
  var unitInput    = $('#unit');
  var systemBlurb  = $('#system-blurb');
  var systemKind   = $('#system-kind');

  var trueCountEl  = $('#true-count');
  var trueNoteEl   = $('#true-count-note');
  var trueLabelEl  = $('#true-count-label');
  var runningEl    = $('#running-count');
  var runningNote  = $('#running-note');
  var decksLeftEl  = $('#decks-left');
  var cardsSeenEl  = $('#cards-seen-note');
  var edgeEl       = $('#edge');

  var penFill      = $('#penetration-fill');
  var penLabel     = $('#penetration-label');
  var penMeter     = $('#penetration-meter');

  var betAmount    = $('#bet-amount');
  var betUnits     = $('#bet-units');
  var betNote      = $('#bet-note');
  var betTone      = $('#bet-tone');

  var cardpad      = $('#cardpad');
  var undoBtn      = $('#undo-btn');
  var resetBtn     = $('#reset-btn');
  var saveBtn      = $('#save-session-btn');

  var indexList    = $('#index-list');
  var indexCount   = $('#index-count');
  var historyList  = $('#history-list');

  /* ---------------------------------------------------------------------
     Build the system dropdown
     --------------------------------------------------------------------- */
  TC.SYSTEM_ORDER.forEach(function (id) {
    var sys = TC.SYSTEMS[id];
    systemSelect.appendChild(
      el('option', { value: id }, [sys.name + ' — level ' + sys.level + (sys.balanced ? '' : ', unbalanced')])
    );
  });
  systemSelect.value = state.systemId;
  decksSelect.value = String(state.decks);
  unitInput.value = state.unit;

  /* ---------------------------------------------------------------------
     Rendering
     --------------------------------------------------------------------- */
  function pulse(node) {
    node.classList.remove('pulse');
    void node.offsetWidth;          // force reflow so the animation restarts
    node.classList.add('pulse');
  }

  function toneClass(value) {
    return value > 0 ? 'is-positive' : (value < 0 ? 'is-negative' : '');
  }

  /** Build (or rebuild) the 13 rank keys. */
  function renderCardPad() {
    var tags = system().tags;
    clear(cardpad);

    TC.RANKS.forEach(function (rank) {
      var tag = tags[rank] || 0;
      var left = remainingOf(rank);

      var key = el('button', {
        class: 'cardkey',
        type: 'button',
        'data-rank': rank,
        disabled: left <= 0,
        'aria-label': rank + ', tag ' + TC.signed(tag) + ', ' + left + ' remaining'
      }, [
        el('span', { text: rank }),
        el('span', { class: 'cardkey__tag ' + toneClass(tag), text: TC.signed(tag) }),
        el('span', { class: 'cardkey__left', text: left + ' left' })
      ]);

      cardpad.appendChild(key);
    });
  }

  /** Update only the "n left" figures and disabled state (cheap, per deal). */
  function refreshCardPad() {
    TC.$$('.cardkey', cardpad).forEach(function (key) {
      var rank = key.dataset.rank;
      var left = remainingOf(rank);
      key.querySelector('.cardkey__left').textContent = left + ' left';
      key.disabled = left <= 0;
      key.setAttribute('aria-label',
        rank + ', tag ' + TC.signed(system().tags[rank] || 0) + ', ' + left + ' remaining');
    });
  }

  function renderIndexPlays(tc) {
    var plays = TC.activeIndexPlays(tc);
    clear(indexList);

    indexCount.textContent = plays.length + ' active';
    indexCount.className = 'pill ' + (plays.length ? 'pill--good' : '');

    if (!plays.length) {
      indexList.appendChild(el('li', { class: 'empty-state' }, [
        'No deviations at this count — play textbook basic strategy.'
      ]));
      return;
    }

    plays.forEach(function (play) {
      indexList.appendChild(
        el('li', { class: 'list__item' }, [
          el('span', { class: 'list__badge is-positive', text: play.action.slice(0, 2).toUpperCase() }),
          el('div', { class: 'list__body' }, [
            el('div', { class: 'list__title', text: play.hand + ' vs dealer ' + play.vs + ' → ' + play.action }),
            el('div', {
              class: 'list__meta',
              text: 'Index ' + TC.signed(play.index) + ' · switches on when TC ' +
                    (play.when === 'gte' ? '≥ ' : '≤ ') + TC.signed(play.index)
            })
          ])
        ])
      );
    });
  }

  function renderHistory() {
    clear(historyList);

    if (!state.seen.length) {
      historyList.appendChild(el('li', { class: 'empty-state' }, [
        'No cards yet. Tap a card above — or use the keyboard.'
      ]));
      return;
    }

    var tags = system().tags;
    // Newest first, capped so the list stays readable.
    var recent = state.seen.slice(-30).reverse();

    recent.forEach(function (rank, i) {
      var tag = tags[rank] || 0;
      var position = state.seen.length - i;

      historyList.appendChild(
        el('li', { class: 'list__item' }, [
          el('span', { class: 'list__badge', text: rank }),
          el('div', { class: 'list__body' }, [
            el('div', { class: 'list__title', text: 'Card #' + position }),
            el('div', { class: 'list__meta', text: 'Tag ' + TC.signed(tag) })
          ]),
          el('span', { class: 'pill ' + (tag > 0 ? 'pill--good' : tag < 0 ? 'pill--bad' : ''), text: TC.signed(tag) })
        ])
      );
    });

    if (state.seen.length > 30) {
      historyList.appendChild(el('li', { class: 'empty-state' }, [
        '…and ' + (state.seen.length - 30) + ' earlier cards.'
      ]));
    }
  }

  /** Full re-render of every derived readout. */
  function render(options) {
    options = options || {};
    var sys = system();
    var rc = runningCount();
    var tc = trueCount();
    var etc = effectiveTrueCount();
    var left = decksRemaining();
    var pen = penetration();

    // System description
    systemBlurb.textContent = sys.blurb + '  (' + sys.efficiency + ')';
    systemKind.textContent = sys.balanced ? 'Balanced' : 'Unbalanced';
    systemKind.className = 'pill ' + (sys.balanced ? 'pill--info' : 'pill--warn');

    // Running count
    runningEl.textContent = TC.signed(rc);
    runningEl.className = 'readout__value ' + toneClass(rc);
    runningNote.textContent = sys.balanced
      ? 'from 0'
      : 'IRC ' + TC.signed(initialRunningCount()) + ' · pivot ' + TC.signed(sys.pivot);

    // True count (or pivot distance for unbalanced systems)
    if (sys.balanced) {
      trueCountEl.textContent = (tc >= 0 ? '+' : '−') + Math.abs(tc).toFixed(1);
      trueNoteEl.textContent =
        tc >= 3 ? 'Hot shoe — press your bets' :
        tc >= 1 ? 'Slightly favourable' :
        tc <= -2 ? 'Cold shoe — the house is ahead' : 'Neutral shoe';
    } else {
      trueCountEl.textContent = TC.signed(tc);
      trueNoteEl.textContent = tc >= 0
        ? 'At or above the pivot — you have the edge'
        : Math.abs(tc) + ' below the pivot';
    }
    trueCountEl.className = 'readout__value ' + toneClass(tc);

    // Label the hero cell honestly: unbalanced systems show pivot distance.
    trueLabelEl.textContent = sys.balanced ? 'True count' : 'Pivot distance';

    // Decks / cards
    decksLeftEl.textContent = left.toFixed(1);
    cardsSeenEl.textContent = state.seen.length + ' card' + (state.seen.length === 1 ? '' : 's') + ' seen';

    // Edge — derived from the comparable true-count figure
    var edge = TC.playerEdge(etc);
    edgeEl.textContent = (edge >= 0 ? '+' : '−') + Math.abs(edge).toFixed(1) + '%';
    edgeEl.className = 'readout__value ' + toneClass(edge);

    // Penetration
    var pct = Math.round(pen * 100);
    penFill.style.width = pct + '%';
    penFill.classList.toggle('is-hot', pct >= 75);
    penLabel.textContent = pct + '% dealt';
    penMeter.setAttribute('aria-valuenow', String(pct));

    // Bet advice
    var advice = TC.betAdvice(etc);
    betAmount.textContent = TC.money(advice.units * state.unit);
    betUnits.textContent = advice.label;
    betNote.textContent = advice.note;
    betTone.textContent = advice.tone === 'good' ? 'Raise' : advice.tone === 'warn' ? 'Hold' : 'Minimum';
    betTone.className = 'pill pill--' + advice.tone;

    renderIndexPlays(etc);
    renderHistory();
    refreshCardPad();

    undoBtn.disabled = state.seen.length === 0;

    if (options.pulse) {
      pulse(trueCountEl);
      pulse(runningEl);
    }

    // Track the peak true count reached, for the dashboard.
    if (sys.balanced && tc > 0) TC.Stats.setMax('peakTrueCount', Math.round(tc * 10) / 10);
  }

  /* ---------------------------------------------------------------------
     Actions
     --------------------------------------------------------------------- */
  function dealCard(rank) {
    if (remainingOf(rank) <= 0) {
      TC.toast('No ' + rank + 's left in this shoe.', 'warn', 2000);
      return;
    }

    state.seen.push(rank);
    save();
    TC.Stats.bump('cardsCounted', 1);
    render({ pulse: true });

    // Warn once the cut card would realistically come out.
    if (Math.abs(penetration() - 0.75) < 0.0035) {
      TC.toast('75% penetration — the cut card is close.', 'info');
    }
    if (state.seen.length === state.decks * CARDS_PER_DECK) {
      TC.toast('Shoe exhausted. Start a new one.', 'warn', 5000);
    }
  }

  function undo() {
    if (!state.seen.length) return;
    var rank = state.seen.pop();
    save();
    render({ pulse: true });
    TC.toast('Removed ' + rank + '.', 'info', 1600);
  }

  function resetShoe(quiet) {
    var counted = state.seen.length;
    state.seen = [];
    save();
    render();
    if (!quiet) {
      TC.toast('New ' + state.decks + '-deck shoe. Count reset.', 'success');
      if (counted > 20) TC.Activity.add('Finished a shoe (' + counted + ' cards)', 'counter');
    }
  }

  /* ---------------------------------------------------------------------
     Event listeners
     --------------------------------------------------------------------- */

  // Card pad — one delegated listener for all 13 keys.
  cardpad.addEventListener('click', function (event) {
    var key = event.target.closest('.cardkey');
    if (!key || key.disabled) return;
    dealCard(key.dataset.rank);
  });

  undoBtn.addEventListener('click', undo);

  resetBtn.addEventListener('click', function () {
    if (state.seen.length > 0 &&
        !window.confirm('Start a new shoe? The current count will be cleared.')) return;
    resetShoe();
  });

  systemSelect.addEventListener('change', function () {
    state.systemId = systemSelect.value;
    save();
    renderCardPad();
    render({ pulse: true });
    TC.toast('Switched to ' + system().name + '.', 'info');
    console.log('[TrueCount] Counting system changed to ' + system().name);
  });

  decksSelect.addEventListener('change', function () {
    state.decks = Number(decksSelect.value);
    // A different shoe size invalidates the current count.
    state.seen = [];
    save();
    renderCardPad();
    render({ pulse: true });
    TC.toast('Shoe set to ' + state.decks + ' decks. Count reset.', 'info');
  });

  unitInput.addEventListener('input', function () {
    var value = Number(unitInput.value);
    var errorNode = $('#unit-error');

    if (!unitInput.value.trim() || Number.isNaN(value) || value < 1 || value > 1000) {
      TC.Validate.fail(unitInput, errorNode, 'Enter a betting unit between €1 and €1000.');
      return;
    }
    TC.Validate.pass(unitInput, errorNode);
    state.unit = Math.round(value);
    save();
    render();
  });

  saveBtn.addEventListener('click', function () {
    if (!state.seen.length) {
      TC.toast('Nothing to save yet — deal some cards first.', 'warn');
      return;
    }
    var rc = runningCount();
    var tc = trueCount();

    TC.Stats.bump('sessions', 1);
    TC.Activity.add(
      'Saved a ' + system().name + ' session',
      'counter',
      state.seen.length + ' cards · RC ' + TC.signed(rc) + ' · TC ' + TC.signed(tc, 1)
    );

    // The brief asks that form-style submissions be simulated — we log them.
    console.log('[TrueCount] Session saved:', {
      system: system().name,
      decks: state.decks,
      cardsSeen: state.seen.length,
      runningCount: rc,
      trueCount: Number(tc.toFixed(2)),
      penetration: Math.round(penetration() * 100) + '%',
      bettingUnit: state.unit,
      savedAt: new Date().toISOString()
    });

    TC.toast('Session saved to your dashboard.', 'success');
  });

  // Shortcuts panel
  var shortcutsBtn = $('#shortcuts-btn');
  var shortcutsPanel = $('#shortcuts-panel');
  shortcutsBtn.addEventListener('click', function () {
    var open = shortcutsPanel.hidden;
    shortcutsPanel.hidden = !open;
    shortcutsBtn.setAttribute('aria-expanded', String(open));
  });

  // Keyboard control
  var KEY_MAP = {
    a: 'A', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    '7': '7', '8': '8', '9': '9', '0': '10', t: '10', j: 'J', q: 'Q', k: 'K'
  };

  document.addEventListener('keydown', function (event) {
    // Never hijack typing in a field.
    var tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;

    var key = event.key.toLowerCase();

    if (key === 'backspace') { event.preventDefault(); undo(); return; }
    if (key === 'r') { event.preventDefault(); resetShoe(); return; }

    var rank = KEY_MAP[key];
    if (rank) {
      event.preventDefault();
      dealCard(rank);
      // Flash the matching key so keyboard use still feels physical.
      var btn = cardpad.querySelector('[data-rank="' + rank + '"]');
      if (btn) {
        btn.classList.add('pulse');
        window.setTimeout(function () { btn.classList.remove('pulse'); }, 340);
      }
    }
  });

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  renderCardPad();
  render();

  if (state.seen.length) {
    TC.toast('Resumed your saved shoe — ' + state.seen.length + ' cards already counted.', 'info', 4200);
  }
})();
