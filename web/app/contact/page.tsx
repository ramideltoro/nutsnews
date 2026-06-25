import type { Metadata } from "next";

import { LocalizedContactPage } from "./LocalizedContactPage";

export const metadata: Metadata = {
  title: "Contact",
  description:
    "Contact NutsNews with questions, feedback, story ideas, or site issues.",
  alternates: {
    canonical: "/contact",
  },
  openGraph: {
    title: "Contact | NutsNews",
    description:
      "Send a message to NutsNews with questions, feedback, story ideas, or site issues.",
    url: "/contact",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact | NutsNews",
    description:
      "Send a message to NutsNews with questions, feedback, story ideas, or site issues.",
  },
};

export default function ContactPage() {
  return <LocalizedContactPage />;
}
