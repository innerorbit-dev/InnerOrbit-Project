import { motion } from 'framer-motion';
import { Calculator, Lock, Trash2, Smartphone, User, AlertTriangle } from 'lucide-react';

export default function FeaturesSection() {
    const features = [
        { title: "Stealth Mode", desc: "Disguised as a functional calculator.", icon: <Calculator size={30} /> },
        { title: "Dual-Layer Encryption", desc: "AES-256 + RSA-2048 encryption.", icon: <Lock size={30} /> },
        { title: "Self-Destruct", desc: "Messages vanish without a trace.", icon: <Trash2 size={30} /> },
        { title: "Cross-Platform", desc: "Seamless sync across all devices.", icon: <Smartphone size={30} /> },
        { title: "Anonymous ID", desc: "No phone number required.", icon: <User size={30} /> },
        { title: "Panic Switch", desc: "Instant wipe with a secret gesture.", icon: <AlertTriangle size={30} /> }
    ];

    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 30 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 50 } }
    };

    return (
        <section id="features" className="bg-features" style={{ position: 'relative', padding: '8rem 0' }}>
            <div className="container" style={{ position: 'relative', zIndex: 10 }}>
                <div style={{ textAlign: 'center', marginBottom: '4rem' }}>
                    <h2 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem', color: '#0f172a' }}>
                        Your Privacy, <span className="gradient-text">Your Control</span>
                    </h2>
                    <p style={{ color: '#64748b', fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto' }}>
                        Built for those who demand absolute secrecy. Your data never leaves your device unencrypted.
                    </p>
                </div>

                <motion.div
                    className="feature-grid"
                    variants={container}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true, margin: "-100px" }}
                >
                    {features.map((f, i) => (
                        <motion.div
                            key={i}
                            variants={item}
                            className="feature-card"
                            style={{ border: '1px solid #e2e8f0', background: 'white' }}
                        >
                            <div style={{
                                width: '60px', height: '60px', borderRadius: '16px',
                                background: 'rgba(6, 182, 212, 0.1)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
                                color: '#0891b2'
                            }}>
                                {f.icon}
                            </div>
                            <h3 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', fontWeight: 700, color: '#0f172a' }}>{f.title}</h3>
                            <p style={{ color: '#64748b', lineHeight: 1.6 }}>{f.desc}</p>
                        </motion.div>
                    ))}
                </motion.div>
            </div>
        </section>
    );
}
