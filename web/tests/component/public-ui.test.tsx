import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";

import { ArticleFeed } from "@/app/components/ArticleFeed";
import { HeroTagline } from "@/app/components/HeroTagline";
import { SiteFooter } from "@/app/components/SiteFooter";
import { ThemeSwitcher } from "@/app/components/ThemeSwitcher";
import { LocalizedArticleDetail } from "@/app/articles/[id]/LocalizedArticleDetail";
import { ContactForm } from "@/app/contact/ContactForm";
import { SavedStoriesPage } from "@/app/saved/SavedStoriesPage";
import type { Article } from "@/lib/articles";
import { LANGUAGE_CHANGE_EVENT, LANGUAGE_STORAGE_KEY } from "@/lib/languages";
import { SAVED_STORIES_STORAGE_KEY } from "@/lib/savedStories";

vi.mock("@/lib/runtimePublicConfigClient", () => ({
  useRuntimePublicConfig: () => ({
    runtimeEnv: "staging",
    sideEffectsMode: "disabled",
    databaseProviderMode: "supabase_primary",
    productionWritesPaused: false,
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

  test("refetches and renders localized card copy when the reader changes language", async () => {
    const localizedArticle = article({
      id: "localized-feed",
      title: "Un quartier transforme un terrain vide en jardin",
      ai_summary:
        "Des voisins creent un jardin partage avec des bancs et des plantes locales.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        articles: [localizedArticle],
        nextPage: null,
        nextCursor: null,
        sections: [
          {
            id: "community",
            articles: [localizedArticle],
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <ArticleFeed
        initialArticles={[article({ id: "english-feed", title: "English feed title" })]}
        initialNextPage={null}
        initialNextCursor={null}
        initialCategorySections={[]}
      />,
    );

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGE_EVENT, {
        detail: { languageCode: "fr" },
      }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith("/api/articles?home=1&lang=fr", {
        cache: "default",
        headers: { Accept: "application/json" },
      }),
    );
    expect(
      await screen.findByRole("heading", {
        name: "Un quartier transforme un terrain vide en jardin",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "Des voisins creent un jardin partage avec des bancs et des plantes locales.",
      ),
    ).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("fr");
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

describe("LocalizedArticleDetail", () => {
  test("hydrates visible article copy from the selected language detail API", async () => {
    const englishArticle = article({
      id: "detail-localized",
      source: "Google News - Happy Times",
      title: "English detail title",
      ai_summary: "English detail summary.",
      published_on_site_at: "2026-07-02T12:00:00Z",
    });
    const frenchArticle = {
      ...englishArticle,
      title: "Titre detail francais",
      ai_summary: "Resume detail francais.",
      language_code: "fr",
      requested_language_code: "fr",
      translation_available: true,
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => frenchArticle,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LocalizedArticleDetail initialArticle={englishArticle} />);

    expect(
      screen.getByRole("heading", { name: "English detail title" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("lang", "en");

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGE_EVENT, {
        detail: { languageCode: "fr" },
      }),
    );

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/articles/detail-localized?lang=fr",
        expect.objectContaining({
          cache: "default",
          headers: { Accept: "application/json" },
          signal: expect.any(AbortSignal),
        }),
      ),
    );
    expect(
      await screen.findByRole("heading", { name: "Titre detail francais" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Resume detail francais.")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("lang", "fr");
    expect(
      screen.getByLabelText(
        "community | Google News - Happy Times | 2 juillet 2026",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Retour à NutsNews/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lire l’article complet")).toBeInTheDocument();
    expect(screen.getByText("À propos de NutsNews")).toBeInTheDocument();
    expect(
      screen.getByText(
        "NutsNews propose un court résumé original et renvoie les lecteurs vers l’éditeur d’origine pour l’article complet.",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", {
        name: "Lire l’article complet chez Happy Times: Titre detail francais",
      }),
    ).toBeInTheDocument();
  });

  test("keeps the server-rendered article when localized detail fetch fails", async () => {
    const englishArticle = article({
      id: "detail-fallback",
      title: "English fallback title",
      ai_summary: "English fallback summary.",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ error: "Article not found" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LocalizedArticleDetail initialArticle={englishArticle} />);

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGE_EVENT, {
        detail: { languageCode: "fr" },
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      screen.getByRole("heading", { name: "English fallback title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("English fallback summary.")).toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("lang", "en");
  });

  test("keeps the server-rendered article when the detail API has no usable translation", async () => {
    const englishArticle = article({
      id: "detail-translation-missing",
      source: "Google News - Happy Times",
      title: "Server-rendered English title",
      ai_summary: "Server-rendered English summary.",
      published_on_site_at: "2026-07-02T12:00:00Z",
    });
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ...englishArticle,
        title: "API English fallback title",
        ai_summary: "API English fallback summary.",
        language_code: "en",
        requested_language_code: "fr",
        translation_available: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<LocalizedArticleDetail initialArticle={englishArticle} />);

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGE_EVENT, {
        detail: { languageCode: "fr" },
      }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    expect(
      screen.getByRole("heading", { name: "Server-rendered English title" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Server-rendered English summary.")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "API English fallback title" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toHaveAttribute("lang", "en");
    expect(
      screen.getByRole("link", { name: /Back to NutsNews/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("Read full story")).toBeInTheDocument();
    expect(screen.getByText("About NutsNews")).toBeInTheDocument();
    expect(
      screen.getByLabelText(
        "community | Google News - Happy Times | July 2, 2026",
      ),
    ).toBeInTheDocument();
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

describe("HeroTagline", () => {
  test("updates the masthead tagline when the reader changes language", async () => {
    render(<HeroTagline variant="masthead" />);

    expect(screen.getByText("Positive News, Simplified")).toBeInTheDocument();

    window.dispatchEvent(
      new CustomEvent(LANGUAGE_CHANGE_EVENT, {
        detail: { languageCode: "fr" },
      }),
    );

    expect(
      await screen.findByText("Actualités positives, simplifiées"),
    ).toBeInTheDocument();
  });
});

describe("SiteFooter", () => {
  test("opens the mobile menu with the footer navigation routes", async () => {
    const user = userEvent.setup();

    render(<SiteFooter />);

    const menuToggle = screen.getByTestId("nutsnews-footer-menu");
    expect(menuToggle).toHaveAttribute("aria-expanded", "false");

    await user.click(menuToggle);

    expect(menuToggle).toHaveAttribute("aria-expanded", "true");
    const menuPanel = screen.getByTestId("nutsnews-footer-menu-panel");

    expect(within(menuPanel).getByRole("link", { name: "Apps" })).toHaveAttribute("href", "/apps");
    expect(within(menuPanel).getByRole("link", { name: "Saved" })).toHaveAttribute("href", "/saved");
    expect(within(menuPanel).getByRole("link", { name: "About" })).toHaveAttribute("href", "/about");
    expect(within(menuPanel).getByRole("link", { name: "Contact" })).toHaveAttribute("href", "/contact");
    expect(within(menuPanel).getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");

    await user.keyboard("{Escape}");

    await waitFor(() => {
      expect(screen.queryByTestId("nutsnews-footer-menu-panel")).not.toBeInTheDocument();
    });
  });

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
