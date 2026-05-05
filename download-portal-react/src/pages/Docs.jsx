import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
    Search,
    Book,
    Rocket,
    Shield,
    Smartphone,
    Monitor,
    Globe,
    MessageCircle,
    Lock,
    Eye,
    ChevronRight,
    ChevronDown,
    Github,
    ExternalLink,
    HelpCircle,
    Terminal,
    AlertTriangle,
    CheckCircle
} from 'lucide-react';
import './Docs.css';
import logoImg from '../assets/logos/innerorbit-logo.png';

const Docs = () => {
    const [scrolled, setScrolled] = useState(false);
    const [activeSection, setActiveSection] = useState('overview');
    const [openGroups, setOpenGroups] = useState({
        'getting-started': true,
        'account': false,
        'platforms': false,
        'features': false,
        'security': false,
        'resources': false,
        'updates': false
    });
    const [activeTab, setActiveTab] = useState('mobile');

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);

            const sections = [
                'overview', 'features', 'installation', 'mobile-guide',
                'web-guide', 'desktop-guide', 'quickstart', 'account',
                'messaging', 'security', 'privacy', 'encryption',
                'faq', 'troubleshooting', 'contact', 'release-notes'
            ];

            let current = sections[0];
            for (const section of sections) {
                const element = document.getElementById(section);
                if (element) {
                    const rect = element.getBoundingClientRect();
                    if (rect.top <= 150) {
                        current = section;
                    }
                }
            }
            setActiveSection(current);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const toggleGroup = (group) => {
        setOpenGroups(prev => ({
            ...prev,
            [group]: !prev[group]
        }));
    };

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            window.scrollTo({
                top: element.offsetTop - 80,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div className="docs-page">
            {/* Top Navigation */}
            <header className={`docs-header ${scrolled ? 'scrolled' : ''}`}>
                <div className="header-container">
                    <Link to="/" className="docs-logo">
                        <img src={logoImg} alt="InnerOrbit" className="logo-img" />
                        <span>Docs</span>
                    </Link>
                    <div className="header-actions">
                        <Link to="/" className="btn-secondary">Back to Portal</Link>
                        <a href="https://github.com/innerorbit" target="_blank" rel="noopener noreferrer" className="btn-primary">
                            <Github size={16} style={{ marginRight: '8px' }} />
                            GitHub
                        </a>
                    </div>
                </div>
            </header>

            <div className="docs-wrapper">
                {/* Sidebar Navigation */}
                <aside className="docs-sidebar">
                    <div className="search-container">
                        <div className="search-inner">
                            <Search size={16} className="search-icon" />
                            <input type="text" placeholder="Search documentation..." className="search-input" />
                        </div>
                    </div>

                    <nav className="sidebar-nav" style={{ paddingTop: '1rem' }}>
                        <div className="nav-group">
                            <button className={`nav-toggle ${openGroups['getting-started'] ? 'active' : ''}`} onClick={() => toggleGroup('getting-started')}>
                                <span><Rocket size={16} style={{ marginRight: '10px', opacity: 0.7 }} /> Getting Started</span>
                                {openGroups['getting-started'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <div className={`nav-dropdown ${openGroups['getting-started'] ? 'active' : ''}`}>
                                <a onClick={() => scrollToSection('overview')} className={`nav-link ${activeSection === 'overview' ? 'active' : ''}`}>Overview</a>
                                <a onClick={() => scrollToSection('features')} className={`nav-link ${activeSection === 'features' ? 'active' : ''}`}>Features</a>
                                <a onClick={() => scrollToSection('installation')} className={`nav-link ${activeSection === 'installation' ? 'active' : ''}`}>Installation</a>
                                <a onClick={() => scrollToSection('quickstart')} className={`nav-link ${activeSection === 'quickstart' ? 'active' : ''}`}>Quick Setup</a>
                            </div>
                        </div>

                        <div className="nav-group">
                            <button className={`nav-toggle ${openGroups['account'] ? 'active' : ''}`} onClick={() => toggleGroup('account')}>
                                <span><Shield size={16} style={{ marginRight: '10px', opacity: 0.7 }} /> Account & Profile</span>
                                {openGroups['account'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <div className={`nav-dropdown ${openGroups['account'] ? 'active' : ''}`}>
                                <a onClick={() => scrollToSection('account')} className={`nav-link ${activeSection === 'account' ? 'active' : ''}`}>Account Setup</a>
                                <a onClick={() => scrollToSection('profile')} className={`nav-link`}>Profile Settings</a>
                                <a onClick={() => scrollToSection('account-security')} className={`nav-link`}>Account Security</a>
                            </div>
                        </div>

                        <div className="nav-group">
                            <button className={`nav-toggle ${openGroups['platforms'] ? 'active' : ''}`} onClick={() => toggleGroup('platforms')}>
                                <span><Monitor size={16} style={{ marginRight: '10px', opacity: 0.7 }} /> Platform Guides</span>
                                {openGroups['platforms'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <div className={`nav-dropdown ${openGroups['platforms'] ? 'active' : ''}`}>
                                <a onClick={() => scrollToSection('mobile-guide')} className={`nav-link ${activeSection === 'mobile-guide' ? 'active' : ''}`}>Mobile App</a>
                                <a onClick={() => scrollToSection('web-guide')} className={`nav-link ${activeSection === 'web-guide' ? 'active' : ''}`}>Web Portal</a>
                                <a onClick={() => scrollToSection('desktop-guide')} className={`nav-link ${activeSection === 'desktop-guide' ? 'active' : ''}`}>Desktop App</a>
                            </div>
                        </div>

                        <div className="nav-group">
                            <button className={`nav-toggle ${openGroups['features'] ? 'active' : ''}`} onClick={() => toggleGroup('features')}>
                                <span><MessageCircle size={16} style={{ marginRight: '10px', opacity: 0.7 }} /> Messaging & Features</span>
                                {openGroups['features'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <div className={`nav-dropdown ${openGroups['features'] ? 'active' : ''}`}>
                                <a onClick={() => scrollToSection('messaging')} className={`nav-link ${activeSection === 'messaging' ? 'active' : ''}`}>Messaging Guide</a>
                                <a onClick={() => scrollToSection('stealth')} className={`nav-link`}>Stealth Mode</a>
                                <a onClick={() => scrollToSection('media')} className={`nav-link`}>Media & Files</a>
                            </div>
                        </div>

                        <div className="nav-group">
                            <button className={`nav-toggle ${openGroups['security'] ? 'active' : ''}`} onClick={() => toggleGroup('security')}>
                                <span><Lock size={16} style={{ marginRight: '10px', opacity: 0.7 }} /> Privacy & Security</span>
                                {openGroups['security'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <div className={`nav-dropdown ${openGroups['security'] ? 'active' : ''}`}>
                                <a onClick={() => scrollToSection('security')} className={`nav-link ${activeSection === 'security' ? 'active' : ''}`}>Security Features</a>
                                <a onClick={() => scrollToSection('privacy')} className={`nav-link ${activeSection === 'privacy' ? 'active' : ''}`}>Privacy Controls</a>
                                <a onClick={() => scrollToSection('encryption')} className={`nav-link ${activeSection === 'encryption' ? 'active' : ''}`}>Encryption</a>
                            </div>
                        </div>

                        <div className="nav-group">
                            <button className={`nav-toggle ${openGroups['resources'] ? 'active' : ''}`} onClick={() => toggleGroup('resources')}>
                                Resources {openGroups['resources'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <div className={`nav-dropdown ${openGroups['resources'] ? 'active' : ''}`}>
                                <a onClick={() => scrollToSection('faq')} className={`nav-link ${activeSection === 'faq' ? 'active' : ''}`}>FAQ</a>
                                <a onClick={() => scrollToSection('troubleshooting')} className={`nav-link ${activeSection === 'troubleshooting' ? 'active' : ''}`}>Troubleshooting</a>
                                <a onClick={() => scrollToSection('contact')} className={`nav-link ${activeSection === 'contact' ? 'active' : ''}`}>Support</a>
                            </div>
                        </div>

                        <div className="nav-group">
                            <button className={`nav-toggle ${openGroups['updates'] ? 'active' : ''}`} onClick={() => toggleGroup('updates')}>
                                Updates & Versions {openGroups['updates'] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </button>
                            <div className={`nav-dropdown ${openGroups['updates'] ? 'active' : ''}`}>
                                <a onClick={() => scrollToSection('release-notes')} className={`nav-link ${activeSection === 'release-notes' ? 'active' : ''}`}>Release Notes</a>
                                <a href="#roadmap" className="nav-link">Feature Roadmap</a>
                            </div>
                        </div>
                    </nav>
                </aside>

                <main className="docs-content">
                    <div className="content-container">
                        <div className="breadcrumb">Docs / {activeSection.replace('-', ' ').toUpperCase()}</div>

                        {/* Overview */}
                        <section id="overview" className="doc-section hero-section">
                            <h1 className="page-title">Welcome to InnerOrbit</h1>
                            <p className="lead-text">Chat safely. Chat privately. No one will know.</p>

                            <div className="intro-description" style={{ marginBottom: '2rem', maxWidth: '700px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                InnerOrbit is a chat app that looks like a calculator or a game. It keeps your messages safe so only you and your friend can read them.
                            </div>

                            <div className="quick-links-grid">
                                <a onClick={() => scrollToSection('installation')} className="quick-link-card" style={{ cursor: 'pointer' }}>
                                    <div className="icon-box">🚀</div>
                                    <div>
                                        <h4>Get the App</h4>
                                        <p>Download for Phone or Computer</p>
                                    </div>
                                </a>
                                <a onClick={() => scrollToSection('features')} className="quick-link-card" style={{ cursor: 'pointer' }}>
                                    <div className="icon-box">✨</div>
                                    <div>
                                        <h4>Cool Features</h4>
                                        <p>Hidden Mode, Secret Chats</p>
                                    </div>
                                </a>
                                <a onClick={() => scrollToSection('security')} className="quick-link-card" style={{ cursor: 'pointer' }}>
                                    <div className="icon-box">🛡️</div>
                                    <div>
                                        <h4>Safety</h4>
                                        <p>How we keep you safe</p>
                                    </div>
                                </a>
                            </div>
                        </section>

                        <hr className="section-divider" />

                        {/* Features */}
                        <section id="features" className="doc-section">
                            <h2>Why Use InnerOrbit?</h2>
                            <p>We built this app to keep your secrets safe.</p>

                            <div className="features-grid">
                                <div className="feature-item">
                                    <div className="feature-icon-wrapper"><Lock size={24} /></div>
                                    <div className="feature-content">
                                        <h3>Private Messages</h3>
                                        <p>Only you and your friend can read your messages. We can't see them.</p>
                                    </div>
                                </div>

                                <div className="feature-item">
                                    <div className="feature-icon-wrapper"><Eye size={24} /></div>
                                    <div className="feature-content">
                                        <h3>Hidden Identity</h3>
                                        <p>You don't need a phone number or email. You get a random ID.</p>
                                    </div>
                                </div>

                                <div className="feature-item">
                                    <div className="feature-icon-wrapper"><HelpCircle size={24} /></div>
                                    <div className="feature-content">
                                        <h3>Disappearing Chats</h3>
                                        <p>Messages can delete themselves automatically after you read them.</p>
                                    </div>
                                </div>

                                <div className="feature-item">
                                    <div className="feature-icon-wrapper"><Smartphone size={24} /></div>
                                    <div className="feature-content">
                                        <h3>Works Everywhere</h3>
                                        <p>Use it on your iPhone, Android, or Computer.</p>
                                    </div>
                                </div>
                            </div>
                        </section>

                        <hr className="section-divider" />

                        {/* Installation */}
                        <section id="installation" className="doc-section">
                            <h2>Installation</h2>
                            <p>Select your platform to get started with InnerOrbit.</p>

                            <div className="tabs-container">
                                <div className="tabs-header">
                                    <button className={`tab-btn ${activeTab === 'mobile' ? 'active' : ''}`} onClick={() => setActiveTab('mobile')}>Mobile</button>
                                    <button className={`tab-btn ${activeTab === 'web' ? 'active' : ''}`} onClick={() => setActiveTab('web')}>Web</button>
                                    <button className={`tab-btn ${activeTab === 'desktop' ? 'active' : ''}`} onClick={() => setActiveTab('desktop')}>Desktop</button>
                                </div>

                                <div className={`tab-content ${activeTab === 'mobile' ? 'active' : ''}`}>
                                    <div className="step-list">
                                        <div className="step-item">
                                            <span className="step-number">01</span>
                                            <div className="step-details">
                                                <h4>Download the App</h4>
                                                <p>Visit the Google Play Store or Apple App Store and search for "InnerOrbit".</p>
                                            </div>
                                        </div>
                                        <div className="step-item">
                                            <span className="step-number">02</span>
                                            <div className="step-details">
                                                <h4>Grant Permissions</h4>
                                                <p>Allow necessary permissions for contacts and notifications to ensure full functionality.</p>
                                            </div>
                                        </div>
                                        <div className="step-item">
                                            <span className="step-number">03</span>
                                            <div className="step-details">
                                                <h4>Create Identity</h4>
                                                <p>Generate your unique 4-digit ID. No personal info needed.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={`tab-content ${activeTab === 'web' ? 'active' : ''}`}>
                                    <div className="code-block-wrapper">
                                        <div className="code-header">
                                            <span>Browser Access</span>
                                        </div>
                                        <pre><code>https://app.innerorbit.io</code></pre>
                                    </div>
                                    <p style={{ marginTop: '1.5rem' }}>Simply navigate to the URL above. InnerOrbit Web supports all modern browsers including Chrome, Firefox, Safari, and Edge.</p>
                                </div>

                                <div className={`tab-content ${activeTab === 'desktop' ? 'active' : ''}`}>
                                    <h3>Windows Installation</h3>
                                    <ol className="install-steps" style={{ listStyle: 'decimal', paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                                        <li style={{ marginBottom: '0.5rem' }}><strong>Download Installer</strong> - Download InnerOrbit.exe from the portal</li>
                                        <li style={{ marginBottom: '0.5rem' }}><strong>Run as Administrator</strong> - Right-click the file and select "Run as Administrator"</li>
                                        <li style={{ marginBottom: '0.5rem' }}><strong>Follow Installation Wizard</strong> - Choose installation directory and complete setup</li>
                                    </ol>

                                    <h3 style={{ marginTop: '2rem' }}>macOS Installation</h3>
                                    <ol className="install-steps" style={{ listStyle: 'decimal', paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                                        <li style={{ marginBottom: '0.5rem' }}><strong>Download App</strong> - Get InnerOrbit.dmg from the portal</li>
                                        <li style={{ marginBottom: '0.5rem' }}><strong>Open DMG File</strong> - Double-click to mount the disk image</li>
                                        <li style={{ marginBottom: '0.5rem' }}><strong>Drag to Applications</strong> - Drag InnerOrbit to your Applications folder</li>
                                    </ol>

                                    <div style={{ background: 'rgba(234, 179, 8, 0.1)', border: '1px solid rgba(234, 179, 8, 0.2)', padding: '1rem', borderRadius: '8px', marginTop: '2rem', color: '#fef08a' }}>
                                        <strong>⚠️ Note:</strong> On macOS, you may need to allow the app in Security & Privacy settings if you get a warning.
                                    </div>
                                </div>
                            </div>
                        </section>

                        <hr className="section-divider" />

                        {/* Mobile Guide */}
                        <section id="mobile-guide" className="doc-section">
                            <h2>Mobile App & Stealth Mode</h2>
                            <p>The mobile experience is designed for maximum privacy and camouflage.</p>

                            <h3>The Calculator Disguise</h3>
                            <p>When you open InnerOrbit on mobile, it appears as a fully functional scientific calculator ("CalcX"). This decoy interface protects your privacy from prying eyes.</p>

                            <h3 style={{ marginTop: '1.5rem' }}>Multiple Decoy Interfaces</h3>
                            <p>InnerOrbit provides multiple game-based decoys to suit your preference.</p>
                            <ul style={{ listStyle: 'disc', paddingLeft: '1.5rem', color: 'var(--text-secondary)' }}>
                                <li style={{ marginBottom: '0.5rem' }}><strong>Calculator:</strong> The default scientific calculator interface.</li>
                                <li style={{ marginBottom: '0.5rem' }}><strong>Tic-Tac-Toe:</strong> A fully playable Tic-Tac-Toe game against AI.</li>
                                <li style={{ marginBottom: '0.5rem' }}><strong>Ludo Master:</strong> A classic board game interface.</li>
                                <li style={{ marginBottom: '0.5rem' }}><strong>Guess Number:</strong> A simple number guessing game.</li>
                            </ul>

                            <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: '#e2e8f0', padding: '1rem', borderRadius: '8px', margin: '1.5rem 0' }}>
                                <strong style={{ color: '#34d399' }}>💡 Stealth Entry:</strong> The default way to access your chats is to <strong>Triple Tap</strong> the "AC" button (Calculator) or the game board/display area (Games).
                            </div>
                        </section>

                        <hr className="section-divider" />

                        {/* Security */}
                        <section id="security" className="doc-section">
                            <h2>Security & Privacy by Design</h2>
                            <p>InnerOrbit is built on three core pillars of security.</p>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', marginTop: '2rem' }}>
                                <div style={{ background: 'rgba(56, 189, 248, 0.05)', border: '1px solid rgba(56, 189, 248, 0.2)', padding: '2rem', borderRadius: '16px' }}>
                                    <h3 style={{ color: '#38bdf8', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Shield size={20} /> Identity: UID & PIN
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                                        Unlike other apps, we don't use your phone number. You are identified by a random <strong>4-digit User ID</strong>.
                                        Access to your account is protected by a <strong>6-digit PIN</strong>.
                                        Since we don't store your personal info, it is <strong>critical</strong> that you remember your PIN.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '2rem', borderRadius: '16px' }}>
                                    <h3 style={{ color: '#a855f7', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <Lock size={20} /> AES-256 Encryption
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                                        Every message, photo, and file you send is encrypted on your device using <strong>AES-256-GCM</strong> encryption.
                                        The keys are stored only on your device in a secure enclave (iOS Keychain / Android Keystore).
                                        Even if our servers are compromised, your data remains unreadable.
                                    </p>
                                </div>

                                <div style={{ background: 'rgba(244, 63, 94, 0.05)', border: '1px solid rgba(244, 63, 94, 0.2)', padding: '2rem', borderRadius: '16px' }}>
                                    <h3 style={{ color: '#f43f5e', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                        <AlertTriangle size={20} /> Account Recovery PIN
                                    </h3>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', lineHeight: 1.7 }}>
                                        During setup, you'll receive a unique <strong>Recovery PIN</strong>. Store this outside of your phone.
                                        If you lose your login PIN, this is the <strong>only way</strong> to recover your account.
                                        Without it, your data is lost forever—we cannot reset it for you.
                                    </p>
                                </div>
                            </div>
                        </section>

                        <hr className="section-divider" />

                        {/* Troubleshooting */}
                        <section id="troubleshooting" className="doc-section">
                            <h2>Troubleshooting</h2>
                            <p>Common issues and how to solve them.</p>

                            <div className="faq-list">
                                <details className="faq-item">
                                    <summary>The app is stuck on "Connecting..."</summary>
                                    <div className="faq-content">
                                        <p>This usually means your network is blocking our secure portal. Try switching from Wi-Fi to Mobile Data, or check if you have a VPN active that might be interfering.</p>
                                    </div>
                                </details>

                                <details className="faq-item">
                                    <summary>I didn't receive a notification for a new message.</summary>
                                    <div className="faq-content">
                                        <p>Since InnerOrbit uses stealth mode, notifications are often disguised or delayed by some battery optimization settings. Ensure you have "Allow background activity" enabled for the app in your phone settings.</p>
                                    </div>
                                </details>

                                <details className="faq-item">
                                    <summary>How do I backup my chats?</summary>
                                    <div className="faq-content">
                                        <p>InnerOrbit does not support cloud backups to third-party services like Google Drive or iCloud to maintain maximum privacy. You can export your chat history manually from Settings &rarr; Privacy &rarr; Export Data.</p>
                                    </div>
                                </details>
                            </div>
                        </section>

                        <footer className="docs-footer">
                            <p>© 2026 InnerOrbit Inc. All rights reserved. Built for absolute privacy.</p>
                        </footer>
                    </div>

                    {/* Right TOC Sidebar */}
                    <aside className="toc-sidebar">
                        <div className="toc-container">
                            <h4>On this page</h4>
                            <ul className="toc-list">
                                <li><a onClick={() => scrollToSection('overview')} className={activeSection === 'overview' ? 'active' : ''}>Overview</a></li>
                                <li><a onClick={() => scrollToSection('features')} className={activeSection === 'features' ? 'active' : ''}>Features</a></li>
                                <li><a onClick={() => scrollToSection('installation')} className={activeSection === 'installation' ? 'active' : ''}>Installation</a></li>
                                <li><a onClick={() => scrollToSection('mobile-guide')} className={activeSection === 'mobile-guide' ? 'active' : ''}>Mobile Stealth</a></li>
                                <li><a onClick={() => scrollToSection('security')} className={activeSection === 'security' ? 'active' : ''}>Security Details</a></li>
                                <li><a onClick={() => scrollToSection('faq')} className={activeSection === 'faq' ? 'active' : ''}>FAQ</a></li>
                                <li><a onClick={() => scrollToSection('troubleshooting')} className={activeSection === 'troubleshooting' ? 'active' : ''}>Troubleshooting</a></li>
                            </ul>
                        </div>
                    </aside>
                </main>
            </div>
        </div>
    );
};

export default Docs;
