(() => {
  const config = window.FINTRACK_SUPABASE_CONFIG;
  const client = window.supabase.createClient(config.url, config.publishableKey);
  window.fintrackSupabase = client;
  const shell = document.querySelector('.app-shell');
  const gate = document.createElement('section');
  gate.id = 'auth-gate';
  gate.innerHTML = `<div class="auth-card"><span class="brand-name">fintrack<span>.</span></span><p class="eyebrow">YOUR PRIVATE WORKSPACE</p><h1 id="auth-title">Sign in to FinTrack</h1><p class="auth-copy">Use your account to open your expense records.</p><form id="auth-form"><label class="field-label" for="auth-email">Email</label><input id="auth-email" class="text-field" type="email" autocomplete="email" required><label class="field-label" for="auth-password">Password</label><input id="auth-password" class="text-field" type="password" autocomplete="current-password" minlength="8" required><label class="field-label auth-name-label" for="auth-name" hidden>Your name</label><input id="auth-name" class="text-field auth-name-input" autocomplete="name" hidden><p class="auth-error" id="auth-error" role="alert"></p><button class="button button-primary auth-submit" type="submit">Sign in</button></form><button type="button" class="auth-switch" id="auth-switch">Create an account</button></div>`;
  document.body.prepend(gate);
  shell.hidden = true;
  let mode = 'signin';
  const showGate = (message = '') => { gate.hidden = false; shell.hidden = true; document.querySelector('#auth-error').textContent = message; };
  const showApp = () => {
    gate.hidden = true; shell.hidden = false;
    if (!document.querySelector('#supabase-signout')) {
      const button = document.createElement('button'); button.id = 'supabase-signout'; button.className = 'auth-switch'; button.textContent = 'Sign out';
      document.querySelector('.sidebar-bottom')?.append(button);
      button.addEventListener('click', async () => { const { error } = await client.auth.signOut(); if (error) showGate(error.message); });
    }
  };
  document.querySelector('#auth-switch').addEventListener('click', () => {
    mode = mode === 'signin' ? 'signup' : 'signin';
    document.querySelector('#auth-title').textContent = mode === 'signin' ? 'Sign in to FinTrack' : 'Create your account';
    document.querySelector('.auth-submit').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
    document.querySelector('#auth-switch').textContent = mode === 'signin' ? 'Create an account' : 'Already have an account? Sign in';
    document.querySelector('.auth-name-label').hidden = mode !== 'signup';
    document.querySelector('.auth-name-input').hidden = mode !== 'signup';
    document.querySelector('#auth-password').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
  });
  document.querySelector('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = document.querySelector('.auth-submit'); button.disabled = true;
    document.querySelector('#auth-error').textContent = '';
    const email = document.querySelector('#auth-email').value.trim();
    const password = document.querySelector('#auth-password').value;
    const result = mode === 'signin'
      ? await client.auth.signInWithPassword({ email, password })
      : await client.auth.signUp({ email, password, options: { data: { full_name: document.querySelector('#auth-name').value.trim() } } });
    button.disabled = false;
    if (result.error) { document.querySelector('#auth-error').textContent = result.error.message; return; }
    if (mode === 'signup' && !result.data.session) { document.querySelector('#auth-error').textContent = 'Check your email to confirm your account, then sign in.'; return; }
    await startApp(result.data.session?.user || result.data.user);
  });
  async function startApp(user) {
    if (!user) return showGate();
    try {
      await window.initializeFinTrackFromSupabase(user);
      showApp();
    } catch (error) {
      console.error('Could not load FinTrack data', error);
      showGate(`Could not load your account data: ${error.message}`);
    }
  }
  client.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT') showGate();
    if (event === 'SIGNED_IN' && session?.user) startApp(session.user);
  });
  client.auth.getSession().then(({ data, error }) => error ? showGate(error.message) : startApp(data.session?.user));
})();


