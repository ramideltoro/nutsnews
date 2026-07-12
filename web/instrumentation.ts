import * as Sentry from "@sentry/nextjs";
import { isTelemetryDeliveryAllowed } from "@/lib/runtimeSafety";

export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("./sentry.server.config");
    }

    if (process.env.NEXT_RUNTIME === "edge") {
        await import("./sentry.edge.config");
    }
}

export function onRequestError(...args: Parameters<typeof Sentry.captureRequestError>) {
    if (isTelemetryDeliveryAllowed()) {
        return Sentry.captureRequestError(...args);
    }
}
