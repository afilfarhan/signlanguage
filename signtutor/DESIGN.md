# SignTutor — Design System

## Aesthetic: "Bioluminescent Studio"
Dark, focused, alive — like a deep-sea research lab where something glows in the dark. Professional sign language coach at midnight in a softly lit studio. Tactile, warm, intelligent.

## Design Tokens

### Colors (OKLCH preferred)
- **Backgrounds:**
  - `--bg-base`: #080c14 (near-black with blue undertone)
  - `--bg-surface`: #0f1420 (card backgrounds)
  - `--bg-elevated`: #161d2e (elevated panels)
  - `--bg-glass`: rgba(255,255,255,0.03)

- **Accents:**
  - `--accent-primary`: #00e5b0 (bioluminescent teal)
  - `--accent-secondary`: #4f8cff (electric blue)
  - `--accent-warm`: #ffb347 (amber)
  - `--accent-success`: #22d98a (green)
  - `--accent-danger`: #ff5370 (red)

- **Text:**
  - `--text-primary`: #f0f4ff
  - `--text-secondary`: #7a8baa
  - `--text-muted`: #3d4f6b

- **Borders:**
  - `--border-subtle`: rgba(255,255,255,0.06)
  - `--border-glow`: rgba(0,229,176,0.25)

### Typography
- **Display:** Syne (700, 800) — headings
- **Body:** DM Sans (300, 400, 500) — body text
- **Mono:** JetBrains Mono (400, 500) — labels, stats, ML readouts

### Spacing & Radius
- `--radius-sm`: 8px
- `--radius-md`: 14px
- `--radius-lg`: 20px
- `--radius-xl`: 28px

### Shadows
- `--shadow-glow`: 0 0 40px rgba(0,229,176,0.12)
- `--shadow-card`: 0 4px 24px rgba(0,0,0,0.4)

## Fonts
Import via Google Fonts:
```
Syne: 400,600,700,800
DM Sans: 300,400,500 (opsz 9..40)
JetBrains Mono: 400,500
```

## Component Patterns
- Cards: bg-surface, subtle border, hover glow transition
- Badges: pill shape, mono font, 10px, uppercase, color-coded
- Buttons: primary (teal), secondary (border), ghost (text only)
- Toggles: pill-shaped, teal when on, smooth 0.2s animation

## Motion
- Ease out with exponential curves (ease-out-quart/expo)
- No bounce, no elastic
- Respect prefers-reduced-motion
