import { useState } from 'react';
import { useAuthStore } from '../stores';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState('login'); // 'login' | 'register' | 'recover'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryCode, setRecoveryCode] = useState('');
  const { login, register, error, completeLogin, recoverPassword } = useAuthStore();
  const [submitting, setSubmitting] = useState(false);
  const [recoveryCodeData, setRecoveryCodeData] = useState(null);
  const [copiedRecoveryCode, setCopiedRecoveryCode] = useState(false);

  const handleCopyRecoveryCode = async () => {
    if (!recoveryCodeData?.code) return;
    try {
      await navigator.clipboard.writeText(recoveryCodeData.code);
      setCopiedRecoveryCode(true);
      setTimeout(() => setCopiedRecoveryCode(false), 1500);
    } catch (err) {
      setCopiedRecoveryCode(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    if (isLogin === 'register' && password !== confirmPassword) {
      useAuthStore.setState({ error: 'Passwords do not match' });
      setSubmitting(false);
      return;
    }

    if (isLogin === 'recover' && password !== confirmPassword) {
      useAuthStore.setState({ error: 'New passwords do not match' });
      setSubmitting(false);
      return;
    }

    if (isLogin === 'login') {
      await login(username, password);
    } else if (isLogin === 'register') {
      const res = await register(username, password);
      if (res.success) {
        setRecoveryCodeData({ token: res.token, user: res.user, code: res.recoveryCode });
      }
    } else if (isLogin === 'recover') {
      const result = await recoverPassword(username, recoveryCode, password);
      if (result.success) {
        setIsLogin('login');
      }
    }
    setSubmitting(false);
  };

  if (recoveryCodeData) {
    return (
      <div className="auth-page">
        <div className="app-bg" />
        <div className="auth-card animate-in" style={{ maxWidth: 480 }}>
          <div className="auth-logo">
            <div className="auth-logo-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}>🔑</div>
            <h2 className="text-gradient">Secret Recovery Code</h2>
          </div>
          <div style={{ background: 'var(--bg-tertiary)', padding: 'var(--space-4)', borderRadius: 'var(--radius-md)', textAlign: 'center', marginBottom: 'var(--space-4)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', justifyContent: 'center' }}>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={handleCopyRecoveryCode}
              aria-label="Copy recovery code"
              title="Copy recovery code"
              style={{ minWidth: 'fit-content', padding: '0.5rem 0.75rem' }}
            >
              {copiedRecoveryCode ? 'Copied' : 'Copy'}
            </button>
            <p style={{ fontWeight: 'bold', fontSize: '1.25rem', letterSpacing: '2px', color: 'var(--text-primary)', margin: 0 }}>
              {recoveryCodeData.code}
            </p>
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-6)' }}>
            <p style={{ marginBottom: 'var(--space-2)' }}><strong>Save this code immediately.</strong> It is mathematically impossible for us to reset your password without it.</p>
            <p>Your cards are heavily secured. If you forget your password, this code is the <em>only</em> way to recover your account.</p>
          </div>
          <button
            className="btn btn-primary btn-lg w-full"
            onClick={() => completeLogin(recoveryCodeData.token, recoveryCodeData.user)}
          >
            I have saved this code
          </button>
        </div>
      </div>
    );
  }

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

          {isLogin === 'recover' && (
            <div className="input-group">
              <label htmlFor="auth-recovery-code">Recovery Code</label>
              <input
                id="auth-recovery-code"
                className="input"
                type="text"
                placeholder="XXXX-XXXX-XXXX"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value.toUpperCase())}
                required
              />
            </div>
          )}

          <div className="input-group">
            <label htmlFor="auth-password">{isLogin === 'recover' ? 'New Password' : 'Password'}</label>
            <input
              id="auth-password"
              className="input"
              type="password"
              placeholder={isLogin === 'recover' ? 'Enter new password' : 'Enter your password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin === 'login' ? 'current-password' : 'new-password'}
              required
            />
          </div>

          {isLogin !== 'login' && (
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
            ) : isLogin === 'login' ? (
              '🔐 Sign In'
            ) : isLogin === 'register' ? (
              '🚀 Create Account'
            ) : (
              '🔑 Reset Password'
            )}
          </button>
        </form>

        <div className="auth-footer" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {isLogin === 'login' ? (
            <>
              <div>
                Don't have an account?{' '}
                <button onClick={() => { setIsLogin('register'); useAuthStore.setState({ error: null }); }}>
                  Create one
                </button>
              </div>
              <div>
                Forgot password?{' '}
                <button onClick={() => { setIsLogin('recover'); useAuthStore.setState({ error: null }); }}>
                  Recover account
                </button>
              </div>
            </>
          ) : (
            <div>
              Back to{' '}
              <button onClick={() => { setIsLogin('login'); useAuthStore.setState({ error: null }); }}>
                Sign in
              </button>
            </div>
          )}
        </div>

        <div style={{ marginTop: 'var(--space-6)', textAlign: 'center' }}>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            🔒 Images are encrypted in your browser, then stored as unreadable data in your cloud account.
          </p>
        </div>
      </div>
    </div>
  );
}
