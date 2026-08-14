---
name: Academic Clarity
colors:
  surface: '#e2fffe'
  surface-dim: '#b4e3e2'
  surface-bright: '#e2fffe'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#cefdfc'
  surface-container: '#c8f7f6'
  surface-container-high: '#c2f1f0'
  surface-container-highest: '#bdebea'
  on-surface: '#002020'
  on-surface-variant: '#3f4948'
  inverse-surface: '#023737'
  inverse-on-surface: '#cbfaf9'
  outline: '#6f7979'
  outline-variant: '#bec9c8'
  surface-tint: '#0b6969'
  primary: '#005151'
  on-primary: '#ffffff'
  primary-container: '#0f6b6b'
  on-primary-container: '#9be9e8'
  inverse-primary: '#87d4d3'
  secondary: '#7f5700'
  on-secondary: '#ffffff'
  secondary-container: '#feb62f'
  on-secondary-container: '#6d4a00'
  tertiary: '#005333'
  on-tertiary: '#ffffff'
  tertiary-container: '#006e45'
  on-tertiary-container: '#86f0b6'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#a3f0ef'
  primary-fixed-dim: '#87d4d3'
  on-primary-fixed: '#002020'
  on-primary-fixed-variant: '#004f50'
  secondary-fixed: '#ffdeae'
  secondary-fixed-dim: '#ffba3e'
  on-secondary-fixed: '#281900'
  on-secondary-fixed-variant: '#604100'
  tertiary-fixed: '#8ef8bd'
  tertiary-fixed-dim: '#71dba2'
  on-tertiary-fixed: '#002112'
  on-tertiary-fixed-variant: '#005232'
  background: '#e2fffe'
  on-background: '#002020'
  surface-variant: '#bdebea'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 60px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  timer-tabular:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  container-padding: 24px
  gutter: 16px
  section-gap: 40px
  stack-sm: 8px
  stack-md: 16px
---

## Brand & Style

The design system is engineered for **SMART-TKA**, an unofficial Indonesian educational platform focusing on academic preparation for SD, SMP, and SMA students. The brand personality is **Professional, Academic, and Encouraging**, avoiding the bureaucratic aesthetics of official ministry portals in favor of a modern, student-centric experience.

The visual style follows **Modern Minimalism** with **Tactile** influences. It prioritizes clarity and focus, utilizing a warm, paper-like background to reduce eye strain during long study sessions. The interface uses generous whitespace and structured layouts to transform complex test-prep data into digestible insights.

**Design Principles:**
- **Clarity over Authority:** Avoid official stamps or national symbols. Use professional typography and clean lines to build trust.
- **Supportive Tone:** Use Bahasa Indonesia that is encouraging and objective. Avoid negative reinforcement or definitive predictions.
- **Focus-Driven:** Eliminate unnecessary decorative elements that might distract from the learning material.

## Colors

This design system utilizes a sophisticated, nature-inspired palette to create a "study-room" atmosphere.

- **Primary (Teal):** Used for primary actions, navigation headers, and core brand moments. It conveys intelligence and stability.
- **Accent (Amber):** Reserved strictly for XP, progress bars, and achievement-related feedback to signify growth.
- **Canvas & Card:** The `#F7F4EE` background mimics high-quality paper, while white surfaces provide a clear "layered" hierarchy for content.
- **Ink (Text):** A deep teal-black `#0B3D3D` provides superior legibility while feeling more integrated than pure black.
- **Success/Warning/Danger:** Standardized utility colors for immediate feedback on quiz results and system alerts.

## Typography

**Plus Jakarta Sans** is the sole typeface, chosen for its modern, friendly, and highly legible characteristics. 

- **Hierarchy:** Use bold weights (700) for page titles and semi-bold (600) for section headers.
- **Body Text:** Standardize on `body-md` for general content.
- **Timer:** For countdowns, specifically use the `timer-tabular` variant to prevent layout jitter as numbers change.
- **Labels:** Use `label-lg` in all-caps for small metadata or button labels to distinguish them from prose.

## Layout & Spacing

The design system utilizes a **12-column fluid grid** for desktop and a **4-column grid** for mobile.

- **Margins:** 24px on mobile, increasing to 48px or auto-centered containers on desktop (max-width: 1200px).
- **Rhythm:** All spacing must be multiples of 4px. Use `stack-md` (16px) for related elements within a card and `section-gap` (40px) between major vertical content blocks.
- **Responsive Behavior:** Cards should stack vertically on mobile. Sidebars for navigation or "Readiness" stats should move to a bottom-fixed sheet or a drawer on smaller screens.

## Elevation & Depth

This design system uses **Tonal Layers** combined with **Soft Outlines** to create hierarchy without excessive shadows.

1.  **Level 0 (Canvas):** `#F7F4EE`. The base of the application.
2.  **Level 1 (Surface/Cards):** `#FFFFFF` with a 1px border of `#E6E1D8`. No shadow is used for static content to maintain a clean, professional look.
3.  **Level 2 (Interactive/Floating):** For active states or dropdowns, use a subtle ambient shadow: `0 4px 12px rgba(11, 61, 61, 0.08)`.
4.  **Disabled States:** Lower opacity to 40% and use a gray-wash of `#E6E1D8` for backgrounds.

## Shapes

The shape language is friendly yet structured. 

- **Containers & Cards:** Use a 16px radius (`rounded-lg`) to create a soft, modern container.
- **Interactive Elements:** Buttons, input fields, and chips use a 12px radius to feel more precise and clickable.
- **Selection Indicators:** Radio buttons and checkboxes should follow a 4px radius or remain circular where appropriate.

## Components

### Buttons & Inputs
- **Primary Button:** Solid teal (`#0F6B6B`) with white text. 12px border radius. 16px vertical padding.
- **Secondary Button:** Outlined with `#E6E1D8`, teal text.
- **Inputs:** White background, `#E6E1D8` border, focus state uses a 2px teal border.

### Status Chips
Used for subject mastery levels:
- **Lemah (Weak):** Background `#FEE2E2` (Light Red), Text `#C2413B`.
- **Sedang (Average):** Background `#FEF3C7` (Light Amber), Text `#D97706`.
- **Dikuasai (Mastered):** Background `#DCFCE7` (Light Green), Text `#2F9E6B`.

### Readiness Ring
- A circular progress component (0-100).
- **Stroke:** Teal (`#0F6B6B`) for the progress, Light Neutral (`#E6E1D8`) for the track.
- **Caption:** Below the ring, use `label-md` with the text: *"Kesiapan latihan (bukan prediksi TKA resmi)"*.

### Countdown Timer
- **Style:** Monospaced/Tabular numbers using the `timer-tabular` typography token.
- **Label:** Small text above or below the numbers reading *"Waktu server"* in `label-md`.

### Feedback & Copy
- **Strict Prohibition:** Never use words like "malu" or "kamu malas". 
- **Disclaimer:** Avoid "prediksi lolos". Instead, use "Skor latihan saat ini".