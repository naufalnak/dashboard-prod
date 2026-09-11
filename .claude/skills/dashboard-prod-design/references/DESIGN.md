# dashboard-prod DESIGN.md

> Auto-generated design system — reverse-engineered via static analysis by skillui.
> Frameworks: React 18.3.1
> Colors: 20 · Fonts: 1 · Components: 63
> Icon library: Lucide · State: not detected
> Primary theme: light · Dark mode toggle: no · Motion: expressive

---

## 1. Visual Theme & Atmosphere

This is a **light-themed** interface with a cool, approachable feel. The light background emphasizes content clarity. Typography uses **sans-serif** throughout — a clean, modern choice that maintains consistency. Spacing follows a **4px base grid** (compact density), with scale: 2, 4, 6, 8, 10, 12, 14, 16px. The accent color **#14746a** anchors interactive elements (buttons, links, focus rings). Motion is expressive — spring physics, layout animations, and staggered reveals are part of the visual language.

---

## 2. Color Palette & Roles

| Token | Hex | Role | Use |
|---|---|---|---|
| background | `#ffffff` | background | Page background, darkest surface |
| card-border | `#10121a` | surface | Card and panel backgrounds |
| input-bg | `#eef0f5` | surface | Card and panel backgrounds |
| text-primary | `#000000` | text-primary | Headings and body text |
| muted | `#5a5a78` | text-muted | Captions, placeholders, secondary info |
| border | `#2a2a38` | border | Dividers, card borders, outlines |
| accent | `#14746a` | accent | CTAs, links, focus rings, active states |
| accent | `#7eb8ff` | accent | CTAs, links, focus rings, active states |
| danger | `#ff4455` | danger | Error states, destructive actions |
| success | `#00d084` | success | Success states, positive indicators |
| warning | `#f0a500` | warning | Warning states, caution indicators |
| info | `#4488ff` | info | Informational highlights |
| unknown | `#1a6fd4` | unknown | Palette color |
| unknown | `#6366f1` | unknown | Palette color |
| accent2 | `#0e5a52` | unknown | Palette color |
| unknown | `#ff9600` | unknown | Palette color |
| unknown | `#0c2236` | unknown | Palette color |
| unknown | `#15406a` | unknown | Palette color |
| unknown | `#2f6fa3` | unknown | Palette color |
| unknown | `#6fa8d8` | unknown | Palette color |

### CSS Variable Tokens

```css
--border: #2a2a38;
--muted: #5a5a78;
--accent: #14746a;
--accent2: #0e5a52;
--card-border: var(--border);
--card-shadow: none;
--card-shadow-hover: none;
--input-border: var(--border);
```


---

## 3. Typography Rules

**Font Stack:**
- **sans-serif** — Heading 1, Heading 2, Heading 3, Body, Caption

| Role | Font | Size | Weight |
|---|---|---|---|
| Heading 1 | sans-serif | 30px | 700 |
| Heading 2 | sans-serif | 28px | 700 |
| Heading 3 | sans-serif | 26px | 700 |
| Body | sans-serif | 12.5px | 400 |
| Caption | sans-serif | 12px | 400 |

**Typographic Rules:**
- Use **sans-serif** for all text — do not mix font families
- Maintain consistent hierarchy: no more than 3-4 font sizes per screen
- Headings use bold (600-700), body uses regular (400)
- Line height: 1.5 for body text, 1.2 for headings
- Use color and opacity for secondary hierarchy, not additional font sizes


---

## 4. Component Stylings

### Layout (2)

**Maintenance** — `src/pages/Maintenance.jsx`
- Variants: `all`
- State: useState

```tsx
<div className="page-view active">
      {/* ── Header ───────────────────────────── */}
      <div className="page-header">
        <div><div className="page-title">Log Work Order Produksi</div></div>
        <div className="header-actions">
          <button className="btn" onClick={(
```

**MaintenanceMode** — `src/pages/MaintenanceMode.jsx`

```tsx
<div style={{
      height: '100dvh', width: '100vw', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', textAlign: 'center',
      padding: '24px', boxSizing: 'border-box', gap: 18,
      background: 'linear-gradient(180deg, #0c2236 0%, #15406a 35%, #2f6fa3 70%, #6fa8d8 100%
```

### Navigation (5)

**BottomNav** — `src/components/BottomNav.jsx`

```tsx
<nav className="bottom-nav">
      <div className={'bn-item' + (page === 'dashboard' ? ' active' : ''
```

**DetailPanel** — `src/components/DetailPanel.jsx`
- State: useState

