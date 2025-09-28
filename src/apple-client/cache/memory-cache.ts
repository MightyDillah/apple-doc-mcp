import type {CacheEntry} from '../types/index.js';

export class MemoryCache {
	private readonly cache = new Map<string, CacheEntry<any>>();
	private readonly cacheTimeout: number;

	constructor(timeoutMs: number = 10 * 60 * 1000) { // Default 10 minutes
		this.cacheTimeout = timeoutMs;
	}

	get<T>(key: string): T | undefined {
		const cached = this.cache.get(key);
		if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
			return cached.data as T;
		}

		return undefined;
	}

	set<T>(key: string, data: T): void {
		this.cache.set(key, {
			data,
			timestamp: Date.now(),
		});
	}

	clear(): void {
		this.cache.clear();
	}
}
