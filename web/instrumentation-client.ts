import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    tracesSampleRate: isProduction ? 0.1 : 1.0,

    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,

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

        return event;
    },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;