import * as Sentry from "@sentry/nextjs";
import { getRuntimePublicConfig } from "@/lib/runtimePublicConfig";

const config = getRuntimePublicConfig();

Sentry.init({
    dsn: config.telemetryEnabled ? config.sentryDsn ?? undefined : undefined,
    environment: config.runtimeEnv,
    release: config.sourceCommit || config.buildId || undefined,
    tracesSampleRate: config.telemetryEnabled ? 0.1 : 0,

    enableLogs: true,

    beforeSend(event) {
        if (event.request?.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
        }

        return config.telemetryEnabled ? event : null;
    },
});
