import { NextResponse } from "next/server";

import { BYPASS_CACHE_HEADERS } from "@/lib/cacheHeaders";
import { logInfo, logWarn } from "@/lib/logger";
import { RuntimeSafetyError, assertProductionOperation } from "@/lib/runtimeSafety";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
    try {
        assertProductionOperation("better-stack-log-test");
    } catch (error) {
        if (error instanceof RuntimeSafetyError) {
            return NextResponse.json(
                { error: "Telemetry delivery is disabled in this environment." },
                { status: 503, headers: BYPASS_CACHE_HEADERS },
            );
        }
        throw error;
    }

    const startedAt = Date.now();

    await logInfo("api.log_test.started", "Better Stack log test started", {
        route: "/api/log-test",
        method: "GET",
    });

    await logWarn("api.log_test.sample_warning", "Sample searchable warning log", {
        route: "/api/log-test",
        searchableExample: true,
        searchHints: ["level:warn", "event:api.log_test.sample_warning"],
    });

    await logInfo("api.log_test.completed", "Better Stack log test completed", {
        route: "/api/log-test",
        method: "GET",
        status: 200,
        durationMs: Date.now() - startedAt,
    });

    return NextResponse.json(
        {
            ok: true,
            message: "Better Stack test logs were emitted.",
            searchInBetterStackFor: {
                service: "nutsnews-web",
                event: "api.log_test.completed",
                level: "info",
            },
        },
        {
            headers: BYPASS_CACHE_HEADERS,
        },
    );
}
