import { useState } from 'react';
import { authAPI } from '../services/api.js';

export default function AuthPage({ onAuth }) {
    const [mode, setMode]       = useState('login');   // 'login' | 'register'
    const [name, setName]       = useState('');
    const [email, setEmail]     = useState('');
    const [password, setPassword] = useState('');
    const [error, setError]     = useState('');
    const [loading, setLoading] = useState(false);

    const isRegister = mode === 'register';

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!email.trim() || !password.trim()) {
            setError('Email and password are required.');
            return;
        }
        if (isRegister && !name.trim()) {
            setError('Please enter your name.');
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            const data = isRegister
                ? await authAPI.register({ name: name.trim(), email: email.trim(), password })
                : await authAPI.login({ email: email.trim(), password });

            onAuth(data.user);
        } catch (err) {
            setError(err.message || 'Something went wrong. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const switchMode = () => {
        setMode(m => m === 'login' ? 'register' : 'login');
        setError('');
        setName('');
        setEmail('');
        setPassword('');
    };

    return (
        <div className="auth-overlay">
            <div className="auth-card">

                {/* Logo */}
                <div className="auth-logo">
                    <div className="auth-logo-icon">C</div>
                    <span className="auth-logo-text">CuraLink</span>
                </div>

                {/* Heading */}
                <h1 className="auth-title">
                    {isRegister ? 'Create an account' : 'Welcome back'}
                </h1>
                <p className="auth-subtitle">
                    {isRegister
                        ? 'Start your AI-powered medical research'
                        : 'Sign in to continue your research'}
                </p>

                {/* Form */}
                <form className="auth-form" onSubmit={handleSubmit} noValidate>
                    {isRegister && (
                        <div className="auth-field">
                            <label className="auth-label" htmlFor="auth-name">Full Name</label>
                            <input
                                id="auth-name"
                                className="auth-input"
                                type="text"
                                placeholder="Dr. Jane Smith"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                autoComplete="name"
                                autoFocus={isRegister}
                            />
                        </div>
                    )}

                    <div className="auth-field">
                        <label className="auth-label" htmlFor="auth-email">Email</label>
                        <input
                            id="auth-email"
                            className="auth-input"
                            type="email"
                            placeholder="you@example.com"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            autoComplete="email"
                            autoFocus={!isRegister}
                        />
                    </div>

                    <div className="auth-field">
                        <label className="auth-label" htmlFor="auth-password">Password</label>
                        <input
                            id="auth-password"
                            className="auth-input"
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            autoComplete={isRegister ? 'new-password' : 'current-password'}
                        />
                    </div>

                    {error && <div className="auth-error">{error}</div>}

                    <button
                        id="auth-submit-btn"
                        className="auth-btn"
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? (isRegister ? 'Creating account…' : 'Signing in…')
                            : (isRegister ? 'Create Account' : 'Sign In')}
                    </button>
                </form>

                {/* Switch mode */}
                <p className="auth-switch">
                    {isRegister ? 'Already have an account? ' : "Don't have an account? "}
                    <button className="auth-switch-btn" type="button" onClick={switchMode}>
                        {isRegister ? 'Sign in' : 'Create one'}
                    </button>
                </p>

                <p className="auth-disclaimer">
                    🔒 CuraLink does not store or share your medical queries.
                    Always consult a qualified healthcare professional.
                </p>
            </div>
        </div>
    );
}
