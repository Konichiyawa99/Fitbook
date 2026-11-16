document.addEventListener('DOMContentLoaded', function () {
  var monthSelect = document.getElementById('sched-month');
  var grid = document.getElementById('sched-grid');
  var aside = document.getElementById('sched-aside');
  var year = new Date().getFullYear();
  var today = new Date();
  var classId = new URLSearchParams(window.location.search).get('classId');
  var schedules = [];
  var bookings = [];
  var classesById = {};
  var selectedDate = '';

  function showError(error) {
    console.error('Unable to load booking schedule:', error);
    aside.textContent = 'Schedule could not be loaded: ' + error.message;
  }

  function dateKey(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function renderCalendar(month) {
    grid.querySelectorAll('.big-calendar__cell').forEach(function (cell) { cell.remove(); });
    var first = new Date(year, month, 1).getDay();
    var total = new Date(year, month + 1, 0).getDate();
    var scheduledDays = new Set(schedules.map(function (row) { return Number(row.scheduledate.slice(8, 10)); }));

    function addCell(day) {
      var cell = document.createElement(day ? 'button' : 'span');
      cell.className = 'big-calendar__cell' + (day ? '' : ' big-calendar__cell--blank');
      if (day) {
        cell.type = 'button';
        cell.textContent = day;
        if (scheduledDays.has(day) && schedules.some(function (row) {
          return Number(row.scheduledate.slice(0, 4)) === year &&
            Number(row.scheduledate.slice(5, 7)) === month + 1 && Number(row.scheduledate.slice(8, 10)) === day;
        })) cell.classList.add('has-booking');
        cell.addEventListener('click', function () {
          selectedDate = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
          renderCalendar(month);
          renderSessions();
        });
        if (selectedDate === year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0')) {
          cell.classList.add('is-selected');
        }
      }
      grid.appendChild(cell);
    }

    for (var i = 0; i < first; i++) addCell(null);
    for (var day = 1; day <= total; day++) addCell(day);
    var trailing = (7 - ((first + total) % 7)) % 7;
    for (var blank = 0; blank < trailing; blank++) addCell(null);
  }

  function renderSessions() {
    aside.textContent = '';
    var heading = document.createElement('h2');
    heading.className = 'schedule-card__title';
    heading.textContent = selectedDate ? new Date(selectedDate + 'T00:00:00').toLocaleDateString() : 'Select a date';
    aside.appendChild(heading);
    if (!selectedDate) return;

    var daySchedules = schedules.filter(function (row) { return row.scheduledate === selectedDate; });
    if (!daySchedules.length) {
      aside.appendChild(document.createTextNode('No classes scheduled for this date.'));
      return;
    }

    daySchedules.forEach(function (schedule) {
      var card = document.createElement('section');
      card.className = 'card';
      var cls = classesById[schedule.classesid] || {};
      var count = bookings.filter(function (row) {
        return row.scheduleid === schedule.scheduleid && !/cancel/i.test(row.status || '');
      }).length;
      var capacity = Number(cls.capacity || 0);
      var title = document.createElement('h3');
      title.textContent = [schedule.time, cls.classesname || 'Class'].join(' · ');
      card.appendChild(title);
      var detail = document.createElement('p');
      detail.textContent = (cls.difficulties || '') +
        (capacity ? ' · ' + count + '/' + capacity + ' booked' : '');
      card.appendChild(detail);

      var existing = bookings.some(function (row) {
        return row.scheduleid === schedule.scheduleid && row.memberid === currentMemberId &&
          !/cancel/i.test(row.status || '');
      });
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn btn-navy';
      button.textContent = existing ? 'Already booked' : 'Book this class';
      button.disabled = existing || (capacity > 0 && count >= capacity) || new Date(selectedDate + 'T' + schedule.time) < today;
      button.addEventListener('click', function () { reserve(schedule, button); });
      card.appendChild(button);
      aside.appendChild(card);
    });
  }

  var currentMemberId;
  async function reserve(schedule, button) {
    button.disabled = true;
    try {
      window.GTGData.throwIfError(await window.supabaseClient.from('tbl_booking').insert({
        memberid: currentMemberId,
        scheduleid: schedule.scheduleid,
        status: 'Booked'
      }));
      bookings.push({
        scheduleid: schedule.scheduleid,
        memberid: currentMemberId,
        status: 'Booked'
      });
      renderSessions();
    } catch (error) {
      console.error('Unable to reserve class:', error);
      button.disabled = false;
      window.alert('Unable to reserve this class: ' + error.message);
    }
  }

  async function load() {
    var account = await window.GTGData.getAccount();
    if (!account || !account.member) throw new Error('This account is not linked to a member profile.');
    currentMemberId = account.member.memberid;

    var selectedClassId = classId ? Number(classId) : null;
    var classQuery = window.supabaseClient.from('tbl_classes')
      .select('classesid, classesname, difficulties, capacity');
    if (selectedClassId) classQuery = classQuery.eq('classesid', selectedClassId);
    var classes = window.GTGData.throwIfError(await classQuery) || [];
    classes.forEach(function (row) { classesById[row.classesid] = row; });
    if (!classes.length) throw new Error('The selected class was not found.');

    var classIds = classes.map(function (row) { return row.classesid; });
    schedules = window.GTGData.throwIfError(await window.supabaseClient.from('tbl_schedule')
      .select('scheduleid, classesid, trainerid, scheduledate, time, slotsfilled')
      .in('classesid', classIds)
      .gte('scheduledate', dateKey(today))
      .order('scheduledate', { ascending: true })
      .order('time', { ascending: true })) || [];
    var scheduleIds = schedules.map(function (row) { return row.scheduleid; });
    bookings = scheduleIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_booking')
        .select('bookingid, memberid, scheduleid, status')
        .in('scheduleid', scheduleIds))
      : [];

    monthSelect.replaceChildren();
    for (var month = today.getMonth(); month < 12; month++) {
      monthSelect.add(new Option(new Date(year, month, 1).toLocaleString([], { month: 'long' }), month));
    }
    monthSelect.value = String(today.getMonth());
    monthSelect.addEventListener('change', function () {
      selectedDate = '';
      renderCalendar(Number(monthSelect.value));
      renderSessions();
    });
    renderCalendar(today.getMonth());
    renderSessions();
  }

  load().catch(showError);
});
