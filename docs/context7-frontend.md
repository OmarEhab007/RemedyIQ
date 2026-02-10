# RemedyIQ Frontend Libraries - Context7 Documentation Reference

> Fetched from Context7 on 2026-02-10 for the RemedyIQ project frontend stack.

---

## Table of Contents

1. [Next.js (Vercel)](#1-nextjs---vercelnetxjs)
2. [shadcn/ui](#2-shadcnui---shadcn-uiui)
3. [Recharts](#3-recharts---rechartsrecharts)
4. [Clerk Authentication](#4-clerk-authentication---clerkclerk-docs)
5. [react-window](#5-react-window---bvaughnreact-window)

---

## 1. Next.js - `/vercel/next.js`

### Overview

Next.js App Router with Server Components, Client Components, Suspense boundaries, `useSearchParams`, and middleware-based routing.

### Key Usage Patterns

#### useSearchParams in Client Components

The `useSearchParams` hook from `next/navigation` must be used in Client Components (marked with `'use client'`). It reads URL query parameters and is available on the server during the initial render for dynamically rendered routes.

```tsx
'use client'

import { useSearchParams } from 'next/navigation'

export default function SearchBar() {
  const searchParams = useSearchParams()
  const search = searchParams.get('search')

  // Logged on the server during the initial render
  // and on the client on subsequent navigations.
  console.log(search)

  return <>Search: {search}</>
}
```

#### Wrapping useSearchParams with Suspense

When using `useSearchParams` in statically rendered routes, wrap the component in a `<Suspense>` boundary. This allows the rest of the page to be statically rendered and sent as part of the initial HTML, while the dynamic part renders a fallback.

```tsx
import { Suspense } from 'react'
import SearchBar from './search-bar'

function SearchBarFallback() {
  return <>placeholder</>
}

export default function Page() {
  return (
    <>
      <nav>
        <Suspense fallback={<SearchBarFallback />}>
          <SearchBar />
        </Suspense>
      </nav>
      <h1>Dashboard</h1>
    </>
  )
}
```

#### Using All Three Routing Hooks Together

Import `useRouter`, `usePathname`, and `useSearchParams` from `next/navigation` in Client Components within the `app` directory. These hooks must be used with the `'use client'` directive and are **not** available in Server Components.

```tsx
'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

export default function ExampleClientComponent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Use router.push(), pathname, searchParams.get() etc.
}
```

#### Cross-Router Compatible SearchBar

A `SearchBar` component that works in both Pages Router and App Router contexts, with a fallback for pre-rendering in Pages Router:

```typescript
import { useSearchParams } from 'next/navigation'

export function SearchBar() {
  const searchParams = useSearchParams()

  if (!searchParams) {
    // Fallback for Pages Router during pre-rendering
    return <input defaultValue="" placeholder="Search..." />
  }

  const search = searchParams.get('search') ?? ''
  return <input defaultValue={search} placeholder="Search..." />
}
```

### Configuration Notes

- **Server Components** are the default in the App Router -- no directive needed.
- **Client Components** require `'use client'` at the top of the file.
- `useSearchParams` causes the client-side rendering boundary to extend up to the nearest `Suspense` boundary. Wrap it in `<Suspense>` to avoid making the entire page client-rendered.
- For static rendering, the `useSearchParams` value is not available on the server; it is populated during hydration.

---

## 2. shadcn/ui - `/shadcn-ui/ui`

### Overview

A collection of re-usable, accessible UI components built with Radix UI and Tailwind CSS. Components are installed individually via CLI and live in your codebase (not a traditional npm dependency).

### Installation

Install individual components using the CLI:

```bash
npx shadcn@latest add dialog
npx shadcn@latest add table
npx shadcn@latest add button
npx shadcn@latest add dropdown-menu
npx shadcn@latest add input
npx shadcn@latest add label
npx shadcn@latest add form
```

### Key Components and Patterns

#### Dialog Component with Form

A full dialog example with trigger, content, header, description, form fields, and footer actions:

```tsx
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DialogDemo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">Edit Profile</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Make changes to your profile here. Click save when you're done.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              Name
            </Label>
            <Input id="name" defaultValue="John Doe" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Username
            </Label>
            <Input id="username" defaultValue="@johndoe" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="secondary">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

#### Dark Mode Toggle

A theme toggle component using a dropdown menu with light, dark, and system options. Uses `lucide-react` icons and syncs with the `dark` class on `document.documentElement`:

```tsx
import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export function ModeToggle() {
  const [theme, setThemeState] = React.useState<
    "theme-light" | "dark" | "system"
  >("theme-light")

  React.useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark")
    setThemeState(isDarkMode ? "dark" : "theme-light")
  }, [])

  React.useEffect(() => {
    const isDark =
      theme === "dark" ||
      (theme === "system" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    document.documentElement.classList[isDark ? "add" : "remove"]("dark")
  }, [theme])

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon">
          <Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
          <Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
          <span className="sr-only">Toggle theme</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => setThemeState("theme-light")}>
          Light
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeState("dark")}>
          Dark
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setThemeState("system")}>
          System
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
```

### Theming with CSS Variables

shadcn/ui uses CSS custom properties (variables) defined in `app/globals.css` for theming. Light mode variables are on `:root`, dark mode on `.dark`:

```css
:root {
  --radius: 0.625rem;
  --background: oklch(1 0 0);
  --foreground: oklch(0.129 0.042 264.695);
  --card: oklch(1 0 0);
  --card-foreground: oklch(0.129 0.042 264.695);
  --popover: oklch(1 0 0);
  --popover-foreground: oklch(0.129 0.042 264.695);
  --primary: oklch(0.208 0.042 265.755);
  --primary-foreground: oklch(0.984 0.003 247.858);
  --secondary: oklch(0.968 0.007 247.896);
  --secondary-foreground: oklch(0.208 0.042 265.755);
  --muted: oklch(0.968 0.007 247.896);
  --muted-foreground: oklch(0.554 0.046 257.417);
  --accent: oklch(0.968 0.007 247.896);
  --accent-foreground: oklch(0.208 0.042 265.755);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(0.929 0.013 255.508);
  --input: oklch(0.929 0.013 255.508);
  --ring: oklch(0.704 0.04 256.788);
  --chart-1: oklch(0.646 0.222 41.116);
  --chart-2: oklch(0.6 0.118 184.704);
  --chart-3: oklch(0.398 0.07 227.392);
  --chart-4: oklch(0.828 0.189 84.429);
  --chart-5: oklch(0.769 0.188 70.08);
  --sidebar: oklch(0.984 0.003 247.858);
  --sidebar-foreground: oklch(0.129 0.042 264.695);
  --sidebar-primary: oklch(0.208 0.042 265.755);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.968 0.007 247.896);
  --sidebar-accent-foreground: oklch(0.208 0.042 265.755);
  --sidebar-border: oklch(0.929 0.013 255.508);
  --sidebar-ring: oklch(0.704 0.04 256.788);
}

.dark {
  --background: oklch(0.129 0.042 264.695);
  --foreground: oklch(0.984 0.003 247.858);
  --card: oklch(0.208 0.042 265.755);
  --card-foreground: oklch(0.984 0.003 247.858);
  --popover: oklch(0.208 0.042 265.755);
  --popover-foreground: oklch(0.984 0.003 247.858);
  --primary: oklch(0.929 0.013 255.508);
  --primary-foreground: oklch(0.208 0.042 265.755);
  --secondary: oklch(0.279 0.041 260.031);
  --secondary-foreground: oklch(0.984 0.003 247.858);
  --muted: oklch(0.279 0.041 260.031);
  --muted-foreground: oklch(0.704 0.04 256.788);
  --accent: oklch(0.279 0.041 260.031);
  --accent-foreground: oklch(0.984 0.003 247.858);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.985 0 0);
  --border: oklch(1 0 0 / 10%);
  --input: oklch(1 0 0 / 15%);
  --ring: oklch(0.551 0.027 264.364);
  --chart-1: oklch(0.488 0.243 264.376);
  --chart-2: oklch(0.696 0.17 162.48);
  --chart-3: oklch(0.769 0.188 70.08);
  --chart-4: oklch(0.627 0.265 303.9);
  --chart-5: oklch(0.645 0.246 16.439);
  --sidebar: oklch(0.208 0.042 265.755);
  --sidebar-foreground: oklch(0.984 0.003 247.858);
  --sidebar-primary: oklch(0.488 0.243 264.376);
  --sidebar-primary-foreground: oklch(0.984 0.003 247.858);
  --sidebar-accent: oklch(0.279 0.041 260.031);
  --sidebar-accent-foreground: oklch(0.984 0.003 247.858);
  --sidebar-border: oklch(1 0 0 / 10%);
  --sidebar-input: oklch(1 0 0 / 15%);
  --sidebar-ring: oklch(0.551 0.027 264.364);
}
```

### Configuration Notes

- Components are added to your project via CLI and stored in `components/ui/`.
- Theming is driven entirely by CSS variables -- customize colors in `globals.css`.
- Dark mode is toggled by adding/removing the `dark` class on the root HTML element.
- shadcn/ui uses `oklch` color space for precise color definitions.
- The `--chart-*` variables are specifically designed for Recharts integration.

---

## 3. Recharts - `/recharts/recharts`

### Overview

A composable charting library built on React components and D3. Provides declarative chart components including LineChart, BarChart, AreaChart, and more, all with built-in responsiveness via `ResponsiveContainer`.

### Key Components and Patterns

#### ResponsiveContainer

Always wrap charts in `ResponsiveContainer` for automatic sizing. Three common patterns:

```jsx
import { LineChart, Line, ResponsiveContainer } from 'recharts';

