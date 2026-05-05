/**
 * InnerOrbit Authentication Module
 * Handles session verification and security checks.
 */

(function () {
    const AUTH_CONFIG = {
        SESSION_KEY: 'portalAccess',
        // TIME_KEY: 'accessTime', // No longer needed
        // SESSION_DURATION: 60 * 60 * 1000, // Unlimited session
        LOGIN_PAGE: 'index.html'
    };

    function checkAuthentication() {
        // Skip check if already on login page
        const path = window.location.pathname;
        if (path.endsWith('index.html') || path.endsWith('/') || path.endsWith('index')) {
            return true;
        }

        // Check local storage/session storage
        const access = sessionStorage.getItem(AUTH_CONFIG.SESSION_KEY);
        // const accessTime = sessionStorage.getItem(AUTH_CONFIG.TIME_KEY);

        // 1. Basic Token Check
        if (!access || access !== 'granted') {
            console.warn("Access denied: No session token found.");
            window.location.replace(AUTH_CONFIG.LOGIN_PAGE);
            return false;
        }

        // 2. Expiration Check - REMOVED (Unlimited Session)
        /*
        if (accessTime) {
            const timeElapsed = Date.now() - parseInt(accessTime);
            if (timeElapsed >= AUTH_CONFIG.SESSION_DURATION) {
                console.warn("Access denied: Session expired.");
                sessionStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
                sessionStorage.removeItem(AUTH_CONFIG.TIME_KEY);
                window.location.replace(AUTH_CONFIG.LOGIN_PAGE);
                return false;
            }
        }
        */

        // 3. Success - Expose Logout Function
        window.logout = function () {
            sessionStorage.removeItem(AUTH_CONFIG.SESSION_KEY);
            // sessionStorage.removeItem(AUTH_CONFIG.TIME_KEY);
            window.location.href = AUTH_CONFIG.LOGIN_PAGE;
        };

        // 4. Unlock UI
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                document.body.classList.add('authenticated');
                document.body.style.visibility = 'visible';
            });
        } else {
            document.body.classList.add('authenticated');
            document.body.style.visibility = 'visible';
        }

        return true;
    }

    // Run immediately
    // Note: Can be commented out for development/testing if needed
    // checkAuthentication(); 

    // For now, enabling it as user requested to decouple it
    checkAuthentication();

    // FAILSAFE: Force visible after 2 seconds if auth logic hangs
    setTimeout(() => {
        document.body.style.visibility = 'visible';
    }, 2000);

})();
