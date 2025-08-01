import axios from 'axios'

const BASE_URL = 'https://developer.apple.com/tutorials/data'
const CONTAINER_BASE_URL = 'https://apple.github.io/container/data'
const CONTAINERIZATION_BASE_URL =
  'https://apple.github.io/containerization/data'

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
  DNT: '1',
}

export interface Technology {
  title: string
  abstract: { text: string; type: string }[]
  url: string
  kind: string
  role: string
  identifier: string
}

export interface ContainerTechnology {
  title: string
  abstract: { text: string; type: string }[]
  url: string
  kind: string
  role: string
  identifier: string
}

export interface ContainerizationTechnology {
  title: string
  abstract: { text: string; type: string }[]
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

export interface FrameworkData {
  metadata: {
    title: string
    role: string
    platforms: any[]
  }
  abstract: { text: string; type: string }[]
  topicSections: TopicSection[]
  references: Record<string, any>
}

export interface SymbolData {
  metadata: {
    title: string
    symbolKind: string
    platforms: any[]
  }
  abstract: { text: string; type: string }[]
  primaryContentSections: any[]
  topicSections: TopicSection[]
  references: Record<string, any>
}

export interface SearchResult {
  title: string
  description: string
  path: string
  framework: string
  symbolKind?: string
  platforms?: string
}

export class AppleDevDocsClient {
  private cache = new Map<string, any>()
  private readonly cacheTimeout = 10 * 60 * 1000 // 10 minutes

  private async makeRequest<T>(referrer: string, url: string): Promise<T> {
    // Simple cache check
    const cached = this.cache.get(url)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data
    }

    try {
      const response = await axios.get(url, {
        headers: { ...HEADERS, Referer: referrer },
        timeout: 15000, // 15 second timeout
      })

      // Cache the result
      this.cache.set(url, {
        data: response.data,
        timestamp: Date.now(),
      })

      return response.data
    } catch (error) {
      console.error(`Error fetching ${url}:`, error)
      throw new Error(`Failed to fetch documentation: ${error}`)
    }
  }

  async getTechnologies(): Promise<Record<string, Technology>> {
    const url = `${BASE_URL}/documentation/technologies.json`
    const data = await this.makeRequest<any>(
      'https://developer.apple.com/documentation',
      url
    )
    return data.references || {}
  }

  async getContainerTechnologies(): Promise<
    Record<string, ContainerTechnology>
  > {
    const url = `${CONTAINER_BASE_URL}/documentation.json`
    const data = await this.makeRequest<any>(
      'https://apple.github.io/container/documentation',
      url
    )
    return data.references || {}
  }

  async getContainerizationTechnologies(): Promise<
    Record<string, ContainerizationTechnology>
  > {
    const url = `${CONTAINERIZATION_BASE_URL}/documentation.json`
    const data = await this.makeRequest<any>(
      'https://apple.github.io/containerization/documentation',
      url
    )
    return data.references || {}
  }

  async getFramework(frameworkName: string): Promise<FrameworkData> {
    const url = `${BASE_URL}/documentation/${frameworkName}.json`
    return await this.makeRequest<FrameworkData>(
      'https://developer.apple.com/documentation',
      url
    )
  }

  async getContainerFramework(frameworkName: string): Promise<FrameworkData> {
    const url = `${CONTAINER_BASE_URL}/documentation/${frameworkName}.json`
    return await this.makeRequest<FrameworkData>(
      'https://apple.github.io/container/documentation',
      url
    )
  }

  async getContainerizationFramework(
    frameworkName: string
  ): Promise<FrameworkData> {
    const url = `${CONTAINERIZATION_BASE_URL}/documentation/${frameworkName}.json`
    return await this.makeRequest<FrameworkData>(
      'https://apple.github.io/containerization/documentation',
      url
    )
  }

  async getSymbol(path: string): Promise<SymbolData> {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const url = `${BASE_URL}/${cleanPath}.json`
    return await this.makeRequest<SymbolData>(
      'https://developer.apple.com/documentation',
      url
    )
  }

  async getContainerSymbol(path: string): Promise<SymbolData> {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const url = `${CONTAINER_BASE_URL}/${cleanPath}.json`

    console.log('cleanPath', cleanPath)
    console.log('url', url)
    return await this.makeRequest<SymbolData>(
      'https://apple.github.io/container/documentation',
      url
    )
  }

  async getContainerizationSymbol(path: string): Promise<SymbolData> {
    // Remove leading slash if present
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    const url = `${CONTAINERIZATION_BASE_URL}/${cleanPath}.json`

    console.log('cleanPath', cleanPath)
    console.log('url', url)
    return await this.makeRequest<SymbolData>(
      'https://apple.github.io/containerization/documentation',
      url
    )
  }

  // NEW: Search across all frameworks
  async searchGlobal(
    query: string,
    options: {
      symbolType?: string
      platform?: string
      maxResults?: number
    } = {}
  ): Promise<SearchResult[]> {
    const { maxResults = 50 } = options
    const results: SearchResult[] = []

    try {
      const technologies = await this.getTechnologies()
      const frameworks = Object.values(technologies).filter(
        (tech) => tech.kind === 'symbol' && tech.role === 'collection'
      )

      // Use all available frameworks (limited to avoid API abuse)
      const searchFrameworks = frameworks.slice(0, 20) // Limit to avoid API abuse

      for (const framework of searchFrameworks) {
        if (results.length >= maxResults) break

        try {
          const frameworkResults = await this.searchFramework(
            framework.title,
            query,
            {
              symbolType: options.symbolType,
              platform: options.platform,
              maxResults: Math.ceil(maxResults / 4), // Distribute across frameworks
            }
          )
          results.push(...frameworkResults)
        } catch (error) {
          // Continue on individual framework errors
          console.warn(`Failed to search ${framework.title}:`, error)
        }
      }

      return results.slice(0, maxResults)
    } catch (error) {
      throw new Error(`Global search failed: ${error}`)
    }
  }