const data = [
  { name: 'A', value: 100 },
  { name: 'B', value: 200 },
  { name: 'C', value: 150 }
];

// Full-width responsive chart
function ResponsiveChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// Fixed aspect ratio (width/height)
function AspectRatioChart() {
  return (
    <ResponsiveContainer width="100%" aspect={2}>
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}

// With min/max constraints
function ConstrainedChart() {
  return (
    <ResponsiveContainer
      width="100%"
      height="100%"
      minWidth={300}
      minHeight={200}
      maxHeight={400}
    >
      <LineChart data={data}>
        <Line type="monotone" dataKey="value" stroke="#8884d8" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

#### LineChart with Multiple Series

A complete line chart with grid, axes, tooltip, legend, and multiple data series:

```jsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

const data = [
  { name: 'Jan', uv: 4000, pv: 2400, amt: 2400 },
  { name: 'Feb', uv: 3000, pv: 1398, amt: 2210 },
  { name: 'Mar', uv: 2000, pv: 9800, amt: 2290 },
  { name: 'Apr', uv: 2780, pv: 3908, amt: 2000 },
  { name: 'May', uv: 1890, pv: 4800, amt: 2181 },
  { name: 'Jun', uv: 2390, pv: 3800, amt: 2500 }
];

function SimpleLineChart() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line
          type="monotone"
          dataKey="pv"
          stroke="#8884d8"
          activeDot={{ r: 8 }}
        />
        <Line
          type="monotone"
          dataKey="uv"
          stroke="#82ca9d"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

#### Custom Tooltip

Create a fully custom tooltip by passing a React component to the `content` prop:

```jsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const data = [
  { name: 'Jan', sales: 4000, profit: 2400 },
  { name: 'Feb', sales: 3000, profit: 1398 },
  { name: 'Mar', sales: 2000, profit: 9800 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{
        backgroundColor: 'white',
        padding: '10px',
        border: '1px solid #ccc'
      }}>
        <p style={{ margin: 0 }}>{`Date: ${label}`}</p>
        {payload.map((entry, index) => (
          <p key={index} style={{ color: entry.color, margin: '5px 0' }}>
            {`${entry.name}: $${entry.value.toLocaleString()}`}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

function ChartWithCustomTooltip() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: 'red', strokeWidth: 2 }}
        />
        <Line type="monotone" dataKey="sales" stroke="#8884d8" />
        <Line type="monotone" dataKey="profit" stroke="#82ca9d" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

#### Custom Legend Position and Layout

Control legend placement with `layout`, `align`, `verticalAlign`, and `wrapperStyle`:

```jsx
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Legend,
  ResponsiveContainer
} from 'recharts';

const data = [
  { name: 'A', uv: 4000, pv: 2400, amt: 2400 },
  { name: 'B', uv: 3000, pv: 1398, amt: 2210 },
  { name: 'C', uv: 2000, pv: 9800, amt: 2290 },
];

function CustomLegendPosition() {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <XAxis dataKey="name" />
        <YAxis />
        <Legend
          layout="vertical"
          align="right"
          verticalAlign="middle"
          wrapperStyle={{ paddingLeft: '20px' }}
        />
        <Line type="monotone" dataKey="pv" stroke="#8884d8" />
        <Line type="monotone" dataKey="uv" stroke="#82ca9d" />
      </LineChart>
    </ResponsiveContainer>
  );
}
```

#### BarChart with Styled Tooltip and Legend

```tsx
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';

const renderBarChart = (
  <BarChart width={600} height={300} data={data} margin={{ top: 5, right: 20, left: 10, bottom: 20 }}>
    <XAxis dataKey="name" stroke="#8884d8" />
    <YAxis />
    <Tooltip wrapperStyle={{ width: 100, backgroundColor: '#ccc' }} />
    <Legend
      width={100}
      wrapperStyle={{
        top: 40,
        right: 20,
        backgroundColor: '#f5f5f5',
        border: '1px solid #d5d5d5',
        borderRadius: 3,
        lineHeight: '40px'
      }}
    />
    <CartesianGrid stroke="#ccc" strokeDasharray="5 5" />
    <Bar dataKey="uv" fill="#8884d8" barSize={30} />
  </BarChart>
);
```

### Configuration Notes

- Always use `ResponsiveContainer` as the outermost wrapper for responsive charts.
- `ResponsiveContainer` requires a parent element with defined dimensions.
- `type="monotone"` on `<Line>` creates smooth curves; other options include `"linear"`, `"step"`, `"basis"`.
- Use `margin` prop on the chart component to control inner spacing.
- Use `activeDot={{ r: 8 }}` to enlarge the dot on hover.
- shadcn/ui provides `--chart-1` through `--chart-5` CSS variables for consistent chart colors.

---

## 4. Clerk Authentication - `/clerk/clerk-docs`

### Overview

Clerk provides drop-in authentication for Next.js with support for organizations, role-based access control, and multi-tenancy. Integration is primarily through middleware and React components.

### Key Usage Patterns

#### Basic Route Protection Middleware

Protect all routes except explicitly public ones using `clerkMiddleware` and `createRouteMatcher`:

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher(['/sign-in(.*)', '/sign-up(.*)'])

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    // Always run for API routes
    '/(api|trpc)(.*)',
  ],
}
```

#### Comprehensive Route Protection with Role-Based Access

Protect different route groups with different authorization levels -- public routes, authenticated-only routes, and admin routes with role checks:

```typescript
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)'
])

