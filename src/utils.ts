import { CONFIG } from './constants'
import { AbstractItem, Platform, SearchOptions, Technology } from './types'

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// LRU Cache Implementation
export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>()
  private readonly maxSize: number
  private readonly timeout: number

  constructor(
    maxSize: number = CONFIG.MAX_CACHE_SIZE,
    timeout: number = CONFIG.CACHE_TIMEOUT
  ) {
    this.maxSize = maxSize
    this.timeout = timeout
  }

  get(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() - entry.timestamp > this.timeout) {
      this.cache.delete(key)
      return null
    }

    // Move to end (LRU)
    this.cache.delete(key)
    this.cache.set(key, entry)
    return entry.data
  }

  set(key: string, data: T): void {
    if (this.cache.has(key)) {
      this.cache.delete(key)
    } else if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      firstKey && this.cache.delete(firstKey)
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    })
  }

  clear(): void {
    this.cache.clear()
  }
}

// Search Utilities
export class SearchUtils {
  static createSearchPattern(query: string): RegExp {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/\\\*/g, '.*').replace(/\\\?/g, '.')
    return new RegExp(pattern, 'i')
  }

  static matchesSearch(
    ref: Technology,
    pattern: RegExp,
    options: SearchOptions
  ): boolean {
    if (!ref.title || !pattern.test(ref.title)) return false

    if (options.symbolType && ref.kind !== options.symbolType) return false

    if (options.platform) {
      return this.hasPlatform(ref, options.platform)
    }

    return true
  }

  private static hasPlatform(ref: Technology, platformQuery: string): boolean {
    const platforms = this.extractPlatforms(ref)
    return platforms.some((p) =>
      p.name?.toLowerCase().includes(platformQuery.toLowerCase())
    )
  }

  private static extractPlatforms(ref: Technology): Platform[] {
    if ('platforms' in ref && Array.isArray(ref.platforms)) {
      return ref.platforms as Platform[]
    }
    return []
  }

  static scoreMatch(title: string, query: string): number {
    const lowerTitle = title.toLowerCase()
    const lowerQuery = query.replace(/\*/g, '').toLowerCase()

    if (lowerTitle === lowerQuery) return 0 // Exact match
    if (lowerTitle.startsWith(lowerQuery)) return 1 // Prefix match
    if (lowerTitle.includes(lowerQuery)) return 2 // Contains match
    return 3 // Pattern match
  }

  static extractText(abstract: AbstractItem[]): string {
    return abstract?.map((item) => item.text).join('') || ''
  }

  static formatPlatforms(platforms: Platform[]): string {
    if (!platforms || platforms.length === 0) return 'All platforms'
    return platforms
      .map((p) => `${p.name} ${p.introducedAt}+${p.beta ? ' (Beta)' : ''}`)
      .join(', ')
  }
}
