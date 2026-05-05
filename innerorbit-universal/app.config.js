require('dotenv').config();

module.exports = {
    expo: {
        name: "CalcX",
        slug: "InnerOrbit-CalcX-A",
        version: "1.0.3",
        orientation: "portrait",
        icon: "./assets/icon.png",
        userInterfaceStyle: "automatic",
        output: "static",
        privacy: "https://innerorbit-bc8ce.web.app/privacy-policy.html",
        splash: {
            image: "./assets/splash.png",
            resizeMode: "contain",
            backgroundColor: "#0F172A"
        },
        assetBundlePatterns: [
            "assets/icon.png",
            "assets/adaptive-icon.png",
            "assets/favicon.png"
        ],
        ios: {
            supportsTablet: true,
            bundleIdentifier: "com.innerorbit.calcx"
        },
        android: {
            adaptiveIcon: {
                foregroundImage: "./assets/adaptive-icon.png",
                backgroundColor: "#0F172A"
            },
            package: "com.innerorbit.calcx",
            jsEngine: "hermes",
            versionCode: 3,
            launchMode: "singleTask",
            permissions: [
                "android.permission.CAMERA",
                "android.permission.READ_EXTERNAL_STORAGE",
                "android.permission.WRITE_EXTERNAL_STORAGE"
            ],
            googleServicesFile: "./google-services.json",
            softwareKeyboardLayoutMode: "adjustResize"
        },
        web: {
            favicon: "./assets/favicon.png",
            bundler: "metro",
            publicPath: "/"
        },
        scheme: "com.innerorbit.calcx",
        plugins: [
            [
                "expo-camera",
                {
                    "cameraPermission": "Allow $(PRODUCT_NAME) to access your camera to scan QR codes."
                }
            ],
            [
                "expo-notifications",
                {
                    "icon": "./assets/icon.png",
                    "color": "#fb7185"
                }
            ],
            [
                "expo-media-library",
                {
                    "photosPermission": "Allow $(PRODUCT_NAME) to access your photos to set a profile picture and send images in chat.",
                    "savePhotosPermission": "Allow $(PRODUCT_NAME) to save photos to your library."
                }
            ],
            "expo-secure-store",
            "expo-web-browser",
            "expo-background-task"
        ],
        notification: {
            icon: "./assets/icon.png",
            color: "#fb7185",
            androidMode: "default",
            androidCollapsedTitle: "New message"
        },
        extra: {
            firebaseApiKey: process.env.FIREBASE_API_KEY,
            firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN,
            firebaseProjectId: process.env.FIREBASE_PROJECT_ID,
            firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET,
            firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
            firebaseAppId: process.env.FIREBASE_APP_ID,
            firebaseMeasurementId: process.env.FIREBASE_MEASUREMENT_ID,
            eas: {
                projectId: "235015b2-033f-4ae4-a1e1-0b62da6db12f"
            }
        }
    }
};
