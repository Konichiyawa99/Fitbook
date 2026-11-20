(function () {
  'use strict';

  var supabase = window.GTG_SUPABASE;
  if (!supabase) return;

  function setText(selector, text) {
    var nodes = document.querySelectorAll(selector);
    nodes.forEach(function (node) { node.textContent = text; });
  }

  function setImage(selector, source, alt) {
    var image = document.querySelector(selector);
    if (!image) return;
    if (!source) {
      image.hidden = true;
      image.removeAttribute('src');
      return;
    }
    image.src = source;
    image.alt = alt || '';
    image.hidden = false;
  }

  function formatName(member, authUser) {
    var first = member && member.firstname;
    var last = member && member.lastname;
    if (!first && !last) {
      var metadata = authUser && authUser.user_metadata ? authUser.user_metadata : {};
      first = metadata.first_name || '';
      last = metadata.last_name || '';
    }
    return {
      first: first || 'Member',
      last: last || ''
    };
  }

  function formatDate(value) {
    if (!value) return 'Date not set';
    var date = new Date(value);
    if (isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  async function findMember(user) {
    var userResult = await supabase
      .from('tbl_user')
      .select('userid, auth_user_id, email')
      .eq('auth_user_id', user.id)
      .maybeSingle();

    if (userResult.error) throw userResult.error;
    if (!userResult.data) {
      var emailResult = await supabase
        .from('tbl_user')
        .select('userid, auth_user_id, email')
        .eq('email', user.email)
        .maybeSingle();
      if (emailResult.error) throw emailResult.error;
      if (emailResult.data) {
        await supabase
          .from('tbl_user')
          .update({ auth_user_id: user.id })
          .eq('userid', emailResult.data.userid);
        userResult.data = emailResult.data;
      } else {
        var metadata = user.user_metadata || {};
        var createUser = await supabase
          .from('tbl_user')
          .insert({
            username: user.email,
            email: user.email,
            auth_user_id: user.id
          })
          .select('userid, auth_user_id, email')
          .single();
        if (createUser.error) throw createUser.error;
        userResult.data = createUser.data;

        await supabase
          .from('tbl_member')
          .insert({
            userid: createUser.data.userid,
            firstname: metadata.first_name || '',
            lastname: metadata.last_name || ''
          });
      }
    }

    var memberResult = await supabase
      .from('tbl_member')
      .select('*')
      .eq('userid', userResult.data.userid)
      .maybeSingle();
    if (memberResult.error) throw memberResult.error;
    return { appUser: userResult.data, member: memberResult.data };
  }

  async function loadClassNames(memberId) {
    var bookingResult = await supabase
      .from('tbl_booking')
      .select('bookingid, scheduleid')
      .eq('memberid', memberId);
    if (bookingResult.error) throw bookingResult.error;

    var scheduleIds = (bookingResult.data || []).map(function (booking) { return booking.scheduleid; });
    if (!scheduleIds.length) return [];

    var scheduleResult = await supabase
      .from('tbl_schedule')
      .select('classesid')
      .in('scheduleid', scheduleIds);
    if (scheduleResult.error) throw scheduleResult.error;

    var classIds = Array.from(new Set((scheduleResult.data || []).map(function (schedule) { return schedule.classesid; })));
    if (!classIds.length) return [];

    var classResult = await supabase
      .from('tbl_classes')
      .select('classesid, classesname')
      .in('classesid', classIds);
    if (classResult.error) throw classResult.error;

    return (classResult.data || []).map(function (item) { return item.classesname; }).filter(Boolean);
  }

  async function loadUpcoming(memberId) {
    var bookingResult = await supabase
      .from('tbl_booking')
      .select('bookingid, scheduleid')
      .eq('memberid', memberId);
    if (bookingResult.error) throw bookingResult.error;

    var scheduleIds = (bookingResult.data || []).map(function (booking) { return booking.scheduleid; });
    if (!scheduleIds.length) return null;

    var now = new Date();
    var scheduleResult = await supabase
      .from('tbl_schedule')
      .select('*')
      .in('scheduleid', scheduleIds)
      .gte('scheduledate', now.toISOString().slice(0, 10))
      .order('scheduledate', { ascending: true })
      .order('time', { ascending: true })
      .limit(1);
    if (scheduleResult.error) throw scheduleResult.error;
    if (!scheduleResult.data || !scheduleResult.data.length) return null;

    var schedule = scheduleResult.data[0];
    var booking = (bookingResult.data || []).find(function (item) {
      return item.scheduleid === schedule.scheduleid;
    });
    var classResult = await supabase
      .from('tbl_classes')
      .select('classesname')
      .eq('classesid', schedule.classesid)
      .maybeSingle();
    if (classResult.error) throw classResult.error;

    var trainerName = 'Coach';
    if (schedule.trainerid) {
      var trainerResult = await supabase
        .from('tbl_trainer')
        .select('employeeid, avatar_url')
        .eq('trainerid', schedule.trainerid)
        .maybeSingle();
      if (!trainerResult.error && trainerResult.data && trainerResult.data.employeeid) {
        var employeeResult = await supabase
          .from('tbl_employee')
          .select('firstname, lastname')
          .eq('employeeid', trainerResult.data.employeeid)
          .maybeSingle();
        if (!employeeResult.error && employeeResult.data) {
          trainerName = 'Coach ' + (employeeResult.data.firstname || '') + (employeeResult.data.lastname ? ' ' + employeeResult.data.lastname : '');
        }
      }
    }

    return {
      className: classResult.data ? classResult.data.classesname : 'Class',
      trainerName: trainerName.trim(),
      trainerImage: trainerResult && trainerResult.data ? trainerResult.data.avatar_url : '',
      bookingId: booking ? booking.bookingid : null,
      scheduleId: schedule.scheduleid,
      date: schedule.scheduledate,
      time: schedule.time
    };
  }

  async function loadProgress(memberId) {
    var result = await supabase
      .from('tbl_progress')
      .select('*')
      .eq('memberid', memberId)
      .order('recordeddate', { ascending: false })
      .limit(5);
    return result.error ? [] : (result.data || []);
  }

  async function loadAttendance(memberId) {
    var result = await supabase
      .from('tbl_memberattendance')
      .select('timein')
      .eq('memberid', memberId)
      .not('timein', 'is', null);
    if (result.error) return [];
    return (result.data || []).map(function (row) { return row.timein; });
  }

  async function loadAnnouncement() {
    var result = await supabase
      .from('tbl_announcement')
      .select('title, message')
      .eq('isactive', true)
      .order('announcementid', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  async function loadDashboardConfig() {
    var result = await supabase
      .from('tbl_dashboard_config')
      .select('payment_qr_url, payment_method, countries')
      .eq('configid', 1)
      .maybeSingle();
    if (result.error) throw result.error;
    return result.data;
  }

  function renderPaymentEmail(email) {
    var input = document.getElementById('pay-email');
    if (input && email) input.value = email;
  }

  function renderDashboardConfig(config) {
    if (!config) return;
    var qr = document.getElementById('payment-qr');
    var caption = document.getElementById('payment-qr-caption');

    if (config.payment_qr_url && qr) {
      qr.src = config.payment_qr_url;
      qr.alt = config.payment_method ? config.payment_method + ' payment QR code' : 'Payment QR code';
      qr.hidden = false;
    }
    if (caption) caption.textContent = config.payment_method
      ? 'Use ' + config.payment_method + ' to complete your payment.'
      : '';
  }

  async function init() {
    var sessionResult = await supabase.auth.getSession();
    var session = sessionResult.data ? sessionResult.data.session : null;
    if (!session) {
      window.location.replace('login.html');
      return;
    }

    try {
      var result = await findMember(session.user);
      var member = result ? result.member : null;
      var name = formatName(member, session.user);
      renderPaymentEmail(session.user.email);
      setText('.settings-panel__profile-name', name.last ? name.last + ', ' + name.first : name.first);
      setText('.page-title', 'Good morning, ' + name.first + '!');
      setText('.profile-card__name', name.last ? name.last + ', ' + name.first : name.first);
      setText('.profile-card__age', member && member.age ? member.age + ' years old' : 'Age not set');
      setText('#member-height', member && member.height ? member.height : 'Not set');
      setText('#member-weight', member && member.weight ? member.weight : 'Not set');
      setText('#member-gender', member && member.sex ? member.sex : 'Not set');
      setImage('#settings-profile-image', member && member.avatar_url, name.first + ' ' + name.last);
      setImage('#profile-image', member && member.avatar_url, name.first + ' ' + name.last);

      if (!result) {
        setText('.payment-empty', 'No member profile is linked to this account.');
        return;
      }
      if (!member) {
        setText('.page-subtitle', 'Your account does not have a member profile yet.');
        return;
      }

      var memberId = member.memberid;
      window.GTG_MEMBER_CONTEXT = { memberId: memberId, member: member, appUser: result.appUser };

      var classNames = await loadClassNames(memberId);
      var enrolledCount = document.getElementById('enrolled-count');
      if (enrolledCount) enrolledCount.textContent = classNames.length;
      var select = document.getElementById('subscribed-classes');
      if (select) {
        select.innerHTML = '';
        if (!classNames.length) {
          select.add(new Option('No enrolled classes', ''));
        } else {
          classNames.forEach(function (name) { select.add(new Option(name, name)); });
        }
        select.dispatchEvent(new Event('change'));
      }

      var upcoming = await loadUpcoming(memberId);
      var ongoingClass = document.getElementById('ongoing-class');
      if (upcoming) {
        window.GTG_MEMBER_CONTEXT.upcoming = upcoming;
        setText('.upcoming-coach__name', upcoming.trainerName);
        setText('.upcoming-coach__class', upcoming.className);
        setText('.upcoming-coach__time', formatDate(upcoming.date) + (upcoming.time ? ' · ' + upcoming.time : ''));
        setImage('#upcoming-coach-image', upcoming.trainerImage, upcoming.trainerName);
        if (ongoingClass) {
          var today = new Date().toISOString().slice(0, 10);
          ongoingClass.textContent = upcoming.date === today ? upcoming.className : 'No class today';
        }

        try {
          var announcement = await loadAnnouncement();
          if (announcement) {
            setText('#announcement-message', announcement.title
              ? announcement.title + ': ' + announcement.message
              : announcement.message);
          }
        } catch (announcementError) {
          console.error(announcementError);
        }

        try {
          var dashboardConfig = await loadDashboardConfig();
          if (dashboardConfig) {
            window.GTG_MEMBER_CONTEXT.paymentMethod = dashboardConfig.payment_method;
            renderDashboardConfig(dashboardConfig);
          }
        } catch (configError) {
          console.error(configError);
        }
      } else {
        setText('.upcoming-coach__name', 'No upcoming class');
        setText('.upcoming-coach__class', '');
        setText('.upcoming-coach__time', '');
        if (ongoingClass) ongoingClass.textContent = 'No class today';
      }

      var progress = await loadProgress(memberId);
      var notesSection = document.querySelector('.trainer-notes');
      if (notesSection) {
        var badge = notesSection.querySelector('.badge-count');
        if (badge) badge.textContent = progress.length;
        var existing = notesSection.querySelectorAll('p, ul');
        existing.forEach(function (node) { node.remove(); });
        if (!progress.length) {
          notesSection.appendChild(document.createElement('p')).textContent = 'No trainer notes yet.';
        } else {
          progress.forEach(function (note) {
            var paragraph = document.createElement('p');
            var value = note.progressvalue != null ? ' · Progress: ' + note.progressvalue : '';
            paragraph.textContent = formatDate(note.recordeddate) + value + (note.progressnotes ? ': ' + note.progressnotes : '');
            notesSection.appendChild(paragraph);
          });
        }
      }

      var attendance = await loadAttendance(memberId);
      window.GTG_ATTENDANCE_DATES = attendance.map(function (value) {
        return new Date(value).toISOString().slice(0, 10);
      });
      var calendar = document.getElementById('dash-big-calendar');
      if (calendar) calendar.dispatchEvent(new Event('gtg-attendance-loaded'));

      var logout = document.querySelector('.settings-panel__logout');
      if (logout) {
        logout.addEventListener('click', async function (event) {
          event.preventDefault();
          await supabase.auth.signOut();
          window.location.replace('index.html');
        });
      }
    } catch (error) {
      console.error(error);
      setText('.page-subtitle', 'Unable to load your Supabase member data.');
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
