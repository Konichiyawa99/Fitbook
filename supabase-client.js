(function () {
  'use strict';

  var url = window.GTG_SUPABASE_URL;
  var key = window.GTG_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key || url.indexOf('YOUR_') !== -1 || key.indexOf('YOUR_') !== -1) {
    window.GTG_SUPABASE_READY = false;
    window.GTG_SUPABASE_ERROR = 'Supabase is not configured.';
    return;
  }

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    window.GTG_SUPABASE_READY = false;
    window.GTG_SUPABASE_ERROR = 'Supabase library could not be loaded.';
    return;
  }

  window.GTG_SUPABASE = window.supabase.createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
  window.GTG_SUPABASE_READY = true;
})();
