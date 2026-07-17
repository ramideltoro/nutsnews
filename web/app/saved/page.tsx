import type { Metadata } from "next";

import { SavedStoriesPage } from "./SavedStoriesPage";

export const metadata: Metadata = {
  title: "Saved Stories",
  description:
    "Open NutsNews stories saved locally in this browser without creating an account.",
  alternates: {
    canonical: "/saved",
  },
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Saved Stories | NutsNews",
    description:
      "A local NutsNews saved-stories page for uplifting articles saved on this device.",
    url: "/saved",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Saved Stories | NutsNews",
    description:
      "Open uplifting NutsNews stories saved locally in this browser.",
  },
};

export default function SavedPage() {
  return <SavedStoriesPage />;
}
