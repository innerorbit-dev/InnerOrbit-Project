import { Twitter, Github, MessageSquare, Sun, Moon, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { Link } from 'react-router-dom';

export default function Footer() {
    const { theme, setTheme } = useTheme();

    return (
        <footer className="bg-footer" style={{ position: 'relative', padding: '6rem 0 2rem', overflow: 'hidden' }}>
            <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4rem', marginBottom: '4rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.5rem' }}>
                            InnerOrbit
                        </div>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
                            Redefining privacy in the digital age.
                            Secure, fast, and completely anonymous.
                        </p>

                        {/* Theme Toggles */}
                        <div style={{ display: 'flex', gap: '8px', background: 'var(--bg-primary)', padding: '6px', borderRadius: '12px', width: 'fit-content', border: '1px solid var(--border-color)' }}>
                            <button
                                onClick={() => setTheme('system')}
                                title="System Default"
                                style={{
                                    background: theme === 'system' ? 'var(--bg-secondary)' : 'transparent',
                                    color: theme === 'system' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                    border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex'
                                }}
                            >
                                <Monitor size={18} />
                            </button>
                            <button
                                onClick={() => setTheme('light')}
                                title="Light Mode"
                                style={{
                                    background: theme === 'light' ? 'var(--bg-secondary)' : 'transparent',
                                    color: theme === 'light' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                    border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex'
                                }}
                            >
                                <Sun size={18} />
                            </button>
                            <button
                                onClick={() => setTheme('dark')}
                                title="Dark Mode"
                                style={{
                                    background: theme === 'dark' ? 'var(--bg-secondary)' : 'transparent',
                                    color: theme === 'dark' ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                    border: 'none', padding: '8px', borderRadius: '8px', cursor: 'pointer', display: 'flex'
                                }}
                            >
                                <Moon size={18} />
                            </button>
                        </div>
                    </div>

                    <div>
                        <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '1.5rem' }}>Product</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Features</a>
                            <a href="#download" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Download</a>
                            <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Changelog</a>
                        </div>
                    </div>

                    <div>
                        <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '1.5rem' }}>Legal</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <Link to="/privacy-policy" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Privacy Policy</Link>
                            <Link to="/terms-of-service" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Terms of Service</Link>
                            <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Security</a>
                        </div>
                    </div>

                    <div>
                        <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '1.5rem' }}>Connect</h4>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {[
                                { id: 'x', icon: <Twitter size={20} /> },
                                { id: 'gh', icon: <Github size={20} /> },
                                { id: 'dc', icon: <MessageSquare size={20} /> }
                            ].map(social => (
                                <a key={social.id} href="#" className="icon-hover" style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: 'rgba(15, 23, 42, 0.05)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-primary)', textDecoration: 'none',
                                    border: '1px solid var(--border-color)'
                                }}>
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{
                    paddingTop: '2rem',
                    textAlign: 'center',
                    color: 'var(--text-secondary)',
                    fontSize: '0.9rem'
                }}>
                    © 2026 InnerOrbit Inc. All rights reserved.
                </div>
            </div>
        </footer>
    );
}
