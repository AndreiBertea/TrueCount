/* ==========================================================================
   strategy.js — basic strategy data
   Multi-deck (4–8), dealer stands on soft 17, double after split allowed,
   no surrender. Codes: H hit · S stand · D double else hit ·
   Ds double else stand · P split.
   Attached to the shared TC namespace so the Learn page can render it.
   ========================================================================== */
(function () {
  'use strict';

  var UPCARDS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'A'];

  /* Hard totals — player total with no usable ace. */
  var HARD = [
    { hand: '8 or less', plays: ['H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H', 'H'] },
    { hand: '9',         plays: ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'] },
    { hand: '10',        plays: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'] },
    { hand: '11',        plays: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H'] },
    { hand: '12',        plays: ['H', 'H', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'] },
    { hand: '13',        plays: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'] },
    { hand: '14',        plays: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'] },
    { hand: '15',        plays: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'] },
    { hand: '16',        plays: ['S', 'S', 'S', 'S', 'S', 'H', 'H', 'H', 'H', 'H'] },
    { hand: '17+',       plays: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'] }
  ];

  /* Soft totals — a hand containing an ace counted as 11. */
  var SOFT = [
    { hand: 'A,2 (13)', plays: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'] },
    { hand: 'A,3 (14)', plays: ['H', 'H', 'H', 'D', 'D', 'H', 'H', 'H', 'H', 'H'] },
    { hand: 'A,4 (15)', plays: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'] },
    { hand: 'A,5 (16)', plays: ['H', 'H', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'] },
    { hand: 'A,6 (17)', plays: ['H', 'D', 'D', 'D', 'D', 'H', 'H', 'H', 'H', 'H'] },
    { hand: 'A,7 (18)', plays: ['Ds', 'Ds', 'Ds', 'Ds', 'Ds', 'S', 'S', 'H', 'H', 'H'] },
    { hand: 'A,8 (19)', plays: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'] },
    { hand: 'A,9 (20)', plays: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'] }
  ];

  /* Pairs — assumes doubling after a split is permitted. */
  var PAIRS = [
    { hand: 'A,A',   plays: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'] },
    { hand: '10,10', plays: ['S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S', 'S'] },
    { hand: '9,9',   plays: ['P', 'P', 'P', 'P', 'P', 'S', 'P', 'P', 'S', 'S'] },
    { hand: '8,8',   plays: ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'] },
    { hand: '7,7',   plays: ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'] },
    { hand: '6,6',   plays: ['P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H', 'H'] },
    { hand: '5,5',   plays: ['D', 'D', 'D', 'D', 'D', 'D', 'D', 'D', 'H', 'H'] },
    { hand: '4,4',   plays: ['H', 'H', 'H', 'P', 'P', 'H', 'H', 'H', 'H', 'H'] },
    { hand: '3,3',   plays: ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'] },
    { hand: '2,2',   plays: ['P', 'P', 'P', 'P', 'P', 'P', 'H', 'H', 'H', 'H'] }
  ];

  var ACTION_NAMES = {
    H: 'Hit',
    S: 'Stand',
    D: 'Double, otherwise hit',
    Ds: 'Double, otherwise stand',
    P: 'Split'
  };

  window.TC.STRATEGY = {
    upcards: UPCARDS,
    charts: { hard: HARD, soft: SOFT, pairs: PAIRS },
    titles: { hard: 'Hard totals', soft: 'Soft totals', pairs: 'Pairs' },
    actionNames: ACTION_NAMES
  };
})();
