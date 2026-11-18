(() => {
  const shell = document.querySelector('.app-shell');
  const landing = document.querySelector('#landing-page');
  const landingStatus = document.querySelector('#landing-status');
  const gate = document.createElement('section');
  gate.id = 'auth-gate';
  gate.hidden = true;
  gate.innerHTML = `<div class="auth-card"><span class="brand-name">fintrack<span>.</span></span><p class="eyebrow">YOUR PRIVATE WORKSPACE</p><h1 id="auth-title">Sign in to FinTrack</h1><p class="auth-copy">Use your account to open your expense records.</p><form id="auth-form"><label class="field-label" for="auth-email">Email</label><input id="auth-email" class="text-field" type="email" autocomplete="email" required><label class="field-label" for="auth-password">Password</label><input id="auth-password" class="text-field" type="password" autocomplete="current-password" minlength="8" required><label class="field-label auth-name-label" for="auth-name" hidden>Your name</label><input id="auth-name" class="text-field auth-name-input" autocomplete="name" hidden><p class="auth-error" id="auth-error" role="alert" aria-live="polite"></p><button class="button button-primary auth-submit" type="submit">Sign in</button></form><button type="button" class="auth-switch" id="auth-switch">Create an account</button><button type="button" class="auth-switch auth-home" id="auth-home">Back to home</button></div>`;
  document.body.prepend(gate);
  shell.hidden = true;
  let mode = 'signin';
  let client = null;
  let activeLoad = null;
  let activeUserId = '';
  let loadedUserId = '';

  function updateMode(nextMode) {
    mode = nextMode === 'signup' ? 'signup' : 'signin';
    document.querySelector('#auth-title').textContent = mode === 'signin' ? 'Sign in to FinTrack' : 'Create your account';
    document.querySelector('.auth-submit').textContent = mode === 'signin' ? 'Sign in' : 'Create account';
    document.querySelector('#auth-switch').textContent = mode === 'signin' ? 'Create an account' : 'Already have an account? Sign in';
    document.querySelector('.auth-name-label').hidden = mode !== 'signup';
    document.querySelector('.auth-name-input').hidden = mode !== 'signup';
    document.querySelector('#auth-password').autocomplete = mode === 'signin' ? 'current-password' : 'new-password';
    document.querySelector('#auth-error').textContent = '';
  }

  function showLanding(message = '') {
    gate.hidden = true;
    shell.hidden = true;
    landing.hidden = false;
    landingStatus.hidden = !message;
    landingStatus.textContent = message;
  }

  function showGate(message = '') {
    landing.hidden = true;
    landingStatus.hidden = true;
    gate.hidden = false;
    shell.hidden = true;
    document.querySelector('#auth-error').textContent = message;
  }

  function showApp() {
    landing.hidden = true;
    landingStatus.hidden = true;
    gate.hidden = true;
    shell.hidden = false;
    if (!document.querySelector('#supabase-signout')) {
      const button = document.createElement('button');
      button.id = 'supabase-signout'; button.className = 'auth-switch'; button.textContent = 'Sign out';
      document.querySelector('.sidebar-bottom')?.append(button);
      button.addEventListener('click', async () => {
        button.disabled = true;
        try {
          const { error } = await client.auth.signOut();
          if (error) throw error;
        } catch (error) {
          button.disabled = false;
          showGate(`Could not sign out: ${error.message || 'Please try again.'}`);
        }
      });
    }
  }

  document.addEventListener('click', (event) => {
    const authAction = event.target.closest('[data-auth-mode]');
    if (authAction) {
      updateMode(authAction.dataset.authMode);
      showGate();
    }
    if (event.target.closest('#auth-home')) showLanding();
  });
  document.querySelector('#auth-switch').addEventListener('click', () => updateMode(mode === 'signin' ? 'signup' : 'signin'));

  async function startApp(user) {
    if (!user) { showLanding(); return; }
    if (loadedUserId === user.id && !shell.hidden) return;
    if (activeLoad && activeUserId === user.id) return activeLoad;
    activeUserId = user.id;
    landingStatus.hidden = false;
    landingStatus.textContent = 'Opening your private workspace…';
    activeLoad = (async () => {
      try {
        await window.initializeFinTrackFromSupabase(user);
        loadedUserId = user.id;
        showApp();
      } catch (error) {
        console.error('Could not load FinTrack data', error);
        showGate(`Could not load your account data. Your records were not replaced with sample data. ${error.message || 'Please try again.'}`);
      } finally {
        activeLoad = null;
        activeUserId = '';
      }
    })();
    return activeLoad;
  }

  document.querySelector('#auth-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    if (form.dataset.submitting === 'true' || !form.reportValidity()) return;
    form.dataset.submitting = 'true';
    const button = document.querySelector('.auth-submit');
    button.disabled = true;
    document.querySelector('#auth-error').textContent = '';
    try {
      if (!client) throw new Error('The sign-in service is unavailable. Check your connection and try again.');
      const email = document.querySelector('#auth-email').value.trim();
      const password = document.querySelector('#auth-password').value;
      const result = mode === 'signin'
        ? await client.auth.signInWithPassword({ email, password })
        : await client.auth.signUp({ email, password, options: { data: { full_name: document.querySelector('#auth-name').value.trim() } } });
      if (result.error) throw result.error;
      if (mode === 'signup' && !result.data.session) {
        document.querySelector('#auth-error').textContent = 'Check your email to confirm your account, then sign in.';
        return;
      }
      await startApp(result.data.session?.user || result.data.user);
    } catch (error) {
      document.querySelector('#auth-error').textContent = error?.message || 'Sign-in failed. Please try again.';
    } finally {
      delete form.dataset.submitting;
      button.disabled = false;
    }
  });

  try {
    const config = window.FINTRACK_SUPABASE_CONFIG;
    if (!window.supabase?.createClient || !config?.url || !config?.publishableKey) throw new Error('The sign-in service is not configured.');
    client = window.supabase.createClient(config.url, config.publishableKey);
    window.fintrackSupabase = client;
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT') { loadedUserId = ''; showLanding(); }
      if (event === 'SIGNED_IN' && session?.user) void startApp(session.user);
    });
    client.auth.getSession().then(({ data, error }) => {
      if (error) { showLanding(`Could not check your saved sign-in. Your financial data has not been loaded. ${error.message}`); return; }
      return startApp(data.session?.user);
    }).catch((error) => showLanding(`Could not check your saved sign-in. Your financial data has not been loaded. ${error.message || 'Please try again.'}`));
  } catch (error) {
    showLanding(`Sign-in is unavailable right now. Your financial data has not been loaded. ${error.message}`);
  }
})();
