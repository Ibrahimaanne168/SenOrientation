import React from "react";

interface BrandLogoProps {
  size?: number;
  className?: string;
  variant?: "auto" | "day" | "night" | "raw";
}

/**
 * Logo officiel SenOrientation — Palette Baobab
 * Symbole épuré de boussole stellaire à 4 pointes en sable doré (#E9D5A1)
 * Fond vert principal (#155E59) en jour et vert nuit (#0D2928 / #1B4440) en nuit.
 */
export function BrandLogo({
  size = 36,
  className = "",
  variant = "auto",
}: BrandLogoProps) {
  const containerBg =
    variant === "raw"
      ? "bg-transparent"
      : variant === "day"
      ? "bg-[#155E59] border border-[#155E59]/20"
      : variant === "night"
      ? "bg-[#0D2928] border border-[#2B514B]"
      : "bg-[var(--logo-bg)] border border-[var(--border-main)]";

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 rounded-xl overflow-hidden flex items-center justify-center transition-colors shadow-2xs ${containerBg} ${className}`}
      aria-label="Logo SenOrientation — Boussole Baobab"
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-[72%] h-[72%]"
      >
        {/* Anneau subtil d'orientation */}
        <circle
          cx="50"
          cy="50"
          r="30"
          stroke="#E9D5A1"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          opacity="0.45"
        />

        {/* Boussole stellaire 4 pointes (Sable Doré pur #E9D5A1) */}
        <path
          d="M50 14 L56 44 L86 50 L56 56 L50 86 L44 56 L14 50 L44 44 Z"
          fill="#E9D5A1"
        />
        {/* Facettage géométrique discret pour une finition sobre */}
        <path
          d="M50 14 L56 44 L50 50 Z M86 50 L56 56 L50 50 Z M50 86 L44 56 L50 50 Z M14 50 L44 44 L50 50 Z"
          fill="#D6C088"
          opacity="0.5"
        />

        {/* Point central de mire */}
        <circle cx="50" cy="50" r="3" fill="#0D2928" />
        <circle cx="50" cy="50" r="1.4" fill="#E9D5A1" />
      </svg>
    </div>
  );
}

export default BrandLogo;
