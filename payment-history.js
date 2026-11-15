/* =========================================================
   payment-history.js
   Shows only the payments (and session usage) for the class
   picked in the "Classes you Enrolled" dropdown.
   ========================================================= */
(function () {
  'use strict';

  /* SAMPLE DATA — replace with the member's real records
     (e.g. loaded from your backend). Keys must match the
     dropdown option text exactly. */
  var PAYMENTS = {
    'Muay Thai': [
      { category: '4-Session Pack', date: 'Nov 3, 2026',  ref: '1234 5678 9012', amount: 500, status: 'paid',    taken: 2, total: 4 },
      { category: 'Single Session', date: 'Oct 12, 2026', ref: '5555 4444 3333', amount: 150, status: 'paid',    taken: 1, total: 1 }
    ],
    'Taekwondo': [
      { category: '4-Session Pack', date: 'Nov 10, 2026', ref: '9876 5432 1098', amount: 500, status: 'pending', taken: 0, total: 4 }
    ]
  };

  var STATUS_LABEL = { paid: 'Paid', pending: 'Pending', failed: 'Failed' };

  var select  = document.getElementById('subscribed-classes');
  var list    = document.getElementById('payment-list');
  var count   = document.getElementById('payment-count');
  var label   = document.getElementById('payment-class');
  var summary = document.getElementById('payment-summary');
  if (!select || !list) return;

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function peso(n) {
    return '\u20B1' + Number(n).toLocaleString('en-PH');
  }

  function buildItem(p) {
    var li = el('li', 'payment-item');

    var info = el('div', 'payment-item__info');
    info.appendChild(el('p', 'payment-item__class', p.category));
    info.appendChild(el('p', 'payment-item__meta', p.date + ' \u00B7 GCash Ref ' + p.ref));

    var side = el('div', 'payment-item__side');
    side.appendChild(el('p', 'payment-item__amount', peso(p.amount)));
    side.appendChild(el('span', 'status-pill status-pill--' + p.status, STATUS_LABEL[p.status] || p.status));

    li.appendChild(info);
    li.appendChild(side);

    var sessions = el('div', 'payment-item__sessions');
    if (p.status === 'paid') {
      var row = el('div', 'sessions-label');
      row.appendChild(el('span', '', 'Sessions taken'));
      row.appendChild(el('strong', '', p.taken + ' / ' + p.total));
      var bar = el('div', 'sessions-bar');
      var fill = el('span');
      fill.style.width = Math.min(100, Math.round((p.taken / p.total) * 100)) + '%';
      bar.appendChild(fill);
      sessions.appendChild(row);
      sessions.appendChild(bar);
    } else {
      sessions.appendChild(el('p', 'sessions-note',
        p.status === 'pending'
          ? 'Sessions unlock once your payment is verified.'
          : 'Payment failed. Please try booking again.'));
    }
    li.appendChild(sessions);
    return li;
  }

  function render() {
    var cls = select.value || select.options[select.selectedIndex].text;
    var items = PAYMENTS[cls] || [];

    list.textContent = '';
    label.textContent = cls;
    count.textContent = items.length;

    if (!items.length) {
      summary.textContent = '';
      list.appendChild(el('li', 'payment-empty', 'No payments yet for this class.'));
      return;
    }

    var taken = 0, total = 0;
    items.forEach(function (p) {
      if (p.status === 'paid') { taken += p.taken; total += p.total; }
      list.appendChild(buildItem(p));
    });
    summary.textContent = total
      ? 'Total sessions taken: ' + taken + ' of ' + total
      : 'No sessions available yet';
  }

  select.addEventListener('change', render);
  render();
})();
