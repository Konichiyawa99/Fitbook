(function () {
  'use strict';

  var select = document.getElementById('subscribed-classes');
  var list = document.getElementById('payment-list');
  var count = document.getElementById('payment-count');
  var label = document.getElementById('payment-class');
  var summary = document.getElementById('payment-summary');
  if (!list) return;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function peso(amount) {
    return '₱' + Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  function render(items) {
    var selected = select ? select.value : '';
    var visible = items.filter(function (payment) {
      return !selected || payment.groupLabel === selected;
    });

    list.textContent = '';
    if (label) label.textContent = selected || 'All payments';
    if (count) count.textContent = visible.length;
    if (!visible.length) {
      if (summary) summary.textContent = '';
      list.appendChild(el('li', 'payment-empty', 'No payments found.'));
      return;
    }

    visible.forEach(function (payment) {
      var li = el('li', 'payment-item');
      var info = el('div', 'payment-item__info');
      info.appendChild(el('p', 'payment-item__class', payment.groupLabel));
      var details = [payment.date, payment.method, payment.reference].filter(Boolean).join(' · ');
      info.appendChild(el('p', 'payment-item__meta', details));

      var side = el('div', 'payment-item__side');
      side.appendChild(el('p', 'payment-item__amount', peso(payment.amount)));
      var normalized = String(payment.status || 'Unknown').toLowerCase();
      var statusClass = ['paid', 'pending', 'failed'].indexOf(normalized) !== -1 ? normalized : 'pending';
      side.appendChild(el('span', 'status-pill status-pill--' + statusClass, payment.status || 'Unknown'));
      li.appendChild(info);
      li.appendChild(side);
      list.appendChild(li);
    });
    if (summary) summary.textContent = visible.length + (visible.length === 1 ? ' payment' : ' payments');
  }

  async function load() {
    var account = await window.GTGData.getAccount();
    if (!account || !account.member) throw new Error('This account is not linked to a member profile.');

    var payments = window.GTGData.throwIfError(await window.supabaseClient
      .from('tbl_payment')
      .select('paymentid, bookingid, subscriptionplanid, paymentstatus, paymentmethod, referenceno, amountpaid, paymentdate')
      .eq('memberid', account.member.memberid)
      .order('paymentdate', { ascending: false })) || [];

    var planIds = Array.from(new Set(payments.map(function (row) { return row.subscriptionplanid; }).filter(Boolean)));
    var bookingIds = Array.from(new Set(payments.map(function (row) { return row.bookingid; }).filter(Boolean)));
    var plans = planIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient
        .from('tbl_subscriptionplan')
        .select('subscriptionplanid, planname')
        .in('subscriptionplanid', planIds))
      : [];
    var bookings = bookingIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient
        .from('tbl_booking')
        .select('bookingid, scheduleid')
        .in('bookingid', bookingIds))
      : [];
    var scheduleIds = Array.from(new Set(bookings.map(function (row) { return row.scheduleid; }).filter(Boolean)));
    var schedules = scheduleIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient
        .from('tbl_schedule')
        .select('scheduleid, classesid')
        .in('scheduleid', scheduleIds))
      : [];
    var classIds = Array.from(new Set(schedules.map(function (row) { return row.classesid; }).filter(Boolean)));
    var classes = classIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient
        .from('tbl_classes')
        .select('classesid, classesname')
        .in('classesid', classIds))
      : [];

    var plansById = {};
    var bookingsById = {};
    var schedulesById = {};
    var classesById = {};
    plans.forEach(function (row) { plansById[row.subscriptionplanid] = row; });
    bookings.forEach(function (row) { bookingsById[row.bookingid] = row; });
    schedules.forEach(function (row) { schedulesById[row.scheduleid] = row; });
    classes.forEach(function (row) { classesById[row.classesid] = row; });

    var normalized = payments.map(function (row) {
      var booking = bookingsById[row.bookingid];
      var schedule = booking && schedulesById[booking.scheduleid];
      var cls = schedule && classesById[schedule.classesid];
      var plan = plansById[row.subscriptionplanid];
      var groupLabel = cls ? cls.classesname : (plan ? plan.planname : 'Payment');
      return {
        groupLabel: groupLabel,
        amount: row.amountpaid,
        date: row.paymentdate ? new Date(row.paymentdate).toLocaleDateString() : '',
        method: row.paymentmethod,
        reference: row.referenceno ? 'Ref ' + row.referenceno : '',
        status: row.paymentstatus
      };
    });

    if (select) {
      var current = select.value;
      select.replaceChildren(new Option('All classes', ''));
      Array.from(new Set(normalized.map(function (item) { return item.groupLabel; }))).forEach(function (value) {
        select.add(new Option(value, value));
      });
      if (normalized.some(function (item) { return item.groupLabel === current; })) select.value = current;
    }
    render(normalized);
    if (select) select.addEventListener('change', function () { render(normalized); });
  }

  load().catch(function (error) {
    console.error('Unable to load payment history:', error);
    list.textContent = '';
    list.appendChild(el('li', 'payment-empty', 'Payment history could not be loaded: ' + error.message));
  });
})();
