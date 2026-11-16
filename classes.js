document.addEventListener('DOMContentLoaded', function () {
  var grid = document.getElementById('classes-grid');
  var empty = document.getElementById('classes-empty');
  var errorState = document.getElementById('classes-error');

  function showError(error) {
    console.error('Unable to load classes:', error);
    errorState.hidden = false;
    errorState.textContent = 'Classes could not be loaded: ' + error.message;
  }

  async function loadClasses() {
    var classes = window.GTGData.throwIfError(await window.supabaseClient
      .from('tbl_classes')
      .select('classesid, classcategoryid, difficulties, capacity, status, classesname')
      .order('classesname')) || [];
    var categoryIds = Array.from(new Set(classes.map(function (row) { return row.classcategoryid; }).filter(Boolean)));
    var categories = categoryIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient
        .from('tbl_classcategory')
        .select('classcategoryid, categoryname, description')
        .in('classcategoryid', categoryIds))
      : [];
    var categoriesById = {};
    categories.forEach(function (row) { categoriesById[row.classcategoryid] = row; });

    grid.textContent = '';
    classes.forEach(function (record) {
      var category = categoriesById[record.classcategoryid];
      var card = document.createElement('article');
      card.className = 'class-card';
      var title = document.createElement('h2');
      title.className = 'class-card__title';
      title.textContent = record.classesname || 'Class';
      card.appendChild(title);

      if (category && category.description) {
        var description = document.createElement('p');
        description.className = 'class-card__desc';
        description.textContent = category.description;
        card.appendChild(description);
      }

      var details = document.createElement('p');
      details.className = 'class-card__desc';
      details.textContent = [
        category && category.categoryname,
        record.difficulties,
        record.capacity ? 'Capacity: ' + record.capacity : '',
        record.status
      ].filter(Boolean).join(' · ');
      card.appendChild(details);

      var book = document.createElement('a');
      book.className = 'btn btn-navy';
      book.href = 'booking.html?classId=' + encodeURIComponent(record.classesid);
      book.textContent = 'View schedule';
      card.appendChild(book);
      grid.appendChild(card);
    });
    empty.hidden = classes.length > 0;
  }

  loadClasses().catch(showError);
});
