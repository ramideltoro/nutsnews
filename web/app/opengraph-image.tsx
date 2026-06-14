import { ImageResponse } from "next/og";
import { createOgImage, OG_IMAGE_SIZE } from "@/lib/ogImage";

export const runtime = "edge";
export const alt = "NutsNews social preview image";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    createOgImage({
      eyebrow: "Positive news, simplified",
      title: "A calmer way to read what is good in the world",
      description:
        "NutsNews finds uplifting stories, summarizes them clearly, and sends readers back to trusted original publishers.",
      badge: "AI-curated uplifting stories",
    }),
    OG_IMAGE_SIZE,
  );
}
