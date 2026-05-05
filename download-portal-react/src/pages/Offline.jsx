import { useState, useEffect } from 'react';
import { WifiOff, RefreshCw, AlertTriangle, SignalHigh } from 'lucide-react';

const Offline = () => {
    const [isRetrying, setIsRetrying] = useState(false);
    const [status, setStatus] = useState('');
    const [timeLeft, setTimeLeft] = useState(5);

    useEffect(() => {
        let timer;
        if (timeLeft > 0 && !isRetrying) {
            timer = setTimeout(() => setTimeLeft(prev => prev - 1), 1000);
        } else if (timeLeft === 0 && !isRetrying) {
            checkConnection();
        }
        return () => clearTimeout(timer);
    }, [timeLeft, isRetrying]);

    const checkConnection = async () => {
        setIsRetrying(true);
        setStatus('Pinging server...');

        try {
            // Using a simple fetch to a known endpoint or just the root
            const response = await fetch('/', { method: 'HEAD', cache: 'no-store' });
            if (response.ok) {
                setStatus('Connection restored! Redirecting...');
                setTimeout(() => {
                    const returnUrl = sessionStorage.getItem('lastPage') || '/';
                    window.location.href = returnUrl;
                }, 1000);
            } else {
                handleFailure();
            }
        } catch (error) {
            handleFailure();
        }
    };

    const handleFailure = () => {
        setStatus('Still offline. Retrying soon...');
        setIsRetrying(false);
        setTimeLeft(5);
    };

    return (
        <div style={{
            margin: 0,
            padding: 0,
            backgroundColor: '#020617',
            color: '#f8fafc',
            fontFamily: "'Inter', sans-serif",
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            overflow: 'hidden',
            textAlign: 'center',
            position: 'relative'
        }}>
            {/* Background Mesh */}
            <div style={{
                position: 'absolute',
                top: 0, left: 0, width: '100%', height: '100%',
                zIndex: 1,
                opacity: 0.1,
                backgroundImage: 'linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
                backgroundSize: '50px 50px'
            }} />

            <div style={{ position: 'relative', zIndex: 10, padding: '2rem', maxWidth: '500px' }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '2rem' }}>
                    <div style={{ position: 'relative' }}>
                        <WifiOff size={80} color="#ef4444" style={{ filter: 'drop-shadow(0 0 10px rgba(239, 68, 68, 0.4))' }} />
                        <div className="ripple-container" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '100%', height: '100%' }}>
                            <div className="ripple"></div>
                            <div className="ripple" style={{ animationDelay: '0.5s' }}></div>
                            <div className="ripple" style={{ animationDelay: '1s' }}></div>
                        </div>
                    </div>
                </div>

                <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '1rem', color: '#ef4444', textShadow: '0 0 15px rgba(239, 68, 68, 0.3)' }}>
                    CONNECTION LOST
                </h1>

                <p style={{ fontSize: '1.1rem', color: '#94a3b8', marginBottom: '2.5rem', lineHeight: 1.6 }}>
                    Your system has lost communication with the network. <br />
                    Please check your internet connection to access the portal.
                </p>

                <button
                    onClick={checkConnection}
                    disabled={isRetrying}
                    style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        color: 'white',
                        padding: '14px 40px',
                        fontSize: '1rem',
                        borderRadius: '12px',
                        cursor: isRetrying ? 'not-allowed' : 'pointer',
                        transition: 'all 0.3s ease',
                        fontWeight: 600,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        margin: '0 auto'
                    }}
                    className="retry-button"
                >
                    <RefreshCw size={18} className={isRetrying ? 'spin' : ''} />
                    {isRetrying ? 'Checking...' : 'Retry Connection Now'}
                </button>

                <div style={{ marginTop: '24px', fontSize: '0.9rem', color: '#64748b', minHeight: '20px', fontWeight: 500 }}>
                    {status || `Auto-retrying in ${timeLeft}s...`}
                </div>
            </div>

            <style>{`
                .retry-button:hover:not(:disabled) {
                    background: rgba(255, 255, 255, 0.1);
                    border-color: rgba(255, 255, 255, 0.3);
                    transform: translateY(-2px);
                }
                .spin {
                    animation: spin 1s linear infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .ripple {
                    position: absolute;
                    width: 100%;
                    height: 100%;
                    border: 2px solid #ef4444;
                    border-radius: 50%;
                    opacity: 0;
                    animation: ripple 2s infinite ease-out;
                }
                @keyframes ripple {
                    0% { transform: scale(0.5); opacity: 0; }
                    50% { opacity: 0.3; }
                    100% { transform: scale(1.5); opacity: 0; }
                }
            `}</style>
        </div>
    );
};

export default Offline;
