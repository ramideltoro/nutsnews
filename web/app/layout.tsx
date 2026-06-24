import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AppVersionGuard } from "./components/AppVersionGuard";
import { ThemeSwitcher } from "./components/ThemeSwitcher";

const siteUrl = "https://www.nutsnews.com";

const appVersion =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_NUTSNEWS_BUILD_ID ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  "development";


const gaId =
  process.env.NODE_ENV === "production"
    ? process.env.NEXT_PUBLIC_GA_ID
    : undefined;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} bg-neutral-950 text-neutral-50 antialiased`}
      >
        {gaId ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        ) : null}

        <AppVersionGuard version={appVersion} />
        <ThemeSwitcher />

        {children}
      </body>
    </html>
  );
}