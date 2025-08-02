import type { DocSourceConfig } from './constants'
import { CONFIG } from './constants'
import { ErrorFactory } from './errors'
import { ResponseValidator, SearchResultFactory } from './factories'
import { DocHttpClient } from './http-client'
import type {
  FrameworkData,
  SearchOptions,
  SearchResult,
  SymbolData,
  Technology,
} from './types'
import { SearchUtils } from './utils'

interface ApiResponse<T> {
  references?: Record<string, T>
}

export class DocSource {
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
    return ResponseValidator.validateTechnologies(data)
  }

  async getFramework(frameworkName: string): Promise<FrameworkData> {
    const url = this.buildUrl(
      `documentation/${frameworkName.toLowerCase()}.json`
    )
    const data = await this.httpClient.get<FrameworkData>(
      url,
      this.config.referrer
    )
    return ResponseValidator.validateFrameworkData(data)
  }

  async getSymbol(path: string): Promise<SymbolData> {
    const cleanPath = this.cleanPath(path)
    const url = this.buildUrl(`${cleanPath}.json`)
    const data = await this.httpClient.get<SymbolData>(
      url,
      this.config.referrer
    )
    return ResponseValidator.validateSymbolData(data)
  }

  async searchFramework(
    frameworkName: string,
    query: string,
    options: SearchOptions = {}
  ): Promise<SearchResult[]> {
    const { maxResults = CONFIG.DEFAULT_FRAMEWORK_MAX_RESULTS } = options

    try {
      const framework = await this.getFramework(frameworkName)
      const searchPattern = SearchUtils.createSearchPattern(query)

      const results = this.collectSearchResults(
        framework,
        frameworkName,
        searchPattern,
        options,
        maxResults
      )

      return this.sortSearchResults(results, query)
    } catch (error) {
      const originalError =
        error instanceof Error ? error : new Error('Unknown error')
      throw ErrorFactory.frameworkSearch(
        frameworkName,
        this.config.name,
        originalError
      )
    }
  }

  private collectSearchResults(
    framework: FrameworkData,
    frameworkName: string,
    searchPattern: RegExp,
    options: SearchOptions,
    maxResults: number
  ): SearchResult[] {
    const results: SearchResult[] = []

    Object.entries(framework.references).forEach(([, ref]) => {
      if (results.length >= maxResults) return

      if (SearchUtils.matchesSearch(ref, searchPattern, options)) {
        results.push(
          SearchResultFactory.create(
            ref,
            frameworkName,
            framework.metadata.platforms
          )
        )
      }
    })

    return results
  }

  private sortSearchResults(
    results: SearchResult[],
    query: string
  ): SearchResult[] {
    return results.sort(
      (a, b) =>
        SearchUtils.scoreMatch(a.title, query) -
        SearchUtils.scoreMatch(b.title, query)
    )
  }

  private buildUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path
    return `${this.config.baseUrl}/${cleanPath}`
  }

  private cleanPath(path: string): string {
    const clean = path.startsWith('/') ? path.slice(1) : path
    return this.isContainerSource() ? clean.toLowerCase() : clean
  }

  private isContainerSource(): boolean {
    return this.config.name.includes('Container')
  }
}
