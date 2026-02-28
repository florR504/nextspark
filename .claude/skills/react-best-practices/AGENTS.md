# React Best Practices

**Version 1.0.0** — Vercel Engineering, January 2026

> Performance optimization guide for React and Next.js, designed for AI agents. 40+ rules across 8 categories, prioritized by impact.

---

## Table of Contents

1. [Eliminating Waterfalls](#1-eliminating-waterfalls) — **CRITICAL**
2. [Bundle Size Optimization](#2-bundle-size-optimization) — **CRITICAL**
3. [Server-Side Performance](#3-server-side-performance) — **HIGH**
4. [Client-Side Data Fetching](#4-client-side-data-fetching) — **MEDIUM-HIGH**
5. [Re-render Optimization](#5-re-render-optimization) — **MEDIUM**
6. [Rendering Performance](#6-rendering-performance) — **MEDIUM**
7. [JavaScript Performance](#7-javascript-performance) — **LOW-MEDIUM**
8. [Advanced Patterns](#8-advanced-patterns) — **LOW**

---

## 1. Eliminating Waterfalls — CRITICAL

Waterfalls are the #1 performance killer. Each sequential await adds full network latency.

### 1.1 Defer Await Until Needed (HIGH)

Move `await` into branches where actually used. Check conditions and early-return BEFORE awaiting expensive operations.

```typescript
async function handleRequest(userId: string, skipProcessing: boolean) {
  if (skipProcessing) return { skipped: true }  // No await needed
  const userData = await fetchUserData(userId)   // Only fetch when needed
  return processUserData(userData)
}
```

### 1.2 Dependency-Based Parallelization (CRITICAL, 2-10x)

Use `better-all` for operations with partial dependencies — automatically starts each task at earliest moment.

```typescript
import { all } from 'better-all'
const { user, config, profile } = await all({
  async user() { return fetchUser() },
  async config() { return fetchConfig() },
  async profile() { return fetchProfile((await this.$.user).id) }
})
// config runs parallel to user; profile starts as soon as user resolves
```

### 1.3 Prevent Waterfall Chains in API Routes (CRITICAL, 2-10x)

Start independent operations immediately, await later.

```typescript
export async function GET(request: Request) {
  const sessionPromise = auth()
  const configPromise = fetchConfig()
  const session = await sessionPromise
  const [config, data] = await Promise.all([configPromise, fetchData(session.user.id)])
  return Response.json({ data, config })
}
```

### 1.4 Promise.all() for Independent Operations (CRITICAL, 2-10x)

When async operations have no interdependencies, execute concurrently.

```typescript
const [user, posts, comments] = await Promise.all([fetchUser(), fetchPosts(), fetchComments()])
```

### 1.5 Strategic Suspense Boundaries (HIGH)

Use Suspense to show wrapper UI faster while data loads. Move data fetching into child async components.

```tsx
function Page() {
  return (
    <div>
      <Sidebar />
      <Header />
      <Suspense fallback={<Skeleton />}>
        <DataDisplay />  {/* Only this waits for data */}
      </Suspense>
      <Footer />
    </div>
  )
}
async function DataDisplay() {
  const data = await fetchData()
  return <div>{data.content}</div>
}
```

Share promises across components with `use()`:
```tsx
function Page() {
  const dataPromise = fetchData()
  return (
    <Suspense fallback={<Skeleton />}>
      <DataDisplay dataPromise={dataPromise} />
      <DataSummary dataPromise={dataPromise} />
    </Suspense>
  )
}
function DataDisplay({ dataPromise }: { dataPromise: Promise<Data> }) {
  const data = use(dataPromise)
  return <div>{data.content}</div>
}
```

**Skip when:** SEO-critical above-fold content, small fast queries, layout-affecting data.

---

## 2. Bundle Size Optimization — CRITICAL

Reducing initial bundle improves TTI and LCP.

### 2.1 Avoid Barrel File Imports (CRITICAL, 200-800ms)

Import directly from source files. Barrel files load thousands of unused modules (10,000+ re-exports in icon libraries).

```tsx
// Direct imports — loads only what you need
import Check from 'lucide-react/dist/esm/icons/check'
import Button from '@mui/material/Button'

// Or use Next.js optimizePackageImports:
// next.config.js: experimental: { optimizePackageImports: ['lucide-react'] }
```

Affected: `lucide-react`, `@mui/material`, `@tabler/icons-react`, `react-icons`, `lodash`, `date-fns`, `rxjs`.

### 2.2 Conditional Module Loading (HIGH)

Load large modules only when feature is activated.

```tsx
useEffect(() => {
  if (enabled && !frames && typeof window !== 'undefined') {
    import('./animation-frames.js').then(mod => setFrames(mod.frames))
  }
}, [enabled, frames])
```

### 2.3 Defer Non-Critical Third-Party Libraries (MEDIUM)

Analytics, logging, error tracking — load after hydration with `dynamic(() => ..., { ssr: false })`.

### 2.4 Dynamic Imports for Heavy Components (CRITICAL)

Use `next/dynamic` for large components not needed on initial render (Monaco, charts, etc.).

```tsx
const MonacoEditor = dynamic(() => import('./monaco-editor').then(m => m.MonacoEditor), { ssr: false })
```

### 2.5 Preload Based on User Intent (MEDIUM)

Preload heavy bundles on hover/focus before click:

```tsx
<button onMouseEnter={() => void import('./monaco-editor')} onFocus={() => void import('./monaco-editor')} onClick={onClick}>
  Open Editor
</button>
```

---

## 3. Server-Side Performance — HIGH

### 3.1 Cross-Request LRU Caching (HIGH)

`React.cache()` is per-request only. Use LRU cache for data shared across sequential requests.

```typescript
import { LRUCache } from 'lru-cache'
const cache = new LRUCache<string, any>({ max: 1000, ttl: 5 * 60 * 1000 })
export async function getUser(id: string) {
  const cached = cache.get(id)
  if (cached) return cached
  const user = await db.user.findUnique({ where: { id } })
  cache.set(id, user)
  return user
}
```

### 3.2 Minimize Serialization at RSC Boundaries (HIGH)

Only pass fields the client actually uses across Server/Client boundary. Don't serialize 50-field objects when client uses 1 field.

```tsx
// Pass only what's needed
async function Page() {
  const user = await fetchUser()
  return <Profile name={user.name} />  // Not <Profile user={user} />
}
```

### 3.3 Parallel Data Fetching with Component Composition (CRITICAL)

RSCs execute sequentially within a tree. Restructure with composition to parallelize:

```tsx
// Both fetch simultaneously — no parent blocking child
async function Header() { const data = await fetchHeader(); return <div>{data}</div> }
async function Sidebar() { const items = await fetchSidebarItems(); return <nav>{items.map(renderItem)}</nav> }
export default function Page() {
  return <div><Header /><Sidebar /></div>
}
```

### 3.4 Per-Request Deduplication with React.cache() (MEDIUM)

```typescript
import { cache } from 'react'
export const getCurrentUser = cache(async () => {
  const session = await auth()
  if (!session?.user?.id) return null
  return await db.user.findUnique({ where: { id: session.user.id } })
})
```

**Important:** `React.cache()` uses `Object.is` — avoid inline objects as arguments (always cache miss). Pass same reference or primitive values.

### 3.5 Use after() for Non-Blocking Operations (MEDIUM)

Schedule work after response is sent — logging, analytics, notifications.

```typescript
import { after } from 'next/server'
export async function POST(request: Request) {
  await updateDatabase(request)
  after(async () => { logUserAction({ userAgent: (await headers()).get('user-agent') }) })
  return Response.json({ status: 'success' })
}
```

---

## 4. Client-Side Data Fetching — MEDIUM-HIGH

### 4.1 Deduplicate Global Event Listeners (LOW)

Use `useSWRSubscription()` to share one listener across N component instances.

### 4.2 Use Passive Event Listeners (MEDIUM)

Add `{ passive: true }` to touch/wheel listeners for immediate scrolling. Only skip when you need `preventDefault()`.

### 4.3 Use SWR/TanStack Query for Deduplication (MEDIUM-HIGH)

Automatic request deduplication, caching, revalidation across components.

```tsx
const { data: users } = useSWR('/api/users', fetcher)
```

### 4.4 Version and Minimize localStorage Data (MEDIUM)

Add version prefix to keys, store only needed fields, always wrap in try-catch (throws in incognito).

```typescript
const VERSION = 'v2'
function saveConfig(config: { theme: string }) {
  try { localStorage.setItem(`userConfig:${VERSION}`, JSON.stringify(config)) } catch {}
}
```

---

## 5. Re-render Optimization — MEDIUM

### 5.1 Defer State Reads to Usage Point (MEDIUM)

Don't subscribe to `useSearchParams()` if you only read it in callbacks. Read on demand instead:

```tsx
const handleShare = () => {
  const ref = new URLSearchParams(window.location.search).get('ref')
  shareChat(chatId, { ref })
}
```

### 5.2 Extract to Memoized Components (MEDIUM)

Extract expensive work into `memo()` components so early returns skip computation.

### 5.3 Narrow Effect Dependencies (LOW)

Use primitives (`user.id`) instead of objects (`user`) in dependency arrays.

### 5.4 Subscribe to Derived State (MEDIUM)

Subscribe to `useMediaQuery('(max-width: 767px)')` instead of `useWindowWidth()` — re-renders only on boolean change, not every pixel.

### 5.5 Use Functional setState Updates (MEDIUM)

Prevents stale closures and eliminates dependencies:

```tsx
setItems(curr => [...curr, ...newItems])     // Not setItems([...items, ...newItems])
setItems(curr => curr.filter(i => i.id !== id)) // Not setItems(items.filter(...))
```

### 5.6 Use Lazy State Initialization (MEDIUM)

Pass function to `useState` for expensive initial values:

```tsx
const [index] = useState(() => buildSearchIndex(items))  // Runs once
// NOT: useState(buildSearchIndex(items))  // Runs every render
```

### 5.7 Use Transitions for Non-Urgent Updates (MEDIUM)

Wrap frequent non-urgent updates in `startTransition()`:

```tsx
const handler = () => startTransition(() => setScrollY(window.scrollY))
```

---

## 6. Rendering Performance — MEDIUM

### 6.1 Animate SVG Wrapper Instead of SVG Element (LOW)

Wrap SVG in `<div>` and animate the wrapper for hardware acceleration.

### 6.2 CSS content-visibility for Long Lists (HIGH)

```css
.message-item { content-visibility: auto; contain-intrinsic-size: 0 80px; }
```

For 1000 items, browser skips layout/paint for ~990 off-screen items.

### 6.3 Hoist Static JSX Elements (LOW)

Extract static JSX outside components to module scope to avoid re-creation.

### 6.4 Optimize SVG Precision (LOW)

Reduce coordinate precision: `npx svgo --precision=1 --multipass icon.svg`

### 6.5 Prevent Hydration Mismatch Without Flickering (MEDIUM)

Inject synchronous `<script>` that reads localStorage and updates DOM before React hydrates.

### 6.6 Use Activity Component for Show/Hide (MEDIUM)

```tsx
import { Activity } from 'react'
<Activity mode={isOpen ? 'visible' : 'hidden'}><ExpensiveMenu /></Activity>
```

Preserves state/DOM, avoids expensive re-renders.

### 6.7 Use Explicit Conditional Rendering (LOW)

Use ternary `count > 0 ? <Badge /> : null` instead of `count && <Badge />` — avoids rendering `0`.

---

## 7. JavaScript Performance — LOW-MEDIUM

### 7.1 Batch DOM CSS Changes (MEDIUM)

Use `classList.add()` or `cssText` instead of setting individual `style.*` properties (reduces reflows).

### 7.2 Build Index Maps for Repeated Lookups (LOW-MEDIUM)

```typescript
const userById = new Map(users.map(u => [u.id, u]))
orders.map(o => ({ ...o, user: userById.get(o.userId) }))
```

Build map once O(n), all lookups O(1). For 1000x1000: 1M ops -> 2K ops.

### 7.3 Cache Property Access in Loops (LOW-MEDIUM)

Cache `obj.config.settings.value` before loop, not inside each iteration.

### 7.4 Cache Repeated Function Calls (MEDIUM)

Use module-level Map for pure functions called repeatedly with same inputs (works outside components).

### 7.5 Cache Storage API Calls (LOW-MEDIUM)

Cache `localStorage`/`sessionStorage`/`document.cookie` reads in memory Map. Invalidate on `storage` event and `visibilitychange`.

### 7.6 Combine Multiple Array Iterations (LOW-MEDIUM)

Replace multiple `.filter()` calls with single loop that fills multiple arrays.

### 7.7 Early Length Check for Array Comparisons (MEDIUM-HIGH)

Check `a.length !== b.length` before expensive sort/compare operations.

### 7.8 Early Return from Functions (LOW-MEDIUM)

Return immediately when result is determined instead of processing remaining items.

### 7.9 Hoist RegExp Creation (LOW-MEDIUM)

Move RegExp to module scope or `useMemo`. Note: global regex `/g` has mutable `lastIndex` state.

### 7.10 Use Loop for Min/Max Instead of Sort (LOW)

Single O(n) pass instead of O(n log n) sort when only finding min/max.

### 7.11 Use Set/Map for O(1) Lookups (LOW-MEDIUM)

`new Set(ids).has(id)` instead of `ids.includes(id)` for repeated membership checks.

### 7.12 Use toSorted() Instead of sort() (MEDIUM-HIGH)

`.sort()` mutates arrays — breaks React immutability model. Use `.toSorted()` (or `[...arr].sort()`).

Also: `.toReversed()`, `.toSpliced()`, `.with()` for immutable operations.

---

## 8. Advanced Patterns — LOW

### 8.1 Store Event Handlers in Refs (LOW)

Use `useEffectEvent` (React) for stable subscriptions that always call latest handler:

```tsx
function useWindowEvent(event: string, handler: () => void) {
  const onEvent = useEffectEvent(handler)
  useEffect(() => {
    window.addEventListener(event, onEvent)
    return () => window.removeEventListener(event, onEvent)
  }, [event])
}
```

### 8.2 useLatest for Stable Callback Refs (LOW)

Access latest values in callbacks without adding to dependency arrays:

```typescript
function useLatest<T>(value: T) {
  const ref = useRef(value)
  useEffect(() => { ref.current = value }, [value])
  return ref
}
```

---

## References

1. [react.dev](https://react.dev)
2. [nextjs.org](https://nextjs.org)
3. [swr.vercel.app](https://swr.vercel.app)
4. [github.com/shuding/better-all](https://github.com/shuding/better-all)
5. [github.com/isaacs/node-lru-cache](https://github.com/isaacs/node-lru-cache)
6. [vercel.com/blog/how-we-optimized-package-imports-in-next-js](https://vercel.com/blog/how-we-optimized-package-imports-in-next-js)
