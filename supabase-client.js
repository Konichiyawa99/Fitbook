(function () {
  window.supabaseClient = window.supabase.createClient(
    'https://vakbrmozgbgeskiikjib.supabase.co',
    'sb_publishable_AZjlCnUY6C7TN3w2g6oNNA_F62mMaKP'
  );

  window.sendMessage = async function (name, email, message) {
    const { error } = await window.supabaseClient
      .from('contact_messages')
      .insert({ name, email, message });

    if (error) {
      throw error;
    }
  };
})();