```tsx
<div className={'detail-panel' + (detailMachine ? ' show' : ''
```

**NotifPanel** — `src/components/NotifPanel.jsx`
- State: useRef

**Topbar** — `src/components/Topbar.jsx`
- Variants: `Admin`, `OP`
- State: useState, useRef

**DataProduksi** — `src/pages/DataProduksi.jsx`
- Variants: `all`
- Props: `label`, `hint`, `children`
- Key Styles: `group-box`
- State: useState

```tsx
<div>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--muted
```

### Data Display (15)

**MachineTable** — `src/components/MachineTable.jsx`
- Props: `machines`, `limit`, `search`, `onSearchChange`
- State: useState

```tsx
<div className="card">
      <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div><div className="card-title">Status Mesin</div><div className="card-sub">{limit && machines.length > limit ? `Menampilkan ${limit} dari ${machines.length} mesin` : `${machines.length} mesin termonitor`}</div></div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {!controlled && (
            <div className="search-wrap" style={{ minWidth: 130 }}>
              <span className="search-icon"><Search size={14} /></span>
              <input className="search-input" placeholder="Cari Mesin…" value={search} onChange={(e
```

**ProduksiTable** — `src/components/ProduksiTable.jsx`
- Props: `rows`, `loading`, `onEdit`, `onDelete`
- State: useState

```tsx
<>
    <div ref={scrollRef} style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: TABLE_MIN_WIDTH, tableLayout: 'fixed', background: 'var(--s1
```

**RecentClosedWO** — `src/components/RecentClosedWO.jsx`
- Props: `items`, `limit`

```tsx
<div className="table-scroll">
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={TH}>Mesin</th>
            <th style={TH}>Penyelesaian</th>
            <th style={{ ...TH, textAlign: 'right' }}>DT</th>
            <th style={{ ...TH, textAlign: 'right' }}>Selesai</th>
          </tr>
        </thead>
        <tbody>
          {closed.map((b, i
```

**RejectionTable** — `src/components/RejectionTable.jsx`
- Props: `rows`, `loading`, `onEdit`, `onDelete`

```tsx
<div ref={scrollRef} style={{ overflow: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 900, tableLayout: 'fixed', background: 'var(--s1
```

**Timeline** — `src/components/Timeline.jsx`
- Props: `items`, `limit`
- State: useState

```tsx
<div className="table-scroll">
      <table className="machine-table tl-table" style={{ minWidth: 420 }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'center' }}>Status</th>
            <th>Mesin</th>
            <th
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={(
```

**Analytics** — `src/pages/Analytics.jsx`
- Key Styles: `filter-chip`
- State: useState

```tsx
<div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Kalender Kerja</div>
          <div className="card-sub">Atur hari kerja per bulan — digunakan untuk kalkulasi MTBF & MTTR yang akurat</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="form-input" style={{ width: 88 }} value={calYear}
            onChange={(e
```

**ARDetail** — `src/pages/ARDetail.jsx`
- Props: `target`
- State: useState

```tsx
<div className="page-view active">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button className="btn-icon" onClick={(
```

**DataOvertime** — `src/pages/DataOvertime.jsx`
- Props: `label`, `children`
- Key Styles: `group-box`
- State: useState

```tsx
<div>
      <label style={{ display: 'block', fontSize: 10.5, fontWeight: 700, color: 'var(--muted
```

*...and 7 more data display components.*

### Data Input (3)

**Combobox** — `src/components/Combobox.jsx`
- Props: `value`, `onChange`, `options`, `style`, `disabled`, `placeholder`
- State: useState, useRef

**TargetsModal** — `src/components/TargetsModal.jsx`
- State: useState

```tsx
<div className="admin-overlay" onClick={closeAdmin}>
      <div className="admin-modal" onClick={(e
```

**RMOPublic** — `src/pages/RMOPublic.jsx`
- Props: `data`, `metrics`, `onReset`
- Key Styles: `group-box`
- State: useState, useRef

```tsx
<div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center', overflow: 'auto' }}>
      <CheckCircle2 size={56} style={{ color: '#00a884', marginBottom: 14 }} />
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 8 }}>
        Data Berhasil Dikirim!
      </div>
      <div style={{ color: '#5a6b73', fontSize: 14, lineHeight: 1.7, marginBottom: 20, maxWidth: 460 }}>
        {data.partName} — {data.proses} ({data.mesin}
```

### Overlay (9)

**Modal** — `src/components/Modal.jsx`
- Props: `title`, `onClose`, `children`, `fullscreen`, `headerVariant`

