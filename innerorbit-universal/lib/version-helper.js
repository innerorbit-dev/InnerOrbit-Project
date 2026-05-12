/**
 * Simple SemVer comparison helper to avoid heavy dependencies.
 * Supports standard X.Y.Z format.
 */
export const VersionHelper = {
    /**
     * Compares two version strings.
     * @returns {number} 1 if v1 > v2, -1 if v1 < v2, 0 if equal.
     */
    compare: (v1, v2) => {
        if (!v1 || !v2) return 0;
        const parts1 = v1.split('.').map(Number);
        const parts2 = v2.split('.').map(Number);
        
        for (let i = 0; i < 3; i++) {
            const n1 = parts1[i] || 0;
            const n2 = parts2[i] || 0;
            if (n1 > n2) return 1;
            if (n1 < n2) return -1;
        }
        return 0;
    },

    isNewer: (remoteVersion, currentVersion) => {
        return VersionHelper.compare(remoteVersion, currentVersion) === 1;
    }
};

export default VersionHelper;
