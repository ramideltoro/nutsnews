import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppVersionGuard } from "./components/AppVersionGuard";
import { RuntimeAnalytics } from "./components/RuntimeAnalytics";

const siteUrl = "https://www.nutsnews.com";

const themeInitScript = `
(function () {
  var browserThemeColors = {
    amber: "#0a0a0a",
    "modern-saas": "#121212",
    "creative-premium": "#0f172a",
    "moody-cyberpunk": "#1a211b"
  };

  function updateBrowserThemeColor(theme) {
    var color = browserThemeColors[theme] || browserThemeColors.amber;
    var themeColorMeta = document.querySelector('meta[name="theme-color"]');

    if (!themeColorMeta) {
      themeColorMeta = document.createElement("meta");
      themeColorMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeColorMeta);
    }

    themeColorMeta.setAttribute("content", color);
  }

  try {
    var storageKey = "nutsnews.web.theme";
    var allowedThemes = {
      amber: true,
      "modern-saas": true,
      "creative-premium": true,
      "moody-cyberpunk": true
    };
    var storedTheme = window.localStorage.getItem(storageKey);
    var theme = allowedThemes[storedTheme] ? storedTheme : "amber";
    var root = document.documentElement;
    root.setAttribute("data-nutsnews-theme", theme);
    root.style.colorScheme = "dark";
    updateBrowserThemeColor(theme);

    var languageStorageKey = "nutsnews.web.language";
    var allowedLanguages = { en: true, fr: true, ja: true };
    var storedLanguage = window.localStorage.getItem(languageStorageKey);
    var language = allowedLanguages[storedLanguage] ? storedLanguage : "en";
    root.setAttribute("lang", language);
  } catch (_) {
    document.documentElement.setAttribute("data-nutsnews-theme", "amber");
    document.documentElement.style.colorScheme = "dark";
    document.documentElement.setAttribute("lang", "en");
    updateBrowserThemeColor("amber");
  }
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NutsNews | Positive News Curated by AI",
    template: "%s | NutsNews",
  },
  description:
    "NutsNews is a calm, positive news feed with uplifting stories from around the world, curated by AI and linked back to trusted original sources.",
  applicationName: "NutsNews",
  authors: [{ name: "Rami Del Toro", url: "https://www.ramideltoro.com" }],
  creator: "Rami Del Toro",
  publisher: "NutsNews",
  keywords: [
    "positive news",
    "uplifting news",
    "happy news",
    "good news",
    "AI curated news",
    "calm news",
    "NutsNews",
  ],
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "NutsNews",
    title: "NutsNews | Positive News Curated by AI",
    description: "A calm daily feed of uplifting stories from around the world.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "NutsNews positive news social preview",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "NutsNews | Positive News Curated by AI",
    description: "A calm daily feed of uplifting stories from around the world.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-nutsnews-theme="amber" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-neutral-950 text-neutral-50 antialiased`}
      >
        <script
          id="nutsnews-theme-init"
          dangerouslySetInnerHTML={{ __html: themeInitScript }}
        />

        <RuntimeAnalytics />
        <AppVersionGuard />
        {children}
      </body>
    </html>
  );
}
