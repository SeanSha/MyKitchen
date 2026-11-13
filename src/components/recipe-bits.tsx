"use client";

import Image from "next/image";
import { useState } from "react";

const tones = ["bg-blush text-ink", "bg-butter text-ink", "bg-mint text-ink"];

export function chipTone(label: string): string {
  if (label === "未分类") return "bg-line text-ink/70";
  const index = [...label].reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length;
  return tones[index] ?? tones[0];
}

export function KindChips({ dishType }: { dishType: string }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      <li className={`rounded-full px-2.5 py-1 text-xs ${chipTone(dishType)}`}>{dishType}</li>
    </ul>
  );
}

export function RecipeCover({
  title,
  videoId,
  className = "aspect-video w-full",
  mark = "text-3xl",
}: {
  title: string;
  videoId: string | null;
  className?: string;
  mark?: string;
}) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const showImage = Boolean(videoId) && failedId !== videoId;
  return (
    <div className={`relative overflow-hidden bg-butter ${className}`}>
      {showImage ? (
        <Image
          src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
          alt=""
          fill
          sizes="(min-width: 1024px) 280px, 50vw"
          className="object-cover"
          draggable={false}
          onError={() => setFailedId(videoId)}
        />
      ) : (
        <span className={`absolute inset-0 grid place-items-center font-semibold text-clay ${mark}`}>{title.slice(0, 1) || "菜"}</span>
      )}
    </div>
  );
}
