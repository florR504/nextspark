/**
 * Translation Service
 *
 * Provides translation query and loading operations.
 * Uses pre-computed data from translation-registry for O(1) operations.
 *
 * @module TranslationService
 */

import {
  THEME_TRANSLATION_LOADERS,
  ENTITY_TRANSLATION_LOADERS,
  PLUGIN_ENTITY_TRANSLATION_LOADERS,
  TranslationLoader
} from '@nextsparkjs/registries/translation-registry'

/**
 * Translation Service - Provides runtime translation queries
 *
 * This service layer abstracts translation registry access, making the registry
 * a pure data structure (Data-Only pattern). All query logic lives here.
 *
 * Performance: All operations are O(1) or O(n) with zero I/O.
 */
export class TranslationService {
  /**
   * Get theme translation loader function
   * Returns a lazy-loading function (doesn't load until called)
   *
   * @param theme - Theme name (e.g., 'default')
   * @param locale - Locale code (e.g., 'en', 'es')
   * @returns Lazy-loading function or null if not found
   *
   * @example
   * ```typescript
   * const loader = TranslationService.getLoader('default', 'en')
   * if (loader) {
   *   const translations = await loader()
   * }
   * ```
   */
  static getLoader(theme: string, locale: string): TranslationLoader | null {
    const themeLoaders = THEME_TRANSLATION_LOADERS[theme]
    if (!themeLoaders) return null
    return themeLoaders[locale] || null
  }

  /**
   * Load theme translation (executes the loader)
   * Convenience wrapper that calls the loader function
   *
   * @param theme - Theme name
   * @param locale - Locale code
   * @returns Translation data or empty object if not found
   *
   * @example
   * ```typescript
   * const translations = await TranslationService.load('default', 'en')
   * // Returns translation object or {} if not found
   * ```
   */
  static async load(theme: string, locale: string): Promise<Record<string, unknown>> {
    const loader = this.getLoader(theme, locale)
    if (!loader) return {} as Record<string, unknown>

    try {
      const result = await loader()
      return (result.default || result) as Record<string, unknown>
    } catch (error) {
      console.error(`[TranslationService] Failed to load theme translation for ${theme}/${locale}:`, error)
      return {} as Record<string, unknown>
    }
  }

  /**
   * Get available locales for a theme
   *
   * @param theme - Theme name
   * @returns Array of locale codes
   *
   * @example
   * ```typescript
   * const locales = TranslationService.getLocales('default')
   * // Returns ['en', 'es']
   * ```
   */
  static getLocales(theme: string): string[] {
    const themeLoaders = THEME_TRANSLATION_LOADERS[theme]
    if (!themeLoaders) return []
    return Object.keys(themeLoaders)
  }

  /**
   * Get all themes with translations
   *
   * @returns Array of theme names
   *
   * @example
   * ```typescript
   * const themes = TranslationService.getThemes()
   * // Returns ['default']
   * ```
   */
  static getThemes(): string[] {
    return Object.keys(THEME_TRANSLATION_LOADERS)
  }

  /**
   * Check if theme has translation for locale
   *
   * @param theme - Theme name
   * @param locale - Locale code
   * @returns True if translation exists
   *
   * @example
   * ```typescript
   * if (TranslationService.has('default', 'en')) {
   *   // Translation exists, safe to load
   * }
   * ```
   */
  static has(theme: string, locale: string): boolean {
    return !!this.getLoader(theme, locale)
  }

  // ============================================
  // Entity Translation Methods
  // ============================================

  /**
   * Get entity translation loader function
   * Returns a lazy-loading function (doesn't load until called)
   *
   * @param theme - Theme name (e.g., 'default')
   * @param entity - Entity name (e.g., 'products', 'blog')
   * @param locale - Locale code (e.g., 'en', 'es')
   * @returns Lazy-loading function or null if not found
   *
   * @example
   * ```typescript
   * const loader = TranslationService.getEntityLoader('default', 'products', 'en')
   * if (loader) {
   *   const translations = await loader()
   * }
   * ```
   */
  static getEntityLoader(theme: string, entity: string, locale: string): TranslationLoader | null {
    const themeEntities = ENTITY_TRANSLATION_LOADERS[theme]
    if (!themeEntities) return null

    const entityLoaders = themeEntities[entity]
    if (!entityLoaders) return null

    return entityLoaders[locale] || null
  }

  /**
   * Load entity translation (executes the loader)
   * Convenience wrapper that calls the loader function
   *
   * @param theme - Theme name
   * @param entity - Entity name
   * @param locale - Locale code
   * @returns Translation data or empty object if not found
   *
   * @example
   * ```typescript
   * const translations = await TranslationService.loadEntity('default', 'products', 'en')
   * // Returns translation object or {} if not found
   * ```
   */
  static async loadEntity(theme: string, entity: string, locale: string): Promise<Record<string, unknown>> {
    // Load plugin translations as base (fallback)
    const pluginBase = await this.loadPluginEntityFallback(entity, locale)

    const loader = this.getEntityLoader(theme, entity, locale)
    if (!loader) return pluginBase

    try {
      const result = await loader()
      const themeTranslations = (result.default || result) as Record<string, unknown>
      // Deep merge: plugin is base, theme overrides
      return this.deepMerge(pluginBase, themeTranslations)
    } catch (error) {
      console.error(`[TranslationService] Failed to load entity translation for ${theme}/${entity}/${locale}:`, error)
      return pluginBase
    }
  }

