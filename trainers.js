document.addEventListener('DOMContentLoaded', function () {
  var grid = document.getElementById('trainers-grid');
  var filter = document.getElementById('category-filter');
  var empty = document.getElementById('trainers-empty');
  var errorState = document.getElementById('trainers-error');
  var records = [];

  function render() {
    var specialty = filter.value.toLowerCase();
    var visible = records.filter(function (row) {
      return !specialty || String(row.specialty || '').toLowerCase() === specialty;
    });
    grid.textContent = '';
    visible.forEach(function (row) {
      var card = document.createElement('article');
      card.className = 'trainer-card';
      var heading = document.createElement('h2');
      heading.className = 'trainer-card__name';
      heading.textContent = [row.firstname, row.lastname].filter(Boolean).join(' ') || 'Trainer';
      card.appendChild(heading);
      var tags = document.createElement('ul');
      tags.className = 'tag-list';
      var tag = document.createElement('li');
      tag.className = 'tag';
      tag.textContent = row.specialty || 'No specialty listed';
      tags.appendChild(tag);
      card.appendChild(tags);
      grid.appendChild(card);
    });
    empty.hidden = visible.length > 0;
  }

  async function load() {
    var trainers = window.GTGData.throwIfError(await window.supabaseClient
      .from('tbl_trainer')
      .select('trainerid, employeeid, specialty')) || [];
    var employeeIds = Array.from(new Set(trainers.map(function (row) { return row.employeeid; }).filter(Boolean)));
    var employees = employeeIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient
        .from('tbl_employee')
        .select('employeeid, firstname, lastname')
        .in('employeeid', employeeIds))
      : [];
    var employeesById = {};
    employees.forEach(function (row) { employeesById[row.employeeid] = row; });
    records = trainers.map(function (row) {
      var employee = employeesById[row.employeeid] || {};
      return {
        firstname: employee.firstname,
        lastname: employee.lastname,
        specialty: row.specialty
      };
    });

    filter.replaceChildren(new Option('All Specialties', ''));
    Array.from(new Set(records.map(function (row) { return row.specialty; }).filter(Boolean)))
      .sort()
      .forEach(function (value) { filter.add(new Option(value, value)); });
    filter.addEventListener('change', render);
    render();
  }

  load().catch(function (error) {
    console.error('Unable to load trainers:', error);
    errorState.hidden = false;
    errorState.textContent = 'Trainer list could not be loaded: ' + error.message;
  });
});
