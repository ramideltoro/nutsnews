import { act, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ArticleFeed } from "@/app/components/ArticleFeed";
import { HeroTagline } from "@/app/components/HeroTagline";
import type { Article } from "@/lib/articles";
import { LANGUAGE_CHANGE_EVENT, LANGUAGE_STORAGE_KEY, type LanguageCode } from "@/lib/languages";

function story(title: string, language: LanguageCode = "en"): Article {
  return {
    id: title, title, source: "Happy Times", original_url: `https://example.test/${title}`,
    image_url: null, published_at: null, published_on_site_at: null,
    ai_summary: title, category: "community", positivity_score: 0.9,
    language_code: language, requested_language_code: language, translation_available: true,
  };
}

function deferredResponse() {
  let resolve!: (value: Response) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<Response>((yes, no) => { resolve = yes; reject = no; });
  return {
    promise, reject,
    resolve: (title: string, language: LanguageCode) => resolve({
      ok: true,
      json: async () => ({ articles: [story(title, language)], sections: [], nextPage: null, nextCursor: null }),
    } as Response),
  };
}

function changeLanguage(languageCode: LanguageCode) {
  act(() => {
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, languageCode);
    window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { languageCode } }));
  });
}

function renderFeed(nextPage: number | null = null) {
  return render(<ArticleFeed initialArticles={[story("English story")]} initialNextPage={nextPage}
    initialNextCursor={null} initialCategorySections={[]} />);
}

describe("language changes while feed requests are pending", () => {
  test("keeps the latest language when an older home response arrives last", async () => {
    const french = deferredResponse();
    const german = deferredResponse();
    const fetchMock = vi.fn().mockReturnValueOnce(french.promise).mockReturnValueOnce(german.promise);
    vi.stubGlobal("fetch", fetchMock);
    renderFeed();
    changeLanguage("fr");
    changeLanguage("de");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { german.resolve("Deutsche Geschichte", "de"); });
    expect(screen.getByRole("heading", { name: "Deutsche Geschichte" })).toBeInTheDocument();
    await act(async () => { french.resolve("Histoire française", "fr"); });
    expect(screen.getByRole("heading", { name: "Deutsche Geschichte" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Histoire française" })).not.toBeInTheDocument();
    expect(document.documentElement.lang).toBe("de");
  });

  test("restores English immediately and ignores pending translations", async () => {
    const french = deferredResponse();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(french.promise));
    renderFeed();
    changeLanguage("fr");
    changeLanguage("en");
    expect(screen.getByRole("heading", { name: "English story" })).toBeInTheDocument();
    await act(async () => { french.resolve("Histoire française", "fr"); });
    expect(screen.getByRole("heading", { name: "English story" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("en");
  });

  test("does not show an obsolete request failure after the new language succeeds", async () => {
    const french = deferredResponse();
    const german = deferredResponse();
    vi.stubGlobal("fetch", vi.fn().mockReturnValueOnce(french.promise).mockReturnValueOnce(german.promise));
    renderFeed();
    changeLanguage("fr");
    changeLanguage("de");
    await act(async () => { german.resolve("Deutsche Geschichte", "de"); });
    await act(async () => { french.reject(new Error("Obsolete request failed")); });
    expect(screen.queryByText("Obsolete request failed")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Deutsche Geschichte" })).toBeInTheDocument();
  });

  test("does not append old-language pagination after switching languages", async () => {
    const olderEnglish = deferredResponse();
    const french = deferredResponse();
    const fetchMock = vi.fn().mockReturnValueOnce(olderEnglish.promise).mockReturnValueOnce(french.promise);
    vi.stubGlobal("fetch", fetchMock);
    renderFeed(1);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/articles?page=1", expect.anything()));
    changeLanguage("fr");
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    await act(async () => { french.resolve("Histoire française", "fr"); });
    await act(async () => { olderEnglish.resolve("Older English story", "en"); });
    expect(screen.queryByRole("heading", { name: "Older English story" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Histoire française" })).toBeInTheDocument();
  });

  test("updates article data when another tab changes the stored language", async () => {
    const french = deferredResponse();
    vi.stubGlobal("fetch", vi.fn().mockReturnValue(french.promise));
    renderFeed();
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: LANGUAGE_STORAGE_KEY, newValue: "fr" }));
    });
    await act(async () => { french.resolve("Histoire française", "fr"); });
    expect(screen.getByRole("heading", { name: "Histoire française" })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe("fr");
  });

  test("aborts feed requests on unmount", () => {
    const french = deferredResponse();
    const fetchMock = vi.fn().mockReturnValue(french.promise);
    vi.stubGlobal("fetch", fetchMock);
    const view = renderFeed();
    changeLanguage("fr");
    view.unmount();
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  });

  test("does not let the initial language timer overwrite a new selection", async () => {
    render(<HeroTagline />);
    act(() => {
      window.dispatchEvent(new CustomEvent(LANGUAGE_CHANGE_EVENT, { detail: { languageCode: "fr" } }));
    });
    await act(async () => { await new Promise((resolve) => window.setTimeout(resolve, 10)); });
    expect(document.documentElement.lang).toBe("fr");
    expect(screen.getByLabelText("Actualités positives, simplifiées")).toBeInTheDocument();
  });
});
