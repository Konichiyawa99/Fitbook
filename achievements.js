document.addEventListener('DOMContentLoaded', function () {
  var list = document.getElementById('progress-list');
  var empty = document.getElementById('progress-empty');
  var errorState = document.getElementById('progress-error');

  async function loadProgress() {
    var account = await window.GTGData.getAccount();
    if (!account || !account.member) throw new Error('This account is not linked to a member profile.');
    var rows = window.GTGData.throwIfError(await window.supabaseClient.from('tbl_progress')
      .select('progressid, progressnotes, recordeddate, progressvalue, targetvalue')
      .eq('memberid', account.member.memberid)
      .order('recordeddate', { ascending: false })) || [];

    list.textContent = '';
    rows.forEach(function (row) {
      var item = document.createElement('div');
      item.className = 'achievement-row';
      var text = row.progressnotes || 'Progress record';
      if (row.progressvalue !== null && row.progressvalue !== undefined) {
        text += ': ' + row.progressvalue;
        if (row.targetvalue !== null && row.targetvalue !== undefined) text += ' / ' + row.targetvalue;
      }
      if (row.recordeddate) text += ' · ' + new Date(row.recordeddate).toLocaleDateString();
      item.textContent = text;
      list.appendChild(item);
    });
    empty.hidden = rows.length > 0;
  }

  loadProgress().catch(function (error) {
    console.error('Unable to load progress records:', error);
    errorState.hidden = false;
    errorState.textContent = 'Progress records could not be loaded: ' + error.message;
  });
});
