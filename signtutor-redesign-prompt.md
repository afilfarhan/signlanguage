# SignTutor — Complete Redesign Build Prompt

## Project Overview

Redesign **SignTutor** — a browser-based ASL (American Sign Language) learning app powered by on-device ML (MediaPipe Hands + ONNX). The app uses webcam input to give real-time fingerspelling and sign feedback entirely in the browser, with no video uploads, no accounts, no cloud processing.

**Stack:** Next.js + Tailwind CSS (existing). Preserve all functional logic. Only redesign the UI/UX layer.

---

## Aesthetic Direction: "Bioluminescent Studio"

The new design language is **dark, focused, and alive** — like a deep-sea research lab where something glows in the dark. Think: a professional sign language coach working at midnight in a softly lit studio. The UI should feel tactile, warm, and intelligent — never cold or clinical.

**Conceptual anchor:** hands are the hero. Everything in the design should celebrate the beauty and precision of human hands communicating.

### Design Tokens

```css
:root {
  /* Backgrounds */
  --bg-base:        #080c14;   /* near-black with blue undertone */
  --bg-surface:     #0f1420;   /* card backgrounds */
  --bg-elevated:    #161d2e;   /* elevated panels */
  --bg-glass:       rgba(255,255,255,0.03);

  /* Brand / Accent */
  --accent-primary:  #00e5b0;  /* bioluminescent teal — the glow color */
  --accent-secondary:#4f8cff;  /* electric blue for secondary actions */
  --accent-warm:     #ffb347;  /* amber for warnings, "learning" state */
  --accent-success:  #22d98a;  /* green for mastered/correct */
  --accent-danger:   #ff5370;  /* red for wrong/error states */

  /* Text */
  --text-primary:   #f0f4ff;
  --text-secondary: #7a8baa;
  --text-muted:     #3d4f6b;

  /* Borders */
  --border-subtle:  rgba(255,255,255,0.06);
  --border-glow:    rgba(0,229,176,0.25);

  /* Typography */
  --font-display: 'Clash Display', 'Syne', sans-serif;   /* headings */
  --font-body:    'DM Sans', sans-serif;                  /* body text */
  --font-mono:    'JetBrains Mono', monospace;            /* labels, stats, ML readouts */

  /* Radius */
  --radius-sm: 8px;
  --radius-md: 14px;
  --radius-lg: 20px;
  --radius-xl: 28px;

  /* Shadows */
  --shadow-glow: 0 0 40px rgba(0,229,176,0.12);
  --shadow-card: 0 4px 24px rgba(0,0,0,0.4);
}
```

Import fonts via Google Fonts:
```html
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,400&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## Global UI Components

### Navbar
- Sticky top navbar, height 60px, `backdrop-filter: blur(20px)`, background `rgba(8,12,20,0.85)`, bottom border `1px solid var(--border-subtle)`
- **Logo:** "SignTutor" in `var(--font-display)`, weight 700, with a small animated hand-wave emoji (🤙) that wiggles on hover using `@keyframes wave`
- **Nav links:** DM Sans medium, `var(--text-secondary)`, transition to `var(--text-primary)` on hover with a 2px `var(--accent-primary)` underline that slides in from left
- **Active link:** `var(--accent-primary)` color, underline always visible
- **Right badge:** "🔒 On-device · no upload" — pill shape, background `rgba(0,229,176,0.08)`, border `1px solid rgba(0,229,176,0.2)`, text in `var(--font-mono)` 11px, teal glow on hover
- Mobile: hamburger menu → full-screen overlay nav with staggered link animation

### Cards (base component)
- Background: `var(--bg-surface)`
- Border: `1px solid var(--border-subtle)`
- Border-radius: `var(--radius-lg)`
- Box-shadow: `var(--shadow-card)`
- On hover: border transitions to `var(--border-glow)`, subtle `transform: translateY(-2px)`, box-shadow adds glow
- Transition: `all 0.25s cubic-bezier(0.4, 0, 0.2, 1)`

### Category Badges
- Pill shape, `font-family: var(--font-mono)`, font-size 10px, font-weight 500, letter-spacing 0.08em, uppercase
- Each category has a unique color:
  - ALPHABET → teal (`var(--accent-primary)`)
  - VOCABULARY → blue (`var(--accent-secondary)`)
  - RETENTION → amber (`var(--accent-warm)`)
  - SECURITY/PRIVACY → green (`var(--accent-success)`)
  - SETUP → muted purple `#a78bfa`