```tsx
<div className="overlay show fullscreen">
        <div className="modal fullscreen">
          <div className={hdrClass}>
            <div className="modal-title">{title}</div>
            <button className="modal-close" onClick={onClose}><X size={24} /></button>
          </div>
          <div className="fullscreen-body">{children}</div>
        </div>
      </div>
```

**ModalRoot** — `src/components/ModalRoot.jsx`

**AddBreakdownModal** — `src/components/modals/AddBreakdownModal.jsx`
- State: useState, useRef

```tsx
e
```

**AddMachineModal** — `src/components/modals/AddMachineModal.jsx`
- State: useState

```tsx
<Modal title="Tambah Mesin" onClose={closeModal}>
      <div className="form-grid">
        <div className="form-group full">
          <label className="form-label">Nama Mesin *</label>
          <input type="text" className={'form-input' + (errName ? ' error' : ''
```

**CloseWOModal** — `src/components/modals/CloseWOModal.jsx`
- Props: `payload`
- State: useState, useRef

```tsx
e
```

**EditMachineModal** — `src/components/modals/EditMachineModal.jsx`
- Props: `payload`
- State: useState

```tsx
<Modal title="Edit Mesin" onClose={closeModal}>
      <div className="form-grid">
        <div className="form-group full">
          <label className="form-label">Nama Mesin *</label>
          <input type="text" className={'form-input' + (errName ? ' error' : ''
```

**ExportWorkOrdersModal** — `src/components/modals/ExportWorkOrdersModal.jsx`
- Key Styles: `filter-row`
- State: useState

```tsx
<Modal title="Export Log Work Order" onClose={closeModal}>
      <div className="form-grid">
        <div className="form-group full">
          <label className="form-label">Periode</label>
          <div className="filter-row">
            {PERIODS.map((p
```

**ImportModal** — `src/components/modals/ImportModal.jsx`
- Variants: `workorder`, `Mechanical`
- Key Styles: `filter-row`
- State: useState, useRef

```tsx
<Modal title="Import CSV" onClose={closeModal}>
      <div className="filter-row" style={{ marginBottom: 12 }}>
        {Object.entries(MODES
```

*...and 1 more overlay components.*

### Typography (1)

**ProsesRowDrawer** — `src/components/ProsesRowDrawer.jsx`
- Props: `row`, `onClose`

```tsx
r.isFinishProses ? 'Ya — dipakai sebagai Total OK Input Rejection' : 'Belum'
```

### Other (28)

**AppSidebar** — `src/components/AppSidebar.jsx`

```tsx
<div className="app-sidebar">
      <div className="asb-section">Menu</div>
      {visibleNavItems.map((n
```

**AvailabilityCard** — `src/components/AvailabilityCard.jsx`
- Props: `kpi`

