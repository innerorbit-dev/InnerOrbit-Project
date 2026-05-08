// Firebase Configuration & Initialization
// Config is now managed centrally in js/firebase-config.js
var db = window.db;

// --- REACT LOGIC ---
const { useState, useEffect, useLayoutEffect, useRef } = React;

// Register GSAP ScrollTrigger
gsap.registerPlugin(ScrollTrigger);

// --- STYLES & UTILS ---
const styles = {
    glass: {
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    },
    glassHover: {
        background: 'var(--glass-bg-hover)',
        borderColor: 'var(--accent-cyan)',
        transform: 'translateY(-5px)',
        boxShadow: '0 20px 40px rgba(0,0,0,0.4)'
    },
    gradientText: {
        background: 'linear-gradient(to right, #22d3ee, #c084fc, #60a5fa)',
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
        backgroundSize: '200% auto',
        animation: 'gradientShift 5s ease infinite'
    }
};

// --- COMPONENTS ---

const PRIVACY_LEVELS = [
    {
        id: 0,
        title: "Normal Chat",
        desc: "Standard E2E Encryption",
        color: "#22d3ee",
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
    },
    {
        id: 1,
        title: "Private Language",
        desc: "Anti-Peek Text Reversal",
        color: "#a855f7",
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 21l21-9-9-2.1L12 3 9.9 9.9 3 12l9 2.1z"></path></svg>
    },
    {
        id: 2,
        title: "Camouflage Mode",
        desc: "Disguised UI (Calc/News)",
        color: "#f59e0b",
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
    },
    {
        id: 3,
        title: "Auto Safety",
        desc: "Auto-Screen Shield",
        color: "#ef4444",
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>
    },
    {
        id: 4,
        title: "Emergency",
        desc: "Decoy mode activated",
        color: "#f43f5e",
        icon: <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
    }
];

// Legacy backgrounds removed

