import axios, { AxiosInstance, AxiosResponse } from 'axios'

// Base Types
export interface AbstractItem {
  text: string
  type: string
}

export interface Platform {
  name: string
  introducedAt: string
  beta?: boolean
}

export interface Technology {
  title: string
  abstract: AbstractItem[]
  url: string
  kind: string
  role: string
  identifier: string
}

export interface TopicSection {
  title: string
  identifiers: string[]
  anchor?: string
}

// Metadata Types
interface BaseMetadata {
  title: string
  platforms: Platform[]
}

interface FrameworkMetadata extends BaseMetadata {
  role: string
}

interface SymbolMetadata extends BaseMetadata {
  symbolKind: string
}

// Document Types
interface BaseDocumentData {
  abstract: AbstractItem[]
  topicSections: TopicSection[]
  references: Record<string, Technology>
}

export interface FrameworkData extends BaseDocumentData {
  metadata: FrameworkMetadata
}

export interface SymbolData extends BaseDocumentData {
  metadata: SymbolMetadata
  primaryContentSections: unknown[]
}

export interface SearchResult {
  title: string
  description: string
  path: string
  framework: string
  symbolKind?: string
  platforms?: string
}

export interface SearchOptions {
  symbolType?: string
  platform?: string
  maxResults?: number
}

// Error Types
export class AppleDocsError extends Error {
  constructor(
    message: string,
    public readonly operation: string,
    public readonly source?: string,
    public readonly originalError?: Error
  ) {
    super(message)
    this.name = 'AppleDocsError'
  }
}

// API Response Types
interface ApiResponse<T> {
  references?: Record<string, T>
}

// Type Guards
const isValidTechnology = (obj: unknown): obj is Technology => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'title' in obj &&
    'url' in obj &&
    'kind' in obj &&
    'role' in obj
  )
}

const isValidAbstractItem = (obj: unknown): obj is AbstractItem => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'text' in obj &&
    'type' in obj &&
    typeof (obj as AbstractItem).text === 'string'
  )
}

// Constants
const SYMBOL_KINDS = {
  COLLECTION: 'collection',
  SYMBOL: 'symbol',
} as const

const ROLES = {
  COLLECTION: 'collection',
} as const

// Cache Types
interface CacheEntry<T> {
  data: T
  timestamp: number
}

// Configuration
interface DocSourceConfig {
  name: string
  baseUrl: string
  referrer: string
}

const DOC_SOURCES: Record<string, DocSourceConfig> = {
  main: {
    name: 'Apple Developer Documentation',
    baseUrl: 'https://developer.apple.com/tutorials/data',
    referrer: 'https://developer.apple.com/documentation',
  },
  container: {
    name: 'Apple Container Documentation',
    baseUrl: 'https://apple.github.io/container/data/documentation',
    referrer: 'https://apple.github.io/container/documentation',
  },
  containerization: {
    name: 'Apple Containerization Documentation',
    baseUrl: 'https://apple.github.io/containerization/data/documentation',
    referrer: 'https://apple.github.io/containerization/documentation',
  },
} as const

const CONFIG = {
  CACHE_TIMEOUT: 10 * 60 * 1000, // 10 minutes
  REQUEST_TIMEOUT: 15000, // 15 seconds
  MAX_CACHE_SIZE: 1000,
  DEFAULT_MAX_RESULTS: 50,
  FRAMEWORK_SEARCH_LIMIT: 20,
} as const

const DEFAULT_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  DNT: '1',
} as const

// Utilities
class LRUCache<T> {
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

class SearchUtils {
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

    if (options.platform && 'platforms' in ref) {
      const platforms = ref.platforms as Platform[]
      const hasPlat = platforms?.some((p) =>
        p.name?.toLowerCase().includes(options.platform!.toLowerCase())
      )
      if (!hasPlat) return false
    }

    return true
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

// HTTP Client abstraction
class DocHttpClient {
  private readonly client: AxiosInstance
  private readonly cache = new LRUCache<unknown>()

  constructor() {
    this.client = axios.create({
      timeout: CONFIG.REQUEST_TIMEOUT,
      headers: DEFAULT_HEADERS,
    })
  }

  async get<T>(url: string, referrer: string): Promise<T> {
    const cached = this.cache.get(url)
    if (cached) return cached as T

    try {
      const response: AxiosResponse<T> = await this.client.get(url, {
        headers: { Referer: referrer },
      })

      this.cache.set(url, response.data)
      return response.data
    } catch (error) {
      const originalError =
        error instanceof Error ? error : new Error('Unknown error')
      throw new AppleDocsError(
        `Failed to fetch ${url}`,
        'HTTP_REQUEST',
        url,
        originalError
      )
    }
  }

  clearCache(): void {
    this.cache.clear()
  }
}

// Documentation source abstraction
class DocSource {
  constructor(
    private readonly config: DocSourceConfig,
    private readonly httpClient: DocHttpClient
  ) {}

  async getTechnologies(): Promise<Record<string, Technology>> {
    const url = this.buildUrl('documentation/technologies.json')
    const data = await this.httpClient.get<ApiResponse<Technology>>(
      url,
      this.config.referrer
    )
    return data.references || {}
  }

  async getFramework(frameworkName: string): Promise<FrameworkData> {
    const url = this.buildUrl(
      `documentation/${frameworkName.toLowerCase()}.json`
    )
    return this.httpClient.get<FrameworkData>(url, this.config.referrer)
  }

