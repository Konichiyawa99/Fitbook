document.addEventListener('DOMContentLoaded', function () {
  var list = document.getElementById('price-list');
  var empty = document.getElementById('plans-empty');
  var errorState = document.getElementById('plans-error');

  async function loadPlans() {
    var plans = window.GTGData.throwIfError(await window.supabaseClient
      .from('tbl_subscriptionplan')
      .select('subscriptionplanid, planname, durationmonths, price')
      .order('price')) || [];
    list.textContent = '';
    plans.forEach(function (plan) {
      var row = document.createElement('li');
      row.className = 'price-row';
      var info = document.createElement('div');
      info.className = 'price-row__info';
      var nameLine = document.createElement('div');
      nameLine.className = 'price-row__name-line';
      var name = document.createElement('h2');
      name.className = 'price-row__name';
      name.textContent = plan.planname || 'Membership plan';
      nameLine.appendChild(name);
      info.appendChild(nameLine);
      var duration = document.createElement('p');
      duration.className = 'price-row__desc';
      duration.textContent = plan.durationmonths ? plan.durationmonths + ' month(s)' : 'Duration not specified';
      info.appendChild(duration);
      var price = document.createElement('span');
      price.className = 'price-row__price';
      price.textContent = '₱' + Number(plan.price || 0).toLocaleString('en-PH', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
      row.appendChild(info);
      row.appendChild(price);
      list.appendChild(row);
    });
    empty.hidden = plans.length > 0;
  }

  loadPlans().catch(function (error) {
    console.error('Unable to load membership plans:', error);
    errorState.hidden = false;
    errorState.textContent = 'Membership plans could not be loaded: ' + error.message;
  });
});
