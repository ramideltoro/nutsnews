import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { ArticleFeed } from "@/app/components/ArticleFeed";
import { SiteFooter } from "@/app/components/SiteFooter";
import { ThemeSwitcher } from "@/app/components/ThemeSwitcher";
import { ContactForm } from "@/app/contact/ContactForm";
import { SavedStoriesPage } from "@/app/saved/SavedStoriesPage";
import type { Article } from "@/lib/articles";
import { LANGUAGE_STORAGE_KEY } from "@/lib/languages";
import { SAVED_STORIES_STORAGE_KEY } from "@/lib/savedStories";

vi.mock("@/lib/runtimePublicConfigClient", () => ({
  useRuntimePublicConfig: () => ({
    runtimeEnv: "staging",
    sideEffectsMode: "disabled",
    databaseProviderMode: "supabase_primary",
    supabaseUrl: null,
    supabaseAnonKey: null,
    turnstileSiteKey: null,
    sentryDsn: null,
    gaId: null,
    iosAppStoreUrl: null,
    sourceCommit: "component-test",
    buildId: "component-test",
    deploymentTarget: "local",
    expectedImageDigest: "",
    configGeneration: "component-test",
    telemetryEnabled: false,
  }),
}));

function article(overrides: Partial<Article> = {}): Article {
  const id = overrides.id ?? crypto.randomUUID();

  return {
    id,
    source: "Google News - Happy Times",
    title: `Good news ${id}`,
    original_url: `https://example.test/articles/${id}`,
    image_url: "https://example.test/image.jpg",
    published_at: "2026-07-01T12:00:00Z",
    published_on_site_at: "2026-07-02T12:00:00Z",
    ai_summary: "A concise uplifting summary for readers.",
    category: "community",
    positivity_score: 0.97,
    language_code: "en",
    ...overrides,
  };
}

describe("ArticleFeed", () => {
  test("renders article cards with missing-image fallback and source/date metadata", async () => {
    const first = article({
      id: "lead",
      title: "Community garden opens downtown",
      image_url: null,
    });
    const duplicate = article({
      id: "lead",
      title: "Duplicate story should collapse",
      original_url: first.original_url,
    });

    render(
      <ArticleFeed
        initialArticles={[
          first,
          article({ id: "feature", title: "Students build a solar bench" }),
          article({ id: "rail", title: "Library launches kindness shelf" }),
          duplicate,
        ]}
        initialNextPage={null}
        initialNextCursor={null}
        initialCategorySections={[
          {
            id: "animals",
            articles: [
              article({
                id: "otter",
                title: "Otter rescue team returns pups to coast",
                category: "animals",
              }),
            ],
          },
        ]}
      />,
    );

    expect(
      await screen.findByRole("heading", {
        name: "Community garden opens downtown",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("No article image")).toBeInTheDocument();
    expect(screen.getAllByTestId("nutsnews-article-card")).toHaveLength(4);
    expect(screen.getAllByText("Happy Times").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", {
        name: "Otter rescue team returns pups to coast",
      }),
    ).toBeInTheDocument();
  });

  test("shows the empty feed state without starting a browser server", () => {
    render(
      <ArticleFeed
        initialArticles={[]}
        initialNextPage={null}
        initialNextCursor={null}
        initialCategorySections={[]}
      />,
    );

    expect(
      screen.getAllByText(
        "No uplifting stories are available yet. Please check back soon.",
      ).length,
    ).toBeGreaterThan(0);
  });

  test("saves and unsaves story cards in local browser storage", async () => {
    const user = userEvent.setup();
    const savedArticle = article({
      id: "local-save",
      title: "Neighborhood choir brings music to hospital rooms",
      source: "Bright Daily",
    });

    render(
      <ArticleFeed
        initialArticles={[savedArticle]}
        initialNextPage={null}
        initialNextCursor={null}
        initialCategorySections={[]}
      />,
    );

    const saveButton = await screen.findByRole("button", {
      name: "Save story: Neighborhood choir brings music to hospital rooms",
    });

    await user.click(saveButton);

    await waitFor(() => expect(saveButton).toHaveTextContent("Saved"));

    const storedPayload = JSON.parse(
      window.localStorage.getItem(SAVED_STORIES_STORAGE_KEY) ?? "{}",
    );

    expect(storedPayload).toMatchObject({
      version: 1,
      stories: [
        {
          id: "local-save",
          source: "Bright Daily",
          title: "Neighborhood choir brings music to hospital rooms",
          original_url: "https://example.test/articles/local-save",
        },
      ],
    });
    expect(storedPayload.stories[0].positivity_score).toBeUndefined();

    await user.click(
      screen.getByRole("button", {
        name: "Remove saved story: Neighborhood choir brings music to hospital rooms",
      }),
    );

    await waitFor(() => expect(saveButton).toHaveTextContent("Save"));
    expect(
      JSON.parse(window.localStorage.getItem(SAVED_STORIES_STORAGE_KEY) ?? "{}")
        .stories,
    ).toHaveLength(0);
  });
});