const Navbar = () => {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            const isScrolled = window.scrollY > 20;
            if (isScrolled !== scrolled) setScrolled(isScrolled);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [scrolled]);

    const NavLink = ({ href, children, mobile }) => (
        <a href={href}
            onClick={() => mobile && setMenuOpen(false)}
            style={{
                color: 'var(--text-primary)',
                opacity: mobile ? 1 : 0.8,
                textDecoration: 'none',
                fontSize: mobile ? '1.5rem' : '0.95rem',
                fontWeight: 500,
                transition: 'all 0.2s',
                padding: mobile ? '10px 0' : '0',
                display: 'block'
            }}
            onMouseOver={e => e.target.style.opacity = '1'}
            onMouseOut={e => e.target.style.opacity = mobile ? '1' : '0.8'}
        >
            {children}
        </a>
    );

    return (
        <nav style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            zIndex: 1000,
            transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
            background: scrolled || menuOpen ? 'rgba(2, 6, 23, 0.8)' : 'transparent',
            backdropFilter: scrolled || menuOpen ? 'blur(20px) saturate(180%)' : 'none',
            WebkitBackdropFilter: scrolled || menuOpen ? 'blur(20px) saturate(180%)' : 'none',
            borderBottom: scrolled || menuOpen ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
            padding: scrolled ? '10px 0' : '20px 0'
        }}>
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Logo */}
                <div style={{
                    fontSize: 'clamp(1.1rem, 4vw, 1.5rem)',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    letterSpacing: '-0.02em',
                    zIndex: 1002,
                    marginRight: '15px'
                }}>
                    <div id="nav-logo-landing-pad" style={{ 
                        width: '32px', 
                        height: '32px', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        opacity: 0 // Hidden until animated logo 'lands'
                    }}>
                        <img src="assets/InnerOrbit-Logo.webp" alt="InnerOrbit Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    </div>
                    <span style={{ whiteSpace: 'nowrap' }}>InnerOrbit</span>
                </div>

                {/* Desktop Links */}
                <div className="desktop-nav" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    <NavLink href="#features">Features</NavLink>
                    <NavLink href="#web-version">Web Version</NavLink>
                    <NavLink href="#download">Download</NavLink>
                    <NavLink href="docs.html">Docs</NavLink>
                    <a href="#download" className="nav-btn" style={{
                        padding: '10px 24px',
                        fontSize: '0.9rem',
                        borderRadius: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        textDecoration: 'none',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        backdropFilter: 'blur(10px)',
                        transition: 'all 0.3s',
                        fontWeight: 600
                    }}
                        onMouseOver={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                            e.currentTarget.style.boxShadow = '0 0 15px rgba(6,182,212,0.2)';
                        }}
                        onMouseOut={e => {
                            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                            e.currentTarget.style.boxShadow = 'none';
                        }}>
                        <span>Get App</span> <img src="assets/download-icons/download-icon -button-for-nav.webp" style={{ width: 18, height: 18 }} />
                    </a>
                </div>

                {/* Mobile Hamburger Button - High Z-Index to stay above drawer */}
                <button className="mobile-menu-btn"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Toggle Menu"
                    style={{
                        display: 'none', // Hidden by default, shown via CSS media query
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        padding: '10px',
                        zIndex: 2000, // Ensure it's ALWAYS on top
                        position: 'relative'
                    }}>
                    <div style={{
                        width: '24px', height: '2px', background: 'white',
                        marginBottom: '6px', transition: '0.3s',
                        transform: menuOpen ? 'rotate(45deg) translate(5px, 6px)' : 'none'
                    }}></div>
                    <div style={{
                        width: '24px', height: '2px', background: 'white',
                        marginBottom: '6px', transition: '0.3s',
                        opacity: menuOpen ? 0 : 1
                    }}></div>
                    <div style={{
                        width: '24px', height: '2px', background: 'white',
                        transition: '0.3s',
                        transform: menuOpen ? 'rotate(-45deg) translate(5px, -6px)' : 'none'
                    }}></div>
                </button>

                {/* Mobile Drawer */}
                <div style={{
                    position: 'fixed',
                    top: 0, right: 0, bottom: 0, left: 0,
                    background: 'rgba(2, 6, 23, 0.95)', // Slightly transparent
                    backdropFilter: 'blur(20px)', // Heavy blur
                    zIndex: 1001,
                    padding: '100px 20px',
                    transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
                    transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2rem'
                }}>
                    {/* Explicit Close Button (Top Right) */}
                    <button onClick={() => setMenuOpen(false)} style={{
                        position: 'absolute', top: '25px', right: '25px',
                        background: 'transparent', border: 'none', color: 'white',
                        fontSize: '2rem', cursor: 'pointer', padding: '10px'
                    }}>&times;</button>

                    <NavLink href="#features" mobile>Features</NavLink>
                    <NavLink href="#web-version" mobile>Web Version</NavLink>
                    <NavLink href="#download" mobile>Download</NavLink>
                    <NavLink href="docs.html" mobile>Documentation</NavLink>
                    <NavLink href="privacy-policy.html" mobile>Privacy</NavLink>
                    <div style={{ width: '100%', height: '1px', background: 'rgba(255,255,255,0.1)' }}></div>
                    <a href="#download" className="btn"
                        onClick={() => setMenuOpen(false)}
                        style={{ width: '100%', textAlign: 'center', padding: '16px' }}>
                        Download Now
                    </a>
                </div>
            </div>
        </nav>
    );
};

// Card components removed

// --- COMPONENTS REMOVED (WindowsPreview, MobilePreview) ---

