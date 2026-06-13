type LogLevel = "debug" | "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const SERVICE_NAME = "nutsnews-web";
const DEFAULT_ENVIRONMENT = process.env.NEXT_PUBLIC_APP_ENV ?? "production";

function normalizeIngestingHost(host: string) {
    const trimmedHost = host.trim().replace(/\/+$/, "");

    if (trimmedHost.startsWith("http://") || trimmedHost.startsWith("https://")) {
        return trimmedHost;
    }

    return `https://${trimmedHost}`;
}

function serializeError(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    return {
        message: String(error),
    };
}

function writeLocalConsole(level: LogLevel, payload: LogFields) {
    const line = JSON.stringify(payload);

    if (level === "error") {
        console.error(line);
        return;
    }

    if (level === "warn") {
        console.warn(line);
        return;
    }

    console.log(line);
}

async function sendToBetterStack(payload: LogFields) {
    const sourceToken = process.env.BETTER_STACK_SOURCE_TOKEN;
    const ingestingHost = process.env.BETTER_STACK_INGESTING_HOST;

    if (!sourceToken || !ingestingHost) {
        return;
    }

    const endpoint = normalizeIngestingHost(ingestingHost);

    try {
        await fetch(endpoint, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${sourceToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            cache: "no-store",
        });
    } catch (error) {
        console.warn(
            JSON.stringify({
                dt: new Date().toISOString(),
                level: "warn",
                service: SERVICE_NAME,
                environment: DEFAULT_ENVIRONMENT,
                event: "better_stack.delivery_failed",
                message: "Failed to deliver log to Better Stack",
                error: serializeError(error),
            }),
        );
    }
}

export async function logEvent(
    level: LogLevel,
    event: string,
    message: string,
    fields: LogFields = {},
) {
    const payload = {
        dt: new Date().toISOString(),
        level,
        service: SERVICE_NAME,
        environment: DEFAULT_ENVIRONMENT,
        event,
        message,
        ...fields,
    };

    writeLocalConsole(level, payload);
    await sendToBetterStack(payload);
}

export async function logDebug(
    event: string,
    message: string,
    fields: LogFields = {},
) {
    await logEvent("debug", event, message, fields);
}

export async function logInfo(
    event: string,
    message: string,
    fields: LogFields = {},
) {
    await logEvent("info", event, message, fields);
}

export async function logWarn(
    event: string,
    message: string,
    fields: LogFields = {},
) {
    await logEvent("warn", event, message, fields);
}

export async function logError(
    event: string,
    message: string,
    error: unknown,
    fields: LogFields = {},
) {
    await logEvent("error", event, message, {
        ...fields,
        error: serializeError(error),
    });
}