describe("SavedStoriesPage", () => {
  test("renders locally saved stories and removes them without login", async () => {
    const user = userEvent.setup();
    const savedArticle = article({
      id: "saved-page-story",
      title: "Students restore a city park mural",
      source: "Kindness Ledger",
      ai_summary: "Students worked with neighbors to restore a mural.",
    });

    window.localStorage.setItem(
      SAVED_STORIES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        stories: [
          {
            ...savedArticle,
            saved_at: "2026-07-17T12:00:00Z",
          },
        ],
      }),
    );

    render(<SavedStoriesPage />);

    expect(
      await screen.findByRole("heading", {
        name: "Students restore a city park mural",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("1 saved story")).toBeInTheDocument();
    expect(
      screen.getByText("Students worked with neighbors to restore a mural."),
    ).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", {
        name: "Remove saved story: Students restore a city park mural",
      }),
    );

    await waitFor(() =>
      expect(screen.getByText("No saved stories yet")).toBeInTheDocument(),
    );
    expect(
      JSON.parse(window.localStorage.getItem(SAVED_STORIES_STORAGE_KEY) ?? "{}")
        .stories,
    ).toHaveLength(0);
  });
});

describe("ThemeSwitcher", () => {
  test("opens settings and applies deterministic theme and language choices", async () => {
    const user = userEvent.setup();
    render(<ThemeSwitcher />);

    await user.click(screen.getByTestId("nutsnews-settings-toggle"));
    await user.click(screen.getByTestId("nutsnews-settings-theme"));
    await user.click(screen.getByTestId("nutsnews-theme-option-sakura"));

    expect(document.documentElement.dataset.nutsnewsTheme).toBe("sakura");
    expect(window.localStorage.getItem("nutsnews.web.theme")).toBe("sakura");

    await user.click(
      screen.getByRole("button", { name: "Back to settings menu" }),
    );
    await user.click(screen.getByTestId("nutsnews-settings-language"));
    await user.click(screen.getByTestId("nutsnews-language-option-fr"));

    expect(document.documentElement.lang).toBe("fr");
    expect(window.localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe("fr");
    expect(screen.getAllByText("Français").length).toBeGreaterThan(0);
  });
});

describe("SiteFooter", () => {
  test("opens archive search and renders result cards from mocked public data", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        articles: [
          article({
            id: "search-result",
            title: "Science fair team wins clean water prize",
            source: "Bright Wire",
          }),
        ],
        nextPage: null,
        query: "science",
        page: 0,
        pageSize: 10,
        languageCode: "en",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<SiteFooter />);

    await user.click(screen.getByTestId("nutsnews-footer-search"));
    const dialog = await screen.findByRole("dialog", { name: "Search" });
    const searchInput = within(dialog).getByTestId("nutsnews-search-input");
    const submit = within(dialog).getByTestId("nutsnews-search-submit");

    expect(submit).toBeDisabled();

    await user.type(searchInput, " science  ");
    await user.click(submit);

    expect(fetchMock).toHaveBeenCalledWith("/api/search?q=science&page=0&limit=10", {
      headers: { Accept: "application/json" },
    });
    expect(
      await within(dialog).findByText("Science fair team wins clean water prize"),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("1 result for “science”")).toBeInTheDocument();
  });
});

describe("ContactForm", () => {
  test("keeps submission local and reports missing anti-spam configuration", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ContactForm />);

    await user.type(screen.getByLabelText("Your email"), "reader@example.test");
    await user.type(
      screen.getByLabelText("Message"),
      "This is a friendly component-test message.",
    );
    await user.click(screen.getByRole("button", { name: "Send" }));

    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        screen.getAllByText(
          "The anti-spam check is not configured yet. Please try again later.",
        ).length,
      ).toBeGreaterThan(0),
    );
  });
});
