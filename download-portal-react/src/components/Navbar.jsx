import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Download, Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import logoImg from '../assets/logos/innerorbit-logo.png';
import downloadIcon from '../assets/download-icons/download-icon -button-for-nav.webp';

export default function Navbar() {
    const [scrolled, setScrolled] = useState(false);
    const [menuOpen, setMenuOpen] = useState(false);

    useEffect(() => {
        const handleScroll = () => {
            setScrolled(window.scrollY > 20);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Features', href: '/#features' },
        { name: 'Download', href: '/#download' },
        { name: 'Docs', href: '/docs' },
    ];

    return (
        <nav
            style={{
                position: 'fixed',
                top: 0, left: 0, right: 0,
                zIndex: 1000,
                transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                background: scrolled || menuOpen ? 'rgba(2, 6, 23, 0.8)' : 'transparent',
                backdropFilter: scrolled || menuOpen ? 'blur(20px) saturate(180%)' : 'none',
                borderBottom: scrolled || menuOpen ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
                padding: scrolled ? '10px 0' : '20px 0'
            }}
        >
            <div className="container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                {/* Logo with Layout Animation */}
                <Link to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1002 }}>
                    <div style={{
                        fontSize: '1.5rem',
                        fontWeight: 700,
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        letterSpacing: '-0.02em',
                    }}>
                        <motion.div
                            layoutId="logo"
                            style={{
                                width: 44,
                                height: 44,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                        >
                            <img
                                src={logoImg}
                                alt="InnerOrbit"
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                            />
                        </motion.div>
                        <span>InnerOrbit</span>
                    </div>
                </Link>

                {/* Desktop Links */}
                <div className="desktop-nav" style={{ display: 'flex', gap: '2rem', alignItems: 'center' }}>
                    {navLinks.map(link => (
                        <a
                            key={link.name}
                            href={link.href}
                            className="nav-link"
                            style={{
                                color: 'rgba(255,255,255,0.8)',
                                textDecoration: 'none',
                                fontWeight: 500,
                                fontSize: '0.95rem'
                            }}
                        >
                            {link.name}
                        </a>
                    ))}

                    <a href="#download" className="nav-btn" style={{
                        padding: '10px 24px',
                        fontSize: '0.9rem',
                        borderRadius: '12px',
                        display: 'flex', alignItems: 'center', gap: '8px',
                        textDecoration: 'none',
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        backdropFilter: 'blur(10px)',
                        fontWeight: 600
                    }}>
                        <span>Get App</span>
                        <img src={downloadIcon} alt="" style={{ width: 18, height: 18 }} />
                    </a>
                </div>

                {/* Mobile Menu Toggle */}
                <button
                    className="mobile-menu-btn"
                    onClick={() => setMenuOpen(!menuOpen)}
                    aria-label="Toggle Menu"
                    style={{
                        display: 'none', // Controlled by CSS media query
                        background: 'rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(10px)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        color: 'white',
                        padding: '8px',
                        cursor: 'pointer',
                        zIndex: 2000
                    }}
                >
                    {menuOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </div>

            {/* Mobile Drawer */}
            {menuOpen && (
                <motion.div
                    initial={{ x: '100%' }}
                    animate={{ x: 0 }}
                    exit={{ x: '100%' }}
                    transition={{ type: 'tween', duration: 0.3 }}
                    style={{
                        position: 'fixed',
                        top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '300px',
                        background: 'rgba(2, 6, 23, 0.95)',
                        backdropFilter: 'blur(20px)',
                        zIndex: 1001,
                        padding: '100px 20px',
                        display: 'flex', flexDirection: 'column', gap: '2rem',
                        borderLeft: '1px solid rgba(255,255,255,0.1)'
                    }}
                >
                    {navLinks.map(link => (
                        <a
                            key={link.name}
                            href={link.href}
                            onClick={() => setMenuOpen(false)}
                            style={{ color: 'white', fontSize: '1.5rem', textDecoration: 'none', fontWeight: 500 }}
                        >
                            {link.name}
                        </a>
                    ))}
                    <a href="#download" className="btn" onClick={() => setMenuOpen(false)} style={{ textAlign: 'center' }}>
                        Download Now
                    </a>
                </motion.div>
            )}
        </nav>
    );
}
