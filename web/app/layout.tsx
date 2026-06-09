import type { Metadata } from "next";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteUrl = "https://www.nutsnews.com";
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
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "NutsNews",
    title: "NutsNews | Positive News Curated by AI",
    description:
      "A calm daily feed of uplifting stories from around the world.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NutsNews | Positive News Curated by AI",
    description:
      "A calm daily feed of uplifting stories from around the world.",
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

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "NutsNews",
  url: siteUrl,
  description:
    "A calm, uplifting news feed curated by AI and linked back to trusted original sources.",
  publisher: {
    "@type": "Organization",
    name: "NutsNews",
    url: siteUrl,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />

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

        {children}
      </body>
    </html>
  );
}