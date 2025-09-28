import axios from 'axios';
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
			console.error(`Error fetching ${url}:`, error instanceof Error ? error.message : String(error));
			throw new Error(`Failed to fetch documentation: ${error instanceof Error ? error.message : String(error)}`);
		}
	}

	async getDocumentation<T>(path: string): Promise<T> {
		return this.makeRequest<T>(`${path}.json`);
	}

	clearCache(): void {
		this.cache.clear();
	}
}
