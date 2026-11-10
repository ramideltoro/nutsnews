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
            dataCollection: {
                userInfo: false,
                cookies: false,
                httpHeaders: {
                    request: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
                    response: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
                },
                httpBodies: [],
                urlQueryParams: { deny: ["forwarded", "-ip", "remote-", "via", "-user"] },
                genAI: { inputs: false, outputs: false },
                databaseQueryData: false,
                queues: false,
                graphQL: { document: false, variables: false },
            },
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
