# 🎨 Prompts oficiales — Kuro, mascota NinjaSec

> **Regla #1 para consistencia:** subí `kuro-hero.png` (la que ya tenés) como **referencia visual** antes de cada generación. En Midjourney usá `--cref <url>`. En DALL-E / Banana IA pegala como image input. En Bing Image Creator copiá el prompt + describí "based on the raccoon ninja character from this reference".

---

## 🚨 IMPORTANTE — Fondo transparente

Las IAs generativas (DALL-E 3, Midjourney, Banana IA) **NO generan PNG con canal alpha verdadero**. Vas a tener que limpiar el fondo después. Hay 2 caminos:

### Camino A — Generar con fondo limpio y removerlo después (recomendado)

Agregá esto al prompt para facilitar el recorte:

```
solid flat green chroma background (#00FF00),
no shadows touching the edges, character fully isolated and centered,
sharp clean silhouette, no blur, sticker style.
```

Después pasalo por **[remove.bg](https://www.remove.bg)** (gratis online, 1 click) → te devuelve PNG con fondo transparente real.

### Camino B — Pedir "sticker style" directamente

Algunas IAs (Midjourney v6 `--style raw`, DALL-E con prompt explícito) generan algo aceptable con:

```
sticker style, isolated character, white background, no shadows,
clean cut edges, transparent-ready.
```

Después remove.bg igual para limpiar restos.

### Camino C — Solo para hero/working con fondo decorativo

Si la imagen es **grande** (hero/working) y va sobre un panel oscuro, podés dejar el fondo navy `#0B0F1A` que ya genera DALL-E — queda invisible sobre el fondo del sitio.

---

## 🔧 Base universal (NO modificar)

Esta descripción del personaje **se repite en TODAS las variantes**:

```
Character: Kuro, a chibi-style cyber-ninja raccoon mascot.
He wears a dark navy hooded ninja outfit (#0B0F1A) with glowing
electric blue accents (#3B82F6), a black natural eye mask blending
with his hood. Large bright cyan-blue eyes (slightly anime-tech style).
On his back: a katana with green glowing hilt (#10B981).
Belt has a small orange-yellow Peruvian tassel (#F59E0B).
Striped raccoon tail visible. Clean modern flat illustration with
soft shading. Cute but professional, suitable for a B2B
cybersecurity SaaS for SMBs.

Style: vector illustration, anime chibi, soft cel-shading, friendly,
crisp lines, NO text in the image, sticker quality.
```

---

## 📦 Las 8 variantes que necesita NinjaSec

> 📌 **Renombrá cada archivo exactamente así** después de generarlo y limpiarlo: el código de la app ya espera estos nombres en `public/mascot/`.

### 1️⃣ `kuro-hero.png` ✅ — Ya generada

**Uso:** Login (`/login`), banners marketing
**Tamaño:** 1024×1024
**Estado:** ✅ Ya está en el proyecto

---

### 2️⃣ `kuro-working.png` — Trabajando en laptop

**Uso:** Landing hero (`/`)
**Tamaño final:** 1024×1024
**Fondo:** Transparente (vía remove.bg) o navy `#0B0F1A`

**Prompt completo:**
```
[BASE UNIVERSAL]

Pose: sitting cross-legged in front of a glowing laptop, hood
slightly back, focused expression with a small confident smile.
The laptop screen shows abstract blue dashboards and a shield icon
(no readable text). Floating holographic UI panels around him with
abstract bars/graphs in blue. He is typing with both paws.

Composition: 3/4 view, centered, isolated character,
solid flat green chroma background (#00FF00),
no shadows touching the edges, sharp clean silhouette, sticker style.

1024x1024, square 1:1 aspect ratio.
--ar 1:1 --style raw --v 6 --cref [kuro-hero.png URL]
```

---

### 3️⃣ `kuro-waving.png` — Saludando alegremente

**Uso:** Empty states del dashboard (cuando no hay datos)
**Tamaño final:** 768×768
**Fondo:** **TRANSPARENTE obligatorio**

**Prompt completo:**
```
[BASE UNIVERSAL]

Pose: standing with right paw raised waving hello, big happy smile,
slightly tilted head, friendly inviting body language. Left paw on
his hip. Tail curled cheerfully. NO shield visible.

Composition: full body, centered, isolated character,
solid flat green chroma background (#00FF00),
no shadows touching the edges, sharp clean silhouette, sticker style.

768x768, square 1:1 aspect ratio.
--ar 1:1 --style raw --v 6 --cref [kuro-hero.png URL]
```

---

### 4️⃣ `kuro-confused.png` — Confundido / 404

**Uso:** Página 404 (`/cualquier-ruta-falsa`)
**Tamaño final:** 768×768
**Fondo:** **TRANSPARENTE obligatorio**

**Prompt completo:**
```
[BASE UNIVERSAL]

Pose: standing, scratching his head with right paw, big floating
question marks in glowing blue (#3B82F6) above him, confused but
cute expression with one eyebrow raised. Holding a paper map upside
down in his left paw. Hood slightly crooked.

Composition: full body, centered, isolated character,
solid flat green chroma background (#00FF00),
no shadows touching the edges, sharp clean silhouette, sticker style.

768x768, square 1:1 aspect ratio.
--ar 1:1 --style raw --v 6 --cref [kuro-hero.png URL]
```

---

### 5️⃣ `kuro-celebrating.png` — Celebrando

**Uso:** Modales de éxito futuros, demo agendada
**Tamaño final:** 768×768
**Fondo:** **TRANSPARENTE obligatorio**

**Prompt completo:**
```
[BASE UNIVERSAL]

Pose: jumping in the air with both paws up, big joyful smile,
sparkles and confetti particles around him in blue (#3B82F6) and
green (#10B981). His katana glows brightly. Tail swirling
energetically. Stars in his eyes.

Composition: full body, centered, isolated character,
solid flat green chroma background (#00FF00),
no shadows touching the edges, sharp clean silhouette, sticker style.

768x768, square 1:1 aspect ratio.
--ar 1:1 --style raw --v 6 --cref [kuro-hero.png URL]
```

---

### 6️⃣ `kuro-avatar.png` — 🌟 CRÍTICO para el FAB asistente

**Uso:** Botón flotante del portal (`/portal/*`) + sidebar + favicon
**Tamaño final:** 256×256 — debe verse bien en círculo de 56×56 px
**Fondo:** **TRANSPARENTE obligatorio** (el FAB lo recorta en círculo)

**Prompt completo:**
```
[BASE UNIVERSAL]

Composition: HEAD AND SHOULDERS ONLY (bust shot, no legs visible),
looking forward at the viewer, gentle confident smile, hood up,
ears visible. Tightly centered for a circular avatar crop, leaving
12% margin around. Face is the focal point — eyes very visible.

solid flat green chroma background (#00FF00),
no shadows touching the edges, sharp clean silhouette, sticker style.

256x256, square 1:1 aspect ratio, optimized for circular cropping.
--ar 1:1 --style raw --v 6 --cref [kuro-hero.png URL]
```

> ⚠️ **Esta variante es la más importante** porque se usa en el FAB del portal que verán todos los clientes. Generala con extra cuidado.

---

### 7️⃣ `kuro-pointing.png` — Señalando hacia un lado

**Uso:** Tour de onboarding (futuro), tooltips de ayuda
**Tamaño final:** 512×512
**Fondo:** **TRANSPARENTE obligatorio**

**Prompt completo:**
```
[BASE UNIVERSAL]

Pose: standing facing forward but pointing emphatically to his right
(viewer's left) with his index paw extended, looking at where he's
pointing with a smart "look at this!" expression. Mouth slightly
open as if explaining something. Other paw resting at his side.

Composition: full body, centered, isolated character,
solid flat green chroma background (#00FF00),
no shadows touching the edges, sharp clean silhouette, sticker style.

512x512, square 1:1 aspect ratio.
--ar 1:1 --style raw --v 6 --cref [kuro-hero.png URL]
```

---

### 8️⃣ `kuro-thumbsup.png` — Pulgar arriba

**Uso:** Confirmaciones rápidas, notifySuccess (toasts)
**Tamaño final:** 512×512
**Fondo:** **TRANSPARENTE obligatorio**

**Prompt completo:**
```
[BASE UNIVERSAL]

Pose: standing facing forward, right paw giving an enthusiastic
thumbs up, big proud smile, winking with one eye (left eye closed).
Left paw on hip. Confident "good job!" body language.

Composition: full body, centered, isolated character,
solid flat green chroma background (#00FF00),
no shadows touching the edges, sharp clean silhouette, sticker style.

512x512, square 1:1 aspect ratio.
--ar 1:1 --style raw --v 6 --cref [kuro-hero.png URL]
```

---

## 🛠️ Flujo paso a paso

### Para cada variante:

1. **Copiá el prompt** completo (incluido `[BASE UNIVERSAL]`)
2. **Subí `kuro-hero.png`** como referencia visual en el generador
3. **Generá la imagen** con el motor que prefieras:
   - Midjourney v6+ → mejor consistencia con `--cref`
   - DALL-E 3 (ChatGPT Plus) → bueno con image input
   - Bing Image Creator → gratis, calidad decente
   - Banana IA → según tu acceso
4. **Si tiene fondo verde/blanco** → pasala por https://www.remove.bg (1 click, gratis)
5. **Si pesa > 300KB** → comprimila en https://tinypng.com
6. **Renombrala** al nombre exacto (ej. `kuro-avatar.png`)
7. **Pegala en** `PY-MK/frontend/public/mascot/`
8. **Editá** `src/components/ui/mascot.tsx` líneas 23-28: cambiá la línea correspondiente para apuntar al nuevo archivo
9. **Hard refresh** del browser (Ctrl+Shift+R)

---

## 🎯 Orden de prioridad sugerido

| Prioridad | Variante | Por qué |
|---|---|---|
| 🔴 P1 | `kuro-avatar.png` | El FAB del portal lo usa — todos los clientes lo verán |
| 🔴 P1 | `kuro-working.png` | Landing hero — primera impresión pública |
| 🟡 P2 | `kuro-confused.png` | Página 404 |
| 🟡 P2 | `kuro-waving.png` | Empty states del dashboard |
| 🟢 P3 | `kuro-thumbsup.png` | Toasts de éxito |
| 🟢 P3 | `kuro-celebrating.png` | Modales de demo agendada |
| 🟢 P3 | `kuro-pointing.png` | Tour de onboarding (futuro) |

---

## 🎨 Tips para que las IAs respeten el personaje

| Problema típico | Solución |
|---|---|
| El color del traje cambia | Repetir `#0B0F1A` en el prompt al menos 2 veces |
| Los ojos pierden el azul brillante | Agregar "cyan-blue glowing eyes" explícito |
| Pierde la cola rayada | Agregar "striped raccoon tail visible" siempre |
| Se ve "diferente" entre imágenes | Usar `--cref` (Midjourney) o image input (DALL-E) con `kuro-hero.png` |
| El estilo se vuelve realista | Repetir "chibi style, vector illustration, flat anime" |
| Aparece texto | Agregar "NO text, NO words, NO letters" al final |

---

## 💡 Si la IA te ofrece varias opciones

**Elegí siempre la que:**
1. Mantenga el antifaz negro natural del mapache
2. Tenga el cinturón azul con borla naranja visible
3. Mantenga las proporciones chibi (cabeza grande, cuerpo pequeño)
4. Tenga ojos grandes y expresivos

Si ninguna cumple, **regenerá** — no aceptes drift de estilo.
