'use client'

import { useReducer, useEffect, useRef, useCallback, useState } from 'react'
import type { Tour, TourState, WalkmeState, WalkmeAction } from '../types/walkme.types'
import { createInitialState, walkmeReducer } from '../lib/core'
import { createStorageAdapter } from '../lib/storage'
import { fetchServerState, saveServerState, mergeStates } from '../lib/server-sync'

interface UseTourStateOptions {
  persistState: boolean
  debug: boolean
  userId?: string
  /** API URL for server-side persistence. If omitted, server sync is disabled. */
  serverSyncUrl?: string
}

/**
 * Internal hook that manages the core WalkMe state machine.
 * Handles useReducer, localStorage persistence, server sync, and initial state loading.
 *
 * Hybrid persistence strategy:
 * 1. localStorage is the primary store (instant reads, no flash)
 * 2. Server (users_metas) is the durable backup (cross-device sync)
 * 3. On mount: load localStorage first, then merge server state in background
 * 4. On change: save to localStorage immediately, debounced save to server
 * 5. Server saves are BLOCKED until the initial server fetch completes
 *    (prevents empty local state from overwriting server data on new devices)
 */
export function useTourState(tours: Tour[], options: UseTourStateOptions) {
  const { persistState, debug, userId, serverSyncUrl } = options
  const [state, dispatch] = useReducer(walkmeReducer, createInitialState())
  const storageRef = useRef(createStorageAdapter(userId))
  const initialized = useRef(false)
  const prevUserIdRef = useRef(userId)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const serverDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Whether the initial server fetch has been kicked off
  const serverSyncStartedRef = useRef(false)
  // Whether the initial server fetch has resolved — server saves are blocked until true
  const serverSyncDoneRef = useRef(false)
  // Reactive flag: true while waiting for initial server fetch.
  // Used by WalkmeProvider to delay auto-trigger evaluation on fresh devices
  // so tours don't flash for ~1s before server state cancels them.
  // CRITICAL: Must initialize to true when server sync will happen so the FIRST
  // render already blocks triggers (setState from effects is too late).
  const [serverSyncPending, setServerSyncPending] = useState(
    () => Boolean(persistState && userId && serverSyncUrl),
  )

  // Re-create storage adapter when userId changes (e.g. session loads async)
  useEffect(() => {
    if (prevUserIdRef.current === userId) return
    prevUserIdRef.current = userId
    storageRef.current = createStorageAdapter(userId)
    serverSyncStartedRef.current = false
    serverSyncDoneRef.current = false
    // If new userId exists and serverSyncUrl is configured, set pending.
    // If userId cleared (logout), set to false to unblock triggers.
    setServerSyncPending(Boolean(persistState && userId && serverSyncUrl))

    // Re-restore persisted state from the new user-scoped storage
    if (persistState) {
      const saved = storageRef.current.load()
      if (saved) {
        dispatch({
          type: 'RESTORE_STATE',
          completedTours: saved.completedTours,
          skippedTours: saved.skippedTours,
          tourHistory: saved.tourHistory,
          activeTour: saved.activeTour,
        })
      } else {
        // New user with no state — reset to clean slate
        dispatch({ type: 'RESET_ALL' })
      }
    }
  }, [userId, persistState])

  // Initialize tours and restore persisted state on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Initialize with tour definitions
    dispatch({ type: 'INITIALIZE', tours })

    if (debug) {
      dispatch({ type: 'SET_DEBUG', enabled: true })
    }

    // Restore persisted state from localStorage (instant, no flash)
    if (persistState) {
      const storage = storageRef.current
      const saved = storage.load()

      if (saved) {
        storage.incrementVisitCount()

        dispatch({
          type: 'RESTORE_STATE',
          completedTours: saved.completedTours,
          skippedTours: saved.skippedTours,
          tourHistory: saved.tourHistory,
          activeTour: saved.activeTour,
        })
      } else {
        // First visit - initialize storage
        storage.incrementVisitCount()
        storage.setFirstVisitDate(new Date().toISOString())
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Background server sync: fetch server state and merge with local.
  // Runs once per userId after local state is restored.
  // Server saves are blocked until this completes to prevent empty local
  // state from overwriting valid server data on a new device/browser.
  // Auto-trigger evaluation in WalkmeProvider is also delayed via
  // serverSyncPending so tours don't flash before server state arrives.
  useEffect(() => {
    if (!persistState || !userId || !serverSyncUrl || !state.initialized) return
    if (serverSyncStartedRef.current) return
    serverSyncStartedRef.current = true
    setServerSyncPending(true)

    fetchServerState(serverSyncUrl)
      .then((serverState) => {
        if (!serverState) return

        const local = storageRef.current.load()
        if (!local) return

        const merged = mergeStates(local, serverState)

        // Only dispatch if server had data the local store didn't
        const hasNewCompleted = merged.completedTours.length > state.completedTours.length
        const hasNewSkipped = merged.skippedTours.length > state.skippedTours.length

        if (hasNewCompleted || hasNewSkipped) {
          dispatch({
            type: 'RESTORE_STATE',
            completedTours: merged.completedTours,
            skippedTours: merged.skippedTours,
            tourHistory: merged.tourHistory as Record<string, TourState>,
            // Cancel any active tour that was already completed/skipped on server
            activeTour: null,
          })
        }
      })
      .finally(() => {
        // Unblock server saves and auto-trigger evaluation
        serverSyncDoneRef.current = true
        setServerSyncPending(false)
      })
  }, [persistState, userId, serverSyncUrl, state.initialized]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-register tour definitions when they change after initialization.
  // This handles the case where tours arrive asynchronously (e.g. after API fetch)
  // and the provider was already mounted with an empty tours array.
  useEffect(() => {
    if (!initialized.current) return
    if (tours.length === 0) return
    dispatch({ type: 'UPDATE_TOURS', tours })
  }, [tours]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist state changes to localStorage (100ms debounce) + server (500ms debounce)
  useEffect(() => {
    if (!persistState || !state.initialized) return

    // --- localStorage save (fast, 100ms debounce) ---
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      const storage = storageRef.current
      const existing = storage.load()

      storage.save({
        version: 1,
        completedTours: state.completedTours,
        skippedTours: state.skippedTours,
        activeTour: state.activeTour,
        tourHistory: state.tourHistory,
        visitCount: existing?.visitCount ?? 1,
        firstVisitDate: existing?.firstVisitDate ?? new Date().toISOString(),
      })
    }, 100)

    // --- Server save (slower, 500ms debounce, only durable fields) ---
    // BLOCKED until initial server sync is done to prevent overwriting
    // valid server data with empty local state on a fresh browser.
    if (userId && serverSyncUrl && serverSyncDoneRef.current) {
      if (serverDebounceRef.current) {
        clearTimeout(serverDebounceRef.current)
      }

      const url = serverSyncUrl
      serverDebounceRef.current = setTimeout(() => {
        const existing = storageRef.current.load()

        saveServerState(url, {
          completedTours: state.completedTours,
          skippedTours: state.skippedTours,
          tourHistory: state.tourHistory,
          visitCount: existing?.visitCount ?? 1,
          firstVisitDate: existing?.firstVisitDate ?? new Date().toISOString(),
        })
      }, 500)
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
      if (serverDebounceRef.current) {
        clearTimeout(serverDebounceRef.current)
      }
    }
  }, [
    persistState,
    userId,
    state.initialized,
    state.completedTours,
    state.skippedTours,
    state.activeTour,
    state.tourHistory,
  ])

  const stableDispatch = useCallback(
    (action: WalkmeAction) => {
      if (debug) {
        console.log('[WalkMe]', action.type, action)
      }
      dispatch(action)
    },
    [debug],
  )

  return {
    state,
    dispatch: stableDispatch,
    storage: storageRef.current,
    /** True while waiting for initial server state fetch (blocks auto-trigger) */
    serverSyncPending,
  }
}
