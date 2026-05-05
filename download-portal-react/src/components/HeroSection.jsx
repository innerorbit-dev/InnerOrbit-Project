import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
// Privacy level icons
import { MessageCircle, Hash, Calculator, Shield, AlertCircle, ArrowDown } from 'lucide-react';

// Images (Need placeholders or valid paths - using what I know exists)
// Original used CSS background images/divs for mockups. 
// For now, I will keep the structure but rely on the complex CSS in index.css for the "hero-animate-window" and "hero-animate-phone".
// Or I should put the HTML structure that matches the CSS.

// Images (Need placeholders or valid paths - using what I know exists)
// Original used CSS background images/divs for mockups. 
// For now, I will keep the structure but rely on the complex CSS in index.css for the "hero-animate-window" and "hero-animate-phone".
// Or I should put the HTML structure that matches the CSS.


const PRIVACY_LEVELS = [
    { id: 0, title: "Normal Chat", desc: "Standard E2E Encryption", color: "#22d3ee", icon: <MessageCircle size={20} /> },
    { id: 1, title: "Private Language", desc: "Anti-Peek Text Reversal", color: "#a855f7", icon: <Hash size={20} /> },
    { id: 2, title: "Camouflage Mode", desc: "Disguised UI (Calc/News)", color: "#f59e0b", icon: <Calculator size={20} /> },
    { id: 3, title: "Auto Safety", desc: "Auto-Screen Shield", color: "#ef4444", icon: <Shield size={20} /> },
    { id: 4, title: "Emergency", desc: "Decoy mode activated", color: "#f43f5e", icon: <AlertCircle size={20} /> }
];

export default function HeroSection() {
    return (
        <section id="hero" className="bg-hero" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', paddingTop: '80px', position: 'relative', overflow: 'hidden' }}>

            {/* Background Visuals defined in CSS .bg-hero::before/after */}

            <div className="container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 10, textAlign: 'center' }}>

                <div id="hero-text" style={{ maxWidth: '900px', margin: '0 auto' }}>
                    <motion.h1
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, ease: "easeOut" }}
                        style={{ fontSize: 'clamp(3.5rem, 6vw, 5.5rem)', fontWeight: 900, lineHeight: 1.1, marginBottom: '2rem', letterSpacing: '-0.02em' }}
                    >
                        The Future of <br />
                        <span className="gradient-text">Social Privacy.</span>
                    </motion.h1>

                    <motion.p
                        initial={{ opacity: 0, y: 40 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        style={{ fontSize: '1.3rem', color: '#94a3b8', lineHeight: 1.7, marginBottom: '2rem', maxWidth: '800px', margin: '0 auto 2rem' }}
                    >
                        More than just encryption. Control who sees what with 5 levels of social stealth—from casual chats to complete invisibility.
                    </motion.p>

                    {/* Privacy Levels Preview Marquee */}
                    <motion.div
                        initial={{ opacity: 0, y: 30 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.4 }}
                        style={{
                            marginBottom: '3rem',
                            width: '100%',
                            maskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                            WebkitMaskImage: 'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
                            overflow: 'hidden'
                        }}>
                        <div className="marquee-content" style={{
                            display: 'flex', gap: '15px', width: 'max-content',
                            animation: 'marquee 25s linear infinite',
                            margin: '0 auto'
                        }}>
                            {[...PRIVACY_LEVELS, ...PRIVACY_LEVELS].map((level, i) => (
                                <div key={i} title={level.title} style={{
                                    padding: '12px 16px', borderRadius: '12px',
                                    background: 'rgba(255,255,255,0.03)', border: `1px solid ${level.color}30`,
                                    display: 'flex', alignItems: 'center', gap: '10px',
                                    minWidth: '140px', backdropFilter: 'blur(5px)',
                                    textAlign: 'left'
                                }}>
                                    <div style={{ color: level.color }}>{level.icon}</div>
                                    <div>
                                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#e2e8f0' }}>{level.title}</div>
                                        <div style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{level.desc}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.6 }}
                        style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}
                    >
                        <a href="#download" className="btn" style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', padding: '16px 32px' }}>
                            Download App
                        </a>
                        <a href="#social-privacy" className="btn" style={{ background: 'transparent', borderColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.1rem', padding: '16px 32px' }}>
                            See Comparison
                        </a>
                    </motion.div>
                </div>
            </div>

            {/* Scroll Down Indicator */}
            <motion.div
                className="scroll-indicator"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5, duration: 1 }}
                style={{
                    position: 'absolute', bottom: '10px', left: '50%', transform: 'translateX(-50%)',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px',
                    color: 'rgba(255,255,255,0.7)', zIndex: 20, cursor: 'pointer',
                    textShadow: '0 0 10px rgba(255,255,255,0.3)'
                }}
                onClick={() => document.getElementById('social-privacy')?.scrollIntoView({ behavior: 'smooth' })}
            >
                <span style={{ fontSize: '0.8rem', letterSpacing: '2px', textTransform: 'uppercase' }}>Scroll</span>
                <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                >
                    <ArrowDown />
                </motion.div>
            </motion.div>

            <style>{`
            @keyframes marquee {
                0% { transform: translateX(0); }
                100% { transform: translateX(-50%); }
            }
        `}</style>
        </section>
    );
}
