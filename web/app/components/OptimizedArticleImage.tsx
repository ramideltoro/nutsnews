"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ARTICLE_CARD_IMAGE_SIZES,
  ARTICLE_IMAGE_PLACEHOLDER,
  ARTICLE_IMAGE_QUALITY,
  normalizeArticleImageUrl,
  shouldBypassNextImageOptimization,
} from "@/lib/imageDelivery";

type ImageMode = "optimized" | "raw" | "fallback";

type OptimizedArticleImageProps = {
  src: string | null;
  alt?: string;
  className?: string;
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

export function ArticleImageFallback() {
  return (
    <div className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.42),_transparent_36%),linear-gradient(135deg,_#171717,_#0a0a0a_58%,_#451a03)]">
      <span className="absolute left-7 top-6 text-5xl text-amber-200/25">
        ✦
      </span>
      <span className="absolute bottom-7 right-8 text-6xl text-amber-300/20">
        ●
      </span>
      <span className="absolute right-12 top-9 text-3xl text-orange-200/25">
        ✧
      </span>

      <div className="relative z-10 rounded-[1.5rem] border border-amber-200/20 bg-black/30 px-5 py-4 text-center shadow-2xl shadow-black/30 backdrop-blur-md">
        <div className="text-4xl">✨</div>
        <p className="mt-2 text-[11px] font-black uppercase tracking-[0.2em] text-amber-100">
          Positive Story
        </p>
      </div>
    </div>
  );
}

export function OptimizedArticleImage({
  src,
  alt = "",
  className = "object-cover",
  eager = false,
  sizes = ARTICLE_CARD_IMAGE_SIZES,
}: OptimizedArticleImageProps) {
  const normalizedSrc = normalizeArticleImageUrl(src);
  const [mode, setMode] = useState<ImageMode>("optimized");

  if (!normalizedSrc || mode === "fallback") {
    return <ArticleImageFallback />;
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
