(function () {
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var SESSION_TIMES = ['7:00 AM', '8:00 AM', '9:00 AM', '10:00 AM', '11:00 AM', '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM'];
  var COACHES = ['Coach Irene', 'Coach Ken', 'Coach Ryan', 'Coach Vince', 'Coach Kyroll'];
  var LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

  var now = new Date();
  var year = now.getFullYear();
  var startOfToday = new Date(year, now.getMonth(), now.getDate());

  var monthSelect = document.getElementById('sched-month');
  var grid = document.getElementById('sched-grid');
  var aside = document.getElementById('sched-aside');
  document.getElementById('sched-year').textContent = year;

  // ---- enrollments (saved by the Classes page after payment) ----
  var enrollments = [];
  var activeId = null;
  try {
    enrollments = JSON.parse(localStorage.getItem('gtg_enrollments') || '[]');
    activeId = localStorage.getItem('gtg_active_enrollment');
  } catch (e) { enrollments = []; }

  function save() {
    try { localStorage.setItem('gtg_enrollments', JSON.stringify(enrollments)); } catch (e) { /* ignore */ }
  }
  function active() {
    return enrollments.filter(function (x) { return x.id === activeId; })[0] || enrollments[enrollments.length - 1] || null;
  }

  var selectedDate = null;
  var menuKey = null;
  var longPressTimer = null;
  var suppressClick = false;

  function bookedOf(enr) { return enr ? enr.booked : {}; }
  function bookedCount(enr) { return Object.keys(bookedOf(enr)).length; }
  function sessionsLeft(enr) { return enr.total === null ? Infinity : enr.total - bookedCount(enr); }
  function counterText(enr) {
    return enr.total === null ? 'Unlimited sessions' : sessionsLeft(enr) + '/' + enr.total + ' Sessions Left';
  }
  function enrLabel(enr) {
    return enr.className + (enr.variantLabel ? ' \u00B7 ' + enr.variantLabel : '') + ' \u00B7 ' + enr.pkgLabel;
  }
  function sessionTypesFor(key) {
    if (key === 'boxing') return ['Group Class', 'Personal Training', 'Buddy Training'];
    if (key === 'gym') return ['Gym Use', 'Group Class'];
    return ['Group Class', 'Private Session'];
  }
  function selectHtml(id, label, list, chosen) {
    return '<select class="select-native" id="' + id + '" aria-label="' + label + '">' +
      '<option value="" disabled' + (chosen ? '' : ' selected') + '>' + label + '</option>' +
      list.map(function (o) { return '<option' + (o === chosen ? ' selected' : '') + '>' + o + '</option>'; }).join('') +
      '</select>';
  }

  // ---- right-click / long-press menu ----
  var menu = document.createElement('div');
  menu.className = 'sched-menu';
  menu.hidden = true;
  menu.innerHTML = '<button type="button" data-act="edit">Edit session</button><button type="button" data-act="cancel">Cancel session</button>';
  document.body.appendChild(menu);

  function hideMenu() { menu.hidden = true; menuKey = null; }
  function openMenu(key, x, y) {
    menuKey = key;
    menu.hidden = false;
    menu.style.left = Math.min(x, window.innerWidth - 170) + 'px';
    menu.style.top = Math.min(y, window.innerHeight - 100) + 'px';
  }

  // ---- calendar ----
  monthSelect.innerHTML = MONTHS.map(function (m, i) {
    return '<option value="' + i + '"' + (i === now.getMonth() ? ' selected' : '') + '>' + m + '</option>';
  }).join('');

  function renderGrid() {
    var enr = active();
    var booked = bookedOf(enr);
    var month = parseInt(monthSelect.value, 10);
    grid.querySelectorAll('.big-calendar__cell').forEach(function (c) { c.remove(); });
    var first = new Date(year, month, 1).getDay();
    var total = new Date(year, month + 1, 0).getDate();
    var i;
    function blank() {
      var b = document.createElement('span');
      b.className = 'big-calendar__cell big-calendar__cell--blank';
      grid.appendChild(b);
    }
    for (i = 0; i < first; i++) blank();
    for (var day = 1; day <= total; day++) {
      (function (day) {
        var key = month + '-' + day;
        var btn = document.createElement('button');
        var date = new Date(year, month, day);
        btn.type = 'button';
        btn.className = 'big-calendar__cell';
        btn.textContent = day;
        // past dates, no enrollment, or every enrolled session already scheduled -> can't pick a free date
        if (date < startOfToday || !enr || (!booked[key] && sessionsLeft(enr) <= 0)) btn.disabled = true;
        if (date.getTime() === startOfToday.getTime()) btn.classList.add('is-today');
        if (selectedDate && selectedDate.month === month && selectedDate.day === day) btn.classList.add('is-selected');
        if (booked[key]) btn.classList.add('has-booking');

        btn.addEventListener('click', function () {
          if (suppressClick) { suppressClick = false; return; }
          selectedDate = { month: month, day: day };
          renderGrid();
          renderAside(false);
        });
        if (booked[key]) {
          btn.addEventListener('contextmenu', function (e) {
            e.preventDefault();
            openMenu(key, e.clientX, e.clientY);
          });
          btn.addEventListener('touchstart', function (e) {
            var t = e.touches[0];
            longPressTimer = setTimeout(function () {
              suppressClick = true;
              openMenu(key, t.clientX, t.clientY);
            }, 550);
          }, { passive: true });
          ['touchend', 'touchmove', 'touchcancel'].forEach(function (ev) {
            btn.addEventListener(ev, function () { clearTimeout(longPressTimer); }, { passive: true });
          });
        }
        grid.appendChild(btn);
      })(day);
    }
    var trailing = (7 - ((first + total) % 7)) % 7;
    for (i = 0; i < trailing; i++) blank();
  }

  // ---- side panel ----
  function renderAside(editing) {
    var enr = active();
    if (!enr) {
      aside.innerHTML = '<p class="sched-empty">No class enrolled yet</p><a class="sched-link" href="classes.html">Go to Classes</a>';
      return;
    }
    var booked = bookedOf(enr);

    if (!selectedDate) {
      aside.innerHTML = '<p class="sched-empty">' + (sessionsLeft(enr) <= 0 ? 'All sessions scheduled' : 'Select a Date') + '</p>' +
        '<p class="sched-left sched-left--center">' + enrLabel(enr) + '<br>' + counterText(enr) + '</p>';
      return;
    }

    var key = selectedDate.month + '-' + selectedDate.day;
    var existing = booked[key];
    var dateText = MONTHS[selectedDate.month] + ' ' + selectedDate.day + ', ' + year;

    if (existing && !editing) {
      aside.innerHTML =
        '<h2 class="sched-date-title">' + dateText + '</h2>' +
        '<p class="sched-success">' + enr.className + ' \u00B7 ' + existing.type + ' \u00B7 ' + existing.level + '<br>' +
          existing.time + ' with ' + existing.trainer + '</p>' +
        '<p class="sched-left sched-left--center">' + counterText(enr) + '</p>' +
        '<div class="sched-row">' +
          '<button type="button" class="sched-apply" id="sched-edit">Edit</button>' +
          '<button type="button" class="sched-apply sched-apply--ghost" id="sched-cancel">Cancel session</button>' +
        '</div>';
      document.getElementById('sched-edit').addEventListener('click', function () { renderAside(true); });
      document.getElementById('sched-cancel').addEventListener('click', function () { cancelSession(key); });
      return;
    }

    var pickedTime = existing ? existing.time : '';
    var chosenType = existing ? existing.type : (enr.variantLabel || '');
    var classOptions = enrollments.map(function (x) { return '<option value="' + x.id + '"' + (x.id === enr.id ? ' selected' : '') + '>' + enrLabel(x) + '</option>'; }).join('');

    aside.innerHTML =
      '<h2 class="sched-date-title">' + dateText + '</h2>' +
      '<div class="sched-form">' +
        '<select class="select-native" id="sched-class" aria-label="Class you Subscribed">' + classOptions + '</select>' +
        '<p class="sched-left">' + counterText(enr) + '</p>' +
        selectHtml('sched-type', 'Session Type', sessionTypesFor(enr.classKey), chosenType) +
        selectHtml('sched-level', 'Class Difficulty', LEVELS, existing ? existing.level : '') +
        '<p class="sched-label">Time Available:</p>' +
        '<div class="sched-times">' +
          SESSION_TIMES.map(function (t) { return '<button type="button" class="sched-time' + (t === pickedTime ? ' is-selected' : '') + '">' + t + '</button>'; }).join('') +
        '</div>' +
        selectHtml('sched-trainer', 'Trainer', COACHES, existing ? existing.trainer : '') +
        '<p class="sched-error" id="sched-error" hidden>Please choose a session type, difficulty, time and trainer.</p>' +
        '<button type="button" class="sched-apply" id="sched-apply">' + (existing ? 'Update Session' : 'Apply Session') + '</button>' +
        '<p class="sched-note">Please be informed that all class session schedules are fixed and strictly followed. Clients are expected to arrive on time and be present for the full duration of their scheduled session.</p>' +
      '</div>';

    document.getElementById('sched-class').addEventListener('change', function (e) {
      activeId = e.target.value;
      try { localStorage.setItem('gtg_active_enrollment', activeId); } catch (err) { /* ignore */ }
      renderGrid();
      renderAside(false);
    });

    aside.querySelectorAll('.sched-time').forEach(function (b) {
      b.addEventListener('click', function () {
        aside.querySelectorAll('.sched-time').forEach(function (x) { x.classList.remove('is-selected'); });
        b.classList.add('is-selected');
        pickedTime = b.textContent;
      });
    });

    document.getElementById('sched-apply').addEventListener('click', function () {
      var type = document.getElementById('sched-type').value;
      var level = document.getElementById('sched-level').value;
      var trainer = document.getElementById('sched-trainer').value;
      if (!type || !level || !trainer || !pickedTime) {
        document.getElementById('sched-error').hidden = false;
        return;
      }
      if (!existing && sessionsLeft(enr) <= 0) return;   // no sessions left
      enr.booked[key] = { type: type, level: level, time: pickedTime, trainer: trainer };
      save();
      renderGrid();
      aside.innerHTML =
        '<h2 class="sched-date-title">' + (existing ? 'Session updated!' : 'Session booked!') + '</h2>' +
        '<p class="sched-success">' + enr.className + ' \u00B7 ' + type + ' \u00B7 ' + level + '<br>' +
          dateText + ' at ' + pickedTime + ' with ' + trainer + '</p>' +
        '<p class="sched-left sched-left--center">' + counterText(enr) + '</p>' +
        (sessionsLeft(enr) > 0 ? '<button type="button" class="sched-apply" id="sched-another">Book another date</button>' : '') +
        '<a class="sched-link" href="classes.html">Back to Classes</a>';
      var another = document.getElementById('sched-another');
      if (another) another.addEventListener('click', function () {
        selectedDate = null;
        renderGrid();
        renderAside(false);
      });
    });
  }

  function cancelSession(key) {
    var enr = active();
    var parts = key.split('-');
    var label = MONTHS[Number(parts[0])] + ' ' + parts[1] + ', ' + year;
    if (!window.confirm('Cancel your ' + enr.className + ' session on ' + label + '?')) return;
    delete enr.booked[key];
    save();
    selectedDate = null;
    renderGrid();
    renderAside(false);
  }

  menu.addEventListener('click', function (e) {
    var act = e.target.getAttribute('data-act');
    var key = menuKey;
    hideMenu();
    if (!act || !key) return;
    var parts = key.split('-');
    if (act === 'edit') {
      selectedDate = { month: Number(parts[0]), day: Number(parts[1]) };
      renderGrid();
      renderAside(true);
    } else {
      cancelSession(key);
    }
  });
  document.addEventListener('click', function (e) { if (!menu.contains(e.target)) hideMenu(); });
  document.addEventListener('scroll', hideMenu, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideMenu(); });

  monthSelect.addEventListener('change', function () {
    selectedDate = null;
    hideMenu();
    renderGrid();
    renderAside(false);
  });

  renderGrid();
  renderAside(false);
})();
