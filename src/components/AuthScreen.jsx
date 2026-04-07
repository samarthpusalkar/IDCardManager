import { useState } from 'react';
import { useAuthStore } from '../stores';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const { login, register, error } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (!isLogin && password !== confirmPassword) {
      useAuthStore.setState({ error: 'Passwords do not match' });
      setSubmitting(false);
      return;
    }

    if (isLogin) {
      await login(username, password);
    } else {
      await register(username, password);
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-page">
      <div className="app-bg" />
      <div className="auth-card animate-in">
        <div className="auth-logo">
          <div className="auth-logo-icon">🪪</div>
          <h2 className="text-gradient">CardComposer</h2>
          <p>Your identity cards, print-ready & secure</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              className="input"
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </div>

          <div className="input-group">
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {!isLogin && (
            <div className="input-group">
              <label htmlFor="auth-confirm-password">Confirm Password</label>
              <input
                id="auth-confirm-password"
                className="input"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
              />
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary btn-lg w-full"
            disabled={submitting}
          >
            {submitting ? (
              <span className="spinner" />
            ) : isLogin ? (
              '🔐 Sign In'
            ) : (
              '🚀 Create Account'
            )}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? (
            <>
              Don't have an account?{' '}
              <button onClick={() => { setIsLogin(false); useAuthStore.setState({ error: null }); }}>
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button onClick={() => { setIsLogin(true); useAuthStore.setState({ error: null }); }}>
                Sign in
              </button>
            </>
          )}
        </div>

        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            🔒 All data is stored locally on your device. Nothing leaves your browser.
          </p>
        </div>
      </div>
    </div>
  );
}
