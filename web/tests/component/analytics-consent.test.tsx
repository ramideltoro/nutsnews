import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";

import { AnalyticsConsentBanner } from "@/app/components/AnalyticsConsentBanner";
import { RuntimeAnalytics } from "@/app/components/RuntimeAnalytics";
import { ThemeSwitcher } from "@/app/components/ThemeSwitcher";
import {
  AnalyticsConsentControls,
  type AnalyticsConsentControlCopy,
} from "@/app/privacy/AnalyticsConsentControls";
import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  getStoredAnalyticsConsentState,
  setAnalyticsConsentState,
} from "@/lib/analyticsConsent";

const MEASUREMENT_ID = "G-COMPONENTTEST";
const runtimeConfigMock = vi.hoisted(() => ({
  gaId: "G-COMPONENTTEST" as string | null,
  telemetryEnabled: true,
}));

vi.mock("@/lib/runtimePublicConfigClient", () => ({
  useRuntimePublicConfig: () => ({
    runtimeEnv: "production",
    sideEffectsMode: "live",
    databaseProviderMode: "supabase_primary",
    productionWritesPaused: false,
    supabaseUrl: null,
    supabaseAnonKey: null,
    turnstileSiteKey: null,
    sentryDsn: null,
    gaId: runtimeConfigMock.gaId,
    iosAppStoreUrl: null,
    sourceCommit: "component-test",
    buildId: "component-test",
    deploymentTarget: "local",
    expectedImageDigest: "",
    configGeneration: "component-test",
    telemetryEnabled: runtimeConfigMock.telemetryEnabled,
  }),
}));

const privacyControlCopy: AnalyticsConsentControlCopy = {
  title: "Analytics setting",
  body: "Analytics loads only after permission.",
  statusLabel: "Current status",
  statusAllowed: "Minimal analytics is allowed",
  statusDenied: "Analytics is off",
  statusBlocked: "Analytics is blocked by browser privacy signals",
  allowButton: "Allow minimal analytics",
  denyButton: "Keep analytics off",
};

type AnalyticsTestWindow = Window & {
  dataLayer?: unknown[];
  [key: `ga-disable-${string}`]: boolean | undefined;
};

function setGlobalPrivacyControl(value: boolean | undefined) {
  Object.defineProperty(window.navigator, "globalPrivacyControl", {
    configurable: true,
    value,
  });
}

function setDoNotTrack(value: string | undefined) {
  Object.defineProperty(window.navigator, "doNotTrack", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  runtimeConfigMock.gaId = MEASUREMENT_ID;
  runtimeConfigMock.telemetryEnabled = true;
  setGlobalPrivacyControl(undefined);
  setDoNotTrack(undefined);
  const analyticsWindow = window as unknown as AnalyticsTestWindow;
  delete analyticsWindow[`ga-disable-${MEASUREMENT_ID}`];
  delete analyticsWindow.dataLayer;
});