  // NEW: Search within a specific framework
  async searchFramework(
    frameworkName: string,
    query: string,
    options: {
      symbolType?: string
      platform?: string
      maxResults?: number
    } = {}
  ): Promise<SearchResult[]> {
    const { maxResults = 20 } = options
    const results: SearchResult[] = []

    try {
      const framework = await this.getFramework(frameworkName)
      const searchPattern = this.createSearchPattern(query)

      Object.entries(framework.references).forEach(([id, ref]) => {
        if (results.length >= maxResults) return

        if (this.matchesSearch(ref, searchPattern, options)) {
          results.push({
            title: ref.title,
            description: this.extractText(ref.abstract || []),
            path: ref.url,
            framework: frameworkName,
            symbolKind: ref.kind,
            platforms: this.formatPlatforms(
              ref.platforms || framework.metadata?.platforms
            ),
          })
        }
      })

      return results.sort(
        (a, b) =>
          this.scoreMatch(a.title, query) - this.scoreMatch(b.title, query)
      )
    } catch (error) {
      throw new Error(`Framework search failed for ${frameworkName}: ${error}`)
    }
  }

  // NEW: Search within Container frameworks
  async searchContainerFramework(
    frameworkName: string,
    query: string,
    options: {
      symbolType?: string
      platform?: string
      maxResults?: number
    } = {}
  ): Promise<SearchResult[]> {
    const { maxResults = 20 } = options
    const results: SearchResult[] = []

    try {
      const framework = await this.getContainerFramework(frameworkName)
      const searchPattern = this.createSearchPattern(query)

      Object.entries(framework.references).forEach(([id, ref]) => {
        if (results.length >= maxResults) return

        if (this.matchesSearch(ref, searchPattern, options)) {
          results.push({
            title: ref.title,
            description: this.extractText(ref.abstract || []),
            path: ref.url,
            framework: frameworkName,
            symbolKind: ref.kind,
            platforms: this.formatPlatforms(
              ref.platforms || framework.metadata?.platforms
            ),
          })
        }
      })

      return results.sort(
        (a, b) =>
          this.scoreMatch(a.title, query) - this.scoreMatch(b.title, query)
      )
    } catch (error) {
      throw new Error(
        `Container framework search failed for ${frameworkName}: ${error}`
      )
    }
  }

  // NEW: Search within Containerization frameworks
  async searchContainerizationFramework(
    frameworkName: string,
    query: string,
    options: {
      symbolType?: string
      platform?: string
      maxResults?: number
    } = {}
  ): Promise<SearchResult[]> {
    const { maxResults = 20 } = options
    const results: SearchResult[] = []

    try {
      const framework = await this.getContainerizationFramework(frameworkName)
      const searchPattern = this.createSearchPattern(query)

      Object.entries(framework.references).forEach(([id, ref]) => {
        if (results.length >= maxResults) return

        if (this.matchesSearch(ref, searchPattern, options)) {
          results.push({
            title: ref.title,
            description: this.extractText(ref.abstract || []),
            path: ref.url,
            framework: frameworkName,
            symbolKind: ref.kind,
            platforms: this.formatPlatforms(
              ref.platforms || framework.metadata?.platforms
            ),
          })
        }
      })

      return results.sort(
        (a, b) =>
          this.scoreMatch(a.title, query) - this.scoreMatch(b.title, query)
      )
    } catch (error) {
      throw new Error(
        `Containerization framework search failed for ${frameworkName}: ${error}`
      )
    }
  }

  // Helper: Create search pattern (supports wildcards)
  private createSearchPattern(query: string): RegExp {
    // Convert wildcard pattern to regex
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = escaped.replace(/\\\*/g, '.*').replace(/\\\?/g, '.')
    return new RegExp(pattern, 'i')
  }

  // Helper: Check if reference matches search criteria
  private matchesSearch(ref: any, pattern: RegExp, options: any): boolean {
    if (!ref.title) return false

    // Title match
    if (!pattern.test(ref.title)) return false

    // Symbol type filter
    if (options.symbolType && ref.kind !== options.symbolType) return false

    // Platform filter (simplified)
    if (options.platform && ref.platforms) {
      const hasPlat = ref.platforms.some((p: any) =>
        p.name?.toLowerCase().includes(options.platform.toLowerCase())
      )
      if (!hasPlat) return false
    }

    return true
  }

  // Helper: Score match quality (lower = better)
  private scoreMatch(title: string, query: string): number {
    const lowerTitle = title.toLowerCase()
    const lowerQuery = query.replace(/\*/g, '').toLowerCase()

    if (lowerTitle === lowerQuery) return 0 // Exact match
    if (lowerTitle.startsWith(lowerQuery)) return 1 // Prefix match
    if (lowerTitle.includes(lowerQuery)) return 2 // Contains match
    return 3 // Pattern match
  }

  // Helper to extract text from abstract array
  extractText(abstract: { text: string; type: string }[]): string {
    return abstract?.map((item) => item.text).join('') || ''
  }

  // Helper to format platform availability
  formatPlatforms(platforms: any[]): string {
    if (!platforms || platforms.length === 0) return 'All platforms'
    return platforms
      .map((p) => `${p.name} ${p.introducedAt}+${p.beta ? ' (Beta)' : ''}`)
      .join(', ')
  }
}
