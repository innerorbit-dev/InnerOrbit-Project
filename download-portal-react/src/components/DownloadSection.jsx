import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import playStoreIcon from '../assets/download-icons/playstore.webp';
import windowsIcon from '../assets/download-icons/window.png';

export default function DownloadSection() {

    const handleDownload = (platform) => {
        // Original Logic:
        // const _0x4a2b = ['aHR0cHM6Ly95b3VyLXN0b3JhZ2UuY29tL2NpcGhlcnBsYXkuYXBr', 'aHR0cHM6Ly95b3VyLXN0b3JhZ2UuY29tL2NpcGhlcnBsYXkuZXhl'];
        // const idx = platform === 'playstore' ? 0 : 1;

        // Simulating the secure link retrieval
        alert(`Secure download started for ${platform}. (Simulated)`);
    };

    return (
        <section id="download" className="bg-download" style={{ position: 'relative', padding: '8rem 0', overflow: 'hidden' }}>
            <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                <motion.div
                    id="download-container"
                    initial={{ scale: 0.9, opacity: 0 }}
                    whileInView={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.8 }}
                    viewport={{ once: true }}
                    style={{
                        borderRadius: '32px',
                        padding: '4rem',
                        textAlign: 'center'
                    }}
                >
                    <h2 style={{ fontSize: '3.5rem', fontWeight: 900, marginBottom: '1.5rem', color: '#0f172a' }}>
                        Start Your <span className="gradient-text">Secure Journey</span>
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1.2rem', marginBottom: '3rem', maxWidth: '600px', margin: '0 auto 3rem' }}>
                        Be among the first to reclaim your digital privacy.
                        Available on Android and Windows.
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'center', gap: '2rem', flexWrap: 'wrap' }}>
                        {/* Play Store Button */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDownload('Google Play')}
                            className="btn"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '15px',
                                padding: '16px 32px', fontSize: '1.1rem',
                                background: 'linear-gradient(135deg, #0ea5e9, #2563eb)'
                            }}
                        >
                            <img src={playStoreIcon} alt="Play Store" style={{ width: 30, height: 30 }} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase' }}>Get it on</div>
                                <div style={{ fontWeight: 700 }}>Google Play</div>
                            </div>
                        </motion.button>

                        {/* Windows Button */}
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleDownload('Windows')}
                            className="btn"
                            style={{
                                display: 'flex', alignItems: 'center', gap: '15px',
                                padding: '16px 32px', fontSize: '1.1rem',
                                background: 'linear-gradient(135deg, #0f172a, #334155)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <img src={windowsIcon} alt="Windows" style={{ width: 30, height: 30 }} />
                            <div style={{ textAlign: 'left' }}>
                                <div style={{ fontSize: '0.7rem', opacity: 0.8, textTransform: 'uppercase' }}>Download for</div>
                                <div style={{ fontWeight: 700 }}>Windows 10/11</div>
                            </div>
                        </motion.button>
                    </div>

                    <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '2rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Check size={16} color="var(--accent-cyan)" /> v2.4.0 Stable
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Check size={16} color="var(--accent-cyan)" /> 64-bit Optimized
                        </span>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Check size={16} color="var(--accent-cyan)" /> Verified Secure
                        </span>
                    </div>
                </motion.div>
            </div>
        </section>
    );
}