- Background is 10% opacity of the color, border is 20% opacity

### Buttons
- **Primary:** `var(--accent-primary)` background, `var(--bg-base)` text, font-weight 600, border-radius `var(--radius-md)`, padding `12px 24px`. Hover: brightness 1.1, scale 1.02. Active: scale 0.98.
- **Secondary:** transparent, `1px solid var(--border-subtle)`, `var(--text-secondary)` text. Hover: border becomes `var(--border-glow)`, text becomes `var(--text-primary)`.
- **Ghost:** no border, `var(--text-secondary)` text. Hover: background `var(--bg-glass)`.
- All buttons: `transition: all 0.2s ease`, cursor pointer, no outline (custom focus ring instead: `2px solid var(--accent-primary)` with 2px offset)

---

## Page-by-Page Redesign Specs

---

### 1. HOME PAGE (`/`)

**Hero Section**
- Full-viewport-height hero with a **radial gradient background**: center `rgba(0,229,176,0.06)` bleeding out to `var(--bg-base)`. Add a subtle animated noise texture overlay (SVG feTurbulence, opacity 0.03) for depth.
- Floating decorative element: large, blurred hand SVG silhouette in top-right corner, `opacity: 0.04`, slowly drifting with a `@keyframes float` animation (translateY ±12px, 8s ease-in-out infinite).
- **Super-label** above headline: "SignTutor" pill badge with teal dot pulse animation (like a live indicator)
- **Headline:** `var(--font-display)`, 72px desktop / 44px mobile, weight 800, line-height 1.05. Use a split-word reveal animation on page load (words slide up + fade in with 80ms stagger using `animation-delay`). The words "real-time feedback" should have a teal `text-shadow: 0 0 40px rgba(0,229,176,0.4)` glow.
- **Subheadline:** DM Sans, 18px, `var(--text-secondary)`, max-width 520px, centered, line-height 1.6. Animate in after headline with 200ms delay.
- **CTA Button:** Primary button "Start your first lesson →", 52px height, 20px horizontal padding. After 400ms delay from page load, animate in with scale-up from 0.95 + fade. On hover, the arrow `→` slides 4px right.
- **Trust Badges Row:** 4 pill badges below CTA: "🔒 On-device by default", "MediaPipe Hands", "ONNX ML", "WCAG 2.2 AA". Animate in with stagger. Use a subtle horizontal separator line above.

**Feature Cards Grid**
- Section title: "Everything you need to learn ASL" in `var(--font-display)` weight 700, 32px
- 2×2 grid on desktop, 1-column on mobile
- Each card has:
  - Category badge (top-left)
  - Icon (32px, custom SVG or emoji that matches the category — 🤚 for Fingerspelling, 💬 for Dynamic Signs, 🔁 for Spaced Repetition, 🔒 for Privacy)
  - Title in `var(--font-display)` weight 700, 22px
  - Description in DM Sans, `var(--text-secondary)`, 15px
  - "Explore →" link in `var(--accent-primary)`, hover: arrow translates right 4px
- Cards animate in on scroll with `IntersectionObserver`: slide up 20px + fade in, 100ms stagger between cards

**Footer**
- `var(--bg-surface)`, `1px solid var(--border-subtle)` top border
- Left: "© 2026 SignTutor" in `var(--font-mono)` 12px `var(--text-muted)`
- Right: About · Privacy · GitHub links, `var(--text-secondary)`, hover `var(--accent-primary)`

---

### 2. ABOUT PAGE (`/about`)