const HeroSection = () => {
    const componentRef = useRef(null);

    useLayoutEffect(() => {
        let ctx = gsap.context(() => {
            // Text Animations
            gsap.from("#hero-text > *:not(#privacy-levels-preview)", {
                y: 40,
                opacity: 0,
                duration: 1.2,
                stagger: 0.15,
                ease: "power3.out"
            });

            gsap.from("#privacy-levels-preview", { y: 30, opacity: 0, duration: 1, delay: 0.5, ease: "power3.out" });

            // Scroll Down Indicator Animation (CSS handled)
        }, componentRef);

        return () => ctx.revert();
    }, []);

    return (
        <section id="hero" className="bg-hero" ref={componentRef} style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: '80px', position: 'relative', overflow: 'hidden' }}>
            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10, textAlign: 'center' }}>

                <div id="hero-text" style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <h1 style={{ fontSize: 'clamp(3.5rem, 6vw, 5.5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '2rem', letterSpacing: '-0.02em' }}>
                        The Future of <br />
                        <span style={{
                            background: 'linear-gradient(to right, #22d3ee, #c084fc, #60a5fa)',
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            backgroundSize: '200% auto',
                            animation: 'gradientShift 5s ease infinite'
                        }}>Social Privacy.</span>
                    </h1>
                    <p style={{ fontSize: '1.3rem', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: '2rem', maxWidth: '800px', margin: '0 auto 2rem' }}>
                        More than just encryption. Control who sees what with 5 levels of social stealth—from casual chats to complete invisibility.
                    </p>

                    {/* Privacy Levels Preview Marquee */}
                    <div id="privacy-levels-preview" style={{
                        marginBottom: '3rem',
                        width: '100%',
                        maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                        WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                        overflow: 'hidden'
                    }}>
                        <div className="marquee-content" style={{
                            display: 'flex', gap: '15px', width: 'max-content',
                            animation: 'marquee 25s linear infinite',
                            margin: '0 auto' // Center the marquee content wrapper if possible, though marquee itself moves
                        }}
                            onMouseEnter={(e) => e.currentTarget.style.animationPlayState = 'paused'}
                            onMouseLeave={(e) => e.currentTarget.style.animationPlayState = 'running'}
                        >
                            {[...PRIVACY_LEVELS, ...PRIVACY_LEVELS].map((level, i) => (
                                <div key={i} title={level.title} style={{
                                    padding: '12px 16px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${level.color}30`,
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    minWidth: '140px', backdropFilter: 'blur(5px)',
                                    textAlign: 'left' // Keep text aligned left inside cards
                                }}>
                                    <div style={{ color: level.color }}>{level.icon}</div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>{level.title}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{level.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <style>{`
                        @keyframes marquee {
                            0% { transform: translateX(0); }
                            100% { transform: translateX(-50%); }
                        }
                        @keyframes gradientShift {
                            0% { background-position: 0% 50%; }
                            50% { background-position: 100% 50%; }
                            100% { background-position: 0% 50%; }
                        }
                    `}</style>

                    <div className="flex-btn-group" style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                        <a href="#download" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', padding: '16px 32px' }}>
                            Download App
                        </a>
                        <a href="#social-privacy" className="btn" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', padding: '16px 32px' }}>
                            See Comparison
                        </a>
                    </div>
                </div>
            </div>

            {/* Scroll Down Indicator */}
            <div className="scroll-indicator" style={{
                position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                color: 'rgba(255,255,255,0.7)', zIndex: 20, cursor: 'pointer',
                textShadow: '0 0 10px rgba(255,255,255,0.3)'
            }} onClick={() => document.getElementById('social-privacy').scrollIntoView({ behavior: 'smooth' })}>
                <span style={{ fontSize: '0.8rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Scroll</span>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'bounce 2s infinite' }}>
                    <path d="M7 13l5 5 5-5M7 6l5 5 5-5" />
                </svg>
                <style>{`
                    @keyframes bounce {
                        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
                        40% { transform: translateY(-10px); }
                        60% { transform: translateY(-5px); }
                    }
                `}</style>
            </div>
        </section>
    );
};

// --- NEW SOCIAL PRIVACY COMPARISON COMPONENT ---
const SocialPrivacyComparison = () => {
    useLayoutEffect(() => {
        gsap.utils.toArray('.comparison-card').forEach((card, i) => {
            gsap.from(card, {
                scrollTrigger: {
                    trigger: card,
                    start: "top 85%",
                },
                y: 50,
                opacity: 0,
                duration: 1,
                ease: "power3.out",
                delay: i * 0.2
            });
        });
    }, []);

    return (
        <section id="social-privacy" className="bg-social" style={{ padding: '8rem 0', position: 'relative' }}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
                    <h2 style={{ fontWeight: 800, marginBottom: '1.5rem' }}>
                        Social Privacy vs. <span style={{ color: '#64748b' }}>Normal Apps</span>
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
                        Most apps think privacy ends at encryption. We believe it begins with how you exist in the digital world.
                    </p>
                </div>

                <div className="responsive-grid" style={{ maxWidth: '1000px', margin: '0 auto' }}>
                    {/* Standard Apps Card */}
                    <div className="comparison-card" style={styles.glass}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            Normal Apps
                        </div>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-secondary)' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#ef4444' }}>✕</span> Visible notifications on lock screen
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#ef4444' }}>✕</span> Anyone can see you're using the app
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#ef4444' }}>✕</span> Metadata is often logged
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: '#ef4444' }}>✕</span> "Delete" doesn't always mean delete
                            </li>
                        </ul>
                    </div>

                    {/* InnerOrbit Card */}
                    <div className="comparison-card" style={{
                        ...styles.glass,
                        border: '1px solid var(--accent-cyan)',
                        background: 'rgba(6, 182, 212, 0.05)'
                    }}>
                        <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: '1px',
                            background: 'linear-gradient(90deg, transparent, var(--accent-cyan), transparent)'
                        }}></div>

                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {PRIVACY_LEVELS[2].icon}
                            InnerOrbit
                        </div>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-primary)' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: 'var(--accent-cyan)' }}>✓</span> <strong>Camouflage Mode:</strong> App looks like a calculator
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: 'var(--accent-cyan)' }}>✓</span> <strong>Private Language:</strong> Slang auto-translation
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: 'var(--accent-cyan)' }}>✓</span> <strong>Ghost Notifications:</strong> Discreet vibrations only
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <span style={{ color: 'var(--accent-cyan)' }}>✓</span> <strong>Panic Wipe:</strong> Shake to destroy data
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>
    );
};

