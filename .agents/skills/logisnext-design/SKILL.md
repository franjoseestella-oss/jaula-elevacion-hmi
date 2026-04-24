---
name: logisnext-design
description: Skill para aplicar el tema y los colores corporativos de Logisnext (https://logisnext.eu/es/spain/home) en el diseño de interfaces web. Asegura que el frontend adopte la identidad visual de Logisnext, usando sus tonos Magenta, Rojo y las variantes de Acero/Pizarra.
---

# Directrices de Diseño Corporativo: Logisnext Europe

Esta skill debe activarse siempre que el usuario solicite un diseño frontend, componente o página que necesite alinearse con la identidad corporativa de Logisnext o utilizar sus colores y directrices de UI.

## 1. Paleta de Colores (Logisnext Theme)

Utiliza siempre que sea posible variables CSS para definir y aplicar de manera consistente la siguiente paleta extraída de la web oficial de Logisnext:

- **Colores Primarios (Acentos / Interacción)**:
  - **Magenta Corporativo**: `#dd2876` - Color principal para botones (CTAs), enlaces destacados y elementos interactivos importantes.
  - **Rojo Fuerte**: `#e00000` - Rojo utilizado para alertas, elementos críticos o acentos secundarios, evocativo de la marca Mitsubishi.

- **Colores Secundarios (Tonos Acero/Pizarra Industrial)**:
  - **Dark Slate / Pizarra Oscuro (Fondo Oscuro/Texto Principal)**: `#2e404a` - Fondo para secciones oscuras o de alto contraste. También es el color ideal para tipografías de titulares grandes (H1, H2) o cuerpos de texto pesados.
  - **Slate Blue / Pizarra Medio**: `#5d7a8a` - Usado para fondos secundarios de tarjetas, pies de página, encabezados menores o bordes importantes, transmite seriedad técnica/industrial.
  - **Light Slate / Pizarra Claro**: `#aebfc9` - Para divisiones de secciones, bordes finos o colores de placeholder.

- **Colores Neutros**:
  - **Fondo Base**: `#ffffff` (Blanco puro).
  - **Gris de Apoyo**: `#efefef` (Para crear bandas o franjas alternas y separar contenido del blanco).
  - **Básicos**: `#000000` (Negro).

## 2. Tipografía y Estructura

- **Fuente**: Elige fuentes Sans-Serif modernas, legibles y "técnicas" (por ejemplo: Roboto, Inter, Helvetica Neue o análogas).
- **Peso de la Fuente**: Utiliza pesos variables para diferenciar contenido. Los encabezados en negrita (700 o superior) usando el `#2e404a`, mientras que los textos base deben ser más tenues o ligeros, manteniendo excelente legibilidad sobre fondos claros.

## 3. Disposición y Estética Visual (UI/UX)

- **Filosofía**: Maquinaria e Industria se encuentran con la Tecnología moderna. Las interfaces deben verse funcionales, sólidas, limpias y altamente ordenadas, sin excesivos adornos.
- **Formas**: Geometría estructural fuerte; usa formas rectas y ortogonales con bordes ligeramente redondeados (`border-radius: 2px` o `4px`). Evita redondear los botones de manera circular ("pill-shaped"), a menos que sea en los indicadores muy pequeños.
- **Fondos en Bandas**: Divide grandes secciones intercalando una sección con fondo blanco (`#ffffff`) y la siguiente con soporte neutro (`#efefef`), utilizando `#aebfc9` para los divisores (hr).
- **Botones Profesionales**:
  - **Action Button Primario**: Relleno sólido `#dd2876` y texto blanco fuerte. En `#hover`, aplicar un cambio de opacidad o sombreado en color oscuro para respuesta táctil visual, e.g. oscurecer el tono magenta un poco.
  - **Secondary Action**: Botones estilo "Outline" o ghost button contorneados en `#5d7a8a`, con estado `:hover` rellenando sutilmente.

## 4. Implementación en CSS

Para proyectos con hojas de estilo CSS en vainilla, debes siempre encabezar con este bloque de variables CSS para el root:

```css
:root {
  --logisnext-magenta: #dd2876;
  --logisnext-red: #e00000;
  --logisnext-darkslate: #2e404a;
  --logisnext-slate: #5d7a8a;
  --logisnext-lightslate: #aebfc9;
  --logisnext-lightgray: #efefef;
  
  --font-primary: 'Inter', 'Roboto', 'Helvetica Neue', sans-serif;
}
```

## Para Aplicaciones Framework (Ej: TailwindCSS)
Cuando el usuario pida explícitamente usar TailwindCSS como framework, la configuración del archivo principal de Tailwind debería ser adaptada obligatoriamente para reflejar los colores corporativos descritos.

```json
theme: {
  extend: {
    colors: {
      logisnext: {
        magenta: '#dd2876',
        red: '#e00000',
        darkslate: '#2e404a',
        slate: '#5d7a8a',
        lightslate: '#aebfc9',
        lightgray: '#efefef'
      }
    }
  }
}
```

## Modus Operandi

A partir de ahora, cuando operes con esta skill bajo la solicitud de "tema Logisnext" o "diseño Logisnext", DEBES asegurar que todos tus componentes asuman instantáneamente estas variables de color. No uses colores púrpuras, verdes o predeterminados de sistema, y enfócate al 100% en esta paleta y en un diseño funcional e industrial pulido de excelente profesionalismo.
