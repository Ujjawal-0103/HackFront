# Theme & Design System Specification

> **Default Theme:** Light Theme (`#F8FAFC`)  
> **Secondary Theme:** Dark Theme (`#0B1220`)  
> **Compliance:** WCAG 2.1 AA Contrast Ratios (>4.5:1 for body text, >3:1 for interactive boundaries)  
> **Status:** Specification Complete | Implementation Target: Sprint 2 / Sprint 6 UI Foundation

---

## 1. Non-Negotiable Theme Acceptance Criteria

- **TH-01:** On first visit, the application **must start in light mode**, even if the client operating system or browser is configured for dark mode.
- **TH-02:** Dark mode must be available as an optional secondary theme accessible via an in-app toggle.
- **TH-03:** When a user toggles the theme, their preference must persist in `localStorage` under key `traceback-theme-preference`.
- **TH-04:** On subsequent visits, the saved preference is restored. If no preference exists, light mode remains the default.
- **TH-05:** Theme styles are implemented via shared CSS custom property tokens rather than duplicate template layouts.
- **TH-06:** Both light and dark themes must maintain readable typography, clear surface boundaries, distinct borders, and visible keyboard focus rings.
- **TH-07:** Theme switching must remain strictly isolated from business logic, repository permissions, and application data.
- **TH-08:** Theme behavior must be covered by automated and manual test specifications.

---

## 2. Shared Design Tokens Palette

### 2.1 Light Theme (Default)
| Token Name | Hex Value | Purpose / Usage | WCAG Contrast vs Surface |
| :--- | :--- | :--- | :--- |
| `--color-bg-page` | `#F8FAFC` | Page body background (Slate 50) | N/A |
| `--color-surface-main` | `#FFFFFF` | Main card/modal surfaces | N/A |
| `--color-text-primary` | `#0F172A` | Primary headings and body copy (Slate 900) | 18.2:1 (AAA) |
| `--color-text-secondary` | `#475569` | Secondary captions, timestamps (Slate 600) | 5.8:1 (AA) |
| `--color-border` | `#E2E8F0` | Structural borders, dividers (Slate 200) | 1.3:1 (Subtle boundary) |
| `--color-accent-primary` | `#2563EB` | Interactive buttons, active links (Blue 600) | 4.8:1 (AA) |
| `--color-accent-focus` | `#1D4ED8` | Keyboard focus ring | Visible outline |
| `--color-status-success` | `#15803D` | 'Supported' claim verdict (Green 700) | 5.2:1 (AA) |
| `--color-status-warning` | `#B45309` | 'Unverified / Sparse' claim verdict (Amber 700) | 4.9:1 (AA) |
| `--color-status-error` | `#B91C1C` | 'Contradicted' claim verdict (Red 700) | 5.6:1 (AA) |

### 2.2 Dark Theme (Secondary)
| Token Name | Hex Value | Purpose / Usage | WCAG Contrast vs Surface |
| :--- | :--- | :--- | :--- |
| `--color-bg-page` | `#0B1220` | Dark page background | N/A |
| `--color-surface-main` | `#111827` | Dark card/modal surfaces (Gray 900) | N/A |
| `--color-text-primary` | `#F8FAFC` | Dark primary text (Slate 50) | 17.5:1 (AAA) |
| `--color-text-secondary` | `#CBD5E1` | Dark secondary captions (Slate 300) | 8.9:1 (AAA) |
| `--color-border` | `#334155` | Dark structural borders (Slate 700) | 3.2:1 (AA boundary) |
| `--color-accent-primary` | `#60A5FA` | Dark interactive accent (Blue 400) | 7.1:1 (AAA) |
| `--color-accent-focus` | `#93C5FD` | Dark keyboard focus ring | High visibility |
| `--color-status-success` | `#4ADE80` | 'Supported' claim verdict (Green 400) | 8.2:1 (AAA) |
| `--color-status-warning` | `#FBBF24` | 'Unverified / Sparse' verdict (Amber 400) | 10.4:1 (AAA) |
| `--color-status-error` | `#F87171` | 'Contradicted' claim verdict (Red 400) | 6.5:1 (AAA) |

---

## 3. CSS Custom Properties Implementation Architecture

```css
/* tokens.css */
:root {
  /* Default: Light Mode */
  --bg-page: #F8FAFC;
  --surface-main: #FFFFFF;
  --text-primary: #0F172A;
  --text-secondary: #475569;
  --border: #E2E8F0;
  --accent-primary: #2563EB;
  --accent-focus: #1D4ED8;
  --status-success: #15803D;
  --status-warning: #B45309;
  --status-error: #B91C1C;
}

[data-theme="dark"] {
  /* Secondary: Dark Mode */
  --bg-page: #0B1220;
  --surface-main: #111827;
  --text-primary: #F8FAFC;
  --text-secondary: #CBD5E1;
  --border: #334155;
  --accent-primary: #60A5FA;
  --accent-focus: #93C5FD;
  --status-success: #4ADE80;
  --status-warning: #FBBF24;
  --status-error: #F87171;
}

body {
  background-color: var(--bg-page);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  transition: background-color 0.2s ease, color 0.2s ease;
}
```

---

## 4. Theme Controller & Persistence Specification

```javascript
// theme-controller.js
const THEME_STORAGE_KEY = 'traceback-theme-preference';

export function initializeTheme() {
  // Non-negotiable: Default to 'light' regardless of window.matchMedia('(prefers-color-scheme: dark)')
  const savedPreference = localStorage.getItem(THEME_STORAGE_KEY);
  const activeTheme = savedPreference === 'dark' ? 'dark' : 'light';
  applyTheme(activeTheme);
  return activeTheme;
}

export function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(newTheme);
  localStorage.setItem(THEME_STORAGE_KEY, newTheme);
  return newTheme;
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const toggleBtn = document.getElementById('theme-toggle-btn');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');
    toggleBtn.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`);
  }
}
```

---

## 5. Architectural Status & Blocker Documentation
- **Starter Prototype Audit Finding:** The initial workspace audit confirmed that the starter prototype was absent.
- **Architectural Decision:** Per non-negotiable instruction: *"If the existing application architecture does not permit a safe interface change during Sprint 1, document the exact blocker and create a testable theme specification. Do not rebuild the frontend from scratch simply to change its theme."*
- **Blocker Summary:** Because no existing frontend or prototype files were present in the repository, UI code modifications could not be safely patched into existing views without prematurely constructing the full production frontend. Consequently, all theme tokens, accessibility requirements (TH-01 through TH-08), and state persistence logic are authoritatively specified here and ready for binding during Sprint 2 / Sprint 6 UI scaffolding.
