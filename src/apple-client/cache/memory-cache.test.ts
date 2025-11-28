import {
	describe, it, expect, vi, beforeEach, afterEach,
} from 'vitest';
import {MemoryCache} from './memory-cache.js';

describe('MemoryCache', () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('set and get', () => {
		it('stores and retrieves values', () => {
			const cache = new MemoryCache();
			cache.set('key1', {foo: 'bar'});
			expect(cache.get('key1')).toEqual({foo: 'bar'});
		});

		it('returns undefined for missing keys', () => {
			const cache = new MemoryCache();
			expect(cache.get('nonexistent')).toBeUndefined();
		});

		it('overwrites existing values', () => {
			const cache = new MemoryCache();
			cache.set('key1', 'first');
			cache.set('key1', 'second');
			expect(cache.get('key1')).toBe('second');
		});

		it('handles different data types', () => {
			const cache = new MemoryCache();
			cache.set('string', 'hello');
			cache.set('number', 42);
			cache.set('object', {a: 1});
			cache.set('array', [1, 2, 3]);

			expect(cache.get('string')).toBe('hello');
			expect(cache.get('number')).toBe(42);
			expect(cache.get('object')).toEqual({a: 1});
			expect(cache.get('array')).toEqual([1, 2, 3]);
		});
	});

	describe('expiration', () => {
		it('returns value before timeout', () => {
			const cache = new MemoryCache(1000); // 1 second timeout
			cache.set('key', 'value');

			// Advance time by 500ms (less than timeout)
			vi.advanceTimersByTime(500);

			expect(cache.get('key')).toBe('value');
		});

		it('returns undefined after timeout', () => {
			const cache = new MemoryCache(1000); // 1 second timeout
			cache.set('key', 'value');

			// Advance time by 1001ms (past timeout)
			vi.advanceTimersByTime(1001);

			expect(cache.get('key')).toBeUndefined();
		});

		it('cleans up expired entries on get', () => {
			const cache = new MemoryCache(1000);
			cache.set('key', 'value');

			vi.advanceTimersByTime(1001);

			// First get should return undefined and clean up
			expect(cache.get('key')).toBeUndefined();

			// Set a new value
			cache.set('key', 'new value');
			expect(cache.get('key')).toBe('new value');
		});

		it('uses default timeout of 10 minutes', () => {
			const cache = new MemoryCache();
			cache.set('key', 'value');

			// Advance by 9 minutes - should still be valid
			vi.advanceTimersByTime(9 * 60 * 1000);
			expect(cache.get('key')).toBe('value');

			// Advance by 2 more minutes (total 11 min) - should be expired
			vi.advanceTimersByTime(2 * 60 * 1000);
			expect(cache.get('key')).toBeUndefined();
		});
	});

	describe('clear', () => {
		it('removes all entries', () => {
			const cache = new MemoryCache();
			cache.set('key1', 'value1');
			cache.set('key2', 'value2');
			cache.set('key3', 'value3');

			cache.clear();

			expect(cache.get('key1')).toBeUndefined();
			expect(cache.get('key2')).toBeUndefined();
			expect(cache.get('key3')).toBeUndefined();
		});

		it('allows setting new values after clear', () => {
			const cache = new MemoryCache();
			cache.set('key', 'old');
			cache.clear();
			cache.set('key', 'new');

			expect(cache.get('key')).toBe('new');
		});
	});
});
