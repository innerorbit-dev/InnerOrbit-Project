import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const PrivacyPolicy = () => {
    const [activeSection, setActiveSection] = useState('intro');

    useEffect(() => {
        window.scrollTo(0, 0);
        const handleScroll = () => {
            const sections = [
                'intro', 'collection', 'usage', 'legal', 'sharing', 'security', 
                'retention', 'rights', 'children', 'international', 'cookies', 
                'links', 'breach', 'design', 'changes', 'contact', 'specifics', 'consent'
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

    const sections = [
        { id: 'intro', title: '1. Introduction' },
        { id: 'collection', title: '2. Information We Collect' },
        { id: 'usage', title: '3. How We Use Info' },
        { id: 'legal', title: '4. Legal Basis (GDPR)' },
        { id: 'sharing', title: '5. Data Sharing' },
        { id: 'security', title: '6. Data Security' },
        { id: 'retention', title: '7. Data Retention' },
        { id: 'rights', title: '8. Your Privacy Rights' },
        { id: 'children', title: '9. Children\'s Privacy' },
        { id: 'international', title: '10. Int\'l Transfers' },
        { id: 'cookies', title: '11. Cookies (Web)' },
        { id: 'links', title: '12. Third-Party Links' },
        { id: 'breach', title: '13. Breach Notification' },
        { id: 'design', title: '14. Privacy by Design' },
        { id: 'changes', title: '15. Changes to Policy' },
        { id: 'contact', title: '16. Contact Us' },
        { id: 'specifics', title: '17. Specific Disclosures' },
        { id: 'consent', title: '18. Consent Mgmt' },
    ];

    const scrollToSection = (id) => {
        const element = document.getElementById(id);
        if (element) {
            window.scrollTo({
                top: element.offsetTop - 100,
                behavior: 'smooth'
            });
        }
    };

    return (
        <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)' }}>
            <Navbar />
            
            <div className="container" style={{ paddingTop: '140px', display: 'grid', gridTemplateColumns: 'minmax(250px, 300px) 1fr', gap: '4rem', maxWidth: '1400px' }}>
                {/* Fixed Sidebar for Navigation */}
                <aside className="desktop-nav" style={{ 
                    position: 'sticky', 
                    top: '120px', 
                    height: 'fit-content', 
                    maxHeight: 'calc(100vh - 160px)', 
                    overflowY: 'auto', 
                    paddingRight: '1rem',
                    borderRight: '1px solid var(--border-color)'
                }}>
                    <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {sections.map(section => (
                            <button
                                key={section.id}
                                onClick={() => scrollToSection(section.id)}
                                style={{
                                    background: 'none', border: 'none', textAlign: 'left', padding: '10px 16px',
                                    borderRadius: '10px', cursor: 'pointer', fontSize: '0.9rem',
                                    color: activeSection === section.id ? 'var(--accent-cyan)' : 'var(--text-secondary)',
                                    background: activeSection === section.id ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
                                    transition: 'all 0.2s',
                                    fontWeight: activeSection === section.id ? 600 : 400,
                                    borderLeft: activeSection === section.id ? '2px solid var(--accent-cyan)' : '2px solid transparent'
                                }}
                            >
                                {section.title}
                            </button>
                        ))}
                    </nav>
                </aside>

                {/* Main Content Area */}
                <main style={{ maxWidth: '850px', paddingBottom: '120px' }}>
                    <header style={{ marginBottom: '4rem', paddingBottom: '2rem', borderBottom: '1px solid var(--border-color)' }}>
                        <h1 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.03em', background: 'linear-gradient(135deg, var(--text-primary) 0%, var(--text-secondary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                            Privacy Policy
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                            Last Updated: January 19, 2026 • Effective Date: January 19, 2026
                        </p>
                    </header>

                    <section id="intro" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            1. Introduction
                        </h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '1.5rem' }}>Welcome to InnerOrbit ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our mobile application and services.</p>
                            <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)', marginTop: '2rem' }}>
                                <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Data Controller Details:</p>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Entity:</strong> InnerOrbit (Individual Developer)</p>
                                <p style={{ marginBottom: '0.5rem' }}><strong>Email:</strong> <a href="mailto:innerorbit.dev@gmail.com" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>innerorbit.dev@gmail.com</a></p>
                                <p><strong>Support:</strong> <a href="mailto:innerorbit.dev@gmail.com" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>innerorbit.dev@gmail.com</a></p>
                            </div>
                            <p style={{ marginTop: '2rem' }}>By using InnerOrbit, you agree to the collection and use of information in accordance with this policy.</p>
                        </div>
                    </section>

                    <section id="collection" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>2. Information We Collect</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1.5rem' }}>2.1 Information You Provide Directly</h3>
                            <p style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Account Information:</p>
                            <ul style={{ paddingLeft: '2rem', marginBottom: '2rem', listStyleType: 'square' }}>
                                <li style={{ marginBottom: '0.8rem' }}>Email address (required for authentication)</li>
                                <li style={{ marginBottom: '0.8rem' }}>Password (encrypted and never stored in plain text)</li>
                                <li style={{ marginBottom: '0.8rem' }}>User ID (4-digit randomly generated identifier)</li>
                                <li style={{ marginBottom: '0.8rem' }}>Recovery PIN (6-digit encrypted code)</li>
                            </ul>

                            <p style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Profile Information (Optional):</p>
                            <ul style={{ paddingLeft: '2rem', marginBottom: '2rem', listStyleType: 'square' }}>
                                <li style={{ marginBottom: '0.8rem' }}>Display name</li>
                                <li style={{ marginBottom: '0.8rem' }}>Profile photo</li>
                                <li style={{ marginBottom: '0.8rem' }}>Bio/status message</li>
                                <li style={{ marginBottom: '0.8rem' }}>Custom contact nicknames</li>
                            </ul>

                            <p style={{ marginBottom: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Communications:</p>
                            <ul style={{ paddingLeft: '2rem', marginBottom: '2.5rem', listStyleType: 'square' }}>
                                <li style={{ marginBottom: '0.8rem' }}>Messages you send and receive (end-to-end encrypted)</li>
                                <li style={{ marginBottom: '0.8rem' }}>Photos and media you share (stored encrypted)</li>
                                <li style={{ marginBottom: '0.8rem' }}>Message metadata (timestamps, delivery status)</li>
                            </ul>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1.5rem' }}>2.2 Information Collected Automatically</h3>
                            <p style={{ marginBottom: '1rem' }}><strong>Device Information:</strong> Device type and model, Operating system version (iOS/Android/Web/Desktop), App version, Device language settings.</p>
                            <p style={{ marginBottom: '1rem' }}><strong>Usage Information:</strong> Login timestamps, Last seen status, Online/offline presence, Feature usage, App performance data (crash reports).</p>
                            <p style={{ marginBottom: '2.5rem' }}><strong>Network Information:</strong> IP address (for security and fraud prevention), Network connection type, Geographic location (country-level only, derived from IP).</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1.5rem' }}>2.3 Information from Third Parties</h3>
                            <p><strong>Firebase/Google Services:</strong> Authentication tokens, Cloud storage metadata, Push notification tokens, Analytics data (if enabled).</p>
                        </div>
                    </section>

                    <section id="usage" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>3. How We Use Your Information</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '2rem' }}>We use your information for the following purposes:</p>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', marginBottom: '3rem' }}>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '1rem' }}>3.1 Service Delivery</h3>
                                    <p style={{ fontSize: '0.95rem' }}>Create and manage your account, authenticate your identity, enable messaging, deliver push notifications, and provide customer support.</p>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '1rem' }}>3.2 Security and Fraud Prevention</h3>
                                    <p style={{ fontSize: '0.95rem' }}>Verify your identity during login, detect/prevent unauthorized access, monitor for suspicious activity, and enforce our Terms of Service.</p>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '1rem' }}>3.3 Service Improvement</h3>
                                    <p style={{ fontSize: '0.95rem' }}>Analyze app performance, fix bugs, develop new features, and improve user experience.</p>
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '20px', border: '1px solid var(--border-color)' }}>
                                    <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '1rem' }}>3.4 Legal Compliance</h3>
                                    <p style={{ fontSize: '0.95rem' }}>Comply with legal obligations, respond to lawful requests, protect our rights/property, and enforce our policies.</p>
                                </div>
                            </div>
                            
                            <div style={{ background: 'rgba(251, 113, 133, 0.1)', borderLeft: '4px solid #fb7185', padding: '2rem', borderRadius: '12px', color: 'var(--text-primary)' }}>
                                <p style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Important Restriction:</p>
                                <p><strong>We do NOT:</strong> Sell your personal data to third parties, use your messages for advertising, share your data with advertisers, or track you across other apps/websites.</p>
                            </div>
                        </div>
                    </section>

                    <section id="legal" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>4. Legal Basis for Processing (GDPR)</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '1.5rem' }}>For users in the European Economic Area (EEA), we process your data based on:</p>
                            <ul style={{ paddingLeft: '2rem' }}>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Consent:</strong> Login persistence, notifications, photo uploads</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Contract Performance:</strong> Account creation, message delivery</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Legitimate Interests:</strong> Security, fraud prevention, service improvement</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Legal Obligation:</strong> Compliance with laws, court orders</li>
                            </ul>
                        </div>
                    </section>

                    <section id="sharing" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>5. Data Sharing and Disclosure</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1.5rem' }}>5.1 Service Providers</h3>
                            <p style={{ marginBottom: '1rem' }}>We share data with trusted third-party service providers:</p>
                            <p style={{ marginBottom: '1rem' }}><strong>Firebase/Google Cloud Platform:</strong> Authentication, database, storage. Location: USA. <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>Privacy Policy</a>.</p>
                            <p style={{ marginBottom: '2.5rem' }}><strong>Expo/React Native:</strong> App framework and updates (crash reports). <a href="https://expo.dev/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>Privacy Policy</a>.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>5.2 Legal Requirements</h3>
                            <p style={{ marginBottom: '1.5rem' }}>We may disclose info for court orders, law enforcement requests, national security, or protection of rights.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>5.3 Business Transfers</h3>
                            <p style={{ marginBottom: '1.5rem' }}>If acquired, data may be transferred with notification.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>5.4 With Your Consent</h3>
                            <p>We may share data with third parties if you explicitly consent.</p>
                        </div>
                    </section>

                    <section id="security" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>6. Data Security</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '2rem' }}>We implement industry-standard security measures:</p>
                            
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1.5rem' }}>6.1 Encryption</h3>
                            <ul style={{ paddingLeft: '2rem', marginBottom: '2rem' }}>
                                <li style={{ marginBottom: '0.8rem' }}><strong>End-to-end encryption</strong> for all messages</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>AES-256 encryption</strong> for stored credentials</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>TLS/SSL</strong> for data in transit</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Platform-specific secure storage</strong> (iOS Keychain, Android Keystore)</li>
                            </ul>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>6.2 Access Controls</h3>
                            <p style={{ marginBottom: '2rem' }}>Multi-factor authentication, PIN/biometric login, session timeouts, and Decoy PIN.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>6.3 Infrastructure Security</h3>
                            <p style={{ marginBottom: '2rem' }}>Firebase Security Rules, audits, threat detection, and secure development practices.</p>

                            <div style={{ background: 'rgba(255, 255, 255, 0.05)', padding: '1.5rem', borderRadius: '12px', borderLeft: '4px solid var(--text-secondary)' }}>
                                <p style={{ fontStyle: 'italic', fontSize: '0.95rem' }}><strong>Note:</strong> No method of transmission over the Internet is 100% secure. We cannot guarantee absolute security.</p>
                            </div>
                        </div>
                    </section>

                    <section id="retention" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>7. Data Retention</h2>
                        <div style={{ overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', color: 'var(--text-secondary)', fontSize: '1rem', border: '1px solid var(--border-color)' }}>
                                <thead>
                                    <tr style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)' }}>
                                        <th style={{ padding: '1.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Data Type</th>
                                        <th style={{ padding: '1.5rem', textAlign: 'left', borderBottom: '1px solid var(--border-color)' }}>Retention Period</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        ['Account Information', 'Until account deletion'],
                                        ['Messages', 'Until manually deleted by user'],
                                        ['Profile Photos', 'Until replaced or account deleted'],
                                        ['Login Credentials', 'Until user disables persistence'],
                                        ['Usage Logs', '90 days'],
                                        ['Crash Reports', '30 days'],
                                        ['Deleted Account Data', '30 days (backup retention)']
                                    ].map(([type, period], idx) => (
                                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                            <td style={{ padding: '1.2rem 1.5rem' }}>{type}</td>
                                            <td style={{ padding: '1.2rem 1.5rem' }}>{period}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p style={{ marginTop: '1.5rem', color: 'var(--text-secondary)' }}>After account deletion, we permanently remove all messages, media, profile info, and credentials. Some backups may remain for 30 days.</p>
                    </section>

                    <section id="rights" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>8. Your Privacy Rights</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <div style={{ marginBottom: '2.5rem' }}>
                                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1.2rem' }}>8.1 Rights for All Users</h3>
                                <ul style={{ paddingLeft: '2rem' }}>
                                    <li style={{ marginBottom: '0.8rem' }}><strong>Access:</strong> View your personal data</li>
                                    <li style={{ marginBottom: '0.8rem' }}><strong>Correction:</strong> Update inaccurate information</li>
                                    <li style={{ marginBottom: '0.8rem' }}><strong>Deletion:</strong> Delete your account and data</li>
                                    <li style={{ marginBottom: '0.8rem' }}><strong>Portability:</strong> Export your data</li>
                                    <li style={{ marginBottom: '0.8rem' }}><strong>Objection:</strong> Opt-out of certain data processing</li>
                                </ul>
                            </div>

                            <div style={{ marginBottom: '2.5rem' }}>
                                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '1rem' }}>8.2 Additional Rights (GDPR - EEA Users)</h3>
                                <p>Right to Restriction, Right to Object to legitimate interests, Right to Withdraw Consent, and Right to Lodge a Complaint.</p>
                            </div>

                            <div style={{ marginBottom: '3rem' }}>
                                <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '1rem' }}>8.3 Additional Rights (CCPA - California Users)</h3>
                                <p>Right to Know what data we collect, Right to Delete your data, Right to Opt-Out of sales (we don't sell data), and Right to Non-Discrimination.</p>
                            </div>

                            <div style={{ background: 'var(--card-bg)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)' }}>
                                <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>How to Exercise Your Rights</p>
                                <p style={{ marginBottom: '0.5rem' }}><strong>In-App:</strong> Settings → Account → Privacy/Export/Delete.</p>
                                <p><strong>Email:</strong> <a href="mailto:innerorbit.dev@gmail.com" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>innerorbit.dev@gmail.com</a> (include User ID).</p>
                            </div>
                        </div>
                    </section>

                    <section id="children" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>9. Children's Privacy</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>InnerOrbit is <strong>NOT intended for children under 13</strong> (or 16 in the EEA). We do not knowingly collect data from children. <strong>Parental Notice:</strong> Contact <a href="mailto:innerorbit.dev@gmail.com" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>innerorbit.dev@gmail.com</a> to remove child data immediately.</p>
                    </section>

                    <section id="international" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>10. International Data Transfers</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>Your data may be processed in the United States and your local region. For EEA Users, we rely on Standard Contractual Clauses (SCCs) and Adequacy decisions.</p>
                    </section>

                    <section id="cookies" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>11. Cookies and Tracking (Web Version)</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>11.1 Cookies We Use</h3>
                            <p style={{ marginBottom: '1.5rem' }}><strong>Essential:</strong> Auth session, security tokens. <strong>Analytics (Optional):</strong> Usage stats.</p>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '0.5rem' }}>11.2 Your Choices</h3>
                            <p>Control via browser settings or in-app privacy settings.</p>
                        </div>
                    </section>

                    <section id="links" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>12. Third-Party Links</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>We are not responsible for privacy practices of third-party websites linked in the app.</p>
                    </section>

                    <section id="breach" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>13. Data Breach Notification</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>We will notify you within <strong>72 hours</strong> of a breach via email/in-app alert, inform authorities, and provide protection steps.</p>
                    </section>

                    <section id="design" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>14. Privacy by Design</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>InnerOrbit is built on: End-to-end encryption, Local-first storage, Minimal data collection, User control, Transparency, Security audits, and No ads/tracking.</p>
                    </section>

                    <section id="changes" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>15. Changes to This Privacy Policy</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>Updates will be posted with a new "Last Updated" date. Continued use constitutes acceptance.</p>
                    </section>

                    <section id="contact" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>16. Contact Us</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '0.5rem' }}><strong>Email:</strong> <a href="mailto:innerorbit.dev@gmail.com" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>innerorbit.dev@gmail.com</a></p>
                            <p><strong>Legal:</strong> <a href="mailto:legal@innerorbit.in" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>legal@innerorbit.in</a></p>
                        </div>
                    </section>

                    <section id="specifics" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>17. Specific Disclosures</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>17.1 California Residents (CCPA)</h3>
                            <p style={{ marginBottom: '1rem' }}><strong>Collected:</strong> Identifiers, Internet activity, Geolocation, Audio/visual.</p>
                            <p style={{ marginBottom: '2.5rem' }}><strong>Sale:</strong> We do NOT sell personal information.</p>
                            
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>17.2 Nevada Residents</h3>
                            <p style={{ marginBottom: '2.5rem' }}>We do not sell personal information.</p>
                            
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>17.3 EEA/UK Residents (GDPR)</h3>
                            <p>Controller: InnerOrbit. Basis: Consent, Contract, Legitimate Interests.</p>
                        </div>
                    </section>

                    <section id="consent" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>18. Consent Management</h2>
                        <ul style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem', paddingLeft: '2rem' }}>
                            <li style={{ marginBottom: '0.8rem' }}><strong>Login Persistence:</strong> Default OFF. Enable via checkbox.</li>
                            <li style={{ marginBottom: '0.8rem' }}><strong>Notifications:</strong> Default OFF. Enable via permission prompt.</li>
                            <li style={{ marginBottom: '0.8rem' }}><strong>Photo Uploads:</strong> Default OFF. Enable via permission prompt.</li>
                        </ul>
                    </section>

                    <section id="appendix" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>Appendix: Definitions</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>Personal Data, Processing, Controller, Processor, Consent, End-to-End Encryption.</p>
                    </section>

                    <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '2.5rem', borderRadius: '24px', marginTop: '6rem', textAlign: 'center' }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '1.2rem', fontWeight: 600, marginBottom: '0.5rem' }}>Safety & Privacy Guaranteed</p>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>By using InnerOrbit, you acknowledge that you have read and understood this Privacy Policy.</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px' }}>Version 1.0 • Jan 2026</p>
                    </div>
                </main>
            </div>
            
            <Footer />
        </div>
    );
};

export default PrivacyPolicy;
