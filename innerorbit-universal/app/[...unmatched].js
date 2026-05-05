/** Purpose: Fallback route handling unmatched URL segments and protocol errors. */
import { Redirect, useSegments } from "expo-router";
import { useEffect } from "react";
import { Logger } from "../lib/logger";

// Catch-all route to handle file:// protocol weirdness or 404s
export default function Unmatched() {
    const segments = useSegments();

    useEffect(() => {
        Logger.log(`[System] Unmatched Route Hit: /${segments?.join('/')}`);
    }, [segments]);

    return <Redirect href="/login" />;
}

