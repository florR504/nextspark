/**
 * PageRenderer Component — Async Server Component with RSC Streaming
 *
 * Renders pages from the Page Builder using async dynamic imports
 * per block, wrapped in Suspense boundaries for streaming SSR.
 *
 * How it works:
 * 1. Each block is loaded via `loadBlockSSR(slug)` — an async import
 * 2. React Server Components resolve the import on the server
 * 3. Suspense boundaries let React stream HTML progressively
 * 4. Client receives complete HTML (zero CLS, SEO-safe)
 * 5. Only JS chunks for blocks actually on the page are sent to client
 *
 * This gives per-block code splitting WITHOUT the CLS issues of next/dynamic,
 * because the server fully resolves each block before flushing the HTML.
 *
 * @module core/components/public/pageBuilder
 */

import { Suspense } from 'react'
import type { BlockInstance } from '../../../types/blocks'
import { loadBlockSSR, normalizeBlockProps } from '../../../lib/blocks/loader'

// Error display for missing blocks
function BlockError({ blockSlug }: { blockSlug: string }) {
  return (
    <div className="w-full py-12 px-4 bg-destructive/10 border border-destructive/20 rounded">
      <div className="max-w-7xl mx-auto text-center">
        <p className="text-destructive">
          Failed to load block: <code className="font-mono">{blockSlug}</code>
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          This block may not be available or there was an error rendering it.
        </p>
      </div>
    </div>
  )
}

/**
 * Async Server Component — resolves block import on the server,
 * renders HTML, and streams it to the client via Suspense.
 */
async function BlockRenderer({ block }: { block: BlockInstance }) {
  const BlockComponent = await loadBlockSSR(block.blockSlug)

  if (!BlockComponent) {
    console.warn(`Block component not found for slug: ${block.blockSlug}`)
    return <BlockError blockSlug={block.blockSlug} />
  }

  // Normalize props to convert dot-notation to nested objects
  const normalizedProps = normalizeBlockProps(block.props)

  return <BlockComponent {...normalizedProps} />
}

export interface PageRendererProps {
  page: {
    id: string
    title: string
    slug: string
    blocks: BlockInstance[]
    locale: string
  }
}

export function PageRenderer({ page }: PageRendererProps) {
  // Ensure blocks is an array
  const blocks = Array.isArray(page.blocks) ? page.blocks : []

  if (blocks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/10">
        <div className="text-center max-w-md mx-auto px-4">
          <h1 className="text-2xl font-bold mb-2">{page.title}</h1>
          <p className="text-muted-foreground">
            This page does not have any content yet.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen" data-page-id={page.id} data-page-slug={page.slug}>
      {blocks.map((block) => (
        <div
          key={block.id}
          className="@container w-full"
          data-block-id={block.id}
          data-block-slug={block.blockSlug}
        >
          <Suspense>
            <BlockRenderer block={block} />
          </Suspense>
        </div>
      ))}
    </div>
  )
}
