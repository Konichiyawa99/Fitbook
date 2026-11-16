document.addEventListener('DOMContentLoaded', function () {
  var monthSelect = document.getElementById('month-select');
  var yearLabel = document.getElementById('calendar-year');
  var calendar = document.querySelector('.big-calendar');
  var title = document.getElementById('schedule-title');
  var body = document.querySelector('.schedule-card__body');
  var today = new Date();
  var year = today.getFullYear();
  var schedules = [];
  var classesById = {};
  var selectedCell = null;
  var monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  function localDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function renderDay(month, day) {
    var key = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
    var rows = schedules.filter(function (row) { return row.scheduledate === key; });
    title.textContent = key === localDate(today) ? "Today's Schedule" : monthNames[month] + ' ' + day + ' Schedule';
    body.textContent = '';
    if (!rows.length) {
      body.textContent = 'No classes scheduled for this day.';
      return;
    }

    rows.forEach(function (row) {
      var cls = classesById[row.classesid] || {};
      var card = document.createElement('article');
      card.className = 'schedule-item';
      var heading = document.createElement('h3');
      heading.className = 'schedule-item__title';
      heading.textContent = [row.time, cls.classesname || 'Class'].join(' – ');
      card.appendChild(heading);
      var details = document.createElement('p');
      details.className = 'schedule-item__meta';
      var capacity = Number(cls.capacity || 0);
      var filled = Number(row.slotsfilled || 0);
      details.textContent = [cls.difficulties, capacity ? filled + '/' + capacity + ' slots filled' : ''].filter(Boolean).join(' · ');
      card.appendChild(details);
      var book = document.createElement('a');
      book.className = 'btn btn-navy';
      book.href = 'booking.html?classId=' + encodeURIComponent(row.classesid);
      book.textContent = 'Book this class';
      card.appendChild(book);
      body.appendChild(card);
    });
  }

  async function loadMonth(month) {
    var start = new Date(year, month, 1);
    var end = new Date(year, month + 1, 1);
    schedules = window.GTGData.throwIfError(await window.supabaseClient.from('tbl_schedule')
      .select('scheduleid, classesid, scheduledate, time, slotsfilled')
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
    renderCalendar(month);
  }

  function renderCalendar(month) {
    calendar.querySelectorAll('.big-calendar__cell').forEach(function (cell) { cell.remove(); });
    var first = new Date(year, month, 1).getDay();
    var total = new Date(year, month + 1, 0).getDate();
    var scheduledDays = new Set(schedules.map(function (row) { return Number(row.scheduledate.slice(8, 10)); }));
    selectedCell = null;

    function addCell(day) {
      var cell = document.createElement(day ? 'button' : 'span');
      cell.className = 'big-calendar__cell' + (day ? '' : ' big-calendar__cell--blank');
      if (day) {
        cell.type = 'button';
        cell.textContent = day;
        if (scheduledDays.has(day)) cell.classList.add('has-booking');
        if (year === today.getFullYear() && month === today.getMonth() && day === today.getDate()) {
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
    if (month !== today.getMonth()) body.textContent = 'Select a date to see available classes.';
  }

  function selectDate(cell, month, day) {
    if (selectedCell) selectedCell.classList.remove('is-selected');
    selectedCell = cell;
    cell.classList.add('is-selected');
    renderDay(month, day);
  }

  function showError(error) {
    console.error('Unable to load class calendar:', error);
    body.textContent = 'Class schedule could not be loaded: ' + error.message;
  }

  monthNames.forEach(function (month, index) { monthSelect.add(new Option(month, index)); });
  monthSelect.value = String(today.getMonth());
  yearLabel.textContent = year;
  monthSelect.addEventListener('change', function () {
    loadMonth(Number(monthSelect.value)).catch(showError);
  });
  loadMonth(today.getMonth()).catch(showError);
});
