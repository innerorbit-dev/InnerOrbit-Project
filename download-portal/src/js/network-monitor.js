// network-monitor.js
// Standalone Network Monitoring Module for InnerOrbit Portal

(function () {
    let notificationTimeout;

    // Inject Styles
    const styleSheet = document.createElement("style");
    styleSheet.textContent = `
        #networkNotification {
            position: fixed;
            top: -80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(255, 165, 0, 0.9);
            color: #000;
            padding: 12px 25px;
            border-radius: 0 0 15px 15px;
            font-family: 'Inter', sans-serif;
            font-weight: bold;
            box-shadow: 0 4px 20px rgba(0,0,0,0.4);
            z-index: 99999;
            transition: top 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 15px;
            backdrop-filter: blur(5px);
            pointer-events: auto;
        }
        #networkNotification button {
            background: none; 
            border: none; 
            color: inherit; 
            font-weight: bold; 
            cursor: pointer; 
            font-size: 16px;
            padding: 0 5px;
            opacity: 0.7;
            transition: opacity 0.2s;
        }
        #networkNotification button:hover {
            opacity: 1;
        }
    `;
    document.head.appendChild(styleSheet);

    function createNotification() {
        if (document.getElementById('networkNotification')) return;

        const div = document.createElement('div');
        div.id = 'networkNotification';
        div.innerHTML = `
            <span id="netMsg">Message</span>
            <button id="netCloseBtn">✕</button>
        `;
        document.body.appendChild(div);

        document.getElementById('netCloseBtn').onclick = () => {
            div.style.top = '-80px';
        };
    }

    // State
    let isOffline = !navigator.onLine;
    let isSlow = false;
    let isBackOnline = false; // State to track "Back Online" notification
    let pingInterval;

    // Cooldown logic for Slow Network notifications
    let lastSlowNotificationTime = 0;
    const SLOW_NOTIFICATION_COOLDOWN = 60 * 60 * 1000; // 1 Hour

    function showStatus() {
        let notification = document.getElementById('networkNotification');
        if (!notification) {
            createNotification();
            notification = document.getElementById('networkNotification');
        }

        const msgSpan = notification.querySelector('#netMsg');

        if (notificationTimeout) clearTimeout(notificationTimeout);

        if (isOffline) {
            // Priority 1: Offline (Redirect to Offline Page)
            if (!window.location.pathname.includes('offline.html')) {
                // Save current page to return to later
                sessionStorage.setItem('lastPage', window.location.href);
                // Redirect
                window.location.href = 'offline.html';
            }
        } else if (isBackOnline) {
            // Priority 2: Back Online (Show briefly)
            msgSpan.innerText = "✅ Back Online";
            notification.style.background = "rgba(34, 197, 94, 0.95)"; // Green
            notification.style.top = "0";

            notificationTimeout = setTimeout(() => {
                isBackOnline = false;
                showStatus(); // Re-evaluate to hide or show slow status
            }, 3000);
        } else if (isSlow) {
            // Priority 3: Slow Network (With cooldown)
            const now = Date.now();
            if (now - lastSlowNotificationTime > SLOW_NOTIFICATION_COOLDOWN) {
                lastSlowNotificationTime = now;

                msgSpan.innerText = "🚀 Network Slow - Optimization Active";
                notification.style.background = "rgba(255, 165, 0, 0.95)";
                notification.style.top = "0";

                notificationTimeout = setTimeout(() => {
                    notification.style.top = "-80px";
                }, 5000); // 5s Auto-hide
            }
            // If cooldown hasn't passed, do nothing
        } else {
            // Everything good
            notification.style.top = "-80px";
        }
    }

    async function verifyConnection() {
        // Active check to confirm status (Ping)
        const start = Date.now();
        try {
            // Changed to root path '/' for reliable connectivity check
            const response = await fetch('/', {
                method: 'HEAD',
                cache: 'no-store',
                headers: { 'Cache-Control': 'no-cache' }
            });
            const duration = Date.now() - start;

            // Hard check validation
            if (!response.ok) {
                isOffline = true;
            } else {
                isOffline = false;
                // If ping takes > 3s (relaxed from 2s), it's definitely slow
                if (duration > 3000) isSlow = true;
            }
        } catch (e) {
            isOffline = true;
        }
        showStatus();
    }

    function checkNetworkQuality() {
        // 1. Instant check using Browser Network Information API (Efficient)
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

        // Reset flags tentatively
        isSlow = false;

        if (connection) {
            // RTT > 1000ms (relaxed from 600ms)
            // Downlink < 1.0 Mbps (relaxed from 1.5 Mbps)
            if ((connection.rtt && connection.rtt > 1000) ||
                (connection.downlink && connection.downlink < 1.0) ||
                connection.saveData ||
                connection.effectiveType?.includes('2g')) {
                isSlow = true;
            }

            // Attach debug info to console for developer verification
            console.log(`[NetMonitor] RTT: ${connection.rtt}ms, Downlink: ${connection.downlink}Mbps, Effective: ${connection.effectiveType}`);
        }

        // 2. Fallback: If disconnected, explicitly check
        if (!navigator.onLine) {
            isOffline = true;
        } else {
            isOffline = false;
        }

        showStatus();
    }

    // MASTER SWITCH: Change to true to enable Service Worker, false to disable
    const ENABLE_SERVICE_WORKER = false;

    // Initialize
    window.addEventListener('load', () => {
        // Register Service Worker for Offline Support (Controlled by Master Switch)
        if ('serviceWorker' in navigator && ENABLE_SERVICE_WORKER) {
            navigator.serviceWorker.register('/sw.js')
                .then(reg => console.log('[NetMonitor] SW Registered'))
                .catch(err => {
                    // Service Worker registration failed - continue without it
                    console.log('[NetMonitor] SW Not Available:', err.message);
                });
        }

        createNotification();
        checkNetworkQuality();
        verifyConnection(); // Initial Active Ping

        // Passive: Listen to API changes (Very Efficient)
        if (navigator.connection) {
            navigator.connection.addEventListener('change', checkNetworkQuality);
        }

        // Active: Low frequency polling (every 20s) just to be safe
        pingInterval = setInterval(verifyConnection, 20000);
    });

    // Event Listeners
    window.addEventListener('online', () => {
        if (isOffline) {
            isOffline = false;
            isBackOnline = true; // Trigger "Back Online"
            showStatus();

            checkNetworkQuality();
            verifyConnection();
        }
    });

    window.addEventListener('offline', () => {
        isOffline = true;
        showStatus();
    });

})();
