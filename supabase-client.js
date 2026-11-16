(function () {
  window.supabaseClient = window.supabase.createClient(
    'https://vakbrmozgbgeskiikjib.supabase.co',
    'sb_publishable_AZjlCnUY6C7TN3w2g6oNNA_F62mMaKP'
  );

  function throwIfError(result) {
    if (result.error) throw result.error;
    return result.data;
  }

  async function getAuthenticatedUser() {
    var result = await window.supabaseClient.auth.getUser();
    if (result.error) {
      if (result.error.name === 'AuthSessionMissingError') return null;
      throw result.error;
    }
    return result.data.user;
  }

  async function getAccount() {
    var authUser = await getAuthenticatedUser();
    if (!authUser) return null;

    var userRow = throwIfError(await window.supabaseClient
      .from('tbl_user')
      .select('userid, usertypeid, username, email')
      .eq('authid', authUser.id)
      .maybeSingle());
    var account = {
      authUser: authUser,
      user: userRow,
      userType: null,
      member: null,
      employee: null,
      trainer: null,
      admin: null
    };

    if (!userRow) return account;
    if (userRow.usertypeid) {
      account.userType = throwIfError(await window.supabaseClient
        .from('tbl_usertype')
        .select('usertypeid, typename')
        .eq('usertypeid', userRow.usertypeid)
        .maybeSingle());
    }

    account.member = throwIfError(await window.supabaseClient
      .from('tbl_member').select('*').eq('userid', userRow.userid).maybeSingle());
    account.employee = throwIfError(await window.supabaseClient
      .from('tbl_employee').select('*').eq('userid', userRow.userid).maybeSingle());
    if (account.employee) {
      account.trainer = throwIfError(await window.supabaseClient
        .from('tbl_trainer').select('*').eq('employeeid', account.employee.employeeid).maybeSingle());
      account.admin = throwIfError(await window.supabaseClient
        .from('tbl_admin').select('*').eq('employeeid', account.employee.employeeid).maybeSingle());
    }
    return account;
  }

  async function ensureMemberProfile(authUser) {
    var userRow = throwIfError(await window.supabaseClient
      .from('tbl_user').select('userid').eq('authid', authUser.id).maybeSingle());
    var metadata = authUser.user_metadata || {};
    if (!userRow) {
      if (metadata.account_type !== 'member') {
        throw new Error('No application profile is linked to this account.');
      }
      var typeRow = throwIfError(await window.supabaseClient
        .from('tbl_usertype').select('usertypeid').ilike('typename', 'member').maybeSingle());
      var userValues = {
        authid: authUser.id,
        email: authUser.email || null,
        username: authUser.email ? authUser.email.split('@')[0] : null
      };
      if (typeRow) userValues.usertypeid = typeRow.usertypeid;
      userRow = throwIfError(await window.supabaseClient
        .from('tbl_user').insert(userValues).select('userid').single());
    }

    var memberRow = throwIfError(await window.supabaseClient
      .from('tbl_member').select('memberid').eq('userid', userRow.userid).maybeSingle());
    if (!memberRow) {
      if (metadata.account_type !== 'member') return getAccount();
      throwIfError(await window.supabaseClient.from('tbl_member').insert({
        userid: userRow.userid,
        firstname: metadata.first_name || '',
        lastname: metadata.last_name || ''
      }));
    }
    return getAccount();
  }

  function accountName(account) {
    if (!account) return '';
    var person = account.member || account.employee;
    if (person) return [person.firstname, person.lastname].filter(Boolean).join(' ');
    var metadata = account.authUser && account.authUser.user_metadata;
    return metadata ? [metadata.first_name, metadata.last_name].filter(Boolean).join(' ') : '';
  }

  function accountRole(account) {
    if (!account) return '';
    if (account.admin) return 'Admin';
    if (account.trainer) return 'Trainer';
    return account.userType && account.userType.typename
      ? account.userType.typename
      : (account.member ? 'Member' : '');
  }

  function bindProfile() {
    return getAccount().then(function (account) {
      if (!account) return;
      var name = accountName(account);
      var parts = name.split(' ');
      var displayName = parts.length > 1 ? parts[parts.length - 1] + ', ' + parts.slice(0, -1).join(' ') : name;
      document.querySelectorAll('.settings-panel__profile-name, .profile-card__name').forEach(function (node) {
        node.textContent = displayName;
      });
      document.querySelectorAll('.settings-panel__profile-sub').forEach(function (node) {
        node.textContent = accountRole(account);
      });
      document.querySelectorAll('[data-profile-first-name]').forEach(function (node) {
        node.textContent = parts[0] || '';
      });
      document.querySelectorAll('[data-profile-name]').forEach(function (node) {
        node.textContent = name;
      });
    });
  }

  window.GTGData = {
    getAccount: getAccount,
    ensureMemberProfile: ensureMemberProfile,
    accountName: accountName,
    accountRole: accountRole,
    throwIfError: throwIfError,
    bindProfile: bindProfile
  };

  document.addEventListener('DOMContentLoaded', function () {
    bindProfile().catch(function (error) {
      console.error('Unable to load account profile:', error);
    });
    document.querySelectorAll('.settings-panel__logout, .app-sidebar__logout a').forEach(function (link) {
      link.addEventListener('click', async function (event) {
        event.preventDefault();
        try {
          var result = await window.supabaseClient.auth.signOut();
          if (result.error) throw result.error;
          window.location.href = 'index.html';
        } catch (error) {
          console.error('Unable to log out:', error);
          window.alert('Unable to log out. Please try again.');
        }
      });
    });
  });
})();