```tsx
<div className="card">
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div className="card-title">Availability</div>
          <InfoTip text={`(Jam Kerja Mesin × Hari Kerja − Downtime
```

**ClusterBarList** — `src/components/ClusterBarList.jsx`
- Props: `data`, `showLegend`

```tsx
<div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {data.map((d, i
```

**DonutChart** — `src/components/DonutChart.jsx`
- Props: `data`, `labelKey`, `valueKey`, `centerLabel`, `size`, `showLegend`
- State: useRef

```tsx
<div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 10 }}>
      <div style={{ width: boxSize, height: boxSize, flexShrink: 0 }}>
        <canvas ref={canvasRef}></canvas>
      </div>
      {showLegend && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
          {data.slice(0, 5
```

**DowntimeTrend** — `src/components/DowntimeTrend.jsx`
- Props: `days`
- State: useState, useRef

**GaugeCard** — `src/components/GaugeCard.jsx`
- Props: `title`, `value`, `target`, `infoText`, `onClick`, `comingSoon`, `invert`

```tsx
<div className="card" style={{ opacity: .55, background: 'var(--s2
```

**HorizontalBarList** — `src/components/HorizontalBarList.jsx`
- Props: `data`, `mode`, `valueKey`, `unit`
- State: useState

```tsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {data.map((d, i
```

**InfoTip** — `src/components/InfoTip.jsx`
- Props: `text`

```tsx
<span className="info-tip">
      <Info size={12} />
      <span className="info-tip-bubble">{text}</span>
    </span>
```

*...and 20 more other components.*



---

## 5. Layout Principles

- **Base spacing unit:** 4px
- **Spacing scale:** 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24
- **Border radius:** 0 0 12px 12px, 0 50% 50%0, 0 20px 20px 0, 1px, 2px, 5px, 6px, 7px, 8px, 9px, 10px, 12px, 14px 14px 0 0, 14px, 18px 18px 0 0, 20px, 20px 0 0 20px, 50%0 0 50%, 99px
- **Max content width:** 1100px

**Spacing as Meaning:**
| Spacing | Use |
|---|---|
| 4-8px | Tight: related items within a group |
| 12-16px | Medium: between groups |
| 24-32px | Wide: between sections |
| 48px+ | Vast: major section breaks |


---

## 6. Depth & Elevation

### Raised — cards, buttons, interactive elements

- `var(--card-shadow)`
- `var(--card-shadow-hover)`
- `0 0 0 3px rgba(240,165,0,.1)`

### Floating — dropdowns, popovers, modals

- `0 4px 20px rgba(0,0,0,.4)`
- `0 6px 20px rgba(0,0,0,.28)`

### Overlay — full-screen overlays, top-level dialogs

- `0 8px 24px rgba(0,0,0,.35)`
- `0 8px 40px rgba(0,0,0,.5)`
- `0 20px 60px rgba(0,0,0,.35)`

### Z-Index Scale

`0, 1, 5, 10, 20, 50, 100, 150, 200, 500, 790, 800, 900, 950, 999, 9999`



---

## 7. Animation & Motion

This project uses **expressive motion**. Animations are an integral part of the experience.

### CSS Animations

- `@keyframes drawerIn`
- `@keyframes lb-sweep`
- `@keyframes slideUp`
- `@keyframes slideIn`
- `@keyframes slideOut`
- `@keyframes pulse`
- `@keyframes fadeUp`
- `@keyframes fadeIn`

### Motion Guidelines

- Duration: 150-300ms for micro-interactions, 300-500ms for page transitions
- Easing: `ease-out` for enters, `ease-in` for exits
- Always respect `prefers-reduced-motion`


---

## 8. Do's and Don'ts

### Do's

- Use `#14746a` for interactive elements (buttons, links, focus rings)
- Use `#ffffff` as the primary page background
- Use **sans-serif** for all UI text
- Follow the **4px** spacing grid for all margins, padding, and gaps
- Use the defined shadow tokens for elevation — see Section 6
- Use border-radius from the scale: 0 0 12px 12px, 0 50% 50%0, 0 20px 20px 0, 1px, 2px
- Reuse existing components from Section 4 before creating new ones
- Use **Lucide** for all icons

### Don'ts

- Don't introduce colors outside this palette — extend the design tokens first
- Don't mix font families — use sans-serif consistently
- Don't use arbitrary spacing values — stick to multiples of 4px
- Don't create custom box-shadow values outside the system tokens
- Don't use arbitrary border-radius values — pick from the defined scale
- Don't duplicate component patterns — check Section 4 first
- Don't mix icon libraries — consistency matters
- Don't use backdrop-blur or blur effects

### Anti-Patterns (detected from codebase)

- No blur or backdrop-blur effects
- No zebra striping on tables/lists


---

## 9. Responsive Behavior

| Name | Value | Source |
|---|---|---|
| breakpoint-768px | 768px | css |
| breakpoint-1025px | 1025px | css |

**Approach:** Use `@media (min-width: ...)` queries matching the breakpoints above.


---

## 10. Agent Prompt Guide

Use these as starting points when building new UI:

### Build a Card

```
Background: #10121a
Border: 1px solid #2a2a38
Radius: 9px
Padding: 16px
Font: sans-serif
Use shadow tokens from Section 6.
```

### Build a Button

```
Primary: bg #14746a, text white
Ghost: bg transparent, border #2a2a38
Padding: 8px 16px
Radius: 9px
Hover: opacity 0.9 or lighter shade
Focus: ring with #14746a
```

### Build a Page Layout

```
Background: #ffffff
Max-width: 1100px, centered
Grid: 4px base
Responsive: mobile-first, breakpoints from Section 9
```

### Build a Stats Card

```
Surface: #10121a
Label: #5a5a78 (muted, 12px, uppercase)
Value: #000000 (primary, 24-32px, bold)
Status: use success/warning/danger from Section 2
```

### Build a Form

```
Input bg: #ffffff
Input border: 1px solid #2a2a38
Focus: border-color #14746a
Label: #5a5a78 12px
Spacing: 16px between fields
Radius: 9px
```

### General Component

```
1. Read DESIGN.md Sections 2-6 for tokens
2. Colors: only from palette
3. Font: sans-serif, type scale from Section 3
4. Spacing: 4px grid
5. Components: match patterns from Section 4
6. Elevation: shadow tokens
```
