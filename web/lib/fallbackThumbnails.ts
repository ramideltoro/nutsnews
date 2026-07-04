export type FallbackThumbnailId =
  | "community"
  | "animals"
  | "science"
  | "wellness"
  | "travel"
  | "culture"
  | "achievements"
  | "uplifting";

export type FallbackThumbnailVisual = {
  id: FallbackThumbnailId;
  title: string;
  eyebrow: string;
  monogram: string;
  ariaLabel: string;
  gradient: string;
  accent: string;
  glow: string;
  pattern: string;
};

const FALLBACK_THUMBNAILS: Record<FallbackThumbnailId, Omit<FallbackThumbnailVisual, "ariaLabel">> = {
  community: {
    id: "community",
    title: "Community",
    eyebrow: "Good neighbors",
    monogram: "CO",
    gradient: "linear-gradient(135deg, #10231d 0%, #0a0a0a 54%, #4a2408 100%)",
    accent: "#fbbf24",
    glow: "rgba(251, 191, 36, 0.32)",
    pattern: "radial-gradient(circle at 20% 20%, rgba(251, 191, 36, 0.34), transparent 28%), radial-gradient(circle at 80% 76%, rgba(16, 185, 129, 0.22), transparent 30%)",
  },
  animals: {
    id: "animals",
    title: "Animals",
    eyebrow: "Creature care",
    monogram: "AN",
    gradient: "linear-gradient(135deg, #132615 0%, #0b0f0b 56%, #3f2c0b 100%)",
    accent: "#a7f3d0",
    glow: "rgba(16, 185, 129, 0.28)",
    pattern: "radial-gradient(circle at 24% 24%, rgba(167, 243, 208, 0.26), transparent 24%), radial-gradient(circle at 76% 72%, rgba(251, 191, 36, 0.24), transparent 28%)",
  },
  science: {
    id: "science",
    title: "Science",
    eyebrow: "Bright ideas",
    monogram: "SC",
    gradient: "linear-gradient(135deg, #0d2330 0%, #090b0d 55%, #41240c 100%)",
    accent: "#7dd3fc",
    glow: "rgba(125, 211, 252, 0.28)",
    pattern: "radial-gradient(circle at 22% 18%, rgba(125, 211, 252, 0.3), transparent 25%), linear-gradient(115deg, transparent 0 38%, rgba(251, 191, 36, 0.16) 39% 41%, transparent 42% 100%)",
  },
  wellness: {
    id: "wellness",
    title: "Wellness",
    eyebrow: "Healthy wins",
    monogram: "WE",
    gradient: "linear-gradient(135deg, #10251f 0%, #090b0a 55%, #3b1d15 100%)",
    accent: "#86efac",
    glow: "rgba(134, 239, 172, 0.28)",
    pattern: "radial-gradient(circle at 26% 22%, rgba(134, 239, 172, 0.28), transparent 26%), radial-gradient(circle at 76% 78%, rgba(251, 146, 60, 0.2), transparent 26%)",
  },
  travel: {
    id: "travel",
    title: "Travel",
    eyebrow: "Open roads",
    monogram: "TR",
    gradient: "linear-gradient(135deg, #13213a 0%, #090a0c 54%, #4a2508 100%)",
    accent: "#93c5fd",
    glow: "rgba(147, 197, 253, 0.28)",
    pattern: "linear-gradient(130deg, transparent 0 34%, rgba(147, 197, 253, 0.22) 35% 37%, transparent 38% 100%), radial-gradient(circle at 78% 25%, rgba(251, 191, 36, 0.28), transparent 24%)",
  },
  culture: {
    id: "culture",
    title: "Culture",
    eyebrow: "Creative spark",
    monogram: "CU",
    gradient: "linear-gradient(135deg, #281535 0%, #0b090c 54%, #472208 100%)",
    accent: "#f0abfc",
    glow: "rgba(240, 171, 252, 0.26)",
    pattern: "radial-gradient(circle at 22% 24%, rgba(240, 171, 252, 0.24), transparent 26%), radial-gradient(circle at 78% 72%, rgba(251, 191, 36, 0.24), transparent 28%)",
  },
  achievements: {
    id: "achievements",
    title: "Achievement",
    eyebrow: "Milestone",
    monogram: "AC",
    gradient: "linear-gradient(135deg, #2c240b 0%, #0b0a08 56%, #2c1808 100%)",
    accent: "#fde68a",
    glow: "rgba(253, 230, 138, 0.3)",
    pattern: "radial-gradient(circle at 24% 22%, rgba(253, 230, 138, 0.32), transparent 26%), linear-gradient(145deg, transparent 0 42%, rgba(251, 191, 36, 0.18) 43% 45%, transparent 46% 100%)",
  },
  uplifting: {
    id: "uplifting",
    title: "Uplifting",
    eyebrow: "Positive story",
    monogram: "NN",
    gradient: "linear-gradient(135deg, #171717 0%, #0a0a0a 58%, #451a03 100%)",
    accent: "#fcd34d",
    glow: "rgba(245, 158, 11, 0.32)",
    pattern: "radial-gradient(circle at 22% 20%, rgba(245, 158, 11, 0.34), transparent 28%), radial-gradient(circle at 78% 75%, rgba(251, 191, 36, 0.2), transparent 30%)",
  },
};

const CATEGORY_MATCHES: Array<{ id: FallbackThumbnailId; terms: string[] }> = [
  { id: "animals", terms: ["animal", "wildlife", "pet", "rescue"] },
  { id: "science", terms: ["science", "research", "discovery", "space", "climate"] },
  { id: "wellness", terms: ["wellness", "health", "healing", "medical"] },
  { id: "travel", terms: ["travel", "journey", "destination", "outdoor"] },
  { id: "culture", terms: ["culture", "art", "music", "creative", "education"] },
  { id: "achievements", terms: ["achievement", "award", "milestone", "sports", "record"] },
  { id: "community", terms: ["community", "volunteer", "kindness", "neighbors", "local"] },
];

export function getFallbackThumbnailVisual(category?: string | null): FallbackThumbnailVisual {
  const normalizedCategory = category?.toLowerCase() ?? "";
  const match = CATEGORY_MATCHES.find(({ terms }) =>
    terms.some((term) => normalizedCategory.includes(term)),
  );
  const visual = FALLBACK_THUMBNAILS[match?.id ?? "uplifting"];

  return {
    ...visual,
    ariaLabel: `Non-photographic ${visual.title.toLowerCase()} fallback thumbnail for an article with no usable image.`,
  };
}