const isProtectedRoute = createRouteMatcher([
  '/dashboard(.*)',
  '/api/protected(.*)'
])

const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Protect all non-public routes
  if (!isPublicRoute(req)) {
    await auth.protect()
  }

  // Additional permission check for admin routes
  if (isAdminRoute(req)) {
    await auth.protect((has) => {
      return has({ role: 'org:admin' }) || has({ permission: 'org:admin:access' })
    })
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)'
  ]
}
```

#### Custom Redirect Logic for Unauthenticated Users

Use `auth().isAuthenticated` for more control before redirecting, allowing custom logic to run first:

```tsx
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/forum(.*)'])

export default clerkMiddleware(async (auth, req) => {
  const { isAuthenticated, redirectToSignIn } = await auth()

  if (!isAuthenticated && isProtectedRoute(req)) {
    // Add custom logic to run before redirecting

    return redirectToSignIn()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ]
}
```

#### Role-Based Route Protection (Dashboard + Admin)

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isDashboardRoute = createRouteMatcher(['/dashboard(.*)'])
const isAdminRoute = createRouteMatcher(['/admin(.*)'])

export default clerkMiddleware(async (auth, req) => {
  // Restrict admin route to users with specific Role
  if (isAdminRoute(req)) await auth.protect({ role: 'org:admin' })

  // Restrict dashboard routes to signed in users
  if (isDashboardRoute(req)) await auth.protect()
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

### Configuration Notes

- **Middleware file**: Must be at `middleware.ts` (or `.js`) in the project root (or `src/` directory).
- **`createRouteMatcher`**: Accepts an array of route patterns with glob-like syntax (e.g., `'/dashboard(.*)'`).
- **`auth.protect()`**: Automatically redirects unauthenticated users to the sign-in page. Returns a 401 for API routes.
- **`auth.protect({ role: 'org:admin' })`**: Checks for organization-level roles.
- **`auth.protect((has) => ...)`**: Accepts a callback for complex permission checks using `has()`.
- **`config.matcher`**: The standard Next.js middleware matcher pattern that skips static files and Next.js internals.
- **Multi-tenancy**: Use `org:` prefixed roles (e.g., `org:admin`) for organization-scoped permissions.
- **Public routes**: Always include sign-in/sign-up routes and webhook endpoints as public.

---

## 5. react-window - `/bvaughn/react-window`

### Overview

A lightweight library for efficiently rendering large lists and tabular data by only rendering visible items (windowing/virtualization). Essential for RemedyIQ's log viewer where datasets can contain millions of rows.

### Key Components and Patterns

#### List with Fixed Height Rows

The simplest usage -- a virtualized list where every row has the same height:

```tsx
import { List, type RowComponentProps } from "react-window";

function RowComponent({
  index,
  names,
  style
}: RowComponentProps<{
  names: string[];
}>) {
  return (
    <div style={style}>
      {names[index]} - Row {index + 1}
    </div>
  );
}

function App() {
  const names = Array.from({ length: 10000 }, (_, i) => `Item ${i}`);

  return (
    <div style={{ height: "400px" }}>
      <List
        rowComponent={RowComponent}
        rowCount={names.length}
        rowHeight={25}
        rowProps={{ names }}
        style={{ height: "100%", border: "1px solid #ccc" }}
      />
    </div>
  );
}
```

#### List with Variable Row Heights

Use a function for `rowHeight` to support rows of different sizes:

```tsx
import { List, type RowComponentProps } from "react-window";

function RowComponent({
  index,
  data,
  style
}: RowComponentProps<{
  data: Array<{ id: number; content: string; height: number }>;
}>) {
  return (
    <div style={style}>
      <strong>Item {data[index].id}</strong>
      <p>{data[index].content}</p>
    </div>
  );
}

function App() {
  const items = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    content: `Content for item ${i}`,
    height: 30 + (i % 5) * 10 // Varying heights: 30, 40, 50, 60, 70
  }));

  const getRowHeight = (index: number) => items[index].height;

  return (
    <div style={{ height: "600px" }}>
      <List
        rowComponent={RowComponent}
        rowCount={items.length}
        rowHeight={getRowHeight}
        rowProps={{ data: items }}
        style={{ height: "100%" }}
      />
    </div>
  );
}
```

#### List with Dynamic Row Heights

For rows whose height depends on content or user interactions (expand/collapse). Uses the `useDynamicRowHeight` hook and `ResizeObserver` for measurement:

```tsx
import { List, useDynamicRowHeight, type RowComponentProps } from "react-window";
import { useState, useMemo } from "react";

