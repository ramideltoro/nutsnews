"use client";

import Image from "next/image";
import { type CSSProperties, useState } from "react";
import {
  ARTICLE_CARD_IMAGE_SIZES,
  ARTICLE_IMAGE_PLACEHOLDER,
  ARTICLE_IMAGE_QUALITY,
  normalizeArticleImageUrl,
  shouldBypassNextImageOptimization,
} from "@/lib/imageDelivery";
import { getFallbackThumbnailVisual } from "@/lib/fallbackThumbnails";

type ImageMode = "optimized" | "raw" | "fallback";

type OptimizedArticleImageProps = {
  src: string | null;
  alt?: string;
  className?: string;
  category?: string | null;
  eager?: boolean;
  sizes?: string;
};

function ArticleImageLoadingBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.36),_transparent_36%),linear-gradient(135deg,_#171717,_#0a0a0a_58%,_#451a03)]"
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-amber-100/5 to-transparent" />
    </div>
  );
}

export function ArticleImageFallback({
  category,
  className = "",
}: {
  category?: string | null;
  className?: string;
}) {
  const visual = getFallbackThumbnailVisual(category);
  const style = {
    "--fallback-pattern": visual.pattern,
    "--fallback-accent": visual.accent,
    "--fallback-glow": visual.glow,
    backgroundImage: visual.gradient,
  } as CSSProperties;

  return (
    <div
      role="img"
      aria-label={visual.ariaLabel}
      data-fallback-thumbnail={visual.id}
      style={style}
      className={`relative flex h-full w-full items-center justify-center overflow-hidden ${className}`}
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-95 [background-image:var(--fallback-pattern)]"
      />
      <div
        aria-hidden="true"
        className="absolute -left-10 top-8 h-32 w-32 rounded-full blur-2xl"
        style={{ backgroundColor: visual.glow }}
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-12 right-5 h-40 w-40 rounded-full blur-3xl"
        style={{ backgroundColor: visual.glow }}
      />
      <span
        aria-hidden="true"
        className="absolute left-7 top-6 h-12 w-12 rounded-full border text-center text-[10px] font-black uppercase leading-[3rem] tracking-[0.14em]"
        style={{ borderColor: visual.accent, color: visual.accent }}
      >
        {visual.monogram}
      </span>
      <span
        aria-hidden="true"
        className="absolute bottom-7 right-8 h-16 w-16 rounded-full border opacity-40"
        style={{ borderColor: visual.accent }}
      />

      <div className="relative z-10 max-w-[72%] rounded-[1.5rem] border border-white/15 bg-black/35 px-5 py-4 text-center shadow-2xl shadow-black/30 backdrop-blur-md">
        <p
          className="text-[10px] font-black uppercase tracking-[0.2em]"
          style={{ color: visual.accent }}
        >
          {visual.eyebrow}
        </p>
        <p className="mt-2 text-lg font-black uppercase tracking-[0.08em] text-amber-50">
          {visual.title}
        </p>
        <p className="mt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-100/60">
          No article image
        </p>
      </div>
    </div>
  );
}

export function OptimizedArticleImage({
  src,
  alt = "",
  className = "object-cover",
  category,
  eager = false,
  sizes = ARTICLE_CARD_IMAGE_SIZES,
}: OptimizedArticleImageProps) {
  const normalizedSrc = normalizeArticleImageUrl(src);
  const [mode, setMode] = useState<ImageMode>("optimized");

  if (!normalizedSrc || mode === "fallback") {
    return <ArticleImageFallback category={category} />;
  }

  const loading = eager ? "eager" : "lazy";
  const fetchPriority = eager ? "high" : "auto";
  const sharedClassName = `absolute inset-0 h-full w-full ${className} transition duration-500 ease-out`;

  if (mode === "raw" || shouldBypassNextImageOptimization(normalizedSrc)) {
    return (
      <>
        <ArticleImageLoadingBackdrop />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={normalizedSrc}
          alt={alt}
          className={sharedClassName}
          loading={loading}
          fetchPriority={fetchPriority}
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setMode("fallback")}
        />
      </>
    );
  }

  return (
    <>
      <ArticleImageLoadingBackdrop />
      <Image
        src={normalizedSrc}
        alt={alt}
        fill
        sizes={sizes}
        quality={ARTICLE_IMAGE_QUALITY}
        placeholder={ARTICLE_IMAGE_PLACEHOLDER}
        className={sharedClassName}
        loading={loading}
        fetchPriority={fetchPriority}
        onError={() => setMode("raw")}
      />
    </>
  );
}
