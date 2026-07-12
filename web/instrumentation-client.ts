import * as Sentry from "@sentry/nextjs";

void fetch("/api/runtime-config", {
    cache: "no-store",
    headers: { Accept: "application/json" },
})
    .then(async (response) => {
        if (!response.ok) {
            return null;
        }

        return response.json() as Promise<{
            runtimeEnv?: string;
            telemetryEnabled?: boolean;
            sentryDsn?: string | null;
            sourceCommit?: string;
            buildId?: string;
        }>;
    })
    .then((config) => {
        if (!config) {
            return;
        }

        Sentry.init({
            dsn: config.telemetryEnabled ? config.sentryDsn ?? undefined : undefined,
            environment: config.runtimeEnv ?? "unknown",
            release: config.sourceCommit || config.buildId || undefined,
            tracesSampleRate: config.telemetryEnabled ? 0.1 : 0,
            replaysSessionSampleRate: 0,
            replaysOnErrorSampleRate: config.telemetryEnabled ? 1.0 : 0,
            enableLogs: true,
            integrations: [
                Sentry.replayIntegration({
                    maskAllText: true,
                    blockAllMedia: true,
                }),
            ],
            beforeSend(event) {
                if (event.request?.headers) {
                    delete event.request.headers.authorization;
                    delete event.request.headers.cookie;
                }

                return config.telemetryEnabled ? event : null;
            },
        });
    })
    .catch(() => {
        // Missing runtime configuration must fail closed: no browser telemetry.
    });

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
