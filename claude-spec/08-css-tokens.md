# CSS Tokens

## Overview

All visual values (colors, spacing, typography, border radius, shadows) are defined as CSS custom properties in `src/assets/styles/tokens.css`. No component may use hardcoded values for these categories.

---

## `src/assets/styles/tokens.css` — Full Variable Reference

```css
/* ============================================================
   src/assets/styles/tokens.css
   Design tokens for ThunderJira UI
   ============================================================ */

:root {

  /* ----------------------------------------------------------
     Colors — Brand (Jira)
     Use ONLY for elements that represent Jira data.
     Do NOT use for the addon's own chrome/UI.
  ---------------------------------------------------------- */
  --jira-blue:        #0052cc;
  --jira-blue-hover:  #0065ff;
  --jira-blue-light:  #deebff;

  /* ----------------------------------------------------------
     Colors — Jira Status Categories
     Map to Jira's built-in status categories.
  ---------------------------------------------------------- */
  --jira-green:       #00875a;   /* Done / Resolved */
  --jira-green-bg:    #e3fcef;
  --jira-yellow:      #ff8b00;   /* In Progress */
  --jira-yellow-bg:   #fffae6;
  --jira-red:         #de350b;   /* Blocked / Failed */
  --jira-red-bg:      #ffebe6;
  --jira-gray:        #5e6c84;   /* To Do / secondary text */
  --jira-gray-bg:     #f4f5f7;

  /* ----------------------------------------------------------
     Colors — UI Chrome (addon interface, not Jira data)
  ---------------------------------------------------------- */
  --color-bg:         #ffffff;
  --color-bg-subtle:  #f8f9fa;
  --color-border:     #dfe1e6;
  --color-border-focus: #0052cc;
  --color-text:       #172b4d;
  --color-text-muted: #5e6c84;
  --color-text-link:  #0052cc;
  --color-danger:     #de350b;
  --color-success:    #00875a;

  /* ----------------------------------------------------------
     Interactive states
  ---------------------------------------------------------- */
  --color-btn-primary-bg:        #0052cc;
  --color-btn-primary-bg-hover:  #0065ff;
  --color-btn-primary-text:      #ffffff;
  --color-btn-secondary-bg:      #f4f5f7;
  --color-btn-secondary-bg-hover:#ebecf0;
  --color-btn-secondary-text:    #172b4d;

  /* ----------------------------------------------------------
     Spacing scale (4px base unit)
  ---------------------------------------------------------- */
  --space-1:  4px;
  --space-2:  8px;
  --space-3:  12px;
  --space-4:  16px;
  --space-5:  20px;
  --space-6:  24px;
  --space-8:  32px;
  --space-10: 40px;

  /* ----------------------------------------------------------
     Typography
  ---------------------------------------------------------- */
  --font-family-base: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  --font-family-mono: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;

  --font-size-xs:   11px;
  --font-size-sm:   12px;
  --font-size-base: 14px;
  --font-size-md:   16px;
  --font-size-lg:   20px;
  --font-size-xl:   24px;

  --font-weight-normal:   400;
  --font-weight-medium:   500;
  --font-weight-semibold: 600;
  --font-weight-bold:     700;

  --line-height-tight:  1.2;
  --line-height-normal: 1.5;
  --line-height-loose:  1.75;

  /* ----------------------------------------------------------
     Borders
  ---------------------------------------------------------- */
  --border-radius-sm: 3px;
  --border-radius-md: 4px;
  --border-radius-lg: 8px;
  --border-radius-pill: 9999px;
  --border-width: 1px;

  /* ----------------------------------------------------------
     Shadows
  ---------------------------------------------------------- */
  --shadow-sm: 0 1px 2px rgba(9, 30, 66, 0.12);
  --shadow-md: 0 4px 8px rgba(9, 30, 66, 0.16);
  --shadow-lg: 0 8px 24px rgba(9, 30, 66, 0.20);

  /* ----------------------------------------------------------
     Z-index layers
  ---------------------------------------------------------- */
  --z-overlay: 100;
  --z-tooltip: 200;

  /* ----------------------------------------------------------
     Transitions
  ---------------------------------------------------------- */
  --transition-fast:   100ms ease;
  --transition-normal: 200ms ease;
}
```

---

## Rules

### 1. All components use `<style scoped>`

Every Vue component must declare its styles with the `scoped` attribute to prevent leakage:

```vue
<style scoped>
.my-component { ... }
</style>
```

### 2. Reference tokens — never hardcode visual values

Correct:
```css
color: var(--color-text);
padding: var(--space-4);
border-radius: var(--border-radius-md);
```

Wrong:
```css
color: #172b4d;
padding: 16px;
border-radius: 4px;
```

### 3. Jira brand colors are for Jira data only

`--jira-blue`, `--jira-green`, `--jira-yellow`, `--jira-red`, `--jira-gray` and their variants are **exclusively** for elements that represent data coming from Jira:
- Issue status badges (`StatusBadge.vue`)
- Issue key links
- Issue type icons

They must **not** be used for the addon's own UI elements such as buttons, form fields, layout backgrounds, or navigation.

Use `--color-btn-primary-bg`, `--color-text`, `--color-border`, etc. for the addon chrome.

### 4. Jira status color mapping

| Jira status category | Token |
|---------------------|-------|
| Done / Resolved / Closed | `--jira-green` + `--jira-green-bg` |
| In Progress / Active | `--jira-yellow` + `--jira-yellow-bg` |
| Blocked / Rejected / Failed | `--jira-red` + `--jira-red-bg` |
| To Do / Open / Backlog | `--jira-gray` + `--jira-gray-bg` |

The `StatusBadge.vue` component maps Jira's `statusCategory.key` values (`done`, `indeterminate`, `new`) to these tokens.

---

## `src/assets/styles/common.css`

`common.css` contains base resets and utility classes that are **not** component-specific. It is imported once in each app's `main.js`:

```js
import '../../assets/styles/tokens.css'
import '../../assets/styles/common.css'
```

`common.css` includes:
- CSS reset (`box-sizing`, margin/padding resets)
- Base `body` font settings referencing `--font-family-base` and `--color-text`
- Utility classes: `.visually-hidden`, `.truncate`, `.flex`, `.flex-col`, `.gap-*` (using token values)
- Focus ring style using `--color-border-focus`
