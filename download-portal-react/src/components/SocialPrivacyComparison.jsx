import { motion } from 'framer-motion';
import { Smartphone, Calculator, X, Check } from 'lucide-react';

export default function SocialPrivacyComparison() {
    return (
        <section id="social-privacy" className="bg-social" style={{ padding: '8rem 0', position: 'relative' }}>
            <div className="container">
                <div style={{ textAlign: 'center', marginBottom: '5rem' }}>
                    <motion.h2
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-primary)' }}
                    >
                        Social Privacy vs. <span style={{ color: 'var(--text-secondary)' }}>Normal Apps</span>
                    </motion.h2>
                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', maxWidth: '700px', margin: '0 auto' }}
                    >
                        Most apps think privacy ends at encryption. We believe it begins with how you exist in the digital world.
                    </motion.p>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
                    {/* Standard Apps Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="comparison-card hover-scale"
                        style={{
                            /* background removed to use CSS class */
                        }}
                    >
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Smartphone size={24} />
                            Normal Apps
                        </div>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-secondary)', padding: 0, listStyle: 'none' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <X size={20} color="#ef4444" /> Visible notifications on lock screen
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <X size={20} color="#ef4444" /> Anyone can see you're using the app
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <X size={20} color="#ef4444" /> Metadata is often logged
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <X size={20} color="#ef4444" /> "Delete" doesn't always mean delete
                            </li>
                        </ul>
                    </motion.div>

                    {/* InnerOrbit Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6, delay: 0.2 }}
                        className="comparison-card hover-scale"
                        style={{
                            borderColor: 'var(--accent-purple)'
                        }}
                    >
                        <div style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Calculator size={24} color="#f59e0b" />
                            InnerOrbit
                        </div>
                        <ul style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', color: 'var(--text-primary)', padding: 0, listStyle: 'none' }}>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Check size={20} color="#22d3ee" /> <strong>Camouflage Mode:</strong> App looks like a calculator
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Check size={20} color="#22d3ee" /> <strong>Private Language:</strong> Slang auto-translation
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Check size={20} color="#22d3ee" /> <strong>Ghost Notifications:</strong> Discreet vibrations only
                            </li>
                            <li style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <Check size={20} color="#22d3ee" /> <strong>Panic Wipe:</strong> Shake to destroy data
                            </li>
                        </ul>
                    </motion.div>
                </div>
            </div>
        </section>
    );
}
