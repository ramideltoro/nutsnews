import { ImageResponse } from "next/og";
import { createOgImage, OG_IMAGE_SIZE } from "@/lib/ogImage";

export const revalidate = 3600;
export const alt = "NutsNews article social preview image";
export const size = OG_IMAGE_SIZE;
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    createOgImage({
      eyebrow: "Uplifting story preview",
      title: "NutsNews",
      description:
        "Positive news summaries that keep original publishers visible and send readers to the complete story.",
      badge: "Publisher credited",
      footer: "Short summary with source attribution · nutsnews.com",
    }),
    OG_IMAGE_SIZE,
  );
}
