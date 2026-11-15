document.addEventListener('DOMContentLoaded', function () {

  /* ---------- Booking flow: session package + extras -> payment channel ---------- */
  // Packages per class (peso), taken from the GTG Fitness price lists.
  var PACKAGES = {
    gym: [
      { label: 'Walk-in \u00B7 Gym use',        price: 100 },
      { label: 'Walk-in \u00B7 Group class',    price: 200 },
      { label: 'Gym Access',                      price: 1490 },
      { label: 'All-Inclusive \u00B7 2 months', price: 2780 },
      { label: 'All-Inclusive \u00B7 3 months', price: 3900 }
    ],
    boxing:    [ { label: '1 Session', price: 400 }, { label: '5 Sessions', price: 2000 }, { label: '10 Sessions', price: 3500 } ],
    muaythai:  [ { label: '1 Session', price: 400 }, { label: '5 Sessions', price: 2000 }, { label: '10 Sessions', price: 3500 } ],
    taekwondo: [ { label: '10 Sessions', price: 3000 } ],
    yoga:      [ { label: '1 Session', price: 300 }, { label: '1 Month', price: 1990 } ],
    zumba:     [ { label: '1 Session', price: 200 }, { label: '2 Sessions', price: 350 }, { label: '3 Sessions', price: 480 } ],
    personal:  [ { label: '1 Session', price: 400 }, { label: '5 Sessions', price: 2000 }, { label: '10 Sessions', price: 3500 } ],
    buddy:     [ { label: '1 Session', price: 400 }, { label: '5 Sessions', price: 2000 }, { label: '10 Sessions', price: 3500 } ]
  };

  // Price of one extra session: \u20B1400 for every class.
  var RATES = { boxing: 400, muaythai: 400, taekwondo: 400, yoga: 400, zumba: 400, personal: 400, buddy: 400 };
  var MAX_EXTRA = 10;

  // Boxing only: optional training type with its own packages.
  var VARIANTS = [
    { key: 'personal', label: 'Personal Training' },
    { key: 'buddy',    label: 'Buddy Training' }
  ];

  // Equipment comes from equipment-data.js (shared with the Equipment page).
  var CATALOG = {};
  (window.GTG_EQUIPMENT ? window.GTG_EQUIPMENT.items : []).forEach(function (item) {
    CATALOG[item.id] = item;
  });
  function equipmentFor(classKey) {
    var ids = (window.GTG_EQUIPMENT && window.GTG_EQUIPMENT.byClass[classKey]) || [];
    return ids.map(function (id) { return CATALOG[id]; }).filter(Boolean);
  }

  var bookingModal = document.getElementById('booking-modal');
  var bookingTitle = document.getElementById('booking-modal-title');
  var bookingTotalAmount = document.getElementById('booking-total-amount');
  var sessionOptionsEl = document.getElementById('session-options');
  var variantGroup = document.getElementById('variant-group');
  var variantOptionsEl = document.getElementById('variant-options');
  var extraGroup = document.getElementById('extra-group');
  var sessionQtyEl = document.getElementById('session-qty');
  var sessionPriceLine = document.getElementById('session-price-line');
  var sessionHint = document.getElementById('session-hint');
  var sessionMinus = document.getElementById('session-minus');
  var sessionPlus = document.getElementById('session-plus');
  var bookingBreakdown = document.getElementById('booking-breakdown');
  var bookingContinueBtn = document.getElementById('booking-continue-btn');
  var equipmentGroup = document.getElementById('equipment-group');
  var equipmentList = document.getElementById('equipment-list');

  var currentClassKey = null;
  var currentClassName = '';
  var selectedPkg = null;         // chosen package object
  var variant = null;             // null | 'personal' | 'buddy' (boxing only)
  var extraSessions = 0;          // added with the \u2212 / + stepper
  var equipmentQty = {};          // { itemId: quantity }

  function formatPeso(amount) {
    return '\u20B1' + amount.toLocaleString('en-PH');
  }

  function pkgKey() {
    return (currentClassKey === 'boxing' && variant) ? variant : currentClassKey;
  }

  function packagesFor() {
    return PACKAGES[pkgKey()] || [];
  }

  function variantLabel() {
    var v = VARIANTS.filter(function (x) { return x.key === variant; })[0];
    return v ? v.label : '';
  }

  function bookingTitleText() {
    return currentClassName + (variant ? ' \u00B7 ' + variantLabel() : '');
  }

  // How many sessions a package includes (null = unlimited: monthly / access passes)
  function sessionsOf(pkg) {
    var m = /^(\d+) Sessions?$/.exec(pkg.label);
    if (m) return Number(m[1]);
    return /^Walk-in/.test(pkg.label) ? 1 : null;
  }

  function rate() { return RATES[pkgKey()] || 0; }
  function extraAmount() { return extraSessions * rate(); }

  function renderVariants() {
    variantGroup.hidden = currentClassKey !== 'boxing';
    variantOptionsEl.innerHTML = '';
    VARIANTS.forEach(function (v) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'session-option';
      btn.setAttribute('data-variant', v.key);
      btn.textContent = v.label;
      variantOptionsEl.appendChild(btn);
    });
  }

  function renderPackages() {
    sessionOptionsEl.innerHTML = '';
    packagesFor().forEach(function (pkg, i) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'session-option';
      btn.setAttribute('data-pkg', i);
      btn.textContent = pkg.label;
      sessionOptionsEl.appendChild(btn);
    });
  }

  function selectedEquipment() {
    return equipmentFor(currentClassKey)
      .filter(function (item) { return equipmentQty[item.id] > 0; })
      .map(function (item) {
        return { id: item.id, name: item.name, price: item.price, qty: equipmentQty[item.id] };
      });
  }

  function equipmentTotal() {
    return selectedEquipment().reduce(function (sum, item) { return sum + item.price * item.qty; }, 0);
  }

  /* ----- Render + update ----- */
  function renderEquipment() {
    var items = equipmentFor(currentClassKey);
    equipmentList.innerHTML = '';
    equipmentGroup.hidden = items.length === 0;

    items.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'equipment-item';
      li.innerHTML =
        '<div class="equipment-item__info">' +
          '<span class="equipment-item__name"></span>' +
          '<span class="equipment-item__price"></span>' +
        '</div>' +
        '<div class="qty-stepper qty-stepper--sm">' +
          '<button type="button" class="qty-btn" data-eq="' + item.id + '" data-dir="-1" aria-label="Remove one"></button>' +
          '<span class="qty-value" data-eq-qty="' + item.id + '">0</span>' +
          '<button type="button" class="qty-btn" data-eq="' + item.id + '" data-dir="1" aria-label="Add one"></button>' +
        '</div>';
      li.querySelector('.equipment-item__name').textContent = item.name + ' (' + item.type.toLowerCase() + ')';
      li.querySelector('.equipment-item__price').textContent = formatPeso(item.price) + ' each';
      li.querySelector('[data-dir="-1"]').textContent = '\u2212';
      li.querySelector('[data-dir="1"]').textContent = '+';
      equipmentList.appendChild(li);
    });
  }

  function updateBookingUI() {
    var sessAmount = selectedPkg ? selectedPkg.price : 0;
    var extraAmt = extraAmount();
    var eqAmount = equipmentTotal();

    variantOptionsEl.querySelectorAll('.session-option').forEach(function (btn) {
      btn.classList.toggle('is-selected', btn.getAttribute('data-variant') === variant);
    });
    sessionOptionsEl.querySelectorAll('.session-option').forEach(function (btn) {
      btn.classList.toggle('is-selected', packagesFor()[Number(btn.getAttribute('data-pkg'))] === selectedPkg);
    });

    // extra sessions: priced per session
    extraGroup.hidden = !rate();
    sessionQtyEl.textContent = extraSessions;
    sessionMinus.disabled = extraSessions <= 0;
    sessionPlus.disabled = !selectedPkg || extraSessions >= MAX_EXTRA;
    sessionPriceLine.textContent = rate() ? '(per session ' + formatPeso(rate()) + ')' : '';
    sessionHint.textContent = !selectedPkg
      ? ''
      : (extraSessions
          ? extraSessions + (extraSessions === 1 ? ' extra session' : ' extra sessions') + ': +' + formatPeso(extraAmt)
          : 'Need more? Tap + to add extra sessions.');

    equipmentFor(currentClassKey).forEach(function (item) {
      var qtyNode = equipmentList.querySelector('[data-eq-qty="' + item.id + '"]');
      var minus = equipmentList.querySelector('[data-eq="' + item.id + '"][data-dir="-1"]');
      if (qtyNode) qtyNode.textContent = equipmentQty[item.id] || 0;
      if (minus) minus.disabled = !equipmentQty[item.id];
    });

    if (selectedPkg && (eqAmount > 0 || extraAmt > 0)) {
      bookingBreakdown.hidden = false;
      bookingBreakdown.textContent = selectedPkg.label + ' ' + formatPeso(sessAmount) +
        (extraAmt ? '  +  Extra sessions ' + formatPeso(extraAmt) : '') +
        (eqAmount ? '  +  Equipment ' + formatPeso(eqAmount) : '');
    } else {
      bookingBreakdown.hidden = true;
    }

    bookingTotalAmount.textContent = formatPeso(sessAmount + extraAmt + eqAmount);
    bookingContinueBtn.disabled = !selectedPkg;
  }

  function resetBooking() {
    selectedPkg = null;
    variant = null;
    extraSessions = 0;
    equipmentQty = {};
    renderVariants();
    renderPackages();
    renderEquipment();
    updateBookingUI();
  }

  // Open the booking popup whenever any "Book Session" button is clicked.
  document.querySelectorAll('.book-session-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      currentClassKey = btn.getAttribute('data-class');
      currentClassName = btn.getAttribute('data-name') || 'Class';
      bookingTitle.textContent = currentClassName;
      resetBooking();
      bookingModal.showModal();
    });
  });

  // Boxing type (Personal / Buddy): tap again to go back to the regular packages
  variantOptionsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.session-option');
    if (!btn) return;
    var key = btn.getAttribute('data-variant');
    variant = (variant === key) ? null : key;
    selectedPkg = null;
    extraSessions = 0;
    renderPackages();
    updateBookingUI();
  });

  // Package buttons (one handler for the whole list)
  sessionOptionsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('.session-option');
    if (!btn) return;
    selectedPkg = packagesFor()[Number(btn.getAttribute('data-pkg'))];
    updateBookingUI();
  });

  // Extra sessions: − / +
  sessionMinus.addEventListener('click', function () {
    if (extraSessions > 0) { extraSessions--; updateBookingUI(); }
  });
  sessionPlus.addEventListener('click', function () {
    if (selectedPkg && extraSessions < MAX_EXTRA) { extraSessions++; updateBookingUI(); }
  });

  // Equipment quantity: one handler for every − / + in the list
  equipmentList.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-eq]');
    if (!btn || btn.disabled) return;
    var id = btn.getAttribute('data-eq');
    var next = (equipmentQty[id] || 0) + Number(btn.getAttribute('data-dir'));
    if (next < 0 || next > 10) return;
    equipmentQty[id] = next;
    updateBookingUI();
  });

  // Continue: close the booking popup and open the shared payment popup.
  bookingContinueBtn.addEventListener('click', function () {
    if (!selectedPkg) return;
    var sessAmount = selectedPkg.price;
    var equipment = selectedEquipment();
    var eqCount = equipment.reduce(function (n, item) { return n + item.qty; }, 0);

    var title = bookingTitleText();
    var lines = [{ label: title + ' \u00B7 ' + selectedPkg.label, amount: sessAmount }];
    if (extraSessions) lines.push({ label: 'Extra sessions \u00D7 ' + extraSessions, amount: extraAmount() });
    equipment.forEach(function (item) {
      lines.push({ label: item.name + ' \u00D7 ' + item.qty, amount: item.price * item.qty });
    });

    var what = selectedPkg.label + (extraSessions ? ' + ' + extraSessions + ' extra' : '') + ' for ' + title;
    if (eqCount > 0) what += ' + ' + eqCount + (eqCount === 1 ? ' equipment item' : ' equipment items');

    var baseSessions = sessionsOf(selectedPkg);
    var enrolled = baseSessions === null ? null : baseSessions + extraSessions;

    bookingModal.close();
    GTGCheckout.open({
      ref: title + '-' + selectedPkg.label,
      lines: lines,
      total: sessAmount + extraAmount() + equipmentTotal(),
      what: what,
      doneLabel: 'Choose a Date',
      onConfirm: function () {
        // save the enrollment, then open the Booking Date page when the receipt is closed
        var enr = {
          id: String(Date.now()),
          className: currentClassName,
          classKey: currentClassKey,
          variantLabel: variantLabel(),
          pkgLabel: selectedPkg.label,
          total: enrolled,
          booked: {}
        };
        try {
          var list = JSON.parse(localStorage.getItem('gtg_enrollments') || '[]');
          list.push(enr);
          localStorage.setItem('gtg_enrollments', JSON.stringify(list));
          localStorage.setItem('gtg_active_enrollment', enr.id);
        } catch (err) { /* storage unavailable: booking page will ask to enroll again */ }
        var d = document.getElementById('checkout-modal');
        d.addEventListener('close', function onClose() {
          d.removeEventListener('close', onClose);
          window.location.href = 'booking.html';
        });
      }
    });
  });

  // Close (X) button on the booking popup.
  document.querySelectorAll('[data-close-dialog]').forEach(function (closeBtn) {
    closeBtn.addEventListener('click', function () {
      var dialog = document.getElementById(closeBtn.getAttribute('data-close-dialog'));
      if (dialog) dialog.close();
    });
  });

  // Clicking the backdrop also closes the popup (native <dialog> only
  // closes on Esc or .close() by default).
  bookingModal.addEventListener('click', function (e) {
    if (e.target === bookingModal) bookingModal.close();
  });

  /* ---------- Settings menu: close when clicking outside ---------- */
  document.addEventListener('click', function (e) {
    document.querySelectorAll('details.settings-menu[open]').forEach(function (d) {
      if (!d.contains(e.target)) d.removeAttribute('open');
    });
  });

});