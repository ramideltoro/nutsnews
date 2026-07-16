"use client";

import type { LanguageCode } from "@/lib/languages";
import { useSelectedLanguage } from "./useSelectedLanguage";

type PrimarySectionId =
  | "top-stories"
  | "community"
  | "animals"
  | "science"
  | "wellness"
  | "travel"
  | "culture"
  | "achievements";

type PrimarySection = {
  id: PrimarySectionId;
  href: string;
};

const primarySections: PrimarySection[] = [
  { id: "top-stories", href: "#top-stories" },
  { id: "community", href: "#community" },
  { id: "animals", href: "#animals" },
  { id: "science", href: "#science" },
  { id: "wellness", href: "#wellness" },
  { id: "travel", href: "#travel" },
  { id: "culture", href: "#culture" },
  { id: "achievements", href: "#achievements" },
];

export const navCopyByLanguage: Record<LanguageCode, { ariaLabel: string; labels: Record<PrimarySectionId, string> }> = {
  en: {
    ariaLabel: "Primary sections",
    labels: {
      "top-stories": "Top Stories",
      community: "Community",
      animals: "Animals",
      science: "Science",
      wellness: "Wellness",
      travel: "Travel",
      culture: "Culture",
      achievements: "Achievements",
    },
  },
  fr: {
    ariaLabel: "Rubriques principales",
    labels: {
      "top-stories": "À la une",
      community: "Communauté",
      animals: "Animaux",
      science: "Science",
      wellness: "Bien-être",
      travel: "Voyage",
      culture: "Culture",
      achievements: "Réussites",
    },
  },
  ja: {
    ariaLabel: "主要セクション",
    labels: {
      "top-stories": "トップストーリー",
      community: "コミュニティ",
      animals: "動物",
      science: "科学",
      wellness: "ウェルネス",
      travel: "旅行",
      culture: "文化",
      achievements: "達成",
    },
  },
  "de-CH": {
    ariaLabel: "Hauptbereiche",
    labels: {
      "top-stories": "Top-Geschichten",
      community: "Gemeinschaft",
      animals: "Tiere",
      science: "Wissenschaft",
      wellness: "Wohlbefinden",
      travel: "Reisen",
      culture: "Kultur",
      achievements: "Erfolge",
    },
  },
  de: {
    ariaLabel: "Hauptbereiche",
    labels: {
      "top-stories": "Top-Geschichten",
      community: "Gemeinschaft",
      animals: "Tiere",
      science: "Wissenschaft",
      wellness: "Wohlbefinden",
      travel: "Reisen",
      culture: "Kultur",
      achievements: "Erfolge",
    },
  },
  el: {
    ariaLabel: "Κύριες ενότητες",
    labels: {
      "top-stories": "Κύριες ιστορίες",
      community: "Κοινότητα",
      animals: "Ζώα",
      science: "Επιστήμη",
      wellness: "Ευεξία",
      travel: "Ταξίδια",
      culture: "Πολιτισμός",
      achievements: "Επιτεύγματα",
    },
  },
};

export function NewspaperPrimaryNav() {
  const selectedLanguage = useSelectedLanguage();
  const copy = navCopyByLanguage[selectedLanguage] ?? navCopyByLanguage.en;

  return (
    <nav className="newspaper-primary-nav" aria-label={copy.ariaLabel}>
      {primarySections.map((section) => (
        <a key={section.id} href={section.href}>
          {copy.labels[section.id]}
        </a>
      ))}
    </nav>
  );
}