**Current problem:** Wall of plain text, no visual hierarchy, no life.

**Redesigned layout:**
- Two-column layout on desktop: left 60% content, right 40% sticky info panel
- **Page header:** Large "About" in `var(--font-display)` 56px with a faint teal underline stroke (3px, gradient from teal to transparent)

**"What is SignTutor?" section**
- Pull-quote style: the core description in a highlighted block — `var(--bg-elevated)`, left border `3px solid var(--accent-primary)`, padding 24px, border-radius `var(--radius-md)`, DM Sans 17px italic

**"How it Works" section**
- Replace bullet list with a **vertical process timeline**:
  - Vertical line: `2px solid var(--border-subtle)` with a teal gradient on scroll
  - Each step: numbered circle (teal, `var(--font-mono)`), bold title, description
  - Steps: MediaPipe Hands → Static Signs → Dynamic Signs → FSRS Spaced Repetition → Hybrid Fallback
  - Each step card has a small icon and animates in from left on scroll

**"Accessibility" section**
- Info card with a ♿ icon, `var(--bg-elevated)`, green left border
- Accessibility features as icon + text pairs (keyboard ⌨️, eye 👁️, motion 🎬, contrast 🌗)

**"Limitations" section**
- Amber-tinted card (`rgba(255,179,71,0.06)` background, amber left border) to make it visually distinct as a "known constraints" callout
- Each limitation as a row with a `•` bullet in amber

**Right sidebar (sticky):**
- "Tech Stack" card listing: Next.js, MediaPipe Hands, ONNX Runtime Web, Tailwind CSS — each as a badge
- "Version" card: v1.0, Build date, ASL support status
- "Credits" card with linked text

---

### 3. LEARN PAGE (`/learn`)

**Current problem:** 4 cards dumped on a page, Settings card feels out of place.

