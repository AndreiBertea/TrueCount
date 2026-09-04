/* ==========================================================================
   login.js — simulated authentication (Form #1)
   ========================================================================== */
(function () {
  'use strict';

  var TC = window.TC;
  var $ = TC.$;

  TC.init();

  var form      = $('#login-form');
  var username  = $('#username');
  var password  = $('#password');
  var remember  = $('#remember');
  var submitBtn = $('#login-submit');
  var alertBox  = $('#login-alert');
  var toggleBtn = $('#toggle-password');
  var fillBtn   = $('#fill-demo');

  /* If the user is already signed in there is nothing to do here. */
  if (TC.Auth.isLoggedIn()) {
    TC.showAlert(alertBox,
      'You are already signed in as ' + TC.Auth.current().displayName + '. Taking you to the dashboard…',
      'info');
    window.setTimeout(function () { window.location.replace('index.html'); }, 1200);
    return;
  }

  /* Where should we send the user after a successful sign-in? */
  function nextPage() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get('next');
    var allowed = ['index.html', 'counter.html', 'learn.html', 'profile.html'];
    return allowed.indexOf(next) !== -1 ? next : 'index.html';
  }

  /* ---------------------------------------------------------------------
     Validation rules
     --------------------------------------------------------------------- */
  function usernameError() {
    var value = username.value.trim();
    if (!value) return 'Please enter a username.';
    if (value.length < 3) return 'Usernames are at least 3 characters.';
    if (!/^[a-zA-Z0-9_.-]+$/.test(value)) return 'Use letters, numbers, dots, dashes or underscores only.';
    return null;
  }

  function passwordError() {
    var value = password.value;
    if (!value) return 'Please enter your password.';
    if (value.length < 8) return 'Passwords are at least 8 characters.';
    return null;
  }

  function validateAll() {
    return TC.Validate.run([
      { input: username, check: usernameError },
      { input: password, check: passwordError }
    ]);
  }

  /* Validate a field as soon as the user leaves it, and clear the error
     again while they are correcting it. */
  [[username, usernameError], [password, passwordError]].forEach(function (pair) {
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
      TC.hideAlert(alertBox);
    });
  });

  /* ---------------------------------------------------------------------
     Show / hide password
     --------------------------------------------------------------------- */
  toggleBtn.addEventListener('click', function () {
    var showing = password.type === 'text';
    password.type = showing ? 'password' : 'text';
    toggleBtn.textContent = showing ? 'Show' : 'Hide';
    toggleBtn.setAttribute('aria-pressed', String(!showing));
    toggleBtn.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');
    password.focus();
  });

  /* ---------------------------------------------------------------------
     Fill the demo credentials
     --------------------------------------------------------------------- */
  fillBtn.addEventListener('click', function () {
    username.value = TC.Auth.demo.username;
    password.value = TC.Auth.demo.password;
    TC.Validate.pass(username, document.getElementById('username-error'));
    TC.Validate.pass(password, document.getElementById('password-error'));
    TC.toast('Demo credentials filled in.', 'info', 2200);
    submitBtn.focus();
  });

  /* ---------------------------------------------------------------------
     Submit — simulated, with a short "authenticating" delay so the
     loading state is visible.
     --------------------------------------------------------------------- */
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    TC.hideAlert(alertBox);

    if (!validateAll()) {
      TC.showAlert(alertBox, 'Please fix the highlighted fields and try again.', 'error');
      TC.toast('Sign-in failed — check the form.', 'error');
      return;
    }

    var user = username.value.trim();
    var pass = password.value;

    submitBtn.disabled = true;
    submitBtn.textContent = 'Checking…';

    window.setTimeout(function () {
      var demo = TC.Auth.demo;
      var correct = user.toLowerCase() === demo.username && pass === demo.password;

      // Any username is accepted as long as the demo password is used —
      // this keeps the tool usable while still exercising a real failure path.
      if (!correct && pass !== demo.password) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Enter the pit';
        TC.Validate.fail(password, document.getElementById('password-error'),
          'That password is not recognised.');
        TC.showAlert(alertBox,
          'Incorrect credentials. Use the demo account: dealer / blackjack21.', 'error');
        TC.toast('Incorrect credentials.', 'error');
        console.log('[TrueCount] Rejected sign-in attempt for "' + user + '".');
        return;
      }

      TC.Auth.login(user, remember.checked);
      TC.showAlert(alertBox, 'Welcome back, ' + user + '. Redirecting…', 'success');
      TC.toast('Signed in as ' + user + '.', 'success');
      submitBtn.textContent = 'Welcome ' + user;

      window.setTimeout(function () { window.location.href = nextPage(); }, 800);
    }, 550);
  });

  username.focus();
})();
