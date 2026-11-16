document.addEventListener('DOMContentLoaded', function () {
  var roleFilter = document.getElementById('role-filter');
  var classFilter = document.getElementById('class-filter');
  var tableBody = document.querySelector('#checkin-table tbody');
  var emptyState = document.getElementById('checkin-empty');
  var status = document.getElementById('dashboard-error');
  var attendanceRows = [];

  function localDayBounds() {
    var now = new Date();
    var start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    var end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    return { start: start, end: end };
  }

  function localDate(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' +
      String(date.getDate()).padStart(2, '0');
  }

  function displayTime(value) {
    if (!value) return '—';
    return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function renderRows() {
    var role = roleFilter.value;
    var cls = classFilter.value;
    var visibleCount = 0;
    tableBody.querySelectorAll('tr').forEach(function (row) {
      var matches = (role === 'all' || row.dataset.role === role) &&
        (cls === 'all' || row.dataset.class === cls);
      row.classList.toggle('is-hidden', !matches);
      if (matches) visibleCount++;
    });
    emptyState.hidden = visibleCount > 0;
  }

  async function loadDashboard() {
    var bounds = localDayBounds();
    var account = await window.GTGData.getAccount();
    if (!account || !account.user || !account.admin) {
      throw new Error('This account is not linked to an admin profile.');
    }

    var profileName = window.GTGData.accountName(account);
    var greetingName = profileName.split(' ')[0] || 'Admin';
    document.querySelector('[data-profile-first-name]').textContent = greetingName;
    var profileInfo = account.employee
      ? [account.employee.age ? account.employee.age + ' years old' : '', account.employee.sex || ''].filter(Boolean).join(' · ')
      : '';
    setText('admin-profile-meta', profileInfo);

    var results = await Promise.all([
      window.supabaseClient.from('tbl_memberattendance')
        .select('memberattendanceid, memberid, scheduleid, timein, timeout')
        .gte('timein', bounds.start.toISOString())
        .lt('timein', bounds.end.toISOString())
        .order('timein', { ascending: false }),
      window.supabaseClient.from('tbl_payment')
        .select('amountpaid, paymentstatus, paymentdate')
        .gte('paymentdate', bounds.start.toISOString())
        .lt('paymentdate', bounds.end.toISOString())
    ]);
    var attendance = window.GTGData.throwIfError(results[0]) || [];
    var payments = window.GTGData.throwIfError(results[1]) || [];

    var memberIds = Array.from(new Set(attendance.map(function (row) { return row.memberid; }).filter(Boolean)));
    var scheduleIds = Array.from(new Set(attendance.map(function (row) { return row.scheduleid; }).filter(Boolean)));
    var members = memberIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_member')
        .select('memberid, firstname, lastname').in('memberid', memberIds))
      : [];
    var schedules = scheduleIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_schedule')
        .select('scheduleid, classesid, time').in('scheduleid', scheduleIds))
      : [];
    var classIds = Array.from(new Set(schedules.map(function (row) { return row.classesid; }).filter(Boolean)));
    var classes = classIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_classes')
        .select('classesid, classesname').in('classesid', classIds))
      : [];
    var membersById = {};
    var schedulesById = {};
    var classesById = {};
    members.forEach(function (row) { membersById[row.memberid] = row; });
    schedules.forEach(function (row) { schedulesById[row.scheduleid] = row; });
    classes.forEach(function (row) { classesById[row.classesid] = row; });

    attendanceRows = attendance.map(function (row, index) {
      var member = membersById[row.memberid] || {};
      var schedule = schedulesById[row.scheduleid] || {};
      var cls = classesById[schedule.classesid] || {};
      return {
        number: attendance.length - index,
        firstName: member.firstname || '',
        lastName: member.lastname || '',
        timeIn: row.timein,
        timeOut: row.timeout,
        className: cls.classesname || ''
      };
    });

    tableBody.textContent = '';
    classFilter.replaceChildren(new Option('All Classes', 'all'));
    var classNames = Array.from(new Set(attendanceRows.map(function (row) { return row.className; }).filter(Boolean)));
    classNames.forEach(function (name) {
      classFilter.add(new Option(name, name.toLowerCase()));
    });
    attendanceRows.forEach(function (row) {
      var tr = document.createElement('tr');
      tr.dataset.role = 'member';
      tr.dataset.class = row.className.toLowerCase();
      [row.number, row.firstName, row.lastName, displayTime(row.timeIn), displayTime(row.timeOut), 'Member']
        .forEach(function (value) {
          var td = document.createElement('td');
          td.textContent = value;
          tr.appendChild(td);
        });
      tableBody.appendChild(tr);
    });

    setText('attendees-today', attendance.length);
    var revenue = payments.filter(function (row) {
      return ['paid', 'completed'].indexOf(String(row.paymentstatus || '').toLowerCase()) !== -1;
    }).reduce(function (sum, row) { return sum + Number(row.amountpaid || 0); }, 0);
    setText('revenue-today', '₱ ' + revenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

    var today = localDate(bounds.start);
    var todaySchedules = window.GTGData.throwIfError(await window.supabaseClient.from('tbl_schedule')
      .select('scheduleid, classesid, time')
      .eq('scheduledate', today)
      .order('time', { ascending: true })) || [];
    var allClassIds = Array.from(new Set(todaySchedules.map(function (row) { return row.classesid; }).filter(Boolean)));
    var todayClasses = allClassIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_classes')
        .select('classesid, classesname').in('classesid', allClassIds))
      : [];
    var todayClassesById = {};
    todayClasses.forEach(function (row) { todayClassesById[row.classesid] = row; });
    var nowTime = new Date();
    var currentMinutes = nowTime.getHours() * 60 + nowTime.getMinutes();
    var nextSchedule = todaySchedules.filter(function (row) {
      var parts = String(row.time || '').split(':');
      return parts.length >= 2 && Number(parts[0]) * 60 + Number(parts[1]) >= currentMinutes;
    })[0];
    if (!nextSchedule) {
      setText('today-class', 'No upcoming class');
      setText('class-attendees', '0');
    } else {
      var nextClass = todayClassesById[nextSchedule.classesid];
      setText('today-class', nextClass ? nextClass.classesname : 'Scheduled class');
      var attendanceCount = await window.supabaseClient
        .from('tbl_memberattendance')
        .select('memberattendanceid', { count: 'exact', head: true })
        .eq('scheduleid', nextSchedule.scheduleid);
      if (attendanceCount.error) throw attendanceCount.error;
      setText('class-attendees', attendanceCount.count || 0);
    }

    renderRows();
  }

  roleFilter.addEventListener('change', renderRows);
  classFilter.addEventListener('change', renderRows);

  loadDashboard().catch(function (error) {
    console.error('Unable to load admin dashboard:', error);
    status.hidden = false;
    status.textContent = 'Dashboard data could not be loaded: ' + error.message;
  });
});
