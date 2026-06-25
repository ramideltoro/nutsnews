import type { Metadata } from "next";

import { LocalizedAboutPage } from "./LocalizedAboutPage";

export const metadata: Metadata = {
  title: "About NutsNews",
  description:
    "Learn why NutsNews exists and how it brings positive, uplifting stories together through thoughtful automation, AI curation, and a calm reader experience.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About NutsNews",
    description:
      "A calmer way to follow the world: positive stories, thoughtful summaries, source-friendly links, and technology built around uplifting news.",
    url: "/about",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "About NutsNews",
    description:
      "NutsNews is a positive news experience built to make the internet feel calmer, kinder, and easier to enjoy.",
  },
};

export default function AboutPage() {
  return <LocalizedAboutPage />;
}