const FeaturesSection = () => {
    useEffect(() => {
        // Feature Cards Stagger
        gsap.utils.toArray('.feature-card').forEach((card, i) => {
            ScrollTrigger.create({
                trigger: card,
                start: "top 85%",
                onEnter: () => gsap.from(card, {
                    y: 50,
                    opacity: 0,
                    duration: 0.8,
                    ease: "back.out(1.7)"
                })
            });
        });
    }, []);

    const features = [
        { title: "Stealth Mode", desc: "Disguised as a functional calculator.", icon: "calc" },
        { title: "Dual-Layer Encryption", desc: "AES-256 + RSA-2048 encryption.", icon: "lock" },
        { title: "Self-Destruct", desc: "Messages vanish without a trace.", icon: "bomb" },
        { title: "Cross-Platform", desc: "Seamless sync across all devices.", icon: "sync" },
        { title: "Anonymous ID", desc: "No phone number required.", icon: "user" },
        { title: "Panic Switch", desc: "Instant wipe with a secret gesture.", icon: "alert" }
    ];

    return (
        <section id="features" className="bg-features" style={{ position: 'relative', padding: '8rem 0' }}>
            <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h2 style={{ fontWeight: 800, marginBottom: '1rem', color: 'var(--text-primary)' }}>
                        Your Privacy, <span className="gradient-text">Your Control</span>
                    </h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
                        Built for those who demand absolute secrecy. Your data never leaves your device unencrypted.
                    </p>
                </div>

                <div className="responsive-grid">
                    {features.map((f, i) => (
                        <div key={i} className="feature-card" style={styles.glass}>
                            <div style={{
                                width: '60px', height: '60px', borderRadius: '16px',
                                background: 'var(--accent-cyan)20', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
                                color: 'var(--accent-cyan)'
                            }}>
                                {/* Icons would go here */}
                                <div style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{f.icon === 'calc' ? '±' : f.icon === 'lock' ? '🔒' : '★'}</div>
                            </div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{f.title}</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

const WebSection = () => {
    useEffect(() => {
        gsap.utils.toArray('.web-feature-card').forEach((card, i) => {
            ScrollTrigger.create({
                trigger: card,
                start: "top 85%",
                onEnter: () => gsap.from(card, {
                    y: 30,
                    opacity: 0,
                    duration: 0.8,
                    ease: "power3.out",
                    delay: i * 0.1
                })
            });
        });
    }, []);

    const webFeatures = [
        { title: "Zero Install", desc: "No download required. Launch instantly in any modern browser on any device.", icon: "🚀" },
        { title: "Instant Sync", desc: "Your messages and contacts are always updated and ready when you are.", icon: "⚡" },
        { title: "Privacy First", desc: "Built-in auto-lock and encrypted sessions for secure browsing anywhere.", icon: "🛡️" }
    ];

    return (
        <section id="web-version" style={{ padding: '8rem 0', background: 'rgba(6, 182, 212, 0.02)', position: 'relative' }}>
            <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h2 style={{ fontWeight: 800, marginBottom: '1rem' }}>
                        Access Anywhere with <span className="gradient-text">Web Version</span>
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}>
                        Experience the full power of InnerOrbit directly in your browser. Perfect for shared environments or quick access on any machine.
                    </p>
                </div>

                <div className="responsive-grid" style={{ marginBottom: '4rem' }}>
                    {webFeatures.map((f, i) => (
                        <div key={i} className="web-feature-card" style={{
                            ...styles.glass,
                            padding: '2.5rem',
                            transition: 'transform 0.3s'
                        }}>
                            <div style={{ fontSize: '2.5rem', marginBottom: '1.5rem' }}>{f.icon}</div>
                            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem', color: 'var(--text-primary)' }}>{f.title}</h3>
                            <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
                        </div>
                    ))}
                </div>

                <div style={{ textAlign: 'center' }}>
                    <button
                        onClick={() => window.open('https://innerorbit-bc8ce.web.app/', '_blank')}
                        className="btn"
                        style={{
                            padding: '18px 48px',
                            fontSize: '1.2rem',
                            fontWeight: 700,
                            boxShadow: '0 0 30px rgba(6, 182, 212, 0.2)'
                        }}
                    >
                        Launch Web Application
                    </button>
                    <p style={{ marginTop: '1.5rem', color: '#64748b', fontSize: '0.9rem' }}>
                        No account? <a href="#download" onClick={(e) => { e.preventDefault(); document.getElementById('download').scrollIntoView({ behavior: 'smooth' }); }} style={{ color: '#22d3ee', textDecoration: 'none' }}>Download the app</a> to get started.
                    </p>
                </div>
            </div>

            {/* Background elements */}
            <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                width: '600px', height: '600px', background: 'radial-gradient(circle, rgba(6, 182, 212, 0.05) 0%, transparent 70%)',
                pointerEvents: 'none'
            }}></div>
        </section>
    );
};

const DownloadSection = () => {
    useLayoutEffect(() => {
        let ctx = gsap.context(() => {
            gsap.from("#download-container", {
                scrollTrigger: {
                    trigger: "#download-container",
                    start: "top 80%",
                },
                y: 80,
                opacity: 0,
                scale: 0.95,
                duration: 1.2,
                ease: "power3.out"
            });
        });
        return () => ctx.revert();
    }, []);

    return (
        <section id="download" className="bg-download" style={{ position: 'relative', padding: '8rem 0', overflow: 'hidden' }}>

            <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                <div id="download-container" style={{
                    borderRadius: '32px',
                    padding: '4rem',
                    textAlign: 'center'
                }}>
                    <h2 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '1.5rem', color: '#f8fafc' }}>
                        Start Your <span className="gradient-text">Secure Journey</span>
                    </h2>
                    <p style={{ color: '#94a3b8', fontSize: '1.2rem', marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem' }}>
                        Be among the first to reclaim your digital privacy.
                        Available on Android and Windows.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                        {/* Play Store Button */}
                        <button
                            onClick={() => window.downloadFile('playstore')}
                            className="btn"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '15px',
                                padding: '16px 32px', fontSize: '1.1rem',
                                background: 'linear-gradient(135deg, #0ea5e9, #2563eb)'
                            }}
                        >
                            <img src="assets/download-icons/playstore.webp" alt="Play Store" style={{ width: 30, height: 30 }} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase' }}>Get it on</div>
                                <div style={{ fontWeight: 700 }}>Google Play</div>
                            </div>
                        </button>

                        {/* Windows Button */}
                        <button
                            onClick={() => window.downloadFile('windows')}
                            className="btn"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '15px',
                                padding: '16px 32px', fontSize: '1.1rem',
                                background: 'linear-gradient(135deg, #0f172a, #334155)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <img src="assets/download-icons/window.png" alt="Windows" style={{ width: 30, height: 30 }} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase' }}>Download for</div>
                                <div style={{ fontWeight: 700 }}>Windows 10/11</div>
                            </div>
                        </button>

                        {/* Web Version Button */}
                        <button
                            onClick={() => document.getElementById('web-version').scrollIntoView({ behavior: 'smooth' })}
                            className="btn"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '15px',
                                padding: '16px 32px', fontSize: '1.1rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid rgba(6, 182, 212, 0.3)',
                                boxShadow: '0 0 20px rgba(6, 182, 212, 0.1)'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = 'rgba(6, 182, 212, 0.1)'}
                            onMouseOut={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                        >
                            <div style={{ fontSize: '1.8rem' }}>🌐</div>
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase' }}>Explore</div>
                                <div style={{ fontWeight: 700 }}>Web Application</div>
                            </div>
                        </button>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem', color: '#64748b', fontSize: '0.9rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ✓ v2.4.0 Stable
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ✓ 64-bit Optimized
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            ✓ Verified Secure
                        </span>
                    </div>
                </div>
            </div>
        </section>
    );
};

