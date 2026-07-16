import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import React from "react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-nutsnews-theme");
  document.documentElement.removeAttribute("style");
  document.documentElement.lang = "en";
  document.head
    .querySelectorAll('meta[name="theme-color"]')
    .forEach((element) => element.remove());
  window.localStorage.clear();
  window.sessionStorage.clear();
});

class TestIntersectionObserver implements IntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin = "0px";
  readonly thresholds = [0];

  constructor(
    private readonly callback: IntersectionObserverCallback,
  ) {}

  disconnect() {}
  observe(target: Element) {
    this.callback(
      [
        {
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRatio: 1,
          intersectionRect: target.getBoundingClientRect(),
          isIntersecting: true,
          rootBounds: null,
          target,
          time: performance.now(),
        },
      ],
      this,
    );
  }
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
  unobserve() {}
}

Object.defineProperty(window, "IntersectionObserver", {
  configurable: true,
  writable: true,
  value: TestIntersectionObserver,
});

Object.defineProperty(globalThis, "IntersectionObserver", {
  configurable: true,
  writable: true,
  value: TestIntersectionObserver,
});

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("prefers-reduced-motion"),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

Object.defineProperty(window, "scrollTo", {
  configurable: true,
  writable: true,
  value: vi.fn(),
});

vi.stubGlobal(
  "requestAnimationFrame",
  (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(performance.now()), 0),
);

vi.stubGlobal("cancelAnimationFrame", (id: number) => window.clearTimeout(id));

vi.mock("next/image", () => ({
  default: ({
    src,
    alt = "",
    ...props
  }: ComponentProps<"img"> & {
    fill?: boolean;
    priority?: boolean;
    quality?: number;
    placeholder?: string;
  }) => {
    const imageProps = { ...props };
    delete imageProps.fill;
    delete imageProps.priority;
    delete imageProps.quality;
    delete imageProps.placeholder;

    return React.createElement("img", { alt, src: String(src), ...imageProps });
  },
}));

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: ComponentProps<"a"> & { href: string; children: ReactNode }) => (
    React.createElement("a", { href, ...props }, children)
  ),
}));

vi.mock("next/script", () => ({
  default: ({
    onLoad,
    ...props
  }: ComponentProps<"script"> & { onLoad?: () => void }) => {
    if (onLoad) {
      window.setTimeout(onLoad, 0);
    }

    return React.createElement("script", props);
  },
}));

export const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));
