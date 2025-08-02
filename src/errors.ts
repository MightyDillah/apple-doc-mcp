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

export class ErrorFactory {
  static httpRequest(url: string, originalError: Error): AppleDocsError {
    return new AppleDocsError(
      `Failed to fetch ${url}`,
      'HTTP_REQUEST',
      url,
      originalError
    )
  }

  static frameworkSearch(
    frameworkName: string,
    source: string,
    originalError: Error
  ): AppleDocsError {
    return new AppleDocsError(
      `Framework search failed for ${frameworkName}`,
      'FRAMEWORK_SEARCH',
      source,
      originalError
    )
  }

  static globalSearch(originalError: Error): AppleDocsError {
    return new AppleDocsError(
      'Global search failed',
      'GLOBAL_SEARCH',
      undefined,
      originalError
    )
  }
}
