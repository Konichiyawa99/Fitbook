/* =========================================================
   profile-view.js — inline editing for the Edit Profile pages.
   Works with every `.info-list[data-store]` on the page and keeps the
   values in localStorage so they survive a reload.
   Also handles the profile photo upload / remove.
   ========================================================= */
(function () {
  'use strict';

  var toast = document.getElementById('info-toast');
  var toastTimer = null;

  function load(store) {
    try { return JSON.parse(localStorage.getItem('gtg-profile-' + store)) || {}; }
    catch (e) { return {}; }
  }
  function save(store, data) {
    try { localStorage.setItem('gtg-profile-' + store, JSON.stringify(data)); }
    catch (e) { /* storage unavailable: values live for this visit only */ }
  }

  function showToast(msg) {
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove('is-visible'); }, 3000);
  }

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) { n.setAttribute(k, attrs[k]); });
    if (text) n.textContent = text;
    return n;
  }

  function formatDate(iso) {
    var d = new Date(iso + 'T00:00:00');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' });
  }

  /* ---------- Value helpers ---------- */
  function getValue(row, data) {
    var key = row.dataset.key;
    if (row.dataset.type === 'name') {
      var n = data.name || {};
      return {
        first: n.first != null ? n.first : row.dataset.first || '',
        last: n.last != null ? n.last : row.dataset.last || ''
      };
    }
    if (row.dataset.type === 'password') return data.password || null;
    return data[key] != null ? data[key] : (row.dataset.default || '');
  }

  function render(row, data) {
    var out = row.querySelector('.info-row__value');
    var v = getValue(row, data);
    var type = row.dataset.type;
    var text;

    if (type === 'name') text = (v.first + ' ' + v.last).trim();
    else if (type === 'password') text = '••••••••';
    else if (type === 'date' && v) text = formatDate(v);
    else text = v;

    var empty = !text;
    out.textContent = empty ? 'Not set' : text;
    out.classList.toggle('is-empty', empty);
  }

  /* ---------- Editor ---------- */
  function field(id, label, input) {
    var wrap = el('div', { 'class': 'info-form__field' });
    wrap.appendChild(el('label', { 'for': id }, label));
    wrap.appendChild(input);
    return wrap;
  }

  function makeInput(id, type, value, placeholder) {
    var i = el('input', { id: id, type: type });
    if (value != null) i.value = value;
    if (placeholder) i.placeholder = placeholder;
    return i;
  }

  function closeEditor(row) {
    var form = row.querySelector('.info-form');
    if (form) form.remove();
    row.classList.remove('is-editing', 'is-editing--single');
    row.querySelector('.info-row__value').hidden = false;
    var btn = row.querySelector('.info-row__edit');
    btn.hidden = false;
    btn.setAttribute('aria-expanded', 'false');
    btn.focus();
  }

  function openEditor(row, data, store) {
    // Only one editor open at a time
    document.querySelectorAll('.info-row.is-editing').forEach(function (r) {
      if (r !== row) closeEditor(r);
    });

    var type = row.dataset.type;
    var key = row.dataset.key;
    var label = row.dataset.label;
    var uid = 'edit-' + store + '-' + key;
    var v = getValue(row, data);
    var inputs = [];
    var fields = el('div', { 'class': 'info-form__fields' });

    if (type === 'name') {
      var f = makeInput(uid + '-first', 'text', v.first); f.autocomplete = 'given-name';
      var l = makeInput(uid + '-last', 'text', v.last); l.autocomplete = 'family-name';
      inputs = [f, l];
      fields.appendChild(field(uid + '-first', 'First name', f));
      fields.appendChild(field(uid + '-last', 'Last name', l));
    } else if (type === 'password') {
      var p1 = makeInput(uid + '-new', 'password', '', 'At least 8 characters'); p1.autocomplete = 'new-password';
      var p2 = makeInput(uid + '-confirm', 'password', '', 'Re-enter password'); p2.autocomplete = 'new-password';
      inputs = [p1, p2];
      fields.appendChild(field(uid + '-new', 'New password', p1));
      fields.appendChild(field(uid + '-confirm', 'Confirm password', p2));
    } else if (type === 'select') {
      var s = el('select', { id: uid });
      row.dataset.options.split('|').forEach(function (o) {
        var opt = el('option', { value: o }, o);
        if (o === v) opt.selected = true;
        s.appendChild(opt);
      });
      inputs = [s];
      fields.appendChild(field(uid, label, s));
    } else {
      var inp = makeInput(uid, type, v, row.dataset.placeholder);
      if (type === 'number') { inp.min = '1'; inp.max = '120'; inp.inputMode = 'numeric'; }
      if (type === 'date') inp.max = new Date().toISOString().slice(0, 10);
      if (type === 'tel') inp.autocomplete = 'tel';
      if (type === 'email') inp.autocomplete = 'email';
      inputs = [inp];
      fields.appendChild(field(uid, label, inp));
    }

    var error = el('p', { 'class': 'info-form__error', role: 'alert' });
    var actions = el('div', { 'class': 'info-form__actions' });
    var saveBtn = el('button', { type: 'submit', 'class': 'btn btn-navy' }, 'Save');
    var cancelBtn = el('button', { type: 'button', 'class': 'btn btn-outline-plain' }, 'Cancel');
    actions.appendChild(saveBtn);
    actions.appendChild(cancelBtn);

    var form = el('form', { 'class': 'info-form', novalidate: '' });
    form.appendChild(fields);
    form.appendChild(error);
    form.appendChild(actions);

    function fail(msg, input) {
      error.textContent = msg;
      form.querySelectorAll('.has-error').forEach(function (n) { n.classList.remove('has-error'); });
      if (input) { input.parentNode.classList.add('has-error'); input.focus(); }
      return false;
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var val;

      if (type === 'name') {
        var first = inputs[0].value.trim(), last = inputs[1].value.trim();
        if (!first) return fail('Please enter your first name.', inputs[0]);
        if (!last) return fail('Please enter your last name.', inputs[1]);
        data.name = { first: first, last: last };
        syncHeaderName(first, last);
      } else if (type === 'password') {
        if (inputs[0].value.length < 8) return fail('Password must be at least 8 characters.', inputs[0]);
        if (inputs[0].value !== inputs[1].value) return fail('Passwords do not match.', inputs[1]);
        data.password = true; // never store the password itself in the browser
      } else {
        val = inputs[0].value.trim();
        if (type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return fail('Enter a valid email address.', inputs[0]);
        if (type === 'tel' && !/^[0-9+()\-\s]{7,20}$/.test(val)) return fail('Enter a valid phone number.', inputs[0]);
        if (type === 'number') {
          var n = Number(val);
          if (!val || !isFinite(n) || n < 1 || n > 120) return fail('Enter a valid age (1–120).', inputs[0]);
        }
        if (type === 'date' && val && new Date(val) > new Date()) return fail('Birthdate cannot be in the future.', inputs[0]);
        if (type === 'text' && key !== 'address' && !val) return fail('This field can’t be empty.', inputs[0]);
        data[key] = val;
      }

      save(store, data);
      render(row, data);
      closeEditor(row);
      showToast(label + ' updated.');
    });

    cancelBtn.addEventListener('click', function () { closeEditor(row); });
    form.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { e.stopPropagation(); closeEditor(row); }
    });

    row.classList.add('is-editing');
    if (type !== 'name' && type !== 'password') row.classList.add('is-editing--single');
    row.querySelector('.info-row__value').hidden = true;
    var btn = row.querySelector('.info-row__edit');
    btn.hidden = true;
    btn.setAttribute('aria-expanded', 'true');
    row.appendChild(form);
    inputs[0].focus();
  }

  /* Keep the "Last, First" name in the top-bar settings menu in sync */
  function syncHeaderName(first, last) {
    var n = document.querySelector('.settings-panel__profile-name');
    if (n && /-account$/.test(currentAccountStore || '')) n.textContent = last + ', ' + first;
  }
  var currentAccountStore = '';

  /* ---------- Wire up every list ---------- */
  document.querySelectorAll('.info-list[data-store]').forEach(function (list) {
    var store = list.dataset.store;
    var data = load(store);
    if (/-account$/.test(store)) {
      currentAccountStore = store;
      if (data.name) syncHeaderName(data.name.first, data.name.last);
    }
    list.querySelectorAll('.info-row').forEach(function (row) {
      render(row, data);
      row.querySelector('.info-row__edit').setAttribute('aria-label', 'Edit ' + row.dataset.label);
      row.querySelector('.info-row__edit').addEventListener('click', function () {
        openEditor(row, data, store);
      });
    });
  });

  /* ---------- Profile photo ---------- */
  var preview = document.getElementById('avatar-preview');
  var upload = document.getElementById('avatar-upload');
  var hint = document.querySelector('.edit-profile-photo__hint');
  var removeBtn = document.querySelector('.edit-profile-photo__actions .btn-outline-plain');
  if (!preview || !upload) return;

  var originalSrc = preview.getAttribute('src');
  var hintText = hint ? hint.textContent : '';
  var placeholder = 'data:image/svg+xml;utf8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="#dcdcd8"/>' +
    '<circle cx="100" cy="78" r="36" fill="#a9a9a4"/><path d="M28 200c4-44 36-68 72-68s68 24 72 68z" fill="#a9a9a4"/></svg>');

  function setHint(msg, isError) {
    if (!hint) return;
    hint.textContent = msg || hintText;
    hint.classList.toggle('is-error', !!isError);
  }

  preview.addEventListener('error', function () {
    if (preview.getAttribute('src') !== placeholder) preview.src = placeholder;
  });

  upload.addEventListener('change', function (e) {
    var file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!/^image\/(jpeg|png)$/.test(file.type)) {
      setHint('Please choose a JPG or PNG image.', true);
      upload.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setHint('That file is over 5MB. Please choose a smaller one.', true);
      upload.value = '';
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      preview.src = ev.target.result;
      setHint('', false);
      showToast('Profile photo updated.');
    };
    reader.readAsDataURL(file);
  });

  if (removeBtn) {
    removeBtn.addEventListener('click', function () {
      preview.src = placeholder;
      upload.value = '';
      setHint('', false);
      showToast('Profile photo removed.');
    });
  }
})();
