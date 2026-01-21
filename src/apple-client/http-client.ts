import axios, {type AxiosError} from 'axios';
import {AppleDocError, AppleDocErrorCode, createAppleDocErrorFromHttp} from '../errors.js';
import {MemoryCache} from './cache/memory-cache.js';

const baseUrl = 'https://developer.apple.com/tutorials/data';

const headers = {
	dnt: '1',
	referer: 'https://developer.apple.com/documentation',
	'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36',
};

export class HttpClient {
	private readonly cache: MemoryCache;

	constructor() {
		this.cache = new MemoryCache();
	}

	async makeRequest<T>(path: string): Promise<T> {
		const url = `${baseUrl}/${path}`;

		// Simple cache check
		const cached = this.cache.get<T>(url);
		if (cached) {
			return cached;
		}

		try {
			const response = await axios.get<T>(url, {
				headers,
				timeout: 15_000, // 15 second timeout
			});

			// Cache the result
			this.cache.set(url, response.data);
			return response.data;
		} catch (error) {
			// Categorize errors for better user feedback
			if (axios.isAxiosError(error)) {
				const axiosError = error as AxiosError;
				const statusCode = axiosError.response?.status;

				if (statusCode === 404) {
					throw new AppleDocError(
						AppleDocErrorCode.NOT_FOUND,
						`Documentation not found at ${path}`,
						'Check the path spelling or use search_symbols to find the correct path.',
						{url, statusCode},
					);
				}

				if (statusCode === 429) {
					throw new AppleDocError(
						AppleDocErrorCode.RATE_LIMITED,
						'Request rate limited by Apple servers',
						'Wait a few seconds and try again.',
						{url, statusCode},
					);
				}

				if (axiosError.code === 'ECONNABORTED' || axiosError.code === 'ETIMEDOUT') {
					throw new AppleDocError(
						AppleDocErrorCode.TIMEOUT,
						'Request timed out while fetching documentation',
						'The Apple documentation server may be slow. Try again shortly.',
						{url},
					);
				}

				if (axiosError.code === 'ENOTFOUND' || axiosError.code === 'ECONNREFUSED') {
					throw new AppleDocError(
						AppleDocErrorCode.NETWORK_ERROR,
						'Network error while fetching documentation',
						'Check your internet connection and try again.',
						{url},
					);
				}
			}

			// Fallback for unknown errors
			console.error(`Error fetching ${url}:`, error instanceof Error ? error.message : String(error));
			throw createAppleDocErrorFromHttp(
				error instanceof Error ? error : new Error(String(error)),
				url,
			);
		}
	}

	async getDocumentation<T>(path: string): Promise<T> {
		return this.makeRequest<T>(`${path}.json`);
	}

	clearCache(): void {
		this.cache.clear();
	}
}
