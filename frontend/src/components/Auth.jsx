import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import './Auth.css';

// Production Backend URL
const API_BASE_URL = 'https://vylop.onrender.com';

const Auth = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: ''
  });

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const googleUsername = searchParams.get("googleUsername");
    if (googleUsername) {
      localStorage.setItem("username", googleUsername);
      localStorage.setItem("loginType", "google");
      toast.success("Successfully logged in with Google!");
      window.location.href = "/";
    }
  }, [searchParams]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin
      ? { username: formData.username, password: formData.password }
      : formData;

    try {
      const res = await axios.post(`${API_BASE_URL}${endpoint}`, payload);
      localStorage.setItem('username', res.data.username);
      toast.success(isLogin ? 'Welcome back!' : 'Account created successfully!');
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (error) {
      console.error("Auth Error:", error);
      toast.error(error.response?.data?.error || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = `${API_BASE_URL}/oauth2/authorization/google`;
  };

  return (
    <div className="auth-container">
      <div className="auth-card">

        <div className="auth-logo">
          &lt;/&gt; <span className="logo-accent">Vylop</span>
        </div>

        <div className="auth-header">
          <h2>{isLogin ? 'Welcome Back' : 'Create Account'}</h2>
          <p className="auth-subtitle">
            {isLogin ? 'Enter your credentials to access your workspace' : 'Start your coding journey with us today'}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="modal-field">
              <label>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="modern-input"
                placeholder="name@example.com"
                required={!isLogin}
              />
            </div>
          )}

          <div className="modal-field">
            <label>Username</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="modern-input"
              placeholder="Enter your username"
              required
            />
          </div>

          <div className="modal-field">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="modern-input"
              placeholder="••••••••"
              required
            />
          </div>

          <button type="submit" className="auth-submit-btn" disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" style={{margin: '0 auto'}} /> : (isLogin ? 'Sign In →' : 'Create Account →')}
          </button>
        </form>

        <div className="auth-divider"><span>Or continue with</span></div>

        <button onClick={handleGoogleLogin} className="google-auth-btn">
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
            <path d="M12 4.63c1.61 0 3.06.56 4.21 1.64l3.16-3.16C17.45 1.14 14.97 0 12 0 7.7 0 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
          </svg>
          Google
        </button>

        <p className="auth-footer">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <span className="auth-toggle-link" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? 'Sign up' : 'Log in'}
          </span>
        </p>

      </div>
    </div>
  );
};

export default Auth;