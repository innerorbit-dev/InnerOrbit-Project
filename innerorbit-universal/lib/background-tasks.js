/** Purpose: Registers and manages silent background fetch tasks for OTA update checks. */
import { UpdateManager } from './update-manager';
import { Logger } from './logger';
import { NativeModules } from 'react-native';
import { isWeb } from '../utils/platform';

export const UPDATE_CHECK_TASK = 'background-update-check';

let TaskManager = null;
let BackgroundFetch = null;

try {
    const hasTaskManager = !!(
        (global.expo && global.expo.modules && global.expo.modules.ExpoTaskManager) ||
        NativeModules.ExpoTaskManager ||
        NativeModules.RNCEmpty // Just in case
    );

    if (!isWeb && hasTaskManager) {
        try {
            TaskManager = require('expo-task-manager');
            BackgroundFetch = require('expo-background-task');
        } catch (nativeError) {
            Logger.error("[BackgroundFetch] Failed to load native modules (ExpoTaskManager/BackgroundFetch). Background updates disabled.", nativeError);
            Logger.info("[BackgroundFetch] TIP: If you just installed this module, you must rebuild the development APK (npm run build:android).");
        }

        // 1. Define the task
        if (TaskManager && BackgroundFetch) {
            TaskManager.defineTask(UPDATE_CHECK_TASK, async () => {
                try {
                    Logger.log("[BackgroundFetch] Running silent update check...");
                    const result = await UpdateManager.performSilentUpdateCheck();
                    Logger.log(`[BackgroundFetch] Result: ${result.status}`);

                    return result.status === 'no_update' || result.status === 'skipped_due_to_preferences'
                        ? BackgroundFetch.BackgroundTaskResult.NoData
                        : BackgroundFetch.BackgroundTaskResult.NewData;
                } catch (error) {
                    Logger.error("[BackgroundFetch] Task failed:", error);
                    return BackgroundFetch?.BackgroundTaskResult?.Failed || 3; // Fallback to enum value
                }
            });
        }
    }
} catch (e) {
    Logger.error("[BackgroundFetch] Failed to load native modules (ExpoTaskManager/BackgroundFetch). Background updates disabled.", e);
}

// 2. Register function
export async function registerBackgroundUpdateTask() {
    try {
        if (!TaskManager || !BackgroundFetch) {
            Logger.log("[BackgroundFetch] Task manager not available, skipping registration.");
            return;
        }

        const isRegistered = await TaskManager.isTaskRegisteredAsync(UPDATE_CHECK_TASK);
        if (isRegistered) {
            Logger.log("[BackgroundFetch] Task already registered.");
            return;
        }

        await BackgroundFetch.registerTaskAsync(UPDATE_CHECK_TASK, {
            minimumInterval: 60 * 30, // 30 minutes
            stopOnTerminate: false,
            startOnBoot: true,
        });
        Logger.log("[BackgroundFetch] Task registered successfully.");
    } catch (err) {
        Logger.error("[BackgroundFetch] Registration failed:", err);
    }
}
