declare var __DEV__: boolean;

interface Window {
    electron?: {
        showNotification: (title: string, body: string, data?: any) => Promise<any>;
        setBadgeCount: (count: number) => Promise<any>;
        playNotificationSound: () => Promise<any>;
        setScreenshotProtection: (enabled: boolean) => Promise<{ success: boolean; enabled: boolean }>;
        completeSetup: () => Promise<any>;
        onNotificationReply: (callback: (data: any) => void) => () => void;
        platform: string;
        isElectron: boolean;
        safeStorage: {
            encrypt: (plaintext: string) => Promise<{ success: boolean; encrypted?: string; error?: string }>;
            decrypt: (encryptedData: string) => Promise<{ success: boolean; decrypted?: string; error?: string }>;
        };
        windowControls: {
            minimize: () => void;
            maximize: () => void;
            close: () => void;
            isMaximized: () => boolean;
        };
    };
}
