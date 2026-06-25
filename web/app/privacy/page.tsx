import type { Metadata } from "next";

import { LocalizedPrivacyPolicyPage } from "./LocalizedPrivacyPolicyPage";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "Read the NutsNews privacy policy, including how the iOS app and website handle article browsing, local likes, caching, diagnostics, and third-party publisher links.",
  alternates: {
    canonical: "/privacy",
  },
  openGraph: {
    title: "Privacy Policy | NutsNews",
    description:
      "How NutsNews handles privacy for its positive news website and iOS app.",
    url: "/privacy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Privacy Policy | NutsNews",
    description:
      "How NutsNews handles privacy for its positive news website and iOS app.",
  },
};

export default function PrivacyPolicyPage() {
  return <LocalizedPrivacyPolicyPage />;
}