function DynamicRowComponent({
  index,
  listState,
  style
}: RowComponentProps<{
  listState: {
    getText: (index: number) => string;
    isRowCollapsed: (index: number) => boolean;
    toggleRow: (index: number) => void;
  };
}>) {
  const text = listState.getText(index);
  const isCollapsed = listState.isRowCollapsed(index);

  return (
    <div style={style}>
      <button onClick={() => listState.toggleRow(index)}>
        {isCollapsed ? "Expand" : "Collapse"}
      </button>
      {!isCollapsed && <p>{text}</p>}
    </div>
  );
}

function App() {
  const lorem = Array.from({ length: 100 }, (_, i) =>
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit. Row ${i}`
  );

  const [collapsedRows, setCollapsedRows] = useState<Set<number>>(new Set());

  const listState = useMemo(() => ({
    getText: (index: number) => lorem[index],
    isRowCollapsed: (index: number) => collapsedRows.has(index),
    toggleRow: (index: number) => {
      setCollapsedRows(prev => {
        const next = new Set(prev);
        next.has(index) ? next.delete(index) : next.add(index);
        return next;
      });
    }
  }), [lorem, collapsedRows]);

  const rowHeight = useDynamicRowHeight({
    defaultRowHeight: 50
  });

  return (
    <div style={{ height: "500px" }}>
      <List
        rowComponent={DynamicRowComponent}
        rowCount={lorem.length}
        rowHeight={rowHeight}
        rowProps={{ listState }}
        style={{ height: "100%" }}
      />
    </div>
  );
}
```

#### Grid Component for Tabular Data

A 2D grid with fixed cell dimensions, suitable for virtualized tables:

```tsx
import { Grid, type CellComponentProps } from "react-window";

interface Contact {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  company: string;
  title: string;
  address: string;
}

const columnHeaders = [
  "firstName", "lastName", "email", "phone", "city",
  "country", "company", "title", "address", "id"
] as const;

function CellComponent({
  contacts,
  columnIndex,
  rowIndex,
  style
}: CellComponentProps<{
  contacts: Contact[];
}>) {
  const contact = contacts[rowIndex];
  const columnKey = columnHeaders[columnIndex];
  const content = contact[columnKey];

  return (
    <div
      style={{
        ...style,
        borderRight: "1px solid #ddd",
        borderBottom: "1px solid #ddd",
        padding: "5px",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap"
      }}
    >
      {content}
    </div>
  );
}

function App() {
  const contacts: Contact[] = Array.from({ length: 1000 }, (_, i) => ({
    id: i,
    firstName: `First${i}`,
    lastName: `Last${i}`,
    email: `user${i}@example.com`,
    phone: `555-${String(i).padStart(4, "0")}`,
    city: `City${i % 50}`,
    country: `Country${i % 20}`,
    company: `Company${i % 100}`,
    title: `Title${i % 10}`,
    address: `${i} Main St`
  }));

  return (
    <div style={{ height: "600px", width: "100%" }}>
      <Grid
        cellComponent={CellComponent}
        cellProps={{ contacts }}
        columnCount={10}
        columnWidth={150}
        rowCount={contacts.length}
        rowHeight={25}
        style={{ height: "100%", border: "1px solid #ccc" }}
      />
    </div>
  );
}
```

#### Grid Callbacks: onCellsRendered and onResize

Monitor visible cells and respond to grid dimension changes:

```tsx
import { Grid, type CellComponentProps } from "react-window";
import { useState, useCallback } from "react";

function CellComponent({
  columnIndex,
  rowIndex,
  style
}: CellComponentProps<object>) {
  return (
    <div style={{ ...style, border: "1px solid #eee", padding: "4px" }}>
      [{rowIndex}, {columnIndex}]
    </div>
  );
}

function App() {
  const [visibleCells, setVisibleCells] = useState({
    rowStart: 0, rowStop: 0, colStart: 0, colStop: 0
  });

  const handleCellsRendered = useCallback((
    visibleCells: {
      rowStartIndex: number;
      rowStopIndex: number;
      columnStartIndex: number;
      columnStopIndex: number;
    },
    allCells: {
      rowStartIndex: number;
      rowStopIndex: number;
      columnStartIndex: number;
      columnStopIndex: number;
    }
  ) => {
    setVisibleCells({
      rowStart: visibleCells.rowStartIndex,
      rowStop: visibleCells.rowStopIndex,
      colStart: visibleCells.columnStartIndex,
      colStop: visibleCells.columnStopIndex
    });
    console.log("Visible cells:", visibleCells);
    console.log("All cells (with overscan):", allCells);
  }, []);

  const handleResize = useCallback((
    size: { height: number; width: number }
  ) => {
    console.log("Grid resized:", size);
  }, []);

  return (
    <div>
      <div>
        Visible: rows {visibleCells.rowStart}-{visibleCells.rowStop},
        cols {visibleCells.colStart}-{visibleCells.colStop}
      </div>
      <div style={{ height: "400px", width: "100%" }}>
        <Grid
          cellComponent={CellComponent}
          cellProps={{}}
          columnCount={20}
          columnWidth={100}
          rowCount={1000}
          rowHeight={30}
          onCellsRendered={handleCellsRendered}
          onResize={handleResize}
          overscanCount={3}
          style={{ height: "100%" }}
        />
      </div>
    </div>
  );
}
```

### Configuration Notes

- **Parent container must have defined dimensions** -- react-window does not auto-size; the parent `div` needs explicit `height` (and `width` for Grid).
- **`rowHeight`**: Can be a number (fixed) or a function `(index: number) => number` (variable).
- **`rowComponent`** / **`cellComponent`**: Must accept and apply the `style` prop for positioning.
- **`rowProps`** / **`cellProps`**: Pass additional data to row/cell components (avoids putting data in context or closures).
- **`overscanCount`**: Number of extra items to render outside the visible area (default varies; 3 is a good value for smooth scrolling).
- **`useDynamicRowHeight`**: Hook for rows whose height is determined by content after rendering.
- **Grid vs List**: Use `List` for single-column virtualization, `Grid` for 2D tabular data.
- For RemedyIQ's log viewer, `List` with variable row heights is ideal for log entries, while `Grid` is suitable for structured tabular views (SQL queries, API calls).
