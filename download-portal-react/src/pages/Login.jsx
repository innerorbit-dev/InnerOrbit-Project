import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, EyeOff, AlertTriangle } from 'lucide-react';
import { sha256, MOCK_HASH } from '../lib/utils';
import { useAuth } from '../context/AuthContext';

import logoImg from '../assets/logos/innerorbit-logo.png';

export default function Login() {
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);

    const { login } = useAuth();
    const navigate = useNavigate();

    // Auto-focus logic
    useEffect(() => {
        // Small delay to ensure render
        const timer = setTimeout(() => {
            document.getElementById('password')?.focus();
        }, 100);
        return () => clearTimeout(timer);
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!password.trim()) return;

        setLoading(true);

        try {
            const hash = await sha256(password.trim());

            // MOCK AUTH BYPASS: Verify against local hash instead of Firestore
            if (hash === MOCK_HASH) {
                // Success
                setShowSuccess(true);
                // Delay navigation to allow animation to start
                setTimeout(() => {
                    login(); // Updates auth state
                    navigate('/portal');
                }, 1500);
            } else {
                setError('Access denied. Please check your credentials.');
                setLoading(false);
            }
        } catch (err) {
            console.error('Login error:', err);
            setError('System error. Please try again later.');
            setLoading(false);
        }
    };

    return (
        <div className="page-login">
            {/* Background provided by index.css (.page-login::before/after) */}

            <AnimatePresence>
                {!showSuccess ? (
                    <motion.div
                        className="login-container"
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, filter: 'blur(10px)' }}
                        transition={{ duration: 0.5 }}
                    >
                        <div className="login-header">
                            <h1>InnerOrbit Portal</h1>
                            <p>Access your secure download portal. Enter your credentials to continue.</p>
                        </div>

                        <form onSubmit={handleSubmit} className="password-form">
                            {error && (
                                <motion.div
                                    className="error-message"
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    {error}
                                </motion.div>
                            )}

                            <div className="input-group">
                                <label htmlFor="password">Access Password</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="Enter authentication key"
                                        autoComplete="off"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="password-toggle"
                                        onClick={() => setShowPassword(!showPassword)}
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                className="submit-btn"
                                disabled={loading}
                            >
                                {loading ? 'Verifying...' : 'Access Portal'}
                            </button>

                            <div className="security-notice">
                                <div className="icon"><AlertTriangle size={20} color="#dc2626" /></div>
                                <div className="title">Restricted Access</div>
                                <div className="text">
                                    This portal is password protected. Only authorized users can access downloads.
                                </div>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    /* Success State - Icon Pop & Travel */
                    <motion.div
                        className="portal-icon-container"
                        style={{
                            position: 'fixed',
                            top: '50%',
                            left: '50%',
                            transform: 'translate(-50%, -50%)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            zIndex: 2000
                        }}
                    >
                        <motion.img
                            src={logoImg}
                            alt="Access Granted"
                            className="portal-icon"
                            layoutId="logo" /* MAGIC: Shared layout ID for travel animation */
                            initial={{ scale: 0, opacity: 0, rotateX: 20 }}
                            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                            transition={{
                                type: "spring",
                                stiffness: 300,
                                damping: 20,
                                duration: 0.8
                            }}
                            style={{
                                width: 120,
                                marginBottom: 20,
                                filter: 'drop-shadow(0 0 30px rgba(59, 130, 246, 0.8))'
                            }}
                        />
                        <motion.div
                            className="portal-text"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            style={{
                                fontFamily: 'Inter',
                                fontSize: 16,
                                letterSpacing: 4,
                                color: 'rgba(255, 255, 255, 0.8)',
                                textTransform: 'uppercase'
                            }}
                        >
                            Access Granted
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <div className="page-footer">
                &copy; 2026 InnerOrbit. All rights reserved.<br />
                <a href="#">Privacy Policy</a> |
                <a href="#">Terms of Service</a>
            </div>
        </div>
    );
}
