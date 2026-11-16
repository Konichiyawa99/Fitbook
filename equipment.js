document.addEventListener('DOMContentLoaded', function () {
  var grid = document.getElementById('equip-grid');
  var empty = document.getElementById('equip-empty');
  var errorState = document.getElementById('equip-error');

  async function loadEquipment() {
    var records = window.GTGData.throwIfError(await window.supabaseClient
      .from('tbl_equipment')
      .select('equipmentid, equipmentname, status, description, quantity')
      .order('equipmentname')) || [];
    grid.textContent = '';

    records.forEach(function (record) {
      var card = document.createElement('article');
      card.className = 'equip-card';
      var name = document.createElement('h2');
      name.className = 'equip-card__name';
      name.textContent = record.equipmentname || 'Equipment';
      card.appendChild(name);
      if (record.description) {
        var description = document.createElement('p');
        description.className = 'equip-card__meta';
        description.textContent = record.description;
        card.appendChild(description);
      }
      var details = document.createElement('p');
      details.className = 'equip-card__meta';
      details.textContent = [
        record.status,
        record.quantity === null ? '' : 'Quantity: ' + record.quantity
      ].filter(Boolean).join(' · ');
      card.appendChild(details);
      grid.appendChild(card);
    });
    empty.hidden = records.length > 0;
  }

  loadEquipment().catch(function (error) {
    console.error('Unable to load equipment inventory:', error);
    errorState.hidden = false;
    errorState.textContent = 'Equipment inventory could not be loaded: ' + error.message;
  });
});
