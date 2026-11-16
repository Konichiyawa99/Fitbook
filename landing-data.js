document.addEventListener('DOMContentLoaded', function () {
  async function load() {
    var results = await Promise.all([
      window.supabaseClient.from('tbl_classes').select('classesname'),
      window.supabaseClient.from('tbl_trainer').select('trainerid')
    ]);
    var classes = window.GTGData.throwIfError(results[0]) || [];
    var trainers = window.GTGData.throwIfError(results[1]) || [];
    document.querySelectorAll('[data-class-count]').forEach(function (node) {
      node.textContent = classes.length;
    });
    document.querySelectorAll('[data-class-list]').forEach(function (node) {
      node.textContent = classes.map(function (row) { return row.classesname; }).filter(Boolean).join(', ');
    });
    document.querySelectorAll('[data-trainer-count]').forEach(function (node) {
      node.textContent = trainers.length;
    });
  }

  load().catch(function (error) {
    console.error('Unable to load public gym information:', error);
    document.querySelectorAll('[data-class-count], [data-trainer-count]').forEach(function (node) {
      node.textContent = '—';
    });
    document.querySelectorAll('[data-class-list]').forEach(function (node) {
      node.textContent = 'Class information could not be loaded.';
    });
  });
});
