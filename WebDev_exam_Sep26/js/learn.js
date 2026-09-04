/* ==========================================================================
   learn.js — reference page
   Builds the tag comparison table, the basic-strategy charts and a searchable
   Illustrious 18, and draws a live card from the Deck of Cards API.
   ========================================================================== */
(function () {
  'use strict';

  var TC = window.TC;
  var $ = TC.$, $$ = TC.$$, el = TC.el, clear = TC.clear;

  if (!TC.init({ requireAuth: true })) return;

  /* =====================================================================
     1. Draw a card from the API and tag it in every system
     ===================================================================== */
  var drawBtn  = $('#draw-btn');
  var cardSlot = $('#draw-card-slot');
  var tagsRow  = $('#draw-tags');
  var drawMeta = $('#draw-meta');

  function showDrawnCard(card, source) {
    clear(cardSlot).appendChild(
      el('div', {
        class: 'playing-card playing-card--xl' + (card.red ? ' playing-card--red' : ''),
        role: 'img',
        'aria-label': card.rank + ' of ' + card.suit
      }, [
        el('span', { class: 'playing-card__rank', text: card.rank }),
        el('span', { class: 'playing-card__suit', 'aria-hidden': 'true', text: card.suit })
      ])
    );

    clear(tagsRow);
    TC.SYSTEM_ORDER.forEach(function (id) {
      var sys = TC.SYSTEMS[id];
      var tag = sys.tags[card.rank] || 0;
      tagsRow.appendChild(
        el('span', {
          class: 'pill ' + (tag > 0 ? 'pill--good' : tag < 0 ? 'pill--bad' : ''),
          text: sys.name + ' ' + TC.signed(tag)
        })
      );
    });

    drawMeta.textContent = source === 'api'
      ? 'Drawn from deckofcardsapi.com just now.'
      : 'The card server was unreachable, so this card came from a local shuffle.';
  }

  drawBtn.addEventListener('click', function () {
    drawBtn.disabled = true;
    drawBtn.textContent = 'Drawing…';

    clear(cardSlot).appendChild(
      el('div', {
        class: 'playing-card playing-card--back playing-card--xl',
        'aria-hidden': 'true',
        style: 'display:flex;align-items:center;justify-content:center'
      }, [el('span', { class: 'spinner' })])
    );

    TC.fetchJSON(TC.API_BASE + '/new/draw/?count=1')
      .then(function (data) {
        if (!data.success || !data.cards || !data.cards.length) {
          throw new Error('No card came back.');
        }
        var card = TC.normaliseApiCard(data.cards[0]);
        showDrawnCard(card, 'api');
        console.log('[TrueCount] Drew ' + card.code + ' from the card server.');
      })
      .catch(function (err) {
        console.warn('[TrueCount] Draw failed, using a local card:', err.message);
        var card = TC.buildShoe(1)[0];
        showDrawnCard(card, 'local');
        TC.toast('Card server unreachable — drew locally instead.', 'warn');
      })
      .then(function () {
        drawBtn.disabled = false;
        drawBtn.textContent = 'Draw another';
      });
  });

  /* =====================================================================
     2. Tag comparison table
     ===================================================================== */
  var systemFilter = $('#system-filter');
  var tagsHead = $('#tags-head');
  var tagsBody = $('#tags-body');
  var systemNotes = $('#system-notes');

  TC.SYSTEM_ORDER.forEach(function (id) {
    systemFilter.appendChild(el('option', { value: id }, [TC.SYSTEMS[id].name]));
  });

  function visibleSystems() {
    var choice = systemFilter.value;
    return choice === 'all' ? TC.SYSTEM_ORDER : [choice];
  }

  function toneClass(tag) {
    return tag > 0 ? 'act-S' : tag < 0 ? 'act-H' : '';
  }

  function renderTagsTable() {
    var systems = visibleSystems();

    clear(tagsHead).appendChild(
      el('tr', null, [el('th', { scope: 'col', text: 'System' })].concat(
        TC.RANKS.map(function (rank) { return el('th', { scope: 'col', text: rank }); })
      ))
    );

    clear(tagsBody);
    systems.forEach(function (id) {
      var sys = TC.SYSTEMS[id];
      tagsBody.appendChild(
        el('tr', null, [el('th', { scope: 'row', text: sys.name })].concat(
          TC.RANKS.map(function (rank) {
            var tag = sys.tags[rank] || 0;
            return el('td', { class: toneClass(tag), text: TC.signed(tag) });
          })
        ))
      );
    });

    // Notes below the table
    clear(systemNotes);
    systems.forEach(function (id) {
      var sys = TC.SYSTEMS[id];
      systemNotes.appendChild(
        el('div', { class: 'alert' }, [
          el('div', null, [
            el('strong', { text: sys.name }),
            el('span', { class: 'pill ' + (sys.balanced ? 'pill--info' : 'pill--warn'),
                         style: 'margin-left:.5rem',
                         text: sys.balanced ? 'Balanced' : 'Unbalanced' }),
            el('span', { class: 'pill', style: 'margin-left:.35rem', text: 'Level ' + sys.level }),
            el('p', { style: 'margin:.5rem 0 0', text: sys.blurb }),
            el('p', { class: 'faint', style: 'margin:.35rem 0 0', text: sys.efficiency })
          ])
        ])
      );
    });
  }

  systemFilter.addEventListener('change', function () {
    renderTagsTable();
    var label = systemFilter.value === 'all' ? 'all systems' : TC.SYSTEMS[systemFilter.value].name;
    TC.toast('Showing ' + label + '.', 'info', 1800);
  });

  /* =====================================================================
     3. Basic strategy charts
     ===================================================================== */
  var strategyTabs = $('#strategy-tabs');
  var strategyHead = $('#strategy-head');
  var strategyBody = $('#strategy-body');
  var currentChart = 'hard';

  function renderStrategy(which) {
    var S = TC.STRATEGY;
    var rows = S.charts[which];

    clear(strategyHead).appendChild(
      el('tr', null, [el('th', { scope: 'col', text: 'Your hand' })].concat(
        S.upcards.map(function (up) { return el('th', { scope: 'col', text: up }); })
      ))
    );

    clear(strategyBody);
    rows.forEach(function (row) {
      strategyBody.appendChild(
        el('tr', null, [el('th', { scope: 'row', text: row.hand })].concat(
          row.plays.map(function (play, i) {
            return el('td', {
              class: 'act-' + play,
              title: row.hand + ' vs ' + S.upcards[i] + ' → ' + S.actionNames[play]
            }, [play]);
          })
        ))
      );
    });
  }

  strategyTabs.addEventListener('click', function (event) {
    var tab = event.target.closest('[data-chart]');
    if (!tab || tab.dataset.chart === currentChart) return;

    currentChart = tab.dataset.chart;
    $$('[data-chart]', strategyTabs).forEach(function (t) {
      var on = t === tab;
      t.setAttribute('aria-selected', String(on));
      t.setAttribute('aria-pressed', String(on));
    });
    renderStrategy(currentChart);
  });

  /* =====================================================================
     4. Searchable Illustrious 18
     ===================================================================== */
  var searchInput = $('#index-search');
  var tcInput     = $('#index-tc');
  var playList    = $('#index-play-list');
  var resultCount = $('#index-result-count');

  function renderIndexPlays() {
    var query = searchInput.value.trim().toLowerCase();
    var tc = Number(tcInput.value);
    if (Number.isNaN(tc)) tc = 0;

    var matches = TC.INDEX_PLAYS.filter(function (play) {
      if (!query) return true;
      return (play.hand + ' ' + play.vs + ' ' + play.action).toLowerCase().indexOf(query) !== -1;
    });

    resultCount.textContent = matches.length + ' of ' + TC.INDEX_PLAYS.length;

    clear(playList);

    if (!matches.length) {
      playList.appendChild(el('li', { class: 'empty-state' }, [
        'No index play matches “' + searchInput.value.trim() + '”.'
      ]));
      return;
    }

    matches.forEach(function (play) {
      var live = play.when === 'gte' ? tc >= play.index : tc <= play.index;

      playList.appendChild(
        el('li', { class: 'list__item' }, [
          el('span', {
            class: 'list__badge ' + (live ? 'is-positive' : ''),
            text: TC.signed(play.index)
          }),
          el('div', { class: 'list__body' }, [
            el('div', { class: 'list__title', text: play.hand + ' vs ' + play.vs + ' → ' + play.action }),
            el('div', {
              class: 'list__meta',
              text: 'Deviate when the true count is ' +
                    (play.when === 'gte' ? 'at or above ' : 'at or below ') + TC.signed(play.index)
            })
          ]),
          el('span', {
            class: 'pill ' + (live ? 'pill--good' : ''),
            text: live ? 'Live at TC ' + TC.signed(tc) : 'Off'
          })
        ])
      );
    });
  }

  searchInput.addEventListener('input', renderIndexPlays);

  tcInput.addEventListener('input', function () {
    var value = Number(tcInput.value);
    if (tcInput.value.trim() && (Number.isNaN(value) || value < -10 || value > 10)) {
      tcInput.classList.add('is-invalid');
      return;
    }
    tcInput.classList.remove('is-invalid');
    renderIndexPlays();
  });

  /* =====================================================================
     Boot
     ===================================================================== */
  renderTagsTable();
  renderStrategy(currentChart);
  renderIndexPlays();
})();
