import { useEffect, useState } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';

const TermsOfService = () => {
    const [activeSection, setActiveSection] = useState('acceptance');

    useEffect(() => {
        window.scrollTo(0, 0);
        const handleScroll = () => {
            const sections = [
                'acceptance', 'account', 'usage', 'content', 'ip', 'privacy',
                'encryption', 'stealth', 'payments', 'disclaimers', 'indemnification',
                'export', 'governing', 'dmca', 'disputes', 'contact'
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
        { id: 'acceptance', title: '1. Acceptance of Terms' },
        { id: 'account', title: '2. Account Registration' },
        { id: 'usage', title: '3. Acceptable Use Policy' },
        { id: 'content', title: '4. User Content' },
        { id: 'ip', title: '5. Intellectual Property' },
        { id: 'privacy', title: '6. Privacy & Data' },
        { id: 'encryption', title: '7. End-to-End Encryption' },
        { id: 'stealth', title: '8. Stealth Features' },
        { id: 'payments', title: '9. Payments' },
        { id: 'disclaimers', title: '10. Disclaimers' },
        { id: 'indemnification', title: '11. Indemnification' },
        { id: 'export', title: '12. Export Control' },
        { id: 'governing', title: '13. Governing Law' },
        { id: 'dmca', title: '14. DMCA Copyright' },
        { id: 'disputes', title: '16. Dispute Resolution' },
        { id: 'contact', title: '18. Contact Info' },
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
                            Terms of Service
                        </h1>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
                            Last Updated: January 19, 2026 • Effective Date: January 19, 2026
                        </p>
                    </header>

                    <div style={{ background: 'rgba(251, 113, 133, 0.1)', borderLeft: '4px solid #fb7185', padding: '2rem', borderRadius: '12px', color: 'var(--text-primary)', marginBottom: '4rem' }}>
                        <p style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1.1rem' }}>Important Notice:</p>
                        <p>These Terms include a binding arbitration agreement and class action waiver for U.S. users. Please read Section 16 carefully.</p>
                    </div>

                    <section style={{ marginBottom: '5rem' }}>
                        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '2rem', borderRadius: '16px', border: '1px solid var(--border-color)', marginBottom: '2rem' }}>
                            <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>Agreement to Terms:</p>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8 }}>By accessing or using InnerOrbit ("the App," "Service," "we," "our," or "us"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the App.</p>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '1.05rem' }}>InnerOrbit is operated as an individual developer project.</p>
                    </section>

                    <section id="acceptance" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>1. Acceptance of Terms</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>1.1 Binding Agreement</h3>
                            <p style={{ marginBottom: '1.5rem' }}>These Terms constitute a legally binding agreement between you ("User," "you," or "your") and InnerOrbit (Individual Developer). By creating an account, accessing the App, or using any features or services, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>1.2 Age Requirements</h3>
                            <p style={{ marginBottom: '1rem' }}><strong>You must be at least 13 years old</strong> (or 16 in the European Economic Area) to use InnerOrbit.</p>
                            <p style={{ marginBottom: '1rem' }}>By using the App, you represent and warrant that:</p>
                            <ul style={{ paddingLeft: '2rem', marginBottom: '1.5rem', listStyleType: 'square' }}>
                                <li style={{ marginBottom: '0.5rem' }}>You are at least 13 years old (or 16 in the EEA)</li>
                                <li style={{ marginBottom: '0.5rem' }}>You have the legal capacity to enter into this agreement</li>
                                <li style={{ marginBottom: '0.5rem' }}>You are not prohibited from using the Service under applicable law</li>
                            </ul>
                            <p style={{ marginBottom: '2.5rem' }}><strong>Parental Consent:</strong> If you are between 13-18 (or 16-18 in EEA), you must have your parent or legal guardian's permission to use the App.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>1.3 Changes to Terms</h3>
                            <p style={{ marginBottom: '1rem' }}>We reserve the right to modify these Terms at any time. Changes will be posted on this page with a new "Last Updated" date, notified via in-app alert for material changes, and effective immediately upon posting.</p>
                            <p><strong>Your continued use after changes constitutes acceptance.</strong> If you do not agree to the modified Terms, you must stop using the App.</p>
                        </div>
                    </section>

                    <section id="account" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>2. Account Registration and Security</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>2.1 Account Creation</h3>
                            <p style={{ marginBottom: '2.5rem' }}>To use InnerOrbit, you must create an account by providing a valid email address and secure password. You will receive a 4-digit User ID (for PIN login) and a 6-digit Recovery PIN (encrypted).</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>2.2 Account Security</h3>
                            <p style={{ marginBottom: '1rem' }}>You are responsible for maintaining the confidentiality of your password and PIN, all activities that occur under your account, and notifying us immediately of any unauthorized access.</p>
                            <p style={{ marginBottom: '2.5rem' }}><strong>We are not liable for any loss or damage from your failure to protect your account.</strong></p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>2.3 Account Restrictions</h3>
                            <p style={{ marginBottom: '2.5rem' }}>You may not create multiple accounts for the same person, share your account with others, use another person's account without permission, create an account using false or misleading information, or create an account if you were previously banned.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>2.4 Account Termination</h3>
                            <p style={{ marginBottom: '1rem' }}><strong>By You:</strong> You may delete your account at any time via Settings → Account → Delete Account. Deletion is permanent and cannot be undone. All your data will be deleted within 30 days.</p>
                            <p><strong>By Us:</strong> We may suspend or terminate your account if you violate these Terms, terminate accounts that are inactive for 12+ months, or terminate the Service entirely with 30 days' notice.</p>
                        </div>
                    </section>

                    <section id="usage" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>3. Acceptable Use Policy</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>3.1 Permitted Uses</h3>
                            <p style={{ marginBottom: '2.5rem' }}>InnerOrbit is designed for private, secure messaging, sharing photos and media with contacts, using stealth features (calculator mode, games), and personal communication.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>3.2 Prohibited Activities</h3>
                            <p style={{ marginBottom: '1rem' }}>You may NOT use InnerOrbit to:</p>
                            <ul style={{ paddingLeft: '2rem', marginBottom: '2.5rem', listStyleType: 'square' }}>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Illegal Activities:</strong> Violate laws, engage in illegal acts, distribute illegal content, or facilitate fraud.</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Harmful Content:</strong> Harass, threaten, hate speech, explicit content involving minors, or distribute malware.</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Abuse and Spam:</strong> Send spam, impersonate others, phishing, or create fake accounts.</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Intellectual Property Violations:</strong> Infringe on copyrights/trademarks, share pirated content, or violate privacy rights.</li>
                                <li style={{ marginBottom: '0.8rem' }}><strong>Platform Abuse:</strong> Hack, reverse engineer, scrape data, or interfere with operations.</li>
                            </ul>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>3.3 Enforcement</h3>
                            <p>Violations may result in warning, suspension, permanent termination, reporting to law enforcement, or legal action.</p>
                        </div>
                    </section>

                    <section id="content" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>4. User Content</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>4.1 Your Content</h3>
                            <p style={{ marginBottom: '2.5rem' }}>"User Content" means any messages, photos, media, or information you submit. <strong>You retain ownership</strong> of your User Content.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>4.2 License to Us</h3>
                            <p style={{ marginBottom: '2.5rem' }}>By posting User Content, you grant InnerOrbit a non-exclusive, worldwide, royalty-free license to store, transmit, and display your content <strong>solely for the purpose of providing the Service</strong>. We do NOT claim ownership, use content for ads, or share with third parties (except as required).</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1.1rem' }}>4.3 Content Responsibility</h3>
                            <p style={{ marginBottom: '2.5rem' }}>You are solely responsible for your User Content. You warrant that you own rights to content and it violates no laws or rights. <strong>We are not responsible for User Content.</strong></p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>4.4 Content Removal</h3>
                            <p>We reserve the right to remove content violating these Terms or legal requests. We are not obligated to monitor content.</p>
                        </div>
                    </section>

                    <section id="ip" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>5. Intellectual Property Rights</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>5.1 Our Rights & Limited License</h3>
                            <p style={{ marginBottom: '2.5rem' }}>InnerOrbit and related materials are owned by InnerOrbit Team. We grant you a limited, non-exclusive, revocable license to use the App for personal, non-commercial purposes. You may NOT copy, modify, reverse engineer, or use our trademarks without permission.</p>

                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.4rem', marginBottom: '1rem' }}>5.2 Feedback</h3>
                            <p>If you provide feedback, we may use it without obligation to you.</p>
                        </div>
                    </section>

                    <section id="privacy" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>6. Privacy and Data Protection</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '1.5rem' }}>Your use of InnerOrbit is governed by our <a href="/privacy-policy" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>Privacy Policy</a>.</p>
                            <h3 style={{ color: 'var(--text-primary)', fontSize: '1.2rem', marginBottom: '1rem' }}>Key Privacy Features:</h3>
                            <ul style={{ paddingLeft: '2rem', marginBottom: '2rem' }}>
                                <li style={{ marginBottom: '0.5rem' }}>End-to-end encryption for all messages</li>
                                <li style={{ marginBottom: '0.5rem' }}>No message content access by InnerOrbit</li>
                                <li style={{ marginBottom: '0.5rem' }}>Minimal data collection & User control over data</li>
                            </ul>
                            <p style={{ marginBottom: '1.5rem' }}><strong>Data Security:</strong> We implement industry-standard measures, but no system is 100% secure. You use the App at your own risk.</p>
                            <p><strong>Third-Party Services:</strong> We use Firebase/Google Cloud (their privacy policies apply).</p>
                        </div>
                    </section>

                    <section id="encryption" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>7. End-to-End Encryption</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '1.5rem' }}><strong>Encryption Notice:</strong> Only you and your recipient can read messages. InnerOrbit cannot access message content. Messages are encrypted on your device.</p>
                            <p style={{ marginBottom: '1.5rem' }}><strong>Limitations:</strong> We cannot recover lost messages, provide content to law enforcement (we don't have access), or decrypt messages if credentials are lost.</p>
                            <p><strong>Backup:</strong> Encrypted messages are stored on Firebase servers. No backup to third-party services supported.</p>
                        </div>
                    </section>

                    <section id="stealth" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>8. Stealth Features</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '1.5rem' }}><strong>Calculator Mode:</strong> Disguises app as calculator; requires PIN for access.</p>
                            <p style={{ marginBottom: '1.5rem' }}><strong>Decoy PIN:</strong> Opens empty account for emergencies (optional).</p>
                            <p><strong>Intended Use:</strong> Personal privacy and protection. <strong>Prohibited:</strong> Evading lawful surveillance or hiding illegal activities.</p>
                        </div>
                    </section>

                    <section id="payments" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>9. Payments and Subscriptions</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>InnerOrbit is currently <strong>free</strong>. We reserve the right to introduce paid features with 30 days' notice.</p>
                    </section>

                    <section id="disclaimers" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>10. Disclaimers and Limitations</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '1.5rem' }}>THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES. We do not guarantee absolute security.</p>
                            <p><strong>Limitation of Liability:</strong> To the maximum extent permitted by law, InnerOrbit is not liable for indirect damages or data loss. Total liability is limited to $100 USD.</p>
                        </div>
                    </section>

                    <section id="indemnification" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>11. Indemnification</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>You agree to indemnify and hold harmless InnerOrbit from claims arising from your use of the App, User Content, or violation of these Terms.</p>
                    </section>

                    <section id="export" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>12. Export Control</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>You represent you are not in a prohibited country (e.g., Cuba, Iran, North Korea, Syria) or on any U.S. government prohibited list.</p>
                    </section>

                    <section id="governing" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>13. Governing Law</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>These Terms are governed by the laws of your country of residence.</p>
                    </section>

                    <section id="dmca" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>14. DMCA Copyright Policy</h2>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>Send copyright infringement notices to <a href="mailto:dmca@InnerOrbit.app" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>dmca@InnerOrbit.app</a>.</p>
                    </section>

                    <section id="disputes" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>16. Dispute Resolution (U.S. Users)</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '1.5rem' }}><strong>Arbitration:</strong> U.S. users agree to resolve disputes through binding arbitration (AAA), not in court. You waive your right to class actions.</p>
                            <p><strong>Opt-Out:</strong> Email <a href="mailto:arbitration-opt-out@InnerOrbit.app" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>arbitration-opt-out@InnerOrbit.app</a> within 30 days to opt-out.</p>
                        </div>
                    </section>

                    <section id="contact" style={{ marginBottom: '5rem', scrollMarginTop: '120px' }}>
                        <h2 style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--accent-cyan)', marginBottom: '2rem' }}>18. Contact Information</h2>
                        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.8, fontSize: '1.05rem' }}>
                            <p style={{ marginBottom: '0.5rem' }}><strong>Email:</strong> <a href="mailto:legal@InnerOrbit.app" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>legal@InnerOrbit.app</a></p>
                            <p><strong>Support:</strong> <a href="mailto:support@InnerOrbit.app" style={{ color: 'var(--accent-cyan)', textDecoration: 'none' }}>support@InnerOrbit.app</a></p>
                        </div>
                    </section>

                    <div style={{ background: 'rgba(6, 182, 212, 0.05)', border: '1px solid rgba(6, 182, 212, 0.2)', padding: '2.5rem', borderRadius: '24px', marginTop: '6rem', textAlign: 'center' }}>
                        <h2 style={{ color: 'var(--text-primary)', fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Acknowledgment</h2>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.5rem', fontSize: '1.1rem' }}>BY USING InnerOrbit, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS.</p>
                        <p style={{ fontSize: '0.85rem', color: 'var(--accent-cyan)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px' }}>Professional Grade Security • Since 2026</p>
                    </div>
                </main>
            </div>

            <Footer />
        </div>
    );
};

export default TermsOfService;