describe("analytics consent", () => {
  test("distinguishes an undecided visitor from an explicit denial", () => {
    expect(getStoredAnalyticsConsentState()).toBeNull();

    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "unexpected");
    expect(getStoredAnalyticsConsentState()).toBeNull();

    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");
    expect(getStoredAnalyticsConsentState()).toBe("denied");
  });

  test.each([
    {
      name: "telemetry is disabled",
      gaId: MEASUREMENT_ID,
      telemetryEnabled: false,
    },
    {
      name: "the measurement ID is missing",
      gaId: null,
      telemetryEnabled: true,
    },
    {
      name: "the measurement ID is invalid",
      gaId: "not-a-ga-id",
      telemetryEnabled: true,
    },
  ])("fails closed when $name", async ({ gaId, telemetryEnabled }) => {
    runtimeConfigMock.gaId = gaId;
    runtimeConfigMock.telemetryEnabled = telemetryEnabled;

    render(
      <>
        <RuntimeAnalytics />
        <AnalyticsConsentBanner />
      </>,
    );

    await act(async () => {});
    expect(
      screen.queryByTestId("nutsnews-analytics-consent-banner"),
    ).not.toBeInTheDocument();
    expect(document.querySelector("script#google-analytics")).not.toBeInTheDocument();
    expect(
      document.querySelector(`script[src*="${MEASUREMENT_ID}"]`),
    ).not.toBeInTheDocument();
  });

  test("prompts an undecided visitor and starts GA only after permission", async () => {
    const user = userEvent.setup();

    render(
      <>
        <RuntimeAnalytics />
        <AnalyticsConsentBanner />
      </>,
    );

    expect(
      await screen.findByTestId("nutsnews-analytics-consent-banner"),
    ).toBeInTheDocument();
    expect(
      document.querySelector(`script[src*="${MEASUREMENT_ID}"]`),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("nutsnews-analytics-consent-allow"));

    await waitFor(() =>
      expect(
        screen.queryByTestId("nutsnews-analytics-consent-banner"),
      ).not.toBeInTheDocument(),
    );
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
      "granted",
    );
    await waitFor(() =>
      expect(
        document.querySelector(`script[src*="${MEASUREMENT_ID}"]`),
      ).toBeInTheDocument(),
    );
    expect(document.querySelector("script#google-analytics")).toBeInTheDocument();
  });

  test("persists denial, dismisses the prompt, and keeps GA unloaded", async () => {
    const user = userEvent.setup();

    render(
      <>
        <RuntimeAnalytics />
        <AnalyticsConsentBanner />
      </>,
    );

    await user.click(
      await screen.findByTestId("nutsnews-analytics-consent-deny"),
    );

    await waitFor(() =>
      expect(
        screen.queryByTestId("nutsnews-analytics-consent-banner"),
      ).not.toBeInTheDocument(),
    );
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
      "denied",
    );
    expect(
      document.querySelector(`script[src*="${MEASUREMENT_ID}"]`),
    ).not.toBeInTheDocument();
  });

  test("honors a stored denial without showing the first-choice prompt", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "denied");

    render(
      <>
        <RuntimeAnalytics />
        <AnalyticsConsentBanner />
      </>,
    );

    await act(async () => {});
    expect(
      screen.queryByTestId("nutsnews-analytics-consent-banner"),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(`script[src*="${MEASUREMENT_ID}"]`),
    ).not.toBeInTheDocument();
  });

  test("honors a stored grant without showing the first-choice prompt", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");

    render(
      <>
        <RuntimeAnalytics />
        <AnalyticsConsentBanner />
      </>,
    );

    await waitFor(() =>
      expect(
        document.querySelector(`script[src*="${MEASUREMENT_ID}"]`),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("nutsnews-analytics-consent-banner"),
    ).not.toBeInTheDocument();
  });

  test("synchronizes a consent change dispatched by another browser tab", async () => {
    const user = userEvent.setup();

    render(
      <>
        <RuntimeAnalytics />
        <AnalyticsConsentBanner />
        <ThemeSwitcher />
        <AnalyticsConsentControls copy={privacyControlCopy} />
      </>,
    );

    expect(
      await screen.findByTestId("nutsnews-analytics-consent-banner"),
    ).toBeInTheDocument();

    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    act(() =>
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: ANALYTICS_CONSENT_STORAGE_KEY,
          newValue: "granted",
        }),
      ),
    );

    await waitFor(() =>
      expect(
        document.querySelector(`script[src*="${MEASUREMENT_ID}"]`),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByTestId("nutsnews-analytics-consent-banner"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText((_, element) =>
        element?.textContent ===
        "Current status: Minimal analytics is allowed",
      ),
    ).toBeInTheDocument();

    await user.click(screen.getByTestId("nutsnews-settings-toggle"));
    expect(screen.getByTestId("nutsnews-settings-analytics")).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  test("keeps the prompt and GA off when the browser sends GPC", async () => {
    const user = userEvent.setup();
    setGlobalPrivacyControl(true);

    render(
      <>
        <RuntimeAnalytics />
        <AnalyticsConsentBanner />
        <ThemeSwitcher />
      </>,
    );

    const analyticsWindow = window as unknown as AnalyticsTestWindow;
    await waitFor(() =>
      expect(analyticsWindow[`ga-disable-${MEASUREMENT_ID}`]).toBe(true),
    );
    expect(
      screen.queryByTestId("nutsnews-analytics-consent-banner"),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(`script[src*="${MEASUREMENT_ID}"]`),
    ).not.toBeInTheDocument();

    await user.click(screen.getByTestId("nutsnews-settings-toggle"));
    expect(screen.getByTestId("nutsnews-settings-analytics")).toBeDisabled();
    expect(screen.getByText("Blocked by browser privacy")).toBeInTheDocument();
  });

  test("keeps the prompt and GA off when the browser sends Do Not Track", async () => {
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    setDoNotTrack("1");

    render(
      <>
        <RuntimeAnalytics />
        <AnalyticsConsentBanner />
      </>,
    );

    const analyticsWindow = window as unknown as AnalyticsTestWindow;
    await waitFor(() =>
      expect(analyticsWindow[`ga-disable-${MEASUREMENT_ID}`]).toBe(true),
    );
    expect(
      screen.queryByTestId("nutsnews-analytics-consent-banner"),
    ).not.toBeInTheDocument();
    expect(
      document.querySelector(`script[src*="${MEASUREMENT_ID}"]`),
    ).not.toBeInTheDocument();
  });

  test("lets a reader revoke a stored grant while browser privacy blocks analytics", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(ANALYTICS_CONSENT_STORAGE_KEY, "granted");
    setGlobalPrivacyControl(true);

    render(<ThemeSwitcher />);

    await user.click(screen.getByTestId("nutsnews-settings-toggle"));
    const analyticsSwitch = screen.getByTestId("nutsnews-settings-analytics");

    await waitFor(() => expect(analyticsSwitch).toBeEnabled());
    expect(analyticsSwitch).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Blocked by browser privacy")).toBeInTheDocument();

    await user.click(analyticsSwitch);

    await waitFor(() => expect(analyticsSwitch).toBeDisabled());
    expect(analyticsSwitch).toHaveAttribute("aria-checked", "false");
    expect(window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY)).toBe(
      "denied",
    );
  });

  test("synchronizes privacy controls with consent changes elsewhere", async () => {
    render(<AnalyticsConsentControls copy={privacyControlCopy} />);

    const status = await screen.findByText((_, element) =>
      element?.textContent === "Current status: Analytics is off",
    );
    expect(status).toBeInTheDocument();

    act(() => setAnalyticsConsentState("granted"));
    await waitFor(() =>
      expect(status).toHaveTextContent(
        "Current status: Minimal analytics is allowed",
      ),
    );

    act(() => setAnalyticsConsentState("denied"));
    await waitFor(() =>
      expect(status).toHaveTextContent("Current status: Analytics is off"),
    );
  });
});
