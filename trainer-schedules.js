document.addEventListener('DOMContentLoaded', function () {
  var monthSelect = document.getElementById('month-select');
  var yearLabel = document.getElementById('calendar-year');
  var calendar = document.getElementById('big-calendar');
  var title = document.getElementById('schedule-title');
  var body = document.getElementById('schedule-body') || document.getElementById('session-list');
  var count = document.getElementById('schedule-count');
  var year = new Date().getFullYear();
  var today = new Date();
  var schedules = [];
  var classesById = {};
  var bookingsBySchedule = {};
  var selectedCell = null;
  var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function localDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function message(text) {
    body.textContent = text;
  }

  function renderDay(month, day) {
    var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var rows = schedules.filter(function (row) { return row.scheduledate === key; });
    title.textContent = key === localDate(today) ? "Today's Schedule" : months[month] + ' ' + day + ' Schedule';
    if (count) count.textContent = rows.length + ' class' + (rows.length === 1 ? '' : 'es');
    body.textContent = '';
    if (!rows.length) {
      message('No classes scheduled for this day.');
      return;
    }

    rows.forEach(function (row) {
      var cls = classesById[row.classesid] || {};
      var capacity = Number(cls.capacity || 0);
      var filled = bookingsBySchedule[row.scheduleid] || Number(row.slotsfilled || 0);
      var card = document.createElement('article');
      card.className = count ? 'session-card' : 'schedule-item';
      var heading = document.createElement('h3');
      heading.className = count ? 'session-card__title' : 'schedule-item__title';
      heading.textContent = [row.time, cls.classesname || 'Class'].join(' – ');
      card.appendChild(heading);
      if (cls.difficulties) {
        var difficulty = document.createElement('p');
        difficulty.className = count ? 'session-card__meta' : 'schedule-item__meta';
        difficulty.textContent = 'Difficulty: ' + cls.difficulties;
        card.appendChild(difficulty);
      }
      var detail = document.createElement('p');
      detail.className = count ? 'session-card__meta' : 'schedule-item__meta';
      detail.textContent = capacity ? filled + '/' + capacity + ' slots filled' : filled + ' slots filled';
      card.appendChild(detail);
      body.appendChild(card);
    });
  }

  function renderCalendar(month) {
    calendar.querySelectorAll('.big-calendar__cell').forEach(function (cell) { cell.remove(); });
    var first = new Date(year, month, 1).getDay();
    var total = new Date(year, month + 1, 0).getDate();
    var scheduledDays = new Set(schedules
      .filter(function (row) { return Number(row.scheduledate.slice(5, 7)) === month + 1; })
      .map(function (row) { return Number(row.scheduledate.slice(8, 10)); }));
    selectedCell = null;

    function addCell(day) {
      var cell = document.createElement(day ? 'button' : 'span');
      cell.className = 'big-calendar__cell' + (day ? '' : ' big-calendar__cell--blank');
      if (day) {
        cell.type = 'button';
        cell.textContent = day;
        if (scheduledDays.has(day)) cell.classList.add('has-booking');
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
          cell.classList.add('is-today');
          selectDate(cell, month, day);
        } else {
          cell.addEventListener('click', function () { selectDate(cell, month, day); });
        }
      }
      calendar.appendChild(cell);
    }

    for (var blank = 0; blank < first; blank++) addCell(null);
    for (var day = 1; day <= total; day++) addCell(day);
    var trailing = (7 - ((first + total) % 7)) % 7;
    for (var pad = 0; pad < trailing; pad++) addCell(null);
    if (month !== today.getMonth()) message('Select a date to see your classes.');
  }

  function selectDate(cell, month, day) {
    if (selectedCell) selectedCell.classList.remove('is-selected');
    selectedCell = cell;
    cell.classList.add('is-selected');
    renderDay(month, day);
  }

  async function loadMonth(month) {
    var start = new Date(year, month, 1);
    var end = new Date(year, month + 1, 1);
    schedules = window.GTGData.throwIfError(await window.supabaseClient.from('tbl_schedule')
      .select('scheduleid, classesid, scheduledate, time, slotsfilled')
      .eq('trainerid', currentTrainerId)
      .gte('scheduledate', localDate(start))
      .lt('scheduledate', localDate(end))
      .order('scheduledate', { ascending: true })
      .order('time', { ascending: true })) || [];

    var classIds = Array.from(new Set(schedules.map(function (row) { return row.classesid; }).filter(Boolean)));
    var classes = classIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_classes')
        .select('classesid, classesname, difficulties, capacity').in('classesid', classIds))
      : [];
    classesById = {};
    classes.forEach(function (row) { classesById[row.classesid] = row; });

    var scheduleIds = schedules.map(function (row) { return row.scheduleid; });
    var bookings = scheduleIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_booking')
        .select('scheduleid, status').in('scheduleid', scheduleIds))
      : [];
    bookingsBySchedule = {};
    bookings.forEach(function (row) {
      if (!/cancel/i.test(row.status || '')) {
        bookingsBySchedule[row.scheduleid] = (bookingsBySchedule[row.scheduleid] || 0) + 1;
      }
    });
    renderCalendar(month);
  }

  var currentTrainerId;
  async function load() {
    var account = await window.GTGData.getAccount();
    if (!account || !account.trainer) throw new Error('This account is not linked to a trainer profile.');
    currentTrainerId = account.trainer.trainerid;
    monthSelect.replaceChildren();
    months.forEach(function (month, index) { monthSelect.add(new Option(month, index)); });
    monthSelect.value = String(today.getMonth());
    yearLabel.textContent = year;
    monthSelect.addEventListener('change', function () {
      loadMonth(Number(monthSelect.value)).catch(function (error) {
        console.error('Unable to load trainer schedule:', error);
        message('Schedule could not be loaded: ' + error.message);
      });
    });
    await loadMonth(today.getMonth());
  }

  load().catch(function (error) {
    console.error('Unable to load trainer schedule:', error);
    message('Schedule could not be loaded: ' + error.message);
  });
});
