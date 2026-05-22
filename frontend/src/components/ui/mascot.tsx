"use client";

import Image from "next/image";

export type MascotVariant =
  | "hero"          // Pose heroica frontal — login, banners
  | "working"       // Sentado con laptop — landing hero
  | "waving"        // Saludando — empty states
  | "confused"      // Confundido — 404
  | "celebrating"   // Celebrando — modales de éxito
  | "avatar"        // Bust shot circular — sidebar, favicon, FAB portal
  | "pointing"      // Señalando — tour, tooltips
  | "thumbsup";     // Pulgar arriba — toasts de éxito

type MascotSize = "sm" | "md" | "lg" | "xl";

const SIZE_PX: Record<MascotSize, number> = {
  sm: 120,
  md: 200,
  lg: 320,
  xl: 480,
};

const VARIANT_TO_FILE: Record<MascotVariant, string> = {
  hero:        "/mascot/kuro-hero.png",
  working:     "/mascot/kuro-working.png",
  waving:      "/mascot/kuro-waving.png",
  confused:    "/mascot/kuro-confused.png",
  celebrating: "/mascot/kuro-celebrating.png",
  avatar:      "/mascot/kuro-avatar.png",
  pointing:    "/mascot/kuro-pointing.png",
  thumbsup:    "/mascot/kuro-thumbsup.png",
};

const VARIANT_ALT: Record<MascotVariant, string> = {
  hero:        "Kuro, el ninja-mapache de NinjaSec",
  working:     "Kuro analizando dashboards de seguridad",
  waving:      "Kuro saludando",
  confused:    "Kuro está confundido",
  celebrating: "Kuro celebrando",
  avatar:      "Avatar de Kuro",
  pointing:    "Kuro señalando algo importante",
  thumbsup:    "Kuro aprueba con un pulgar arriba",
};

type MascotProps = {
  variant: MascotVariant;
  size?: MascotSize;
  /** Animación flotación sutil. Por defecto: true */
  float?: boolean;
  /** Glow azul detrás del personaje. Por defecto: true en hero/working */
  glow?: boolean;
  className?: string;
  priority?: boolean;
};

export function Mascot({
  variant,
  size = "lg",
  float = true,
  glow,
  className = "",
  priority = false,
}: MascotProps) {
  const px = SIZE_PX[size];
  const src = VARIANT_TO_FILE[variant];
  const alt = VARIANT_ALT[variant];
  const showGlow = glow ?? (variant === "hero" || variant === "working");

  const wrapperClasses = [
    "mascot-wrap",
    `mascot-size-${size}`,
    showGlow ? "mascot-glow" : "",
    float ? "mascot-float" : "",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={wrapperClasses} aria-hidden={false}>
      <Image
        src={src}
        alt={alt}
        width={px}
        height={px}
        priority={priority}
        className="mascot-img"
      />
    </div>
  );
}
