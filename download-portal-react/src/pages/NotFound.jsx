import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldAlert, Clock, Ticket, Home, RefreshCw, Terminal } from 'lucide-react';

const NotFound = () => {
    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const isLocked = queryParams.get('error') === 'locked';

    // Configuration
    const LOCKOUT_DURATION = 2 * 60 * 1000; // 2 minutes in ms

    const [mode, setMode] = useState('404'); // '404' or 'locked'
    const [timeLeft, setTimeLeft] = useState('--:--');
    const [ticketId, setTicketId] = useState('--');
    const [showAdminPanel, setShowAdminPanel] = useState(false);

    useEffect(() => {
        const checkLockout = () => {
            const lockoutTimestamp = localStorage.getItem('lockoutTimestamp');
            const now = Date.now();

            if (isLocked || (lockoutTimestamp && (now - parseInt(lockoutTimestamp)) < LOCKOUT_DURATION)) {
                let timestamp = lockoutTimestamp ? parseInt(lockoutTimestamp) : now;
                if (!lockoutTimestamp) {
                    localStorage.setItem('lockoutTimestamp', timestamp);
                }
                setMode('locked');
                startTimer(timestamp);
                handleTicketDisplay(timestamp);
            } else {
                setMode('404');
            }
        };

        checkLockout();
    }, [isLocked]);

    const startTimer = (startTime) => {
        const update = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const remaining = LOCKOUT_DURATION - elapsed;

            if (remaining <= 0) {
                setTimeLeft('00:00');
                unlockSystem();
            } else {
                const minutes = Math.floor(remaining / 60000);
                const seconds = Math.floor((remaining % 60000) / 1000);
                setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
                requestAnimationFrame(update);
            }
        };
        update();
    };

    const handleTicketDisplay = (timestamp) => {
        const TWELVE_HOURS = 12 * 60 * 60 * 1000;
        let visits = JSON.parse(localStorage.getItem('lockoutVisits') || '{"count": 0, "firstSeen": 0}');
        const now = Date.now();

        if (now - visits.firstSeen > TWELVE_HOURS) {
            visits = { count: 1, firstSeen: now };
        } else {
            visits.count++;
        }

        localStorage.setItem('lockoutVisits', JSON.stringify(visits));

        if (visits.count >= 3) {
            const randomSuffix = Math.floor(Math.random() * 9000) + 1000;
            setTicketId(`SEC-${timestamp.toString().slice(-6)}-${randomSuffix}`);
            setShowAdminPanel(true);
        }
    };

    const unlockSystem = () => {
        localStorage.removeItem('lockoutTimestamp');
        localStorage.removeItem('failedAttempts');
        // In a real app, we'd redirect or refresh
    };

    const isLockedMode = mode === 'locked';
    const primaryColor = isLockedMode ? '#ff3333' : '#00ff00';
    const glowColor = isLockedMode ? 'rgba(255, 51, 51, 0.6)' : 'rgba(0, 255, 0, 0.4)';

    return (
        <div style={{
            backgroundColor: '#050505',
            backgroundImage: `linear-gradient(${primaryColor}08 1px, transparent 1px), linear-gradient(90deg, ${primaryColor}08 1px, transparent 1px)`,
            backgroundSize: '30px 30px',
            color: primaryColor,
            fontFamily: "'Courier New', Courier, monospace",
            margin: 0,
            padding: '20px',
            height: '100vh',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            position: 'relative',
            overflow: 'hidden'
        }}>
            {/* Scanlines Effect */}
            <div style={{
                position: 'fixed',
                top: 0, left: 0, width: '100%', height: '100%',
                background: 'linear-gradient(to bottom, rgba(255,255,255,0), rgba(255,255,255,0) 50%, rgba(0,0,0,0.2) 50%, rgba(0,0,0,0.2))',
                backgroundSize: '100% 4px',
                pointerEvents: 'none',
                zIndex: 10
            }} />

            <h1 style={{
                fontSize: '1.25rem',
                textTransform: 'uppercase',
                letterSpacing: '2px',
                marginBottom: '10px',
                borderBottom: `1px solid ${primaryColor}`,
                paddingBottom: '10px',
                display: 'inline-block'
            }}>
                {isLockedMode ? 'SECURITY ALERT' : 'InnerOrbit Portal'}
            </h1>

            <div style={{ width: '100%', margin: '40px 0' }}>
                <div style={{
                    fontSize: 'clamp(2.5rem, 8vw, 6rem)',
                    fontWeight: 'bold',
                    textShadow: `0 0 10px ${glowColor}`,
                    lineHeight: '1.1',
                    wordWrap: 'break-word',
                    marginBottom: '1rem'
                }}>
                    {isLockedMode ? 'ACCESS LOCKED' : 'ERROR 404'}
                </div>
                <div style={{ fontSize: '1.2rem', opacity: 0.8 }}>
                    {isLockedMode ? 'Maximum attempts exceeded.' : 'Page Not Found'}
                </div>
            </div>

            {isLockedMode && (
                <div style={{
                    fontSize: '3rem',
                    color: '#ffffff',
                    margin: '20px 0',
                    fontWeight: 'bold',
                    fontFamily: 'monospace',
                    textShadow: '0 0 15px rgba(255,255,255,0.3)'
                }}>
                    {timeLeft}
                </div>
            )}

            {showAdminPanel && (
                <div style={{
                    marginTop: '30px',
                    border: '1px solid #ff3333',
                    padding: '2rem',
                    width: '90%',
                    maxWidth: '500px',
                    background: 'rgba(255, 51, 51, 0.05)',
                    borderRadius: '12px',
                    animation: 'fadeIn 0.5s ease'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: '#ff6666', fontWeight: 'bold', textTransform: 'uppercase', marginBottom: '1rem' }}>
                        <ShieldAlert size={18} />
                        Support Assistance
                    </div>
                    <div style={{ fontSize: '0.9rem', marginBottom: '8px', color: '#ffcccc' }}>Ticket Reference ID:</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ffffff', letterSpacing: '2px', marginBottom: '1rem' }}>{ticketId}</div>
                    <div style={{ fontSize: '0.85rem', color: '#ff6666', lineHeight: '1.5' }}>
                        Please provide this ID to the system administrator to manually unlock your terminal.
                    </div>
                </div>
            )}

            {!isLockedMode ? (
                <Link to="/" style={{
                    background: 'transparent',
                    color: primaryColor,
                    border: `1px solid ${primaryColor}`,
                    padding: '12px 32px',
                    fontSize: '1rem',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                    textDecoration: 'none',
                    marginTop: '30px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                }}
                    className="action-btn-hover"
                >
                    <Home size={18} />
                    [ Return to Home ]
                </Link>
            ) : (
                <button
                    onClick={() => window.location.reload()}
                    style={{
                        background: 'transparent',
                        color: primaryColor,
                        border: `1px solid ${primaryColor}`,
                        padding: '12px 32px',
                        fontSize: '1rem',
                        textTransform: 'uppercase',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                        textDecoration: 'none',
                        marginTop: '30px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px'
                    }}
                >
                    <RefreshCw size={18} />
                    [ Manual Sync ]
                </button>
            )}

            <style>{`
                .action-btn-hover:hover {
                    background: ${primaryColor} !important;
                    color: #000 !important;
                    box-shadow: 0 0 20px ${glowColor} !important;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default NotFound;
