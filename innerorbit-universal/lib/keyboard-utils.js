/** Purpose: React hooks and utilities for tracking keyboard visibility, height, and programmatic dismissal. */
import { useEffect, useState } from 'react';
import { Keyboard } from 'react-native';
import { isIOS } from '../utils/platform';

/**
 * Hook to track keyboard visibility and height
 * @returns {{ keyboardVisible: boolean, keyboardHeight: number }}
 */
export function useKeyboard() {
    const [keyboardVisible, setKeyboardVisible] = useState(false);
    const [keyboardHeight, setKeyboardHeight] = useState(0);

    useEffect(() => {
        const showEvent = isIOS ? 'keyboardWillShow' : 'keyboardDidShow';
        const hideEvent = isIOS ? 'keyboardWillHide' : 'keyboardDidHide';

        const showSubscription = Keyboard.addListener(showEvent, (e) => {
            setKeyboardVisible(true);
            setKeyboardHeight(e.endCoordinates.height);
        });

        const hideSubscription = Keyboard.addListener(hideEvent, () => {
            setKeyboardVisible(false);
            setKeyboardHeight(0);
        });

        return () => {
            showSubscription.remove();
            hideSubscription.remove();
        };
    }, []);

    return { keyboardVisible, keyboardHeight };
}

/**
 * Dismiss keyboard programmatically
 */
export function dismissKeyboard() {
    Keyboard.dismiss();
}
