/* Loads payment history for the selected Supabase-enrolled class. */
(function () {
  'use strict';

  var select = document.getElementById('subscribed-classes');
  var list = document.getElementById('payment-list');
  var count = document.getElementById('payment-count');
  var label = document.getElementById('payment-class');
  var summary = document.getElementById('payment-summary');
  if (!select || !list) return;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function peso(n) {
    return '\u20B1' + Number(n || 0).toLocaleString('en-PH');
  }

  function formatDate(value) {
    if (!value) return 'Date not set';
    var date = new Date(value);
    return isNaN(date.getTime())
      ? value
      : date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function loadPayments(className) {
    var context = window.GTG_MEMBER_CONTEXT;
    var supabase = window.GTG_SUPABASE;
    if (!context || !supabase) return [];

    var paymentResult = await supabase
      .from('tbl_payment')
      .select('*')
      .eq('memberid', context.memberId)
      .order('paymentdate', { ascending: false });
    if (paymentResult.error) throw paymentResult.error;

    var payments = paymentResult.data || [];
    if (!payments.length) return [];

    var bookingIds = Array.from(new Set(payments
      .map(function (payment) { return payment.bookingid; })
      .filter(function (id) { return id != null; })));
    var classByBooking = {};

    if (bookingIds.length) {
      var bookingResult = await supabase
        .from('tbl_booking')
        .select('bookingid, scheduleid')
        .in('bookingid', bookingIds);
      if (!bookingResult.error) {
        var bookings = bookingResult.data || [];
        var scheduleIds = Array.from(new Set(bookings.map(function (booking) { return booking.scheduleid; })));
        var scheduleById = {};
        var classById = {};

        if (scheduleIds.length) {
          var scheduleResult = await supabase
            .from('tbl_schedule')
            .select('scheduleid, classesid')
            .in('scheduleid', scheduleIds);
          if (!scheduleResult.error) {
            (scheduleResult.data || []).forEach(function (schedule) {
              scheduleById[schedule.scheduleid] = schedule.classesid;
            });
          }

          var classIds = Array.from(new Set(Object.values(scheduleById)));
          if (classIds.length) {
            var classResult = await supabase
              .from('tbl_classes')
              .select('classesid, classesname')
              .in('classesid', classIds);
            if (!classResult.error) {
              (classResult.data || []).forEach(function (item) {
                classById[item.classesid] = item.classesname;
              });
            }
          }
        }

        bookings.forEach(function (booking) {
          classByBooking[booking.bookingid] = classById[scheduleById[booking.scheduleid]] || '';
        });
      }
    }

    return payments.filter(function (payment) {
      if (!className || className === 'No enrolled classes') return false;
      return classByBooking[payment.bookingid] === className;
    });
  }

  function buildItem(payment) {
    var status = (payment.paymentstatus || 'pending').toLower();
    var li = el('li', 'payment-item');
    var info = el('div', 'payment-item__info');
    info.appendChild(el('p', 'payment-item__class', payment.paymentmethod || 'Payment'));
    info.appendChild(el('p', 'payment-item__meta',
      formatDate(payment.paymentdate) + ' · GCash Ref ' + (payment.referenceno || 'Not available')));

    var side = el('div', 'payment-item__side');
    side.appendChild(el('p', 'payment-item__amount', peso(payment.amountpaid)));
    side.appendChild(el('span', 'status-pill status-pill--' + status,
      status.charAt(0).toUpperCase() + status.slice(1)));

    li.appendChild(info);
    li.appendChild(side);
    return li;
  }

  async function render() {
    var cls = select.value;
    list.textContent = '';
    label.textContent = cls;

    if (!cls || cls === 'No enrolled classes') {
      count.textContent = '0';
      summary.textContent = '';
      list.appendChild(el('li', 'payment-empty', 'No enrolled classes yet.'));
      return;
    }

    try {
      var items = await loadPayments(cls);
      count.textContent = items.length;
      if (!items.length) {
        summary.textContent = '';
        list.appendChild(el('li', 'payment-empty', 'No payments yet for this class.'));
        return;
      }

      summary.textContent = items.length + ' payment record' + (items.length === 1 ? '' : 's');
      items.forEach(function (payment) { list.appendChild(buildItem(payment)); });
    } catch (error) {
      console.error(error);
      count.textContent = '0';
      summary.textContent = '';
      list.appendChild(el('li', 'payment-empty', 'Unable to load payment history.'));
    }
  }

  select.addEventListener('change', render);
  render();
})();
