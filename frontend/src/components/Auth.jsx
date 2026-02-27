import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import './Auth.css';

const Auth = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    
    // --- FIX: Gatekeeper to prevent React Strict Mode double-firing ---
    const hasProcessedAuth = useRef(false);

    useEffect(() => {
        const googleUsername = searchParams.get('googleUsername');
        
        if (googleUsername && !hasProcessedAuth.current) {
            hasProcessedAuth.current = true; // Lock the gate
            
            localStorage.setItem('vylop_username', googleUsername);
            
            // The 'id' forces the toast library to only show this once
            toast.success('Successfully logged in with Google! 🚀', {
                id: 'google-login-toast'
            });
            
            navigate('/');
        }
    }, [searchParams, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
        const payload = isLogin ? { username, password } : { username, email, password };

        try {
            const response = await axios.post(`http://localhost:8080${endpoint}`, payload);
            
            if (response.data.includes("successful")) {
                localStorage.setItem('vylop_username', username);
                toast.success(response.data);
                navigate('/');
            } else {
                toast.error(response.data);
            }
        } catch (error) {
            toast.error(error.response?.data || "An error occurred during authentication.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = () => {
        window.location.href = 'http://localhost:8080/oauth2/authorization/google';
    };

    return (
        <div className="auth-container">
            <Toaster position="top-center" toastOptions={{ style: { background: '#333', color: '#fff' } }}/>
            <div className="auth-card">
                
                <div className="auth-logo">
                    <span className="logo-accent">&gt;</span> Vylop <span className="logo-accent">_</span>
                </div>

                <div className="auth-header">
                    <h2>{isLogin ? 'Welcome Back' : 'Create an account'}</h2>
                    <p className="auth-subtitle">
                        {isLogin ? 'Log in to access your coding workspaces.' : 'Join the real-time collaborative IDE.'}
                    </p>
                </div>

                <form className="auth-form" onSubmit={handleSubmit}>
                    <div className="modal-field">
                        <label>Username</label>
                        <input 
                            type="text" 
                            className="modern-input" 
                            placeholder="e.g. dev_ninja"
                            value={username} 
                            onChange={(e) => setUsername(e.target.value)} 
                            required 
                            autoFocus
                        />
                    </div>

                    {!isLogin && (
                        <div className="modal-field">
                            <label>Email address</label>
                            <input 
                                type="email" 
                                className="modern-input" 
                                placeholder="e.g. ninja@vylop.com"
                                value={email} 
                                onChange={(e) => setEmail(e.target.value)} 
                                required 
                            />
                        </div>
                    )}

                    <div className="modal-field">
                        <label>Password</label>
                        <input 
                            type="password" 
                            className="modern-input" 
                            placeholder="••••••••"
                            value={password} 
                            onChange={(e) => setPassword(e.target.value)} 
                            required 
                        />
                    </div>

                    <button type="submit" className="auth-submit-btn" disabled={isLoading}>
                        {isLoading ? 'Processing...' : (isLogin ? 'Login' : 'Sign up')}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>or</span>
                </div>

                <button type="button" className="google-auth-btn" onClick={handleGoogleLogin}>
                    <svg viewBox="0 0 24 24" width="18" height="18" xmlns="http://www.w3.org/2000/svg">
                        <g transform="matrix(1, 0, 0, 1, 27.009001, -39.238998)">
                            <path fill="#4285F4" d="M -3.264 51.509 C -3.264 50.719 -3.334 49.969 -3.454 49.239 L -14.754 49.239 L -14.754 53.749 L -8.284 53.749 C -8.574 55.229 -9.424 56.479 -10.684 57.329 L -10.684 60.329 L -6.824 60.329 C -4.564 58.239 -3.264 55.159 -3.264 51.509 Z"/>
                            <path fill="#34A853" d="M -14.754 63.239 C -11.514 63.239 -8.804 62.159 -6.824 60.329 L -10.684 57.329 C -11.764 58.049 -13.134 58.489 -14.754 58.489 C -17.884 58.489 -20.534 56.379 -21.484 53.529 L -25.464 53.529 L -25.464 56.619 C -23.494 60.539 -19.444 63.239 -14.754 63.239 Z"/>
                            <path fill="#FBBC05" d="M -21.484 53.529 C -21.734 52.809 -21.864 52.039 -21.864 51.239 C -21.864 50.439 -21.724 49.669 -21.484 48.949 L -21.484 45.859 L -25.464 45.859 C -26.284 47.479 -26.754 49.299 -26.754 51.239 C -26.754 53.179 -26.284 54.999 -25.464 56.619 L -21.484 53.529 Z"/>
                            <path fill="#EA4335" d="M -14.754 43.989 C -12.984 43.989 -11.404 44.599 -10.154 45.789 L -6.734 42.369 C -8.804 40.429 -11.514 39.239 -14.754 39.239 C -19.444 39.239 -23.494 41.939 -25.464 45.859 L -21.484 48.949 C -20.534 46.099 -17.884 43.989 -14.754 43.989 Z"/>
                        </g>
                    </svg>
                    Continue with Google
                </button>

                <div className="auth-footer">
                    <p>
                        {isLogin ? "Don't have an account? " : "Already have an account? "}
                        <span className="auth-toggle-link" onClick={() => setIsLogin(!isLogin)}>
                            {isLogin ? 'Sign up' : 'Log in'}
                        </span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Auth;