import React from "react";

interface BrandLogoProps {
  size?: number;
  className?: string;
  variant?: "auto" | "day" | "night" | "raw";
  rounded?: string;
}

/**
 * Logo officiel JANGORA — Emblème Baobab & Voie du Savoir
 * Inspiré du Baobab sénégalais, du chemin d'orientation et du soleil levant.
 */
export function BrandLogo({
  size = 38,
  className = "",
  variant = "auto",
  rounded = "rounded-2xl",
}: BrandLogoProps) {
  const containerBg =
    variant === "raw"
      ? "bg-transparent"
      : variant === "day"
      ? "bg-white border border-[#DDE6DF]"
      : variant === "night"
      ? "bg-[#0D2928] border border-[#2B514B]"
      : "bg-white dark:bg-[#0A2624] border border-[var(--border-main)]";

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 ${rounded} overflow-hidden flex items-center justify-center transition-colors shadow-xs ${containerBg} ${className}`}
      aria-label="Logo JANGORA"
    >
      <img
        src="/icon.png"
        alt="Jangora"
        className="w-full h-full object-contain p-[2px] select-none"
      />
    </div>
  );
}

export default BrandLogo;
