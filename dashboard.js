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
    window.memberAttendanceDates = new Set();

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
      dashCalendar.querySelectorAll('button.big-calendar__cell').forEach(cell => {
        const day = Number(cell.textContent);
        const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        if (window.memberAttendanceDates.has(dateKey)) cell.classList.add('has-booking');
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
  }

  loadMemberDashboard().catch(function (error) {
    console.error('Unable to load member dashboard:', error);
    var status = document.getElementById('member-dashboard-error');
    if (status) {
      status.hidden = false;
      status.textContent = 'Dashboard data could not be loaded: ' + error.message;
    }
  });

});

async function loadMemberDashboard() {
  var account = await window.GTGData.getAccount();
  if (!account || !account.member) throw new Error('This account is not linked to a member profile.');

  var member = account.member;
  var greeting = document.querySelector('[data-profile-first-name]');
  var name = window.GTGData.accountName(account);
  if (greeting) greeting.textContent = name.split(' ')[0] || 'Member';
  var meta = document.getElementById('member-profile-meta');
  if (meta) meta.textContent = member.age ? member.age + ' years old' : '';
  var gender = document.getElementById('member-gender');
  if (gender) gender.textContent = member.sex || '—';

  var today = new Date();
  var dayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  var dayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
  var dayKey = dayStart.getFullYear() + '-' + String(dayStart.getMonth() + 1).padStart(2, '0') + '-' +
    String(dayStart.getDate()).padStart(2, '0');
  var bookings = window.GTGData.throwIfError(await window.supabaseClient
    .from('tbl_booking')
    .select('bookingid, scheduleid, status')
    .eq('memberid', member.memberid)) || [];
  var scheduleIds = Array.from(new Set(bookings
    .filter(function (row) { return !/cancel/i.test(row.status || ''); })
    .map(function (row) { return row.scheduleid; })
    .filter(Boolean)));
  var schedules = scheduleIds.length
    ? window.GTGData.throwIfError(await window.supabaseClient
      .from('tbl_schedule')
      .select('scheduleid, classesid, trainerid, scheduledate, time')
      .in('scheduleid', scheduleIds)
      .gte('scheduledate', dayKey)
      .order('scheduledate', { ascending: true })
      .order('time', { ascending: true }))
    : [];
  var classIds = Array.from(new Set(schedules.map(function (row) { return row.classesid; }).filter(Boolean)));
  var classes = classIds.length
    ? window.GTGData.throwIfError(await window.supabaseClient
      .from('tbl_classes')
      .select('classesid, classesname')
      .in('classesid', classIds))
    : [];
  var classesById = {};
  classes.forEach(function (row) { classesById[row.classesid] = row; });

  var upcoming = schedules.filter(function (row) {
    var dateTime = new Date(row.scheduledate + 'T' + row.time);
    return dateTime >= today;
  })[0];
  if (upcoming) {
    var className = classesById[upcoming.classesid] ? classesById[upcoming.classesid].classesname : 'Scheduled class';
    document.getElementById('upcoming-class').textContent = className;
    document.getElementById('upcoming-time').textContent =
      new Date(upcoming.scheduledate + 'T' + upcoming.time).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    document.getElementById('member-ongoing-class').textContent =
      upcoming.scheduledate === dayKey ? className : 'No class scheduled';
  } else {
    document.getElementById('upcoming-class').textContent = 'No upcoming classes';
    document.getElementById('member-ongoing-class').textContent = 'No class scheduled';
  }

  var classNames = Array.from(new Set(schedules.map(function (row) {
    var cls = classesById[row.classesid];
    return cls ? cls.classesname : '';
  }).filter(Boolean)));
  document.getElementById('enrolled-count').textContent = classNames.length;

  var attendanceStart = new Date(today.getFullYear(), 0, 1);
  var attendanceEnd = new Date(today.getFullYear() + 1, 0, 1);
  var attendanceQuery = window.supabaseClient.from('tbl_memberattendance')
    .select('timein')
    .eq('memberid', member.memberid)
    .gte('timein', attendanceStart.toISOString())
    .lt('timein', attendanceEnd.toISOString());
  var attendance = window.GTGData.throwIfError(await attendanceQuery);
  window.memberAttendanceDates = new Set((attendance || []).filter(function (row) {
    return row.timein;
  }).map(function (row) {
    var date = new Date(row.timein);
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }));
  var calendar = document.getElementById('dash-big-calendar');
  var monthSelect = document.getElementById('dash-month-select');
  if (calendar && monthSelect) monthSelect.dispatchEvent(new Event('change'));
}