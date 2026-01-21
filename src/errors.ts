/**
 * Apple Doc MCP Error Types
 * Provides categorized errors with user-friendly messages and recovery suggestions
 */

export enum AppleDocErrorCode {
	NOT_FOUND = 'NOT_FOUND',
	NETWORK_ERROR = 'NETWORK_ERROR',
	RATE_LIMITED = 'RATE_LIMITED',
	TIMEOUT = 'TIMEOUT',
	PARSE_ERROR = 'PARSE_ERROR',
	INVALID_REQUEST = 'INVALID_REQUEST',
	UNKNOWN = 'UNKNOWN',
}

type ErrorContext = {
	url?: string;
	path?: string;
	statusCode?: number;
	originalError?: Error;
};

const createErrorFromHttpPattern = (error: Error, url?: string): AppleDocError | undefined => {
	const errorMessage = error.message.toLowerCase();

	if (errorMessage.includes('404') || errorMessage.includes('not found')) {
		return new AppleDocError(
			AppleDocErrorCode.NOT_FOUND,
			`Documentation not found${url ? ` at ${url}` : ''}`,
			'Check the path spelling or use search_symbols to find the correct path.',
			{url, originalError: error},
		);
	}

	if (errorMessage.includes('429') || errorMessage.includes('rate limit') || errorMessage.includes('too many requests')) {
		return new AppleDocError(
			AppleDocErrorCode.RATE_LIMITED,
			'Request rate limited by Apple servers',
			'Wait a few seconds and try again.',
			{url, originalError: error},
		);
	}

	if (errorMessage.includes('timeout') || errorMessage.includes('econnaborted') || errorMessage.includes('etimedout')) {
		return new AppleDocError(
			AppleDocErrorCode.TIMEOUT,
			'Request timed out',
			'The Apple documentation server may be slow. Try again shortly.',
			{url, originalError: error},
		);
	}

	if (errorMessage.includes('enotfound') || errorMessage.includes('econnrefused') || errorMessage.includes('network')) {
		return new AppleDocError(
			AppleDocErrorCode.NETWORK_ERROR,
			'Network error while fetching documentation',
			'Check your internet connection and try again.',
			{url, originalError: error},
		);
	}

	if (errorMessage.includes('json') || errorMessage.includes('parse') || errorMessage.includes('unexpected token')) {
		return new AppleDocError(
			AppleDocErrorCode.PARSE_ERROR,
			'Failed to parse documentation response',
			'The documentation format may have changed. Please report this issue.',
			{url, originalError: error},
		);
	}

	return undefined;
};

export class AppleDocError extends Error {
	readonly code: AppleDocErrorCode;
	readonly suggestion?: string;
	readonly context?: ErrorContext;

	constructor(
		code: AppleDocErrorCode,
		message: string,
		suggestion?: string,
		context?: ErrorContext,
	) {
		super(message);
		this.name = 'AppleDocError';
		this.code = code;
		this.suggestion = suggestion;
		this.context = context;

		// Maintains proper stack trace for V8
		if (Error.captureStackTrace) {
			Error.captureStackTrace(this, AppleDocError);
		}
	}

	toUserMessage(): string {
		const parts: string[] = [this.message];

		if (this.suggestion) {
			parts.push(`\n💡 **Suggestion:** ${this.suggestion}`);
		}

		return parts.join('');
	}
}

export const createAppleDocErrorFromHttp = (error: Error, url?: string): AppleDocError => {
	const patternError = createErrorFromHttpPattern(error, url);
	if (patternError) {
		return patternError;
	}

	return new AppleDocError(
		AppleDocErrorCode.UNKNOWN,
		`Documentation fetch failed: ${error.message}`,
		'If this persists, try a different search query or check the path.',
		{url, originalError: error},
	);
};

export const createAppleDocNotFoundError = (path: string): AppleDocError =>
	new AppleDocError(
		AppleDocErrorCode.NOT_FOUND,
		`Documentation not found for "${path}"`,
		'Check the symbol name spelling or use search_symbols to find available symbols.',
		{path},
	);

export const createAppleDocInvalidRequestError = (message: string): AppleDocError =>
	new AppleDocError(
		AppleDocErrorCode.INVALID_REQUEST,
		message,
		undefined,
	);

/**
 * Check if an error is an AppleDocError
 */
export const isAppleDocError = (error: unknown): error is AppleDocError =>
	error instanceof AppleDocError;
