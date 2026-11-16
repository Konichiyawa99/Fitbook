document.addEventListener('DOMContentLoaded', function () {
  var roleFilter = document.getElementById('role-filter');
  var tableBody = document.querySelector('#checkin-table tbody');
  var emptyState = document.getElementById('checkin-empty');
  var errorState = document.getElementById('trainer-dashboard-error');
  var today = new Date();
  var year = today.getFullYear();
  var monthSelect = document.getElementById('dash-month-select');
  var yearLabel = document.getElementById('dash-calendar-year');
  var calendar = document.getElementById('dash-big-calendar');
  var todayAttendance = [];
  var classesById = {};

  function localDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function showError(error) {
    console.error('Unable to load trainer dashboard:', error);
    errorState.hidden = false;
    errorState.textContent = 'Dashboard data could not be loaded: ' + error.message;
  }

  function renderCalendar(schedules, month) {
    calendar.querySelectorAll('.big-calendar__cell').forEach(function (cell) { cell.remove(); });
    var first = new Date(year, month, 1).getDay();
    var total = new Date(year, month + 1, 0).getDate();
    var scheduledDays = new Set(schedules
      .filter(function (row) { return Number(row.scheduledate.slice(5, 7)) === month + 1; })
      .map(function (row) { return Number(row.scheduledate.slice(8, 10)); }));

    function addCell(day) {
      var cell = document.createElement(day ? 'button' : 'span');
      cell.className = 'big-calendar__cell' + (day ? '' : ' big-calendar__cell--blank');
      if (day) {
        cell.type = 'button';
        cell.textContent = day;
        if (scheduledDays.has(day)) cell.classList.add('has-booking');
      }
      calendar.appendChild(cell);
    }

    for (var blank = 0; blank < first; blank++) addCell(null);
    for (var day = 1; day <= total; day++) addCell(day);
    var trailing = (7 - ((first + total) % 7)) % 7;
    for (var pad = 0; pad < trailing; pad++) addCell(null);
  }

  function renderLog() {
    var selectedRole = roleFilter.value;
    var visible = 0;
    tableBody.querySelectorAll('tr').forEach(function (row) {
      var matches = selectedRole === 'all' || row.dataset.role === selectedRole;
      row.classList.toggle('is-hidden', !matches);
      if (matches) visible++;
    });
    emptyState.hidden = visible > 0;
  }

  async function load() {
    var account = await window.GTGData.getAccount();
    if (!account || !account.trainer) throw new Error('This account is not linked to a trainer profile.');
    var name = window.GTGData.accountName(account);
    document.querySelector('[data-profile-first-name]').textContent = name.split(' ')[0] || 'Trainer';
    document.getElementById('trainer-profile-meta').textContent =
      account.employee && account.employee.age ? account.employee.age + ' years old' : '';
    document.getElementById('trainer-age').textContent =
      account.employee && account.employee.age ? account.employee.age : '—';
    document.getElementById('trainer-gender').textContent =
      account.employee && account.employee.sex ? account.employee.sex : '—';
    document.getElementById('trainer-specialty').textContent = account.trainer.specialty || '—';
    var assignedTags = document.getElementById('assigned-tags');
    if (account.trainer.specialty) {
      var tag = document.createElement('li');
      tag.className = 'tag';
      tag.textContent = account.trainer.specialty;
      assignedTags.appendChild(tag);
    }

    var todayKey = localDate(today);
    var daySchedules = window.GTGData.throwIfError(await window.supabaseClient.from('tbl_schedule')
      .select('scheduleid, classesid, scheduledate, time')
      .eq('trainerid', account.trainer.trainerid)
      .eq('scheduledate', todayKey)
      .order('time', { ascending: true })) || [];
    async function fetchMonthSchedules(month) {
      var monthStart = new Date(year, month, 1);
      var monthEnd = new Date(year, month + 1, 1);
      return window.GTGData.throwIfError(await window.supabaseClient.from('tbl_schedule')
        .select('scheduleid, classesid, scheduledate, time')
        .eq('trainerid', account.trainer.trainerid)
        .gte('scheduledate', localDate(monthStart))
        .lt('scheduledate', localDate(monthEnd))) || [];
    }
    var monthSchedules = await fetchMonthSchedules(today.getMonth());

    var classIds = Array.from(new Set(daySchedules.concat(monthSchedules).map(function (row) {
      return row.classesid;
    }).filter(Boolean)));
    var classes = classIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_classes')
        .select('classesid, classesname').in('classesid', classIds))
      : [];
    classes.forEach(function (row) { classesById[row.classesid] = row; });

    var nextSchedule = daySchedules.filter(function (row) {
      var parts = String(row.time || '').split(':');
      return Number(parts[0]) * 60 + Number(parts[1]) >= today.getHours() * 60 + today.getMinutes();
    })[0];
    if (nextSchedule) {
      var nextClass = classesById[nextSchedule.classesid];
      document.getElementById('trainer-today-class').textContent = nextClass ? nextClass.classesname : 'Scheduled class';
    } else {
      document.getElementById('trainer-today-class').textContent = 'No upcoming class';
    }

    var scheduleIds = daySchedules.map(function (row) { return row.scheduleid; });
    todayAttendance = scheduleIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_memberattendance')
        .select('memberattendanceid, memberid, scheduleid, timein, timeout')
        .in('scheduleid', scheduleIds)
        .order('timein', { ascending: false }))
      : [];
    var memberIds = Array.from(new Set(todayAttendance.map(function (row) { return row.memberid; }).filter(Boolean)));
    var members = memberIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_member')
        .select('memberid, firstname, lastname').in('memberid', memberIds))
      : [];
    var membersById = {};
    members.forEach(function (row) { membersById[row.memberid] = row; });

    tableBody.textContent = '';
    todayAttendance.forEach(function (row, index) {
      var member = membersById[row.memberid] || {};
      var values = [
        todayAttendance.length - index,
        member.firstname || '',
        member.lastname || '',
        row.timein ? new Date(row.timein).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—',
        row.timeout ? new Date(row.timeout).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '—',
        'Member'
      ];
      var tr = document.createElement('tr');
      tr.dataset.role = 'member';
      values.forEach(function (value) {
        var cell = document.createElement('td');
        cell.textContent = value;
        tr.appendChild(cell);
      });
      tableBody.appendChild(tr);
    });

    document.getElementById('trainer-attendees-today').textContent = todayAttendance.length;
    var classAttendees = nextSchedule
      ? todayAttendance.filter(function (row) { return row.scheduleid === nextSchedule.scheduleid; }).length
      : 0;
    document.getElementById('trainer-class-attendees').textContent = classAttendees;

    monthSelect.replaceChildren();
    for (var month = 0; month < 12; month++) {
      monthSelect.add(new Option(new Date(year, month, 1).toLocaleString([], { month: 'long' }), month));
    }
    monthSelect.value = String(today.getMonth());
    yearLabel.textContent = year;
    monthSelect.addEventListener('change', function () {
      var month = Number(monthSelect.value);
      fetchMonthSchedules(month).then(function (schedules) {
        monthSchedules = schedules;
        renderCalendar(monthSchedules, month);
      }).catch(showError);
    });
    renderCalendar(monthSchedules, today.getMonth());
    renderLog();
  }

  roleFilter.addEventListener('change', renderLog);
  load().catch(showError);
});
