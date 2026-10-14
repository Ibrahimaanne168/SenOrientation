import React from "react";

interface BrandLogoProps {
  size?: number;
  className?: string;
  variant?: "auto" | "day" | "night" | "raw";
}

/**
 * Logo officiel JANGORA — Emblème Baobab & Voie du Savoir
 * Inspiré du Baobab sénégalais, du chemin d'orientation et du soleil levant.
 */
export function BrandLogo({
  size = 38,
  className = "",
  variant = "auto",
}: BrandLogoProps) {
  const containerBg =
    variant === "raw"
      ? "bg-transparent"
      : variant === "day"
      ? "bg-[#F7F5EF] border border-[#DDE6DF]"
      : variant === "night"
      ? "bg-[#0D2928] border border-[#2B514B]"
      : "bg-[var(--bg-card)] border border-[var(--border-main)]";

  return (
    <div
      style={{ width: size, height: size }}
      className={`relative shrink-0 rounded-xl overflow-hidden flex items-center justify-center transition-colors shadow-2xs ${containerBg} ${className}`}
      aria-label="Logo JANGORA"
    >
      {/* Emblème Mode Nuit (Arbre or & feuillage sauge sur vert nuit) */}
      <img
        src={variant === "raw" ? "/emblem-dark-trans.png" : "/emblem-dark-square.png"}
        alt="Jangora"
        className={`${
          variant === "day"
            ? "hidden"
            : variant === "night"
            ? "block"
            : "hidden dark:block"
        } w-full h-full object-cover select-none`}
      />
      {/* Emblème Mode Jour (Arbre vert baobab & arche dorée sur ivoire) */}
      <img
        src={variant === "raw" ? "/emblem-light-trans.png" : "/emblem-light-square.png"}
        alt="Jangora"
        className={`${
          variant === "night"
            ? "hidden"
            : variant === "day"
            ? "block"
            : "block dark:hidden"
        } w-full h-full object-cover select-none`}
      />
    </div>
  );
}

export default BrandLogo;
