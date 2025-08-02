export type DocSourceName = keyof typeof DOC_SOURCES;

export interface DocSourceConfig {
  readonly name: string;
  readonly baseUrl: string;
  readonly referrer: string;
}

export const DOC_SOURCES = {
  main: {
    name: "Apple Developer Documentation",
    baseUrl: "https://developer.apple.com/tutorials/data",
    referrer: "https://developer.apple.com/documentation",
  },
  container: {
    name: "Apple Container Documentation",
    baseUrl: "https://apple.github.io/container/data/documentation",
    referrer: "https://apple.github.io/container/documentation",
  },
  containerization: {
    name: "Apple Containerization Documentation",
    baseUrl: "https://apple.github.io/containerization/data/documentation",
    referrer: "https://apple.github.io/containerization/documentation",
  },
} as const satisfies Record<string, DocSourceConfig>;

export const CONFIG = {
  CACHE_TIMEOUT: 10 * 60 * 1000, // 10 minutes
  REQUEST_TIMEOUT: 15000, // 15 seconds
  MAX_CACHE_SIZE: 1000,
  DEFAULT_MAX_RESULTS: 50,
  FRAMEWORK_SEARCH_LIMIT: 20,
  SEARCH_RESULTS_PER_FRAMEWORK: 4, // For distributing results across frameworks
  DEFAULT_FRAMEWORK_MAX_RESULTS: 20,
} as const;

export const DEFAULT_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  DNT: "1",
} as const;

export const SYMBOL_KINDS = {
  COLLECTION: "collection",
  SYMBOL: "symbol",
} as const;

export const ROLES = {
  COLLECTION: "collection",
} as const;
