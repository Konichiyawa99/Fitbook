document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Settings menu: close when clicking outside ---------- */
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });

  /* ---------- Attended Classes calendar ---------- */
  const dashMonthSelect = document.getElementById('dash-month-select');
  const dashYearLabel   = document.getElementById('dash-calendar-year');
  const dashCalendar    = document.getElementById('dash-big-calendar');

  if (dashMonthSelect && dashYearLabel && dashCalendar) {
    const dashMonthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dashToday = new Date();
    const dashCurrentYear = dashToday.getFullYear(); // year is always the real current year

    let dashSelectedCell = null; // tracks the currently highlighted day button

    function dashPopulateMonthSelect(selectedMonth) {
      dashMonthSelect.innerHTML = dashMonthNames
        .map((name, i) => `<option value="${i}"${i === selectedMonth ? ' selected' : ''}>${name}</option>`)
        .join('');
    }

    function dashAddCell(day) {
      const cell = document.createElement(day ? 'button' : 'span');
      cell.className = 'big-calendar__cell' + (day ? '' : ' big-calendar__cell--blank');
      if (day) {
        cell.type = 'button';
        cell.textContent = day;
        cell.addEventListener('click', () => dashSelectDate(cell));
      }
      dashCalendar.appendChild(cell);
    }

    function dashRenderCalendar(year, month) {
      dashCalendar.querySelectorAll('.big-calendar__cell').forEach(cell => cell.remove());
      dashCalendar.setAttribute('aria-label', `${dashMonthNames[month]} ${year}`);
      dashSelectedCell = null;

      const firstWeekday = new Date(year, month, 1).getDay();       // 0=Sun ... 6=Sat
      const totalDays     = new Date(year, month + 1, 0).getDate(); // handles 28/29/30/31 automatically

      for (let i = 0; i < firstWeekday; i++) dashAddCell(null);
      for (let day = 1; day <= totalDays; day++) dashAddCell(day);

      // pad the last row out to a full 7 columns
      const trailingBlanks = (7 - ((firstWeekday + totalDays) % 7)) % 7;
      for (let i = 0; i < trailingBlanks; i++) dashAddCell(null);

      const attended = window.GTG_ATTENDANCE_DATES || [];
      dashCalendar.querySelectorAll('.big-calendar__cell').forEach(function (cell) {
        if (!cell.textContent) return;
        const dateKey = year + '-' +
          String(month + 1).padStart(2, '0') + '-' +
          String(Number(cell.textContent)).padStart(2, '0');
        if (attended.indexOf(dateKey) !== -1) cell.classList.add('is-attended');
      });
    }

    function dashSelectDate(cell) {
      if (dashSelectedCell) dashSelectedCell.classList.remove('is-selected');
      cell.classList.add('is-selected');
      dashSelectedCell = cell;
    }

    dashMonthSelect.addEventListener('change', () => {
      dashRenderCalendar(dashCurrentYear, parseInt(dashMonthSelect.value, 10));
    });

    // Initial setup — defaults to today's real month/year
    dashYearLabel.textContent = dashCurrentYear;
    dashPopulateMonthSelect(dashToday.getMonth());
    dashRenderCalendar(dashCurrentYear, dashToday.getMonth());

    dashCalendar.addEventListener('gtg-attendance-loaded', function () {
      var attended = window.GTG_ATTENDANCE_DATES || [];
      dashCalendar.querySelectorAll('.big-calendar__cell').forEach(function (cell) {
        if (!cell.textContent) return;
        var month = dashMonthSelect.value;
        var dateKey = dashCurrentYear + '-' +
          String(Number(month) + 1).padStart(2, '0') + '-' +
          String(Number(cell.textContent)).padStart(2, '0');
        if (attended.indexOf(dateKey) !== -1) cell.classList.add('is-attended');
      });
    });
  }

});