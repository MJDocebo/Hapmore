import { useState } from 'react';
import { supabase, supabaseConfigured, usernameToEmail } from '../lib/supabase';
import { Loader } from '../components/icons';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: usernameToEmail(username), password });
    setBusy(false);
    if (err) setError(err.message === 'Invalid login credentials' ? 'Wrong username or password.' : err.message);
  };

  return (
    <div className="login">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <img src="/logo.png" alt="" width="36" height="36" />
          <div>
            <h1 className="brand-name">str(notes)</h1>
            <p className="muted">Notes for courses, projects and research</p>
          </div>
        </div>
        {!supabaseConfigured && (
          <div className="alert is-error">
            Supabase isn’t configured. Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your environment and
            redeploy.
          </div>
        )}
        <label className="field">
          <span>Username</span>
          <input className="input" autoComplete="username" autoFocus value={username} onChange={(e) => setUsername(e.target.value)} />
        </label>
        <label className="field">
          <span>Password</span>
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="alert is-error">{error}</div>}
        <button className="btn primary block" type="submit" disabled={busy || !supabaseConfigured}>
          {busy ? <Loader size={16} className="spin" /> : 'Sign in'}
        </button>
        <p className="login-foot muted">Accounts are created by the administrator. There’s no public sign-up.</p>
      </form>
    </div>
  );
}
