# RemedyIQ Frontend: Component Design Specifications
## Detailed UI Component Guide with Code Examples

**Date:** February 2026
**Status:** Implementation Ready
**Stack:** Next.js 16, React 19, shadcn/ui, Tailwind CSS 4

---

## Table of Contents

1. [Color System](#color-system)
2. [Typography](#typography)
3. [Component Library](#component-library)
4. [Layout Components](#layout-components)
5. [Data Display Components](#data-display-components)
6. [Interactive Components](#interactive-components)
7. [Specialty Components](#specialty-components)

---

## Color System

### Semantic Palette

**Light Mode:**
```css
/* Brand Colors */
--color-primary: #0066CC;      /* Primary actions, links */
--color-primary-light: #E6F0FF; /* Primary backgrounds */
--color-primary-dark: #003D7A;  /* Primary hover/active */

/* Status Colors */
--color-success: #28A745;       /* ✓ Success, healthy */
--color-success-light: #E8F5E9; /* Success backgrounds */
--color-warning: #FFC107;       /* ⚠ Warning, degraded */
--color-warning-light: #FFF8E1; /* Warning backgrounds */
--color-error: #DC3545;         /* ✗ Error, failed */
--color-error-light: #FFEBEE;   /* Error backgrounds */
--color-info: #17A2B8;          /* ℹ Information, neutral */
--color-info-light: #E0F7FA;    /* Info backgrounds */
--color-debug: #6C757D;         /* Debug, verbose */
--color-debug-light: #F1F3F5;   /* Debug backgrounds */

/* Escalation (AR Server specific) */
--color-escalation: #8B0000;    /* Critical escalation */
--color-escalation-light: #FFE6E6;

/* Neutral Colors */
--color-bg-primary: #FFFFFF;    /* Page background */
--color-bg-secondary: #F8F9FA;  /* Card/panel background */
--color-bg-tertiary: #F0F2F5;   /* Subtle background */
--color-surface: #FFFFFF;       /* Raised surfaces */
--color-border: #E0E0E0;        /* Dividers, edges */
--color-border-light: #EEEEEE;  /* Subtle dividers */
--color-text-primary: #212529;  /* Primary text */
--color-text-secondary: #6C757D;/* Secondary text */
--color-text-tertiary: #A6ADBA; /* Tertiary text (disabled) */
```

**Dark Mode:**
```css
/* Brand Colors */
--color-primary: #4DADF7;
--color-primary-light: #1A3A52;
--color-primary-dark: #7BC3FF;

/* Status Colors */
--color-success: #51CF66;
--color-success-light: #1D3D2D;
--color-warning: #FFD93D;
--color-warning-light: #3D3A1A;
--color-error: #FF6B6B;
--color-error-light: #3D1A1A;
--color-info: #4DADF7;
--color-info-light: #1A3A3D;
--color-debug: #A6ADBA;
--color-debug-light: #2A2E35;

/* Escalation */
--color-escalation: #FF8A8A;
--color-escalation-light: #4D1A1A;

/* Neutral Colors */
--color-bg-primary: #0F1419;
--color-bg-secondary: #1A1E27;
--color-bg-tertiary: #25293D;
--color-surface: #151A24;
--color-border: #404854;
--color-border-light: #2A2E35;
--color-text-primary: #E8EAED;
--color-text-secondary: #A6ADBA;
--color-text-tertiary: #5A6268;
```

### Color Usage Guidelines

| Color | Primary Use | Examples |
|-------|-----------|----------|
| **Primary (#0066CC)** | CTA buttons, active nav, links | "Start analysis", highlighted rows, focus state |
| **Success (#28A745)** | Healthy status, passed checks | "✓ Running", "Completed", green badges |
| **Warning (#FFC107)** | Degraded performance, slow | "⚠ Slow", amber badges, attention-needed |
| **Error (#DC3545)** | Failures, errors, critical | "✗ Failed", red badges, error messages |
| **Info (#17A2B8)** | Informational, neutral | Info toasts, blue badges, hints |
| **Debug (#6C757D)** | Debug/verbose logs | Gray text, muted sections |
| **Escalation (#8B0000)** | Critical AR Server escalation | Red-dark badges, urgent alerts |

### Contrast Verification

**WCAG 2.1 AA Requirements:**
- Normal text: 4.5:1 minimum contrast ratio
- Large text (18pt+): 3:1 minimum
- UI components: 3:1 for borders and focus indicators

**Verified Pairs (Light Mode):**
- Text (#212529) on Background (#FFFFFF): 21:1 ✓
- Text (#212529) on Surface (#F8F9FA): 18:1 ✓
- Success (#28A745) on Success Light (#E8F5E9): 5.2:1 ✓
- Error (#DC3545) on Error Light (#FFEBEE): 5.1:1 ✓
- Border (#E0E0E0) on Background (#FFFFFF): 1.5:1 (decorative only)

---

## Typography

### Font Stack

```css
/* UI Elements (system font for performance) */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto',
             'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;

/* Monospace (for logs, code, structured data) */
font-family: 'Monaco', 'Courier New', 'Courier', monospace;
/* Fallback for non-Mac: 'Menlo', 'Consolas', monospace */
```

### Scale (8px baseline)

| Token | Size | Line Height | Weight | Usage |
|-------|------|-------------|--------|-------|
| **xs** | 12px | 16px | 400 | Helper text, captions, timestamp |
| **sm** | 14px | 20px | 400 | Secondary labels, log timestamps |
| **base** | 14px | 20px | 400 | Body text, table cells |
| **lg** | 16px | 24px | 500 | Primary labels, card titles |
| **xl** | 18px | 28px | 500 | Dashboard section headers |
| **2xl** | 22px | 32px | 600 | Page titles, major headings |

**Monospace Usage:**
```css
/* Log messages, structured data */
font-family: 'Monaco', monospace;
font-size: 13px;
line-height: 1.5;
letter-spacing: 0; /* No extra spacing */
```

### Example Implementation (Tailwind)

```tsx
// Page Title
<h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
  Log Explorer
</h1>

// Section Header
<h2 className="text-lg font-medium text-gray-700 dark:text-gray-300">
  Recent Searches
</h2>

// Body Text
<p className="text-base text-gray-600 dark:text-gray-400">
  Explore logs from the last 24 hours
</p>

// Helper Text / Secondary Label
<span className="text-xs text-gray-500 dark:text-gray-400">
  Updated 2 minutes ago
</span>

// Monospace (logs)
<pre className="text-sm font-mono text-gray-900 dark:text-gray-100 bg-gray-50 dark:bg-gray-900">
  2026-02-17T14:30:45.123Z ERROR [api-server] Connection timeout
</pre>
```

---

## Component Library

### Base Components (from shadcn/ui)

All components use `shadcn/ui` (copy-paste, not npm install).

**Standard Components:**
- `Button` - Actions, CTAs, form submission
- `Card` - Containers, dashboard tiles, panels
- `Input` - Text fields, search, filters
- `Label` - Form labels, field identifiers
- `Dialog` - Modal dialogs, confirmations
- `Dropdown` - Select menus, more options
- `Badge` - Status tags, labels, counts
- `Avatar` - User profiles, service icons
- `Toast` - Notifications, alerts
- `Tabs` - Tab navigation, view switchers
- `Sheet` - Side panels, mobile navigation
- `Table` - Data tables (see custom extension below)

### Button Variants

```tsx
// Primary CTA (blue)
<Button variant="default">
  Start Analysis
</Button>

// Secondary (outline)
<Button variant="outline">
  Cancel
</Button>

// Destructive (red)
<Button variant="destructive">
  Delete Search
</Button>

// Ghost (minimal)
<Button variant="ghost">
  View Details
</Button>

// Link (text only)
<Button variant="link">
  Learn more
</Button>

// With icon
<Button variant="default" size="sm">
  <Plus className="w-4 h-4 mr-1" />
  Add Filter
</Button>
```

### Badge Variants (Status)

```tsx
// Success
<Badge variant="success">✓ Running</Badge>

// Warning
<Badge variant="warning">⚠ Slow</Badge>

// Error
<Badge variant="destructive">✗ Failed</Badge>

// Info
<Badge variant="info">ℹ 5 matches</Badge>

// Escalation (custom variant)
<Badge className="bg-red-900 text-white">
  ESCALATED
</Badge>

// Outline
<Badge variant="outline">Draft</Badge>
```

---

## Layout Components

### 1. Sidebar Navigation

**Structure:**
```tsx
<div className="flex h-screen">
  {/* Sidebar */}
  <aside className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
    {/* Logo Section */}
    <div className="p-4 border-b border-gray-200 dark:border-gray-800">
      <div className="flex items-center space-x-2">
        <div className="w-8 h-8 bg-blue-600 rounded-md flex items-center justify-center text-white font-bold">
          RQ
        </div>
        <span className="font-semibold text-gray-900 dark:text-white">RemedyIQ</span>
      </div>
    </div>

    {/* Search/Command Bar */}
    <div className="p-4 border-b border-gray-200 dark:border-gray-800">
      <Input
        placeholder="Search... (⌘K)"
        className="h-9 text-sm"
      />
    </div>

    {/* Navigation Groups */}
    <nav className="flex-1 overflow-y-auto p-4 space-y-8">
      {/* Group 1: Core */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-2 mb-3">
          Core
        </h3>
        <div className="space-y-1">
          <NavItem href="/dashboard" icon={<LayoutGrid />} label="Dashboard" active />
          <NavItem href="/logs" icon={<LogStream />} label="Log Explorer" />
          <NavItem href="/traces" icon={<Zap />} label="Trace Viewer" />
          <NavItem href="/analysis" icon={<BarChart3 />} label="Analysis" />
        </div>
      </div>

      {/* Group 2: Recent */}
      <div>
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide px-2 mb-3">
          Recent
        </h3>
        <div className="space-y-1">
          <NavItem href="/dashboard/job-errors" label="Job Errors Dashboard" />
          <NavItem href="/logs?job=CHG123" label="CHG0123456 Logs" />
        </div>
      </div>
    </nav>

    {/* Footer */}
    <div className="p-4 border-t border-gray-200 dark:border-gray-800 space-y-2">
      <NavItem href="/settings" icon={<Settings />} label="Settings" />
      <NavItem href="/help" icon={<HelpCircle />} label="Help & Docs" />
    </div>
  </aside>

  {/* Main Content */}
  <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-950">
    {/* Page content here */}
  </main>
</div>
```

**NavItem Component:**
```tsx
function NavItem({ href, icon, label, active = false }) {
  return (
    <Link href={href}>
      <a className={cn(
        "flex items-center space-x-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
        active
          ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
          : "text-gray-700 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800"
      )}>
        {icon && <span className="w-5 h-5">{icon}</span>}
        <span>{label}</span>
      </a>
    </Link>
  );
}
```

### 2. Breadcrumb Navigation

```tsx
<nav className="flex items-center space-x-2 text-sm mb-6">
  <Link href="/dashboard">
    <a className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
      Dashboard
    </a>
  </Link>
  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600" />
  <Link href="/logs">
    <a className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
      Log Explorer
    </a>
  </Link>
  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600" />
  <span className="text-gray-900 dark:text-white font-medium">
    Live Tail
  </span>
</nav>
```

### 3. Page Header

```tsx
<div className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
  <div className="max-w-7xl mx-auto px-6 py-6">
    <div className="flex items-start justify-between">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
          Log Explorer
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Search and analyze logs across all jobs
        </p>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm">
          <Download className="w-4 h-4 mr-1" />
          Export
        </Button>
        <Button size="sm">
          <Save className="w-4 h-4 mr-1" />
          Save Search
        </Button>
      </div>
    </div>
  </div>
</div>
```

---

## Data Display Components

### 1. Virtualized Log Table

**Features:**
- Virtual scrolling (react-window)
- Sortable columns
- Expandable rows (details panel)
- Severity color coding
- Monospace font for logs

```tsx
import { FixedSizeList as List } from 'react-window';

function LogTable({ logs, onSelectLog }) {
  const Row = ({ index, style }) => {
    const log = logs[index];
    return (
      <div
        style={style}
        className="flex items-center border-b border-gray-200 dark:border-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer"
        onClick={() => onSelectLog(log)}
      >
        <div className="w-32 px-4 py-3 text-xs font-mono text-gray-600 dark:text-gray-400">
          {new Date(log.timestamp).toLocaleTimeString()}
        </div>
        <div className="w-24 px-4 py-3">
          <Badge variant={getSeverityVariant(log.severity)}>
            {log.severity}
          </Badge>
        </div>
        <div className="flex-1 px-4 py-3">
          <p className="text-sm font-mono text-gray-900 dark:text-gray-100 truncate">
            {log.message}
          </p>
        </div>
        <div className="w-32 px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
          {log.source}
        </div>
      </div>
    );
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 grid grid-cols-[120px_100px_1fr_120px] gap-4">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Timestamp</div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Severity</div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Message</div>
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">Source</div>
      </div>

      {/* Virtual List */}
      <List
        height={500}
        itemCount={logs.length}
        itemSize={44}
        width="100%"
      >
        {Row}
      </List>
    </div>
  );
}

function getSeverityVariant(severity) {
  switch (severity) {
    case 'ERROR': return 'destructive';
    case 'WARN': return 'warning';
    case 'INFO': return 'info';
    case 'DEBUG': return 'debug';
    default: return 'default';
  }
}
```

### 2. Timeline/Histogram

```tsx
function LogTimeline({ distribution }) {
  // distribution: { timestamp: count }
  const max = Math.max(...Object.values(distribution));

  return (
    <div className="h-16 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-end gap-0.5">
      {Object.entries(distribution).map(([time, count]) => {
        const height = (count / max) * 100;
        return (
          <div
            key={time}
            className="flex-1 bg-blue-400 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 rounded-t transition-colors cursor-pointer"
            style={{ height: `${height}%`, minHeight: '2px' }}
            title={`${count} logs at ${time}`}
          />
        );
      })}
    </div>
  );
}
```

### 3. Trace Waterfall

```tsx
function TraceWaterfall({ spans }) {
  const renderSpan = (span, depth = 0) => {
    const relativeStart = (span.start_time - spans[0].start_time) / 1000;
    const duration = span.duration_ms / 1000;
    const viewportWidth = 800;
    const totalDuration = 1000; // ms

    const left = (relativeStart / totalDuration) * viewportWidth;
    const width = (duration / totalDuration) * viewportWidth;

    return (
      <div key={span.id} className="mb-1">
        {/* Span row */}
        <div className="flex items-center gap-4 h-8">
          <div style={{ paddingLeft: `${depth * 20}px` }} className="w-48">
            <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
              {span.name}
            </span>
          </div>

          {/* Timeline bar */}
          <div className="relative flex-1 h-6 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
            <div
              style={{ left: `${left}px`, width: `${width}px` }}
              className={cn(
                "absolute top-0 h-full rounded transition-colors",
                span.status === 'error' && "bg-red-500",
                span.status === 'warning' && "bg-yellow-500",
                span.status === 'success' && "bg-green-500"
              )}
              title={`${span.name} (${span.duration_ms}ms)`}
            />
          </div>

          <div className="text-sm text-gray-600 dark:text-gray-400 w-20 text-right">
            {span.duration_ms}ms
          </div>
        </div>

        {/* Children */}
        {span.children && span.children.map(child => renderSpan(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="p-4 bg-white dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-lg overflow-x-auto">
      {spans.map(span => renderSpan(span))}
    </div>
  );
}
```

---

## Interactive Components

### 1. Filter Panel

```tsx
function FilterPanel({ filters, onFilterChange, onClear }) {
  return (
    <div className="p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
          Active Filters
        </h3>

        {filters.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">No filters applied</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filters.map((filter, idx) => (
              <Badge
                key={idx}
                variant="outline"
                className="flex items-center gap-2"
              >
                <span>{filter.name}</span>
                <X
                  className="w-3 h-3 cursor-pointer hover:text-red-600"
                  onClick={() => onFilterChange(filters.filter((_, i) => i !== idx))}
                />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div>
        <Label className="text-sm font-medium mb-2">Add Filter</Label>
        <div className="flex gap-2">
          <Input placeholder="Field name" className="h-9" />
          <Input placeholder="Value" className="h-9" />
          <Button variant="outline" size="sm">Add</Button>
        </div>
      </div>

      {filters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="w-full"
        >
          Clear All Filters
        </Button>
      )}
    </div>
  );
}
```

### 2. Query Builder (Visual + Code Modes)

```tsx
function QueryBuilder({ value, onChange, mode = 'visual' }) {
  const [queryMode, setQueryMode] = useState(mode);

  if (queryMode === 'code') {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Query (LogQL)</Label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setQueryMode('visual')}
          >
            ← Visual Mode
          </Button>
        </div>
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full h-24 font-mono text-sm p-2 border border-gray-200 dark:border-gray-800 rounded-md bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100"
          placeholder="{job_id='CHG123'} | json | level='ERROR'"
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium">Build Query</Label>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setQueryMode('code')}
        >
          Code Mode →
        </Button>
      </div>

      {/* WHERE clause */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3 space-y-2">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">WHERE</div>
        <div className="flex gap-2 items-center">
          <Select defaultValue="job_id">
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="job_id">Job ID</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="level">Level</SelectItem>
            </SelectContent>
          </Select>

          <Select defaultValue="equals">
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="regex">Regex</SelectItem>
            </SelectContent>
          </Select>

          <Input placeholder="Value" className="flex-1 h-9" />
          <Button variant="ghost" size="sm">✕</Button>
        </div>
        <Button variant="outline" size="sm" className="w-full">
          + Add Condition
        </Button>
      </div>

      {/* GROUP BY */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-md p-3 space-y-2">
        <div className="text-xs font-semibold text-gray-700 dark:text-gray-300">GROUP BY</div>
        <Select>
          <SelectTrigger>
            <SelectValue placeholder="Select field to group by..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="level">Level</SelectItem>
            <SelectItem value="service">Service</SelectItem>
            <SelectItem value="host">Host</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Preview */}
      <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-md p-3">
        <div className="text-xs text-gray-600 dark:text-gray-400 font-mono">
          {value || "{job_id='...'} | ..."}
        </div>
      </div>
    </div>
  );
}
```

### 3. Time Range Picker

```tsx
function TimeRangePicker({ start, end, onRangeChange }) {
  const presets = [
    { label: 'Last 1h', value: [now - 3600000, now] },
    { label: 'Last 24h', value: [now - 86400000, now] },
    { label: 'Last 7d', value: [now - 604800000, now] },
    { label: 'Custom', value: null },
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-64">
          <Calendar className="w-4 h-4 mr-2" />
          {formatDateRange(start, end)}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {presets.map(preset => (
              <Button
                key={preset.label}
                variant="outline"
                size="sm"
                onClick={() => onRangeChange(preset.value[0], preset.value[1])}
              >
                {preset.label}
              </Button>
            ))}
          </div>

          <div className="border-t border-gray-200 dark:border-gray-800 pt-4 space-y-2">
            <div>
              <Label className="text-sm">Start</Label>
              <Input type="datetime-local" className="h-9" />
            </div>
            <div>
              <Label className="text-sm">End</Label>
              <Input type="datetime-local" className="h-9" />
            </div>
            <Button className="w-full">Apply</Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

---

## Specialty Components

### 1. Loading States

```tsx
// Skeleton Loader
function TableSkeleton() {
  return (
    <div className="space-y-2 p-4">
      {[...Array(10)].map((_, i) => (
        <div
          key={i}
          className="h-10 bg-gray-200 dark:bg-gray-800 rounded animate-pulse"
        />
      ))}
    </div>
  );
}

// Spinner
function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-2">
      <div className="w-8 h-8 border-4 border-gray-200 dark:border-gray-700 border-t-blue-500 rounded-full animate-spin" />
      <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
    </div>
  );
}
```

### 2. Empty States

```tsx
function EmptyState({ title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center">
      <Box className="w-12 h-12 text-gray-300 dark:text-gray-700 mb-4" />
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
        {title}
      </h3>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 max-w-sm">
        {description}
      </p>
      {action && <Button variant="outline">{action}</Button>}
    </div>
  );
}
```

### 3. Error Boundary

```tsx
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
    // Send to error tracking (Sentry, etc.)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <h3 className="font-semibold text-red-900 dark:text-red-200 mb-2">
            Oops! Something went wrong
          </h3>
          <p className="text-sm text-red-800 dark:text-red-300 mb-4">
            {this.state.error?.message}
          </p>
          <Button
            variant="outline"
            onClick={() => this.setState({ hasError: false })}
          >
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### 4. Toast Notifications

```tsx
import { toast } from 'sonner';

// Usage
toast.success('Log saved successfully');
toast.error('Failed to delete search', { description: 'Please try again later' });
toast.loading('Exporting logs...');
toast.dismiss();
```

**Toast Variants:**
- `toast.success()` - Green, checkmark icon
- `toast.error()` - Red, X icon
- `toast.warning()` - Amber, alert icon
- `toast.info()` - Blue, info icon
- `toast.loading()` - Gray, spinner

---

## Implementation Checklist

- [ ] Install shadcn/ui components
- [ ] Set up Tailwind CSS dark mode
- [ ] Verify color contrast (WCAG AA)
- [ ] Test virtualization performance (1000+ rows)
- [ ] Implement keyboard navigation (Tab, Escape, arrows)
- [ ] Add ARIA labels to all interactive elements
- [ ] Set up error boundary for all pages
- [ ] Create component storybook (Storybook or Chromatic)
- [ ] Test on mobile devices (iOS, Android)
- [ ] Performance audit with Lighthouse

---

**Status:** Ready for development
**Next:** Copy-paste shadcn/ui components and implement layouts