**Redesigned layout:**
- Page header: "Learn ASL" in `var(--font-display)` 48px + subtitle
- **Progress bar** (even if empty for new users): "Your progress — 0 / 32 signs" with a teal progress bar, DM Sans, shown above the cards to motivate learners
- **3 learning module cards** (remove Settings from here — it doesn't belong):
  - Full-width on first row OR large 2-col + 1 smaller
  - Each card is taller (min 200px), has a large background icon watermark (very low opacity, 0.04) — e.g., 🤚 for Fingerspelling, 📚 for 200 Signs, 🔁 for Spaced Repetition
  - Prominent category badge, large title, description, estimated time ("~5 min per session"), and a full "Start →" button (not just a link)
  - Show a progress mini-bar per module if data is available
- **Setup card** at bottom: styled as a secondary utility card — smaller, `var(--bg-glass)` background, "⚙️ Configure & Calibrate" with a different visual weight to distinguish it from learning content

---

### 4. FINGERSPELLING PAGE (`/fingerspelling`)

**Current problem:** Letter cards are text-only — no illustrations, no visual reference for how hands actually look.

**Redesigned layout:**
- Page header: "ASL Fingerspelling" title + "24 letters · real-time feedback · on-device ML" subtitle in `var(--font-mono)`
- **Filter/Sort bar:** Pill toggle buttons to filter: All · A–F · G–M · N–S · T–Y. Also a "Difficulty" sort toggle. Animated with a sliding pill background indicator.
- **Letter grid:** 4-column on desktop, 3 on tablet, 2 on mobile
- **Each letter card:**
  - Top: Large letter in `var(--font-display)` 48px weight 800, teal glow
  - Middle: A hand shape visual — use large Unicode hand gesture emojis styled as illustrations OR implement SVG hand shapes. At minimum use a styled placeholder with a hand outline icon.
  - Bottom: Short description text in DM Sans 13px `var(--text-secondary)`
  - Footer row: "Practice →" button that links to `/fingerspelling/[letter]`
  - On hover: card lifts, letter glows, "Practice →" slides into view from bottom
  - Cards that the user has attempted: show a small progress indicator (color ring around the letter)

---

### 5 & 6. LETTER PRACTICE PAGES (`/fingerspelling/[letter]`)

**Current problem:** Functional but visually cluttered. The left/right panel split is logical but needs better visual hierarchy. Feedback information is buried in small text.

**Redesigned layout:**

**Top toolbar (redesigned):**
- "Classifier:" label + segmented control for ML (ONNX) / Rule-based — pill toggle, teal active state
- "Start Camera" / "Stop" as prominent buttons
- Mirror / Left-handed as clean toggle switches (not checkboxes) aligned right

**Left panel — Demo/Reference:**
- Panel header: "REFERENCE" label in `var(--font-mono)` 10px, letter-spacing 0.1em, `var(--text-muted)`
- Target letter shown in `var(--font-display)` 96px, white, centered with a soft radial glow behind it
- Description text in a distinct styled callout below
- **Letter selector:** Redesigned as a scrollable pill row. Current letter: teal filled. Others: subtle `var(--bg-elevated)` with white text. Hover: border becomes teal. Animate selection with a sliding indicator.

**Right panel — Webcam / Feedback:**
- Panel header: "YOU · WEBCAM" with the "🔒 On-device" badge — keep as-is but refine styling
- Webcam feed: full panel height, `border-radius: var(--radius-md)` clipping, `border: 1px solid var(--border-subtle)`
- **Detected label:** Large `var(--font-display)` text overlay on the webcam — show what letter is currently detected in a frosted glass pill at the bottom of the webcam feed
- **Confidence bar:** Below webcam, a glowing teal progress bar showing confidence percentage with animated fill

**Finger State Panel (redesigned):**
- "FINGER FEEDBACK" section header in `var(--font-mono)`
- 5 finger columns: THUMB · INDEX · MIDDLE · RING · PINKY
- Each column: finger name label, a large icon (✓ in teal glow or ✗ in red glow), and the status text
- ✓ correct: teal background glow, checkmark icon with pulse animation on correct detection
- ✗ wrong: red tinted background, the specific correction hint ("should extend") in amber text

**Feedback Grid (HANDSHAPE · ORIENTATION · LOCATION · MOVEMENT):**
- 2×2 grid of feedback cards, each with:
  - Label in `var(--font-mono)` 10px uppercase
  - Status dot: 🔴 red (issue) or 🟢 green (correct)
  - Hint text in DM Sans 14px
  - On correct: card border flashes teal briefly via CSS animation

**Bottom bar:**
- Model status: `var(--font-mono)` pill — "Model: loading…" (amber) / "Model: ready" (teal)
- FPS counter: `var(--font-mono)`, `var(--text-muted)`
- Instructional hint text center-aligned

---

### 7. SETTINGS PAGE (`/setup/settings`)

**Current problem:** Two cards on a nearly empty page — feels abandoned.

**Redesigned layout:**
- Page header: "Settings" in `var(--font-display)` + subtitle
- **Back navigation:** "← Back to Learn" as a styled ghost button in top-left, not a plain link
- Layout: Centered, max-width 640px, single column

**"Display & Hand Preference" card:**
- `var(--bg-surface)` card with section icon (👁️) next to title
- **Toggle switches** instead of checkboxes: custom CSS toggle, pill-shaped, teal when on, gray when off. Label on left, toggle on right, full row is clickable.
- "Mirror webcam" — with a small helper text: "Flip the webcam so it feels natural"
- "Left-handed" — helper text: "Optimised hand detection for left-hand signers"
- Smooth toggle animation: 0.2s ease for the pill sliding

**"Advanced (Beta)" card:**
- Amber-tinted header badge: "BETA" in `var(--font-mono)`, amber pill
- Same toggle pattern
- "Enable personalization" — helper: "Adapts difficulty based on your 20+ attempts"
- "NMM scoring" — helper: "Facial expression analysis (experimental)"
- Footer note: Small italic text in `var(--text-muted)` about future availability

**Future settings placeholder cards** (visible but locked):
- "Notification Preferences" — coming soon, grayed out with lock icon
- "Data & Privacy" — coming soon

---

### 8. WORDS PAGE (`/words`)

**Current problem:** 8 sign cards in a plain 2-col grid, no visual differentiation, word labels float awkwardly.

**Redesigned layout:**
- Page header: "ASL Dynamic Signs" in `var(--font-display)` + "8 common signs · Transformer recognition · 1.5 s recording window" in `var(--font-mono)` subheader
- **How it works** callout: Small `var(--bg-elevated)` info card explaining the 1.5s sliding window, before the grid. Icon: ⚡

**Sign cards grid (2-col desktop, 1-col mobile):**
- Each card is taller (~120px), `var(--bg-surface)`, with a left colored accent border (unique tint per sign)
- **Sign word** displayed large on the left: `var(--font-display)` 28px, weight 800, in a solid teal/green colored badge that fills the left section — like a large "stamp"
- **Description** text: DM Sans 14px `var(--text-secondary)` on the right
- **"Practice this sign →"** link at the bottom of each card, subtle, appears on hover
- Signs have unique accent colors for their badge: HELLO (teal), GOODBYE (blue), YES (green), NO (red/coral), PLEASE (amber), THANKS (purple), SORRY (rose), HELP (orange)
- Card hover: border-left color intensifies, card lifts slightly

---

### 9. PRACTICE PAGE (`/practice`)

**Current problem:** Stats look like debugging output. Sign grid is sparse and visually confusing. No motivation.

**Redesigned layout:**
- Page header: "Practice Queue" in `var(--font-display)` + "FSRS-powered · adapts to your progress" in `var(--font-mono)`

**Stats row (4 cards):**
- Full-width row, 4 equal cards
- **DUE NOW:** Teal accent. If 0: muted. If >0: glowing teal border + subtle pulse animation to draw attention
- **MASTERED:** Green accent. Number in `var(--font-display)` 40px weight 800
- **LEARNING:** Amber accent
- **NEW:** Blue accent
- Each card: label in `var(--font-mono)` 11px uppercase tracking, big number, a small contextual icon (⏰, ⭐, 📖, ✨)
- When DUE NOW > 0: a prominent "Start Review Session →" primary button appears below the stats row

**Progress visualization:**
- A horizontal stacked progress bar showing the ratio of Mastered / Learning / New for all 32 signs
- Color-coded: green / amber / blue / gray, with legend below

**"All Signs" section:**
- **FINGERSPELLING subsection:**
  - Heading with count badge "24 signs"
  - Letters as square tiles in a responsive grid, larger (40×40px)
  - Color-coded by status: teal (mastered), amber (learning), `var(--bg-elevated)` (not started)
  - Hover: shows the sign name and next review date in a tooltip
- **DYNAMIC SIGNS subsection:**
  - Same tile treatment but rectangular pill-shaped tiles that fit the word labels
  - Same color coding

**Legend:** Redesign as 3 badge-style pills (🟢 Mastered · 🟡 Learning · ⬜ New) instead of plain text

---

### 10. SETUP WIZARD (`/setup`)

**Current problem:** Functional but cold. Step indicator feels like a table. Language options feel flat.

**Redesigned layout:**

**Step Progress Indicator:**
- Replace table-style steps with a horizontal stepper:
  - Circular step numbers with connecting lines
  - Active step: teal filled circle, white number, teal connecting line ahead
  - Completed steps: teal outline, checkmark icon
  - Future steps: `var(--text-muted)` circle
  - Step labels below each circle: "Language", "Camera", "Lighting", "Framing"
  - Animate transition: when advancing, the connecting line fills with teal from left to right

**Step 1 — Choose Language:**
- Card title: "Choose your sign language" in `var(--font-display)` 28px
- Subtitle in DM Sans `var(--text-secondary)`
- Language option cards:
  - 2×2 grid
  - Each card: flag emoji + language name bold + full name + status badge
  - ASL: "🇺🇸 ASL" — teal radio selected state, "Fully shipped" green badge
  - BSL: "🇬🇧 BSL" — disabled/muted, "Coming soon" amber badge
  - ArSL: "🇸🇦 ArSL" — disabled/muted, "Preview" amber badge
  - Other: "🌍 Other" — disabled/muted, "Roadmap" gray badge
  - Selected card: teal border, teal radio dot, subtle teal glow
  - Disabled cards: 50% opacity, `cursor: not-allowed`, tooltip on hover: "Coming in a future release"

**Navigation row:**
- "Step 1 of 4" in `var(--font-mono)` `var(--text-muted)` left-aligned
- "Next: Camera Permission →" primary button right-aligned
- On step 1: no back button. On steps 2+: "← Back" ghost button

---

## Animations & Motion System

### Page transitions
- On route change: content fades out (150ms) and new content fades + slides in from bottom 16px (200ms). Use Next.js `AnimatePresence` with Framer Motion or CSS transitions.

### Micro-interactions
- **Correct sign detected:** Screen edge flashes teal for 600ms (`box-shadow: inset 0 0 60px rgba(0,229,176,0.15)`) + a subtle haptic-style pulse
- **Wrong finger position:** The specific finger column in the feedback panel shakes once (CSS `@keyframes shake`: translateX ±4px, 3 iterations, 300ms)
- **Letter selector:** Active letter pill slides with a sliding background pill indicator (the background moves, not the pills)
- **Stats on Practice page:** Numbers count up from 0 on page load using a `requestAnimationFrame` counter animation (300ms)
- **Card hover states:** All cards `transform: translateY(-2px)` with shadow deepening — consistent across all pages
- **Toggle switches:** Pill slides with `transform: translateX`, background color fades with `transition: background 0.2s`
- **Progress bars:** Fill animation `@keyframes fillBar` on mount, 800ms ease-out

### Reduced motion
- Respect `prefers-reduced-motion: reduce` — disable all animations, keep only opacity transitions

---

## Responsive Breakpoints

```css
/* Mobile first */
/* sm: 640px — tablet */
/* md: 768px — small desktop */
/* lg: 1024px — standard desktop */
/* xl: 1280px — wide */
```

- Navbar: hamburger menu below `md`, full nav above
- Hero headline: 44px mobile → 72px desktop
- Feature cards: 1-col mobile → 2-col desktop
- Practice layout (letter pages): stacked mobile → side-by-side desktop
- Finger feedback: 3-col on mobile (hide RING+PINKY labels) → 5-col desktop

---

## Accessibility (WCAG 2.2 AA — preserve and improve)

- All interactive elements: visible focus ring `outline: 2px solid var(--accent-primary); outline-offset: 2px`
- Color is never the only differentiator — always pair with icon or text label
- Skip-to-content link as first focusable element
- All ARIA labels on webcam, toggle switches, and icon-only buttons
- Keyboard navigation: letter selector navigable with arrow keys
- Screen reader: announce when a sign is correctly detected ("Sign A detected, confidence 94%")
- Contrast: all text meets 4.5:1 minimum. `var(--text-secondary)` on `var(--bg-surface)` must be verified.

---

## What NOT to Change

- All ML logic, webcam integration, ONNX model loading, MediaPipe Hands detection
- FSRS spaced repetition algorithm and data structure
- localStorage data schema
- Routing structure (Next.js pages)
- The "On-device · no upload" privacy guarantee — keep this badge prominent everywhere
- Existing ARIA landmark structure — only add to it, don't remove

---

## Deliverables Expected

1. Updated global CSS / Tailwind config with all design tokens
2. Redesigned shared components: `Navbar`, `Card`, `Badge`, `Button`, `Toggle`, `ProgressBar`, `Stepper`
3. All 10 page layouts reimplemented per specs above
4. Animation utilities: `useCountUp`, `useFadeIn`, `useSlideIn`, scroll observer hook
5. Mobile-responsive at all breakpoints
6. No regressions on existing functionality