  async getSymbol(path: string): Promise<SymbolData> {
    const cleanPath = this.cleanPath(path)
    const url = this.buildUrl(`${cleanPath}.json`)
    return this.httpClient.get<SymbolData>(url, this.config.referrer)
  }

  async searchFramework(
    frameworkName: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { maxResults = 20 } = options
    const results: SearchResult[] = []

    try {
      const framework = await this.getFramework(frameworkName)
      const searchPattern = SearchUtils.createSearchPattern(query)

      Object.entries(framework.references).forEach(([, ref]) => {
        if (results.length >= maxResults) return

        if (SearchUtils.matchesSearch(ref, searchPattern, options)) {
          results.push({
            title: ref.title,
            description: SearchUtils.extractText(ref.abstract || []),
            path: ref.url,
            framework: frameworkName,
            symbolKind: ref.kind,
            platforms: SearchUtils.formatPlatforms(
              ('platforms' in ref
                ? ref.platforms
                : framework.metadata?.platforms) as Platform[]
            ),
          })
        }
      })

      return results.sort(
        (a, b) =>
          SearchUtils.scoreMatch(a.title, query) -
          SearchUtils.scoreMatch(b.title, query)
      )
    } catch (error) {
      const originalError =
        error instanceof Error ? error : new Error('Unknown error')
      throw new AppleDocsError(
        `Framework search failed for ${frameworkName}`,
        'FRAMEWORK_SEARCH',
        this.config.name,
        originalError
      )
    }
  }

  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${this.config.baseUrl}/${cleanPath}`
  }

  private cleanPath(path: string): string {
    const clean = path.startsWith('/') ? path.slice(1) : path
    return this.config.name.includes('Container') ? clean.toLowerCase() : clean
  }
}

// Main client
export class AppleDevDocsClient {
  private readonly httpClient = new DocHttpClient()
  private readonly sources: Record<string, DocSource>

  constructor() {
    this.sources = Object.fromEntries(
      Object.entries(DOC_SOURCES).map(([key, config]) => [
        key,
        new DocSource(config, this.httpClient),
      ])
    )
  }

  // Main documentation methods
  async getTechnologies(): Promise<Record<string, Technology>> {
    return this.sources.main.getTechnologies()
  }

  async getFramework(frameworkName: string): Promise<FrameworkData> {
    return this.sources.main.getFramework(frameworkName)
  }

  async getSymbol(path: string): Promise<SymbolData> {
    return this.sources.main.getSymbol(path)
  }

  // Container documentation methods
  async getContainerTechnologies(): Promise<Record<string, Technology>> {
    return this.sources.container.getTechnologies()
  }

  async getContainerFramework(frameworkName: string): Promise<FrameworkData> {
    return this.sources.container.getFramework(frameworkName)
  }

  async getContainerSymbol(path: string): Promise<SymbolData> {
    return this.sources.container.getSymbol(path)
  }

  // Containerization documentation methods
  async getContainerizationTechnologies(): Promise<Record<string, Technology>> {
    return this.sources.containerization.getTechnologies()
  }

  async getContainerizationFramework(
    frameworkName: string
  ): Promise<FrameworkData> {
    return this.sources.containerization.getFramework(frameworkName)
  }

  async getContainerizationSymbol(path: string): Promise<SymbolData> {
    return this.sources.containerization.getSymbol(path)
  }

  // Search methods
  async searchGlobal(
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { maxResults = CONFIG.DEFAULT_MAX_RESULTS } = options
    const results: SearchResult[] = []

    try {
      const technologies = await this.getTechnologies()
      const frameworks = Object.values(technologies)
        .filter(
          (tech) =>
            tech.kind === SYMBOL_KINDS.SYMBOL && tech.role === ROLES.COLLECTION
        )
        .slice(0, CONFIG.FRAMEWORK_SEARCH_LIMIT)

      const searchPromises = frameworks.map(async (framework) => {
        try {
          return await this.searchFramework(framework.title, query, {
            ...options,
            maxResults: Math.ceil(maxResults / 4),
          })
        } catch (error) {
          console.warn(`Failed to search ${framework.title}:`, error)
          return []
        }
      })

      const allResults = await Promise.allSettled(searchPromises)

      allResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(...result.value)
        }
      })

      return results.slice(0, maxResults)
    } catch (error) {
      const originalError =
        error instanceof Error ? error : new Error('Unknown error')
      throw new AppleDocsError(
        'Global search failed',
        'GLOBAL_SEARCH',
        undefined,
        originalError
      )
    }
  }

  async searchFramework(
    frameworkName: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.sources.main.searchFramework(frameworkName, query, options)
  }

  async searchContainerFramework(
    frameworkName: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.sources.container.searchFramework(frameworkName, query, options)
  }

  async searchContainerizationFramework(
    frameworkName: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    return this.sources.containerization.searchFramework(
      frameworkName,
      query,
      options
    )
  }

  // Utility methods
  clearCache(): void {
    this.httpClient.clearCache()
  }

  extractText(abstract: AbstractItem[]): string {
    return SearchUtils.extractText(abstract)
  }

  formatPlatforms(platforms: Platform[]): string {
    return SearchUtils.formatPlatforms(platforms)
  }
}
