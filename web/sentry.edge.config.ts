import * as Sentry from "@sentry/nextjs";

const isProduction = process.env.NODE_ENV === "production";
const release =
    process.env.NEXT_PUBLIC_NUTSNEWS_SOURCE_COMMIT?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA?.trim() ||
    process.env.NEXT_PUBLIC_NUTSNEWS_BUILD_ID?.trim() ||
    undefined;

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

    environment: process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
    release,

    tracesSampleRate: isProduction ? 0.1 : 1.0,

    enableLogs: true,

    beforeSend(event) {
        if (event.request?.headers) {
            delete event.request.headers.authorization;
            delete event.request.headers.cookie;
        }

        return event;
    },
});
