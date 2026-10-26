# UI Design System & Specifications (`DESIGN.md`)

This document defines the universal design specifications for the entire **Project Time Analytics** application. All pages, components, and future additions **must** adhere strictly to these rules with zero exceptions.

---

## 1. Core Design Philosophy

- **Unboxed & Unclustered**: Avoid wrapping entire sections or tables in heavy bordered container cards. Use open, flat, breathable layouts separated by subtle horizontal dividers.
- **Extended Full-Width Layout**: Always extend the main view across the full width of the screen (`w-full max-w-none px-8 py-6`). Never artificially constrain wide monitors with cramped `max-w-7xl` or `max-w-5xl` wrappers.
- **Unified Aesthetic**: Clean, modern, two-tone minimalist palette with white interactive surfaces and curved pill borders. No harsh solid black blocks.
- **Dynamic Date & Time Control**: All analytical views must provide reactive date selectors (`Month`, `From Date`, `To Date`) with instant real-time filtering across metrics, charts, client breakdowns, and log tables.

---

## 2. Typography

- **Single Font Family**: **Arial / Helvetica** (`font-family: Arial, Helvetica, sans-serif;`).
  - No mixed fonts (no Inter, Roboto, Georgia, etc.).
- **Numeric & Code Values**: `font-mono` for hours (e.g. `186.9h`), dates (`2026-09-01`), commit SHAs (`abcdef1`), and quantities.
- **Type Scale**:
  - **Page Title**: `text-lg font-semibold tracking-tight text-[#17212B]`
  - **Section Header**: `text-lg font-bold text-[#17212B]`
  - **KPI Metric Label**: `text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider`
  - **KPI Metric Value**: `text-3xl font-bold font-mono text-[#17212B]`
  - **Table Headers**: `text-xs font-semibold text-[#17212B]`
  - **Table Primary Text**: `text-sm font-semibold text-[#17212B]`
  - **Table Secondary Text**: `text-xs text-[#17212B]/70`

---

## 3. Color Palette

| Token | Value | Purpose |
| :--- | :--- | :--- |
| **Canvas Background** | `#F5F7F8` | Main application background |
| **Primary Text / Brand** | `#17212B` | Headers, primary text, prominent accents |
| **Muted Text** | `rgba(23, 33, 43, 0.65)` | Subtitles, labels, secondary metadata |
| **Surface (Controls & Badges)** | `#FFFFFF` | Background for buttons, inputs, select boxes, badges, tooltips |
| **Dividers & Borders** | `rgba(23, 33, 43, 0.15)` | Clean horizontal separator lines between sections |
| **Table Row Hover** | `rgba(255, 255, 255, 0.60)` | Subtle row highlight on hover |
| **Pie Chart Palette (Blue)** | `#1D4ED8`, `#2563EB`, `#3B82F6`, `#60A5FA`, `#93C5FD`, `#0284C7` | Data visualization slices |

---

## 4. UI Components Specification

### 4.1 Buttons
- **Shape**: **Curved Pill Borders** (`rounded-full`).
- **Color**: **White background** (`bg-white`) with dark text (`text-[#17212B]`).
- **Border**: Subtle border (`border border-[#17212B]/20`), enhanced on hover (`hover:bg-gray-50 hover:border-[#17212B]/40`).
- **Icon Buttons**: Rounded circle (`rounded-full`), `h-7 w-7` or `h-8 w-8`.

### 4.2 Form Inputs & Selects
- **Shape**: `rounded-full` (curved pill borders).
- **Background**: `bg-white` with dark text (`text-[#17212B]`).
- **Border**: `border border-[#17212B]/20`.
- **Focus**: `focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#17212B]`.

### 4.3 Sidebar & Navigation
- **Header Alignment**: Sidebar brand header and main window page header **must** both have fixed height `h-[73px]` with `border-b border-[#17212B]/15` to form one unbroken, perfectly aligned horizontal divider across the entire window.
- **Brand Avatar**: Curved white pill/circle (`bg-white text-[#17212B] border border-[#17212B]/20 shadow-sm`). No solid black box.
- **Active Navigation Highlighter**: **White pill** (`bg-white text-[#17212B] border border-[#17212B]/15 shadow-sm font-semibold`), never black.
- **Inactive Nav Items**: `text-[#17212B]/75 hover:bg-white/70 hover:text-[#17212B] rounded-full`.

### 4.4 Data Visualizations (Pie Charts)
- **Chart Type**: Pie / Donut charts (`innerRadius={42}`, `outerRadius={68}`, `paddingAngle={3}`).
- **Colors**: Slices are styled using the **Blue Palette** (`#1D4ED8`, `#2563EB`, `#3B82F6`, `#60A5FA`, `#93C5FD`, `#0284C7`).
- **Surfaces & Tooltips**: All surrounding chart surfaces, tooltips, and legends are **White** (`bg-white text-[#17212B] border border-[#17212B]/20 shadow-lg`). No black boxes.

### 4.5 Date & Filter Controls Bar
- **Controls Included on Every Data Tab**:
  - `Month` Selector (All Months + dynamic sheet months)
  - `From` Date Input (`<Input type="date" />`)
  - `To` Date Input (`<Input type="date" />`)
  - `Reset` Button (restores default all-time view)
- **Synchronization**:
  - Selecting a month auto-populates `From` (1st of month) and `To` (last day of month).
  - Entering custom `From` or `To` dates dynamically queries and recalibrates all metrics and tables in real-time.

### 4.6 Badges & Chips
- **Shape**: `rounded-full`.
- **Color**: `bg-white text-[#17212B] border border-[#17212B]/15`.
- **Padding**: `px-2.5 py-0.5 text-[10px] or text-[11px]`.

### 4.7 Tables
- **Unboxed**: Direct table on canvas without nested container boxes.
- **Header**: Transparent background with `border-b border-[#17212B]/15`.
- **Rows**: `border-b border-[#17212B]/10 hover:bg-white/60 transition-colors`.
- **Padding**: `py-3.5` for comfortable vertical breathing room.

### 4.8 KPI Summary Metrics Strip
- **Layout**: Unboxed grid (`grid grid-cols-2 sm:grid-cols-4 gap-6 py-4 border-b border-[#17212B]/15`).
- **Label**: `text-[11px] font-semibold text-[#17212B]/60 uppercase tracking-wider`.
- **Value**: `text-3xl font-bold font-mono text-[#17212B] mt-1`.

---

## 5. Rules & Anti-Patterns

1. **NO Boxed Enclosures**: Never wrap page content in `<Card>` or heavy bordered `rounded-lg` panels unless displaying a dedicated modal dialog.
2. **NO Hardcoded Constraints**: Never use `max-w-7xl` or `max-w-5xl` on page root containers; use `w-full max-w-none px-8 py-6`.
3. **NO Black / Dark Buttons or Highlighters**: Active tabs and standard buttons must always be white with curved pill borders.
4. **NO Misaligned Header Dividers**: Sidebar header and window header must maintain identical `h-[73px]` height and border.
5. **NO Bar Charts for Summaries**: Use modern Blue Pie / Donut charts with white tooltips and legends.
6. **NO Static Date Controls**: All tabs must support both Month selection and custom Date range inputs with live recalculation.
7. **NO Sharp Square Corners**: All interactive controls (buttons, inputs, select dropdowns, search bars, badges) must use `rounded-full`.
8. **Direct Sheet Linking**: All categorical data (Clients, Categories, Developers, Projects) must be parsed dynamically from Google Sheets without synthetic defaults.
