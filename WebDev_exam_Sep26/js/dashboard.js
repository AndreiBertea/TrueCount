/* ==========================================================================
   dashboard.js — the landing page once signed in
   Renders stats, the shoe left in progress, a system comparison and a
   filterable activity feed whose items can be removed individually.
   ========================================================================== */
(function () {
  'use strict';

  var TC = window.TC;
  var $ = TC.$, $$ = TC.$$, el = TC.el, clear = TC.clear;

  if (!TC.init({ requireAuth: true })) return;

  var session = TC.Auth.current();

  /* ---------------------------------------------------------------------
     Greeting
     --------------------------------------------------------------------- */
  function timeOfDay() {
    var h = new Date().getHours();
    if (h < 5) return 'Still up';
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  }

  $('#greeting').textContent = timeOfDay() + ', ' + session.displayName + '.';

  var stats = TC.Stats.all();
  $('#greeting-sub').textContent = stats.cardsCounted
    ? 'You have counted ' + stats.cardsCounted.toLocaleString('en-IE') +
      ' cards so far. Pick up where you left off, or start something new.'
    : 'Nothing counted yet. Open the live count and tap your first card.';

  /* ---------------------------------------------------------------------
     Stat tiles
     --------------------------------------------------------------------- */
  function renderStats() {
    var s = TC.Stats.all();

    var tiles = [
      { label: 'Cards counted', value: s.cardsCounted.toLocaleString('en-IE'), hint: 'across every shoe' },
      { label: 'Sessions saved', value: s.sessions, hint: 'from the live count' },
      { label: 'Sign-ins',       value: s.logins, hint: 'simulated sessions' },
      { label: 'Peak true count',value: TC.signed(s.peakTrueCount, 1), hint: 'highest you have tracked' }
    ];

    var row = clear($('#stat-row'));
    tiles.forEach(function (tile) {
      row.appendChild(
        el('article', { class: 'stat' }, [
          el('span', { class: 'stat__label', text: tile.label }),
          el('span', { class: 'stat__value', text: String(tile.value) }),
          el('span', { class: 'stat__hint', text: tile.hint })
        ])
      );
    });
  }

  /* ---------------------------------------------------------------------
     Shoe in progress — reads the live-count state
     --------------------------------------------------------------------- */
  function renderShoeStatus() {
    var mount = clear($('#shoe-status'));
    var saved = TC.Store.get(TC.KEYS.counter, null);

    if (!saved || !Array.isArray(saved.seen) || !saved.seen.length) {
      mount.appendChild(el('p', { class: 'muted', style: 'font-size:.875rem', text: 'No shoe open.' }));
      mount.appendChild(el('a', { class: 'btn btn--sm btn--block', href: 'counter.html', style: 'margin-top:.75rem' },
        ['Start counting']));
      return;
    }

    var sys = TC.SYSTEMS[saved.systemId] || TC.SYSTEMS['hi-lo'];
    var seen = saved.seen.length;
    var total = saved.decks * 52;
    var pct = Math.round((seen / total) * 100);

    var running = saved.seen.reduce(function (t, r) { return t + (sys.tags[r] || 0); },
      (!sys.balanced && sys.irc) ? sys.irc(saved.decks) : 0);
    var decksLeft = Math.max((total - seen) / 52, 0.25);
    var tc = sys.balanced ? running / decksLeft : running - (sys.pivot || 0);

    mount.appendChild(el('div', { class: 'row row--between row--middle' }, [
      el('span', { class: 'muted', style: 'font-size:.875rem', text: sys.name + ' · ' + saved.decks + ' decks' }),
      el('span', { class: 'pill', text: pct + '% dealt' })
    ]));

    mount.appendChild(el('div', { class: 'row row--between row--middle', style: 'margin-top:.75rem' }, [
      el('div', null, [
        el('div', { class: 'stat__label', text: 'Running' }),
        el('div', { class: 'stat__value', style: 'font-size:1.5rem', text: TC.signed(running) })
      ]),
      el('div', { style: 'text-align:right' }, [
        el('div', { class: 'stat__label', text: 'True' }),
        el('div', {
          class: 'stat__value',
          style: 'font-size:1.5rem;color:' + (tc > 0 ? 'var(--positive)' : tc < 0 ? 'var(--negative)' : 'inherit'),
          text: TC.signed(tc, 1)
        })
      ])
    ]));

    mount.appendChild(el('a', { class: 'btn btn--sm btn--primary btn--block', href: 'counter.html', style: 'margin-top:1rem' },
      ['Resume this shoe']));
  }

  /* ---------------------------------------------------------------------
     Systems list
     --------------------------------------------------------------------- */
  function renderSystems() {
    var list = clear($('#systems-list'));
    var current = (TC.Store.get(TC.KEYS.counter, {}) || {}).systemId || 'hi-lo';

    TC.SYSTEM_ORDER.forEach(function (id) {
      var sys = TC.SYSTEMS[id];
      list.appendChild(
        el('li', { class: 'list__item' }, [
          el('span', { class: 'list__badge', text: 'L' + sys.level }),
          el('div', { class: 'list__body' }, [
            el('div', { class: 'list__title', text: sys.name }),
            el('div', { class: 'list__meta', text: sys.efficiency })
          ]),
          id === current
            ? el('span', { class: 'pill pill--good', text: 'In use' })
            : el('span', { class: 'pill', text: sys.balanced ? 'Balanced' : 'Unbalanced' })
        ])
      );
    });
  }

  /* ---------------------------------------------------------------------
     Activity feed — filterable, individually removable
     --------------------------------------------------------------------- */
  var activeFilter = 'all';

  var KIND_ICON = { counter: '♠', profile: '☺', auth: '⚿', info: '·' };

  function renderActivity() {
    var list = clear($('#activity-list'));
    var items = TC.Activity.all().filter(function (item) {
      return activeFilter === 'all' || item.kind === activeFilter;
    });

    if (!items.length) {
      list.appendChild(el('li', { class: 'empty-state' }, [
        activeFilter === 'all'
          ? 'Nothing here yet. Your saved sessions and profile changes will show up in this feed.'
          : 'No ' + activeFilter + ' activity yet.'
      ]));
      $('#clear-activity').disabled = TC.Activity.all().length === 0;
      return;
    }

    items.forEach(function (item) {
      var removeBtn = el('button', {
        class: 'btn btn--sm btn--ghost',
        type: 'button',
        'aria-label': 'Remove "' + item.label + '" from the activity feed'
      }, ['✕']);

      // Removing an entry updates storage and re-renders the list.
      removeBtn.addEventListener('click', function () {
        TC.Activity.remove(item.id);
        renderActivity();
        TC.toast('Entry removed.', 'info', 1800);
      });

      list.appendChild(
        el('li', { class: 'list__item' }, [
          el('span', { class: 'list__badge', 'aria-hidden': 'true', text: KIND_ICON[item.kind] || '·' }),
          el('div', { class: 'list__body' }, [
            el('div', { class: 'list__title', text: item.label }),
            el('div', { class: 'list__meta', text: (item.detail ? item.detail + ' · ' : '') + TC.relativeTime(item.at) })
          ]),
          removeBtn
        ])
      );
    });

    $('#clear-activity').disabled = false;
  }

  // Filter chips
  $('#activity-filters').addEventListener('click', function (event) {
    var chip = event.target.closest('.chip');
    if (!chip) return;

    activeFilter = chip.dataset.filter;
    $$('.chip', event.currentTarget).forEach(function (c) {
      c.setAttribute('aria-pressed', String(c === chip));
    });
    renderActivity();
  });

  // Clear the whole feed
  $('#clear-activity').addEventListener('click', function () {
    if (!TC.Activity.all().length) return;
    if (!window.confirm('Clear your entire activity feed?')) return;
    TC.Activity.clear();
    renderActivity();
    TC.toast('Activity feed cleared.', 'success');
  });

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  renderStats();
  renderShoeStatus();
  renderSystems();
  renderActivity();
})();
