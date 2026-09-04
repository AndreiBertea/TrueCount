/* ==========================================================================
   profile.js — user profile, settings (Form #4) and feedback (Form #5)
   ========================================================================== */
(function () {
  'use strict';

  var TC = window.TC;
  var $ = TC.$, $$ = TC.$$, el = TC.el, clear = TC.clear;

  if (!TC.init({ requireAuth: true })) return;

  var session = TC.Auth.current();
  var AVATARS = ['🂡', '♠', '♥', '♦', '♣', '🎯', '🧠', '🕶'];

  /* ---------------------------------------------------------------------
     Stored profile
     --------------------------------------------------------------------- */
  function loadProfile() {
    var saved = TC.Store.get(TC.KEYS.profile, {}) || {};
    return {
      displayName:   saved.displayName || session.displayName || session.username,
      email:         saved.email || '',
      avatar:        saved.avatar || session.avatar || '🂡',
      defaultSystem: TC.SYSTEMS[saved.defaultSystem] ? saved.defaultSystem : 'hi-lo',
      bankroll:      typeof saved.bankroll === 'number' ? saved.bankroll : 2000,
      betUnit:       typeof saved.betUnit === 'number' ? saved.betUnit : 25,
      showHints:     saved.showHints !== false
    };
  }

  var profile = loadProfile();

  /* ---------------------------------------------------------------------
     Elements
     --------------------------------------------------------------------- */
  var form         = $('#settings-form');
  var nameInput    = $('#display-name');
  var emailInput   = $('#email');
  var systemSelect = $('#default-system');
  var bankrollInput= $('#bankroll');
  var unitInput    = $('#bet-unit');
  var hintsToggle  = $('#show-hints');
  var avatarGroup  = $('#avatar-choice');
  var settingsAlert= $('#settings-alert');
  var spreadNote   = $('#spread-note');

  var chosenAvatar = profile.avatar;

  TC.SYSTEM_ORDER.forEach(function (id) {
    systemSelect.appendChild(el('option', { value: id }, [TC.SYSTEMS[id].name]));
  });

  /* ---------------------------------------------------------------------
     Identity header
     --------------------------------------------------------------------- */
  function renderIdentity() {
    var stats = TC.Stats.all();

    $('#profile-avatar').textContent = profile.avatar;
    $('#profile-name').textContent = profile.displayName;
    $('#profile-meta').textContent = '@' + session.username +
      (profile.email ? ' · ' + profile.email : ' · no email on file');
    $('#profile-system').textContent = TC.SYSTEMS[profile.defaultSystem].name;

    // Experience is judged on how much shoe you have actually counted.
    var level = stats.cardsCounted < 200 ? 'Beginner'
      : stats.cardsCounted < 2000 ? 'Improving'
      : 'Experienced';
    $('#profile-level').textContent = level;

    $('#profile-since').textContent = session.loggedInAt
      ? 'Session started ' + TC.relativeTime(session.loggedInAt)
      : 'New player';

    // Quick stats in the aside
    var quick = clear($('#profile-quickstats'));
    [
      ['Cards counted', stats.cardsCounted.toLocaleString('en-IE')],
      ['Shoes saved', String(stats.sessions)],
      ['Sign-ins', String(stats.logins)],
      ['Peak true count', TC.signed(stats.peakTrueCount, 1)]
    ].forEach(function (pair) {
      quick.appendChild(
        el('div', { class: 'row row--between row--middle' }, [
          el('span', { class: 'faint', text: pair[0] }),
          el('strong', { text: pair[1] })
        ])
      );
    });
  }

  function renderStats() {
    var s = TC.Stats.all();
    var row = clear($('#profile-stats'));

    [
      { label: 'Sign-ins',       value: s.logins,       hint: 'simulated sessions' },
      { label: 'Cards counted',  value: s.cardsCounted.toLocaleString('en-IE'), hint: 'on the live count' },
      { label: 'Shoes saved',    value: s.sessions,     hint: 'recorded sessions' },
      { label: 'Peak true count',value: TC.signed(s.peakTrueCount, 1), hint: 'highest tracked' }
    ].forEach(function (tile) {
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
     Avatar picker
     --------------------------------------------------------------------- */
  function renderAvatars() {
    clear(avatarGroup);
    AVATARS.forEach(function (glyph) {
      var btn = el('button', {
        class: 'chip' + (glyph === chosenAvatar ? ' is-active' : ''),
        type: 'button',
        'aria-pressed': String(glyph === chosenAvatar),
        'aria-label': 'Use ' + glyph + ' as your avatar',
        style: 'font-size:1.15rem;line-height:1.2'
      }, [glyph]);

      btn.addEventListener('click', function () {
        chosenAvatar = glyph;
        renderAvatars();
        $('#profile-avatar').textContent = glyph;
      });

      avatarGroup.appendChild(btn);
    });
  }

  /* ---------------------------------------------------------------------
     Fill the form from the stored profile
     --------------------------------------------------------------------- */
  function fillForm() {
    nameInput.value = profile.displayName;
    emailInput.value = profile.email;
    systemSelect.value = profile.defaultSystem;
    bankrollInput.value = profile.bankroll;
    unitInput.value = profile.betUnit;
    hintsToggle.checked = profile.showHints;
    chosenAvatar = profile.avatar;
    renderAvatars();
    updateSpreadNote();
  }

  /** A live piece of advice that reacts to the bankroll/unit pair. */
  function updateSpreadNote() {
    var bankroll = Number(bankrollInput.value);
    var unit = Number(unitInput.value);

    if (!bankroll || !unit || unit <= 0) {
      spreadNote.textContent = 'Enter a bankroll and a betting unit to see how much cover you have.';
      return;
    }

    var units = Math.floor(bankroll / unit);
    var verdict = units >= 200 ? 'very comfortable'
      : units >= 100 ? 'comfortable'
      : units >= 50 ? 'workable, but thin'
      : 'too thin — a 1–12 spread will bust this roll';

    spreadNote.textContent = 'A unit of ' + TC.money(unit) + ' against a ' + TC.money(bankroll) +
      ' bankroll is ' + units.toLocaleString('en-IE') + ' units of cover — ' + verdict + '.';
  }

  bankrollInput.addEventListener('input', updateSpreadNote);
  unitInput.addEventListener('input', updateSpreadNote);

  /* ---------------------------------------------------------------------
     Validation (Form #4)
     --------------------------------------------------------------------- */
  function nameError() {
    var v = nameInput.value.trim();
    if (!v) return 'Give yourself a display name.';
    if (v.length < 2) return 'That is a little short — use at least 2 characters.';
    if (v.length > 24) return 'Keep it to 24 characters or fewer.';
    return null;
  }

  function emailError() {
    var v = emailInput.value.trim();
    if (!v) return 'We need an email address for your summary.';
    if (!TC.Validate.isEmail(v)) return 'That does not look like an email address.';
    return null;
  }

  function bankrollError() {
    var v = Number(bankrollInput.value);
    if (!bankrollInput.value.trim()) return 'Enter your bankroll.';
    if (Number.isNaN(v) || v < 100) return 'Use a bankroll of at least €100.';
    if (v > 1000000) return 'That is above the supported maximum of €1,000,000.';
    return null;
  }

  function unitError() {
    var v = Number(unitInput.value);
    var bankroll = Number(bankrollInput.value);
    if (!unitInput.value.trim()) return 'Enter a betting unit.';
    if (Number.isNaN(v) || v < 1) return 'A betting unit must be at least €1.';
    if (v > 1000) return 'Keep the unit at €1000 or below.';
    if (bankroll && v * 20 > bankroll) return 'That unit is more than 1/20th of your bankroll.';
    return null;
  }

  [[nameInput, nameError], [emailInput, emailError],
   [bankrollInput, bankrollError], [unitInput, unitError]].forEach(function (pair) {
    var input = pair[0], check = pair[1];
    var errorNode = document.getElementById(input.id + '-error');

    input.addEventListener('blur', function () {
      var message = check();
      if (message) TC.Validate.fail(input, errorNode, message);
      else TC.Validate.pass(input, errorNode);
    });

    input.addEventListener('input', function () {
      if (input.classList.contains('is-invalid') && !check()) {
        TC.Validate.pass(input, errorNode);
      }
      TC.hideAlert(settingsAlert);
    });
  });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var valid = TC.Validate.run([
      { input: nameInput,     check: nameError },
      { input: emailInput,    check: emailError },
      { input: bankrollInput, check: bankrollError },
      { input: unitInput,     check: unitError }
    ]);

    if (!valid) {
      TC.showAlert(settingsAlert, 'Some fields need attention before we can save.', 'error');
      TC.toast('Settings not saved — check the form.', 'error');
      return;
    }

    profile = {
      displayName:   nameInput.value.trim(),
      email:         emailInput.value.trim(),
      avatar:        chosenAvatar,
      defaultSystem: systemSelect.value,
      bankroll:      Number(bankrollInput.value),
      betUnit:       Number(unitInput.value),
      showHints:     hintsToggle.checked
    };

    TC.Store.set(TC.KEYS.profile, profile);

    // Keep the header in sync with the new name/avatar.
    TC.Auth.updateSession({ displayName: profile.displayName, avatar: profile.avatar });

    // Push the preferred system and unit into the live counter's state.
    var counter = TC.Store.get(TC.KEYS.counter, null);
    if (counter) {
      counter.systemId = profile.defaultSystem;
      counter.unit = profile.betUnit;
      TC.Store.set(TC.KEYS.counter, counter);
    }

    TC.Activity.add('Updated profile settings', 'profile',
      profile.displayName + ' · ' + TC.SYSTEMS[profile.defaultSystem].name);

    // Simulated submission — the brief asks for this to be printed.
    console.log('[TrueCount] Profile form submitted:', Object.assign({}, profile, {
      username: session.username,
      submittedAt: new Date().toISOString()
    }));

    TC.showAlert(settingsAlert, 'Settings saved. Your header and live count now use them.', 'success');
    TC.toast('Profile updated.', 'success');

    renderIdentity();
    // Re-render the header so the new name and avatar appear immediately.
    TC.init();
  });

  $('#revert-btn').addEventListener('click', function (event) {
    event.preventDefault();
    profile = loadProfile();
    fillForm();
    $$('.is-invalid', form).forEach(function (input) {
      TC.Validate.pass(input, document.getElementById(input.id + '-error'));
    });
    TC.hideAlert(settingsAlert);
    TC.toast('Reverted to your saved settings.', 'info');
  });

  /* ---------------------------------------------------------------------
     Feedback form (Form #5)
     --------------------------------------------------------------------- */
  var feedbackForm  = $('#feedback-form');
  var topicSelect   = $('#feedback-topic');
  var messageInput  = $('#feedback-message');
  var charCount     = $('#char-count');
  var feedbackAlert = $('#feedback-alert');

  messageInput.addEventListener('input', function () {
    var length = messageInput.value.length;
    charCount.textContent = length + ' / 500';
    charCount.style.color = length > 460 ? 'var(--warning)' : '';
    if (messageInput.classList.contains('is-invalid') && length >= 20) {
      TC.Validate.pass(messageInput, $('#feedback-message-error'));
    }
  });

  feedbackForm.addEventListener('submit', function (event) {
    event.preventDefault();

    var valid = TC.Validate.run([
      {
        input: topicSelect,
        check: function () { return topicSelect.value ? null : 'Pick a topic.'; }
      },
      {
        input: messageInput,
        check: function () {
          var v = messageInput.value.trim();
          if (!v) return 'Write a short message.';
          if (v.length < 20) return 'Tell us a little more — at least 20 characters.';
          if (v.length > 500) return 'Please keep it under 500 characters.';
          return null;
        }
      }
    ]);

    if (!valid) {
      TC.showAlert(feedbackAlert, 'Your feedback needs a topic and a message.', 'error');
      TC.toast('Feedback not sent.', 'error');
      return;
    }

    var payload = {
      from: session.username,
      email: profile.email || '(not provided)',
      topic: topicSelect.value,
      message: messageInput.value.trim(),
      submittedAt: new Date().toISOString()
    };

    // Simulated submission.
    console.log('[TrueCount] Feedback form submitted:', payload);

    TC.Activity.add('Sent feedback', 'profile', topicSelect.options[topicSelect.selectedIndex].text);
    TC.showAlert(feedbackAlert,
      'Thanks — your feedback was captured. Open the browser console to see the payload.', 'success');
    TC.toast('Feedback sent.', 'success');

    feedbackForm.reset();
    charCount.textContent = '0 / 500';
  });

  /* ---------------------------------------------------------------------
     Data controls
     --------------------------------------------------------------------- */
  $('#export-btn').addEventListener('click', function () {
    var dump = {
      session: TC.Auth.current(),
      profile: TC.Store.get(TC.KEYS.profile, {}),
      stats: TC.Stats.all(),
      activity: TC.Activity.all(),
      counter: TC.Store.get(TC.KEYS.counter, null)
    };
    console.log('[TrueCount] Full local data export:', dump);
    TC.toast('Your data is printed in the browser console.', 'info', 4200);
  });

  $('#reset-stats-btn').addEventListener('click', function () {
    if (!window.confirm('Reset every statistic? Your profile and settings are kept.')) return;
    TC.Stats.reset();
    TC.Activity.add('Reset practice statistics', 'profile');
    renderIdentity();
    renderStats();
    TC.toast('Statistics reset.', 'success');
    console.log('[TrueCount] Statistics reset by the user.');
  });

  $('#wipe-btn').addEventListener('click', function () {
    if (!window.confirm('Delete everything TrueCount has stored and sign out?')) return;
    [TC.KEYS.session, TC.KEYS.profile, TC.KEYS.stats, TC.KEYS.activity, TC.KEYS.counter]
      .forEach(TC.Store.remove);
    console.log('[TrueCount] All local data deleted.');
    TC.toast('Everything deleted. Signing you out…', 'info');
    window.setTimeout(function () { window.location.href = 'login.html'; }, 900);
  });

  /* ---------------------------------------------------------------------
     Boot
     --------------------------------------------------------------------- */
  fillForm();
  renderIdentity();
  renderStats();
})();