const Footer = () => {
    const [theme, setTheme] = React.useState(localStorage.getItem('innerorbit-theme') || 'default');

    React.useEffect(() => {
        if (theme === 'default') {
            document.documentElement.removeAttribute('data-theme');
        } else {
            document.documentElement.setAttribute('data-theme', theme);
        }
        localStorage.setItem('innerorbit-theme', theme);
    }, [theme]);

    const activeStyle = { background: 'rgba(168, 85, 247, 0.2)', color: 'var(--accent-purple)', border: '1px solid var(--accent-purple)' };
    const inactiveStyle = { background: 'rgba(128, 128, 128, 0.1)', color: 'var(--text-secondary)', border: '1px solid var(--card-border)' };

    return (
        <footer className="bg-footer" style={{ position: 'relative', padding: '6rem 0 2rem', overflow: 'hidden' }}>
            <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '4rem', marginBottom: '4rem' }}>
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '1.5rem', color: 'var(--text-primary)', fontWeight: 700, fontSize: '1.5rem' }}>
                            <div className="nav-logo-container" style={{ width: 32, height: 32 }}></div>
                            InnerOrbit
                        </div>
                        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '2rem' }}>
                            Redefining privacy in the digital age.
                            Secure, fast, and completely anonymous.
                        </p>
                    </div>

                    <div>
                        <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '1.5rem' }}>Product</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <a href="#features" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--text-primary)'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>Features</a>
                            <a href="#download" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--text-primary)'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>Download</a>
                            <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--text-primary)'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>Changelog</a>
                        </div>
                    </div>

                    <div>
                        <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '1.5rem' }}>Legal</h4>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <a href="privacy-policy.html" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--text-primary)'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>Privacy Policy</a>
                            <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--text-primary)'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>Terms of Service</a>
                            <a href="#" style={{ color: 'var(--text-secondary)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseOver={e => e.target.style.color = 'var(--text-primary)'} onMouseOut={e => e.target.style.color = 'var(--text-secondary)'}>Security</a>
                        </div>
                    </div>

                    <div>
                        <h4 style={{ color: 'var(--text-primary)', fontWeight: 700, marginBottom: '1.5rem' }}>Connect</h4>
                        <div style={{ display: 'flex', gap: '1rem' }}>
                            {[
                                { id: 'x', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg> },
                                { id: 'gh', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" /></svg> },
                                { id: 'dc', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.419-2.1568 2.419z" /></svg> }
                            ].map(social => (
                                <a key={social.id} href="#" style={{
                                    width: '40px', height: '40px', borderRadius: '50%',
                                    background: 'rgba(128, 128, 128, 0.1)', display: 'flex',
                                    alignItems: 'center', justifyContent: 'center',
                                    color: 'var(--text-primary)', textDecoration: 'none',
                                    transition: 'all 0.3s',
                                    border: '1px solid var(--card-border)'
                                }}
                                    onMouseOver={e => {
                                        e.currentTarget.style.background = 'rgba(128, 128, 128, 0.2)';
                                        e.currentTarget.style.color = 'var(--accent-cyan)';
                                    }}
                                    onMouseOut={e => {
                                        e.currentTarget.style.background = 'rgba(128, 128, 128, 0.1)';
                                        e.currentTarget.style.color = 'var(--text-primary)';
                                    }}
                                >
                                    {social.icon}
                                </a>
                            ))}
                        </div>
                    </div>
                </div>

                <div style={{
                    paddingTop: '2rem',
                    borderTop: '1px solid var(--card-border)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '1rem'
                }}>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                            onClick={() => setTheme('default')}
                            title="Default Theme"
                            style={{
                                width: '36px', height: '36px', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.3s',
                                ...(theme === 'default' ? activeStyle : inactiveStyle)
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></svg>
                        </button>
                        <button
                            onClick={() => setTheme('light')}
                            title="Light Theme"
                            style={{
                                width: '36px', height: '36px', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.3s',
                                ...(theme === 'light' ? activeStyle : inactiveStyle)
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></svg>
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            title="Dark Theme"
                            style={{
                                width: '36px', height: '36px', borderRadius: '8px',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                cursor: 'pointer', transition: 'all 0.3s',
                                ...(theme === 'dark' ? activeStyle : inactiveStyle)
                            }}
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
                        </button>
                    </div>

                    {/* TEMPORARY FOOTER LOGOUT */}
                    <div style={{ display: 'flex', justifyContent: 'center' }}>
                        <button 
                            onClick={() => {
                                sessionStorage.removeItem('portalAccess');
                                window.location.href = 'index.html';
                            }}
                            style={{
                                padding: '8px 20px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                borderRadius: '10px',
                                color: '#ef4444',
                                fontSize: '0.85rem',
                                fontWeight: '700',
                                cursor: 'pointer',
                                backdropFilter: 'blur(10px)',
                                transition: 'all 0.3s'
                            }}
                            onMouseOver={e => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                                e.currentTarget.style.transform = 'translateY(-2px)';
                            }}
                            onMouseOut={e => {
                                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                                e.currentTarget.style.transform = 'translateY(0)';
                            }}
                        >
                            DEV: LOGOUT 🚪
                        </button>
                    </div>

                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        © 2026 InnerOrbit Inc. All rights reserved.
                    </div>
                </div>
            </div>
        </footer>
    );
};

const App = () => {
    useEffect(() => {
        // Signal that the portal is fully mounted and ready for the entrance animation
        window.PORTAL_READY = true;
        window.dispatchEvent(new CustomEvent('portal-ready'));
    }, []);

    return (
        <div style={{ overflowX: 'hidden' }}>
            <Navbar />
            <HeroSection />
            <SocialPrivacyComparison />
            <FeaturesSection />
            <WebSection />
            <DownloadSection />
            <Footer />
        </div>
    );
};

const root = ReactDOM.createRoot(document.getElementById('react-root'));
root.render(<App />);

// --- Move Angular Root Logic --- 
// We append the Angular root inside React's DOM flow after render or just keep it separate
// For simplicity, it stays in its own div #angular-docs-root which is visually placed above via CSS or moved




// --- LEGACY LOGIC ---
// Smooth Scroll
const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // https://www.desmos.com/calculator/brs54l4xou
    direction: 'vertical', // vertical, horizontal
    gestureDirection: 'vertical', // vertical, horizontal, both
    smooth: true,
    mouseMultiplier: 1,
    smoothTouch: false,
    touchMultiplier: 2,
});

// Connect Lenis to ScrollTrigger
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
});
gsap.ticker.lagSmoothing(0);
// Download Logic
// Dynamically fetch latest desktop installer URL from Firestore (app/version.downloadUrl)
async function getDesktopInstallerUrl() {
    try {
        const docRef = db.collection('app').doc('version');
        const snap = await docRef.get();
        if (snap.exists) {
            const data = snap.data();
            if (data && data.downloadUrl) return data.downloadUrl;
        }
        return null;
    } catch (err) {
        console.error('Failed to fetch desktop installer URL:', err);
        return null;
    }
}

// --- Custom Modal Logic ---
function showCustomModal(title, message, icon = '✨') {
    const modal = document.getElementById('customModal');
    const modalTitle = document.getElementById('customModalTitle');
    const modalMessage = document.getElementById('customModalMessage');
    const modalIcon = document.getElementById('customModalIcon');
    const closeBtn = document.getElementById('closeCustomModal');

    if (modal && modalTitle && modalMessage) {
        modalTitle.textContent = title;
        modalMessage.textContent = message;
        modalIcon.textContent = icon;
        modal.style.display = 'flex';

        // Animation
        gsap.fromTo(modal.firstElementChild,
            { scale: 0.8, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.3, ease: "back.out(1.7)" }
        );

        const closeHandler = () => {
            gsap.to(modal.firstElementChild, {
                scale: 0.8, opacity: 0, duration: 0.2,
                onComplete: () => modal.style.display = 'none'
            });
            closeBtn.removeEventListener('click', closeHandler);
        };

        closeBtn.addEventListener('click', closeHandler);

        // Close on outside click
        modal.onclick = (e) => {
            if (e.target === modal) closeHandler();
        };
    } else {
        // Fallback if modal elements missing
        alert(`${title}\n\n${message}`);
    }
}

window.downloadFile = async function (platform) {
    const playstoreB64 = 'aHR0cHM6Ly95b3VyLXN0b3JhZ2UuY29tL2NpcGhlcnBsYXkuYXBr';
    try {
        if (platform === 'windows') {
            // DEPLOYMENT: Serving Zipped Installer (Bypasses .exe blocking)
            const url = "downloads/InnerOrbit_Setup_1.0.0.zip";

            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'InnerOrbit_Setup_1.0.0.zip');
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            showCustomModal('Downloading...', 'Your download has started.\n\n📂 Please UNZIP the file to install InnerOrbit.', '📦');
        } else if (platform === 'playstore') {
            const url = atob(playstoreB64);
            const link = document.createElement('a');
            link.href = url;
            link.target = '_blank';
            link.rel = 'noopener';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    } catch (e) { console.error(e); }
};
