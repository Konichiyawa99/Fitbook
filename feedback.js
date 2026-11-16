document.addEventListener('DOMContentLoaded', function () {
  var form = document.querySelector('.feedback-card form');
  var categoryDropdown = document.getElementById('feedback-for');
  var categorySummary = document.getElementById('feedback-for-summary');
  var categoryValue = document.getElementById('feedback-for-value');
  var trainerField = document.getElementById('trainer-field');
  var trainerDropdown = document.getElementById('trainer');
  var trainerSummary = document.getElementById('trainer-summary');
  var trainerValue = document.getElementById('trainer-value');
  var trainerOptions = document.getElementById('trainer-options');
  var status = document.getElementById('feedback-status');

  function setStatus(message, success) {
    status.textContent = message;
    status.className = success ? 'form-error is-visible is-success' : 'form-error is-visible';
  }

  function bindOptions(dropdown, summary, hiddenInput, onSelect) {
    dropdown.querySelectorAll('.dropdown-list button').forEach(function (option) {
      option.addEventListener('click', function () {
        var value = option.dataset.value;
        summary.textContent = value;
        hiddenInput.value = value;
        dropdown.removeAttribute('open');
        if (onSelect) onSelect(value);
      });
    });
  }

  bindOptions(categoryDropdown, categorySummary, categoryValue, function (value) {
    var showTrainer = value === 'Trainer';
    trainerField.hidden = !showTrainer;
    if (!showTrainer) {
      trainerValue.value = '';
      trainerSummary.textContent = 'Choose a trainer';
    }
  });

  async function loadTrainers() {
    var trainers = window.GTGData.throwIfError(await window.supabaseClient
      .from('tbl_trainer').select('trainerid, employeeid, specialty')) || [];
    var employeeIds = Array.from(new Set(trainers.map(function (row) { return row.employeeid; }).filter(Boolean)));
    var employees = employeeIds.length
      ? window.GTGData.throwIfError(await window.supabaseClient.from('tbl_employee')
        .select('employeeid, firstname, lastname').in('employeeid', employeeIds))
      : [];
    var employeesById = {};
    employees.forEach(function (row) { employeesById[row.employeeid] = row; });
    trainers.forEach(function (trainer) {
      var employee = employeesById[trainer.employeeid] || {};
      var name = [employee.firstname, employee.lastname].filter(Boolean).join(' ');
      if (!name) return;
      var option = document.createElement('button');
      option.type = 'button';
      option.dataset.value = name;
      option.textContent = name + (trainer.specialty ? ' · ' + trainer.specialty : '');
      trainerOptions.appendChild(option);
    });
    bindOptions(trainerDropdown, trainerSummary, trainerValue);
  }

  loadTrainers().catch(function (error) {
    console.error('Unable to load feedback trainers:', error);
    setStatus('Trainer list could not be loaded: ' + error.message, false);
  });

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    status.className = 'form-error';
    var message = document.getElementById('message').value.trim();
    if (!categoryValue.value) {
      setStatus('Please choose a feedback category.', false);
      return;
    }
    if (categoryValue.value === 'Trainer' && !trainerValue.value) {
      setStatus('Please choose a trainer.', false);
      return;
    }
    if (!message) {
      setStatus('Please enter a message.', false);
      return;
    }

    var submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      var account = await window.GTGData.getAccount();
      if (!account || !account.member) throw new Error('This account is not linked to a member profile.');
      var feedbackMessage = categoryValue.value === 'Trainer'
        ? 'Trainer: ' + trainerValue.value + '\n' + message
        : message;
      window.GTGData.throwIfError(await window.supabaseClient.from('tbl_feedback').insert({
        memberid: account.member.memberid,
        feedbacktype: categoryValue.value,
        message: feedbackMessage
      }));
      form.reset();
      categorySummary.textContent = 'Choose a category';
      trainerSummary.textContent = 'Choose a trainer';
      trainerField.hidden = true;
      setStatus('Thank you. Your feedback has been saved.', true);
    } catch (error) {
      console.error('Unable to save feedback:', error);
      setStatus('Feedback could not be saved: ' + error.message, false);
    } finally {
      submit.disabled = false;
    }
  });
});
