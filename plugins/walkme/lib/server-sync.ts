'use client'

/**
 * WalkMe Server Sync
 *
 * Client-side helpers for syncing tour state with the server.
 * All operations are fire-and-forget — failures never block the UI.
 *
 * IMPORTANT: This module is theme-agnostic. The API URL is injected
 * by the consumer (theme) — the plugin never hardcodes theme paths.
 */

import type { StorageSchema } from '../types/walkme.types'

/** Subset of StorageSchema that gets persisted to the server */
export interface ServerState {
  completedTours: string[]
  skippedTours: string[]
  tourHistory: Record<string, unknown>
  visitCount: number
  firstVisitDate: string
}

/**
 * Fetch the user's tour state from the server.
 * Returns null if no state exists or on any error.
 */
export async function fetchServerState(apiUrl: string): Promise<ServerState | null> {
  try {
    const res = await fetch(apiUrl, { credentials: 'include' })
    if (!res.ok) return null

    const json = await res.json()
    if (!json.success || !json.data) return null

    return json.data as ServerState
  } catch {
    return null
  }
}

/**
 * Save the user's tour state to the server.
 * Fire-and-forget — errors are silently ignored.
 */
export async function saveServerState(apiUrl: string, state: ServerState): Promise<void> {
  try {
    await fetch(apiUrl, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(state),
    })
  } catch {
    // Silent failure — localStorage is the primary store
  }
}

/**
 * Merge local state with server state.
 * Strategy: union of completed/skipped arrays, local active tour preserved.
 * Server tourHistory entries fill gaps (local wins on conflict).
 */
export function mergeStates(
  local: StorageSchema,
  server: ServerState,
): { completedTours: string[]; skippedTours: string[]; tourHistory: Record<string, unknown> } {
  return {
    completedTours: [...new Set([...local.completedTours, ...server.completedTours])],
    skippedTours: [...new Set([...local.skippedTours, ...server.skippedTours])],
    tourHistory: { ...server.tourHistory, ...local.tourHistory },
  }
}