  /**
   * Load plugin entity translation as fallback
   * Searches all plugins for an entity with the given name and locale
   *
   * @param entity - Entity name (e.g., 'leadforms')
   * @param locale - Locale code (e.g., 'en', 'es')
   * @returns Merged plugin translations or empty object
   */
  private static async loadPluginEntityFallback(entity: string, locale: string): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {}

    for (const pluginName of Object.keys(PLUGIN_ENTITY_TRANSLATION_LOADERS)) {
      const entityLoaders = PLUGIN_ENTITY_TRANSLATION_LOADERS[pluginName]?.[entity]
      const loader = entityLoaders?.[locale]
      if (!loader) continue

      try {
        const data = await loader()
        const translations = (data.default || data) as Record<string, unknown>
        Object.assign(result, this.deepMerge(result, translations))
      } catch (error) {
        console.error(`[TranslationService] Failed to load plugin entity translation for ${pluginName}/${entity}/${locale}:`, error)
      }
    }

    return result
  }

  /**
   * Deep merge two objects. Values in `override` take priority over `base`.
   * Only plain objects are merged recursively; other values are replaced.
   */
  private static deepMerge(
    base: Record<string, unknown>,
    override: Record<string, unknown>
  ): Record<string, unknown> {
    const result = { ...base }
    for (const key of Object.keys(override)) {
      const baseVal = result[key]
      const overrideVal = override[key]
      if (
        baseVal !== null &&
        overrideVal !== null &&
        typeof baseVal === 'object' &&
        typeof overrideVal === 'object' &&
        !Array.isArray(baseVal) &&
        !Array.isArray(overrideVal)
      ) {
        result[key] = this.deepMerge(
          baseVal as Record<string, unknown>,
          overrideVal as Record<string, unknown>
        )
      } else {
        result[key] = overrideVal
      }
    }
    return result
  }

  /**
   * Get available locales for an entity in a theme
   *
   * @param theme - Theme name
   * @param entity - Entity name
   * @returns Array of locale codes
   *
   * @example
   * ```typescript
   * const locales = TranslationService.getEntityLocales('default', 'products')
   * // Returns ['en', 'es']
   * ```
   */
  static getEntityLocales(theme: string, entity: string): string[] {
    const themeEntities = ENTITY_TRANSLATION_LOADERS[theme]
    if (!themeEntities) return []

    const entityLoaders = themeEntities[entity]
    if (!entityLoaders) return []

    return Object.keys(entityLoaders)
  }

  /**
   * Get all entities with translations for a theme
   *
   * @param theme - Theme name
   * @returns Array of entity names
   *
   * @example
   * ```typescript
   * const entities = TranslationService.getEntities('default')
   * // Returns ['products', 'blog']
   * ```
   */
  static getEntities(theme: string): string[] {
    const themeEntities = ENTITY_TRANSLATION_LOADERS[theme]
    if (!themeEntities) return []
    return Object.keys(themeEntities)
  }

  /**
   * Check if entity has translation for locale
   *
   * @param theme - Theme name
   * @param entity - Entity name
   * @param locale - Locale code
   * @returns True if translation exists
   *
   * @example
   * ```typescript
   * if (TranslationService.hasEntity('default', 'products', 'en')) {
   *   // Translation exists, safe to load
   * }
   * ```
   */
  static hasEntity(theme: string, entity: string, locale: string): boolean {
    return !!this.getEntityLoader(theme, entity, locale)
  }

  /**
   * Load all entity translations for a theme and locale
   * Useful for preloading all entity translations at once
   *
   * @param theme - Theme name
   * @param locale - Locale code
   * @returns Object with entity names as keys and translations as values
   *
   * @example
   * ```typescript
   * const allEntityTranslations = await TranslationService.loadAllEntities('default', 'en')
   * // Returns { products: {...}, blog: {...} }
   * ```
   */
  static async loadAllEntities(theme: string, locale: string): Promise<Record<string, Record<string, unknown>>> {
    const entities = this.getEntities(theme)
    const result: Record<string, Record<string, unknown>> = {}

    for (const entity of entities) {
      const translations = await this.loadEntity(theme, entity, locale)
      if (Object.keys(translations).length > 0) {
        result[entity] = translations
      }
    }

    // Also include plugin entities that have no theme override
    const themeEntitySet = new Set(entities)
    for (const pluginName of Object.keys(PLUGIN_ENTITY_TRANSLATION_LOADERS)) {
      for (const entityName of Object.keys(PLUGIN_ENTITY_TRANSLATION_LOADERS[pluginName])) {
        if (!themeEntitySet.has(entityName)) {
          const translations = await this.loadPluginEntityFallback(entityName, locale)
          if (Object.keys(translations).length > 0) {
            result[entityName] = translations
          }
        }
      }
    }

    return result
  }
}
