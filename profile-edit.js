document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('profile-form');
  var status = document.getElementById('profile-status');
  var role = form.dataset.profileRole;
  var account;

  function showStatus(message, success) {
    status.textContent = message;
    status.className = success ? 'form-error is-visible is-success' : 'form-error is-visible';
  }

  function setValue(id, value) {
    var input = document.getElementById(id);
    if (input && value !== null && value !== undefined) input.value = value;
  }

  async function loadProfile() {
    account = await window.GTGData.getAccount();
    if (!account || !account.user) throw new Error('No application profile is linked to this account.');
    var person = role === 'member' ? account.member : account.employee;
    if (!person) throw new Error('No ' + role + ' profile is linked to this account.');

    setValue('first-name', person.firstname);
    setValue('last-name', person.lastname);
    setValue('email', account.authUser.email || account.user.email);
    setValue('phone', person.phonenumber);
    setValue('age', person.age);
    setValue('gender', person.sex);
    setValue('address', person.address);
    if (role === 'admin') setValue('position', account.admin && account.admin.role);
    if (role === 'trainer') {
      var specialty = document.getElementById('trainer-specialty');
      if (specialty) specialty.textContent = account.trainer ? account.trainer.specialty || 'No specialty listed' : '';
    }
  }

  async function saveProfile(event) {
    event.preventDefault();
    var newPassword = document.getElementById('new-password').value;
    var confirmPassword = document.getElementById('confirm-password').value;
    var email = document.getElementById('email').value.trim();
    if (newPassword && newPassword !== confirmPassword) {
      showStatus('The new passwords do not match.', false);
      return;
    }
    if (newPassword && newPassword.length < 6) {
      showStatus('Password must be at least 6 characters.', false);
      return;
    }

    var submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    try {
      var personValues = {
        firstname: document.getElementById('first-name').value.trim(),
        lastname: document.getElementById('last-name').value.trim(),
        phonenumber: document.getElementById('phone').value.trim() || null,
        age: document.getElementById('age').value ? Number(document.getElementById('age').value) : null,
        sex: document.getElementById('gender').value || null,
        address: document.getElementById('address').value.trim() || null
      };
      var personTable = role === 'member' ? 'tbl_member' : 'tbl_employee';
      var personId = role === 'member' ? account.member.memberid : account.employee.employeeid;
      var idColumn = role === 'member' ? 'memberid' : 'employeeid';
      window.GTGData.throwIfError(await window.supabaseClient.from(personTable)
        .update(personValues).eq(idColumn, personId));

      if (role === 'admin') {
        window.GTGData.throwIfError(await window.supabaseClient.from('tbl_admin')
          .update({ role: document.getElementById('position').value })
          .eq('adminid', account.admin.adminid));
      }

      var authChanges = {};
      if (email && email !== account.authUser.email) authChanges.email = email;
      if (newPassword) authChanges.password = newPassword;
      if (Object.keys(authChanges).length) {
        var authResult = await window.supabaseClient.auth.updateUser(authChanges);
        if (authResult.error) throw authResult.error;
      }
      if (email && email !== account.user.email) {
        window.GTGData.throwIfError(await window.supabaseClient.from('tbl_user')
          .update({ email: email }).eq('userid', account.user.userid));
      }

      form.reset();
      document.getElementById('new-password').value = '';
      document.getElementById('confirm-password').value = '';
      await loadProfile();
      showStatus('Profile changes saved.', true);
    } catch (error) {
      console.error('Unable to save profile:', error);
      showStatus('Profile changes could not be saved: ' + error.message, false);
    } finally {
      submit.disabled = false;
    }
  }

  form.addEventListener('submit', saveProfile);
  loadProfile().catch(function (error) {
    console.error('Unable to load profile:', error);
    showStatus('Profile could not be loaded: ' + error.message, false);
  });
});
