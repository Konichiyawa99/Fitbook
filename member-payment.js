(function () {
  'use strict';

  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  var ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

  function showStatus(message, isError) {
    var status = document.getElementById('payment-upload-status');
    if (!status) return;
    status.textContent = message;
    status.classList.toggle('is-error', Boolean(isError));
  }

  function getExtension(file) {
    var parts = file.name.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : 'jpg';
  }

  async function submitPayment(event) {
    event.preventDefault();

    var form = event.currentTarget;
    var button = document.getElementById('payment-submit');
    var fileInput = document.getElementById('receipt-file');
    var file = fileInput && fileInput.files ? fileInput.files[0] : null;
    var context = window.GTG_MEMBER_CONTEXT;
    var supabase = window.GTG_SUPABASE;

    if (!context || !supabase) {
      showStatus('Your member account is still loading. Please try again.', true);
      return;
    }
    if (!file) {
      showStatus('Please upload your payment receipt.', true);
      return;
    }
    if (ALLOWED_TYPES.indexOf(file.type) === -1) {
      showStatus('Receipt must be a JPG, PNG, or WebP image.', true);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showStatus('Receipt image must be 5 MB or smaller.', true);
      return;
    }
    button.disabled = true;
    showStatus('Uploading receipt...');

    try {
      var sessionResult = await supabase.auth.getSession();
      var session = sessionResult.data ? sessionResult.data.session : null;
      if (!session) throw new Error('Your session has expired. Please log in again.');

      var path = session.user.id + '/' + Date.now() + '-' +
        crypto.randomUUID() + '.' + getExtension(file);
      var uploadResult = await supabase.storage
        .from('payment-receipts')
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadResult.error) throw uploadResult.error;

      var payment = {
        memberid: context.memberId,
        bookingid: context.upcoming ? context.upcoming.bookingId : null,
        subscriptionplanid: context.member.subscriptionplanid || null,
        paymentstatus: 'pending',
        paymentmethod: context.paymentMethod || 'QR payment',
        paymentdate: new Date().toISOString(),
        receipt_url: path
      };
      var paymentResult = await supabase.from('tbl_payment').insert(payment);
      if (paymentResult.error) {
        await supabase.storage.from('payment-receipts').remove([path]);
        throw paymentResult.error;
      }

      form.reset();
      showStatus('Receipt submitted. Your payment is pending verification.');
      setTimeout(function () {
        document.getElementById('payment-modal').close();
      }, 1200);
    } catch (error) {
      console.error(error);
      showStatus(error.message || 'Unable to submit your receipt.', true);
    } finally {
      button.disabled = false;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    var form = document.getElementById('payment-form');
    if (form) form.addEventListener('submit', submitPayment);
  });
})();
