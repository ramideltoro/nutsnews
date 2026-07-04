import { ImageResponse } from "next/og";
import { getArticleById } from "@/lib/articles";
import { createOgImage, OG_IMAGE_SIZE } from "@/lib/ogImage";

export const revalidate = 3600;
export const alt = "NutsNews article social preview image";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

type ArticleOpenGraphImageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function Image({ params }: ArticleOpenGraphImageProps) {
  const { id } = await params;
  const article = await getArticleById(id);

  if (!article) {
    return new ImageResponse(
      createOgImage({
        eyebrow: "Story preview",
        title: "NutsNews",
        description:
          "A calm mobile feed of uplifting stories from trusted original publishers.",
        badge: "Positive news",
      }),
      OG_IMAGE_SIZE,
    );
  }

  const description =
    article.ai_summary ??
    "Read this uplifting story summary on NutsNews and visit the original publisher for the full article.";
  const badge = [article.category, article.source].filter(Boolean).join(" · ");

  return new ImageResponse(
    createOgImage({
      eyebrow: "Uplifting story preview",
      title: article.title,
      description,
      badge,
      footer: `${article.source} · via NutsNews`,
    }),
    OG_IMAGE_SIZE,
  );
}
