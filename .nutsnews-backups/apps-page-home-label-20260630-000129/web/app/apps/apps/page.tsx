import type { Metadata } from "next";

import { LocalizedAppsPage } from "./LocalizedAppsPage";

export const metadata: Metadata = {
  title: "NutsNews Apps",
  description:
    "Download NutsNews for iPhone and see what mobile platforms are coming next, including Android, iPad, Apple Watch, and CarPlay.",
  alternates: {
    canonical: "/apps",
  },
  openGraph: {
    title: "NutsNews Apps",
    description:
      "NutsNews for iPhone is here, with more ways to read positive news coming next.",
    url: "/apps",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "NutsNews Apps",
    description:
      "NutsNews for iPhone is here, with more ways to read positive news coming next.",
  },
};

export default function AppsPage() {
  return <LocalizedAppsPage />;
}
