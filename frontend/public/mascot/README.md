# 🦝 Kuro — Mascota oficial de NinjaSec

Esta carpeta contiene las variantes oficiales de **Kuro**, el mapache ninja de NinjaSec.

## Archivos esperados

| Archivo | Variante | Tamaño | Dónde se usa |
|---|---|---|---|
| `kuro-hero.png` | Pose heroica frontal | 1024×1024 | Login (`/login`), banners |
| `kuro-working.png` | Trabajando en laptop | 1024×1024 | Landing hero (`/`) |
| `kuro-waving.png` | Saludando | 768×768 | Empty states del dashboard |
| `kuro-confused.png` | Confundido / perdido | 768×768 | Página 404 |
| `kuro-celebrating.png` | Celebrando / pulgar arriba | 768×768 | Modales de éxito (futuro) |
| `kuro-avatar.png` | Avatar circular cuadrado | 256×256 | Sidebar, favicon, header |

## Requisitos técnicos

- **Formato:** PNG con **fondo transparente** (ideal) o **fondo navy `#0B0F1A`**
- **Espacio negativo:** 8-10% de margen alrededor del personaje
- **DPI:** 72 (web)
- **Peso máx por archivo:** 300KB (usar [TinyPNG](https://tinypng.com) si excede)

## Cómo agregar una variante nueva

1. Guardá la imagen aquí con el nombre `kuro-<variante>.png`
2. Si querés que aparezca en otro lugar, importá `<Mascot variant="<variante>" />` desde `@/components/ui/mascot`
3. Para nuevas variantes hay que actualizar el tipo `MascotVariant` en `components/ui/mascot.tsx`

## Paleta de colores oficial de Kuro

| Elemento | Hex |
|---|---|
| Capa/traje principal | `#0B0F1A` |
| Pelaje gris | `#334155` |
| Antifaz negro | `#000000` |
| Acentos tech (cinturón, ojos brillo) | `#3B82F6` (primary) |
| Empuñadura katana | `#10B981` (success) |
| Borla / detalle peruano | `#F59E0B` (warning) |
| Escudo "N" | `#F8FAFC` con borde `#3B82F6` |

## Prompt base para mantener consistencia

Ver `PROMPTS-KURO.md` en este mismo directorio para los 6 prompts listos para Banana IA / Midjourney / DALL-E 3.
