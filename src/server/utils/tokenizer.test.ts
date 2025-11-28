import {describe, it, expect} from 'vitest';
import {tokenize, createSearchTokens} from './tokenizer.js';

describe('tokenize', () => {
	it('returns empty array for empty input', () => {
		expect(tokenize('')).toEqual([]);
	});

	it('returns empty array for undefined-like input', () => {
		expect(tokenize(undefined as unknown as string)).toEqual([]);
	});

	it('splits on forward slashes', () => {
		const tokens = tokenize('documentation/SwiftUI/View');
		expect(tokens).toContain('documentation');
		expect(tokens).toContain('swiftui');
		expect(tokens).toContain('view');
	});

	it('splits on dots', () => {
		const tokens = tokenize('com.apple.documentation');
		expect(tokens).toContain('com');
		expect(tokens).toContain('apple');
		expect(tokens).toContain('documentation');
	});

	it('splits on underscores', () => {
		const tokens = tokenize('my_function_name');
		expect(tokens).toContain('my');
		expect(tokens).toContain('function');
		expect(tokens).toContain('name');
	});

	it('splits on hyphens', () => {
		const tokens = tokenize('some-kebab-case');
		expect(tokens).toContain('some');
		expect(tokens).toContain('kebab');
		expect(tokens).toContain('case');
	});

	it('splits on whitespace', () => {
		const tokens = tokenize('hello world');
		expect(tokens).toContain('hello');
		expect(tokens).toContain('world');
	});

	it('handles camelCase', () => {
		const tokens = tokenize('gridItem');
		expect(tokens).toContain('grid');
		expect(tokens).toContain('item');
		expect(tokens).toContain('griditem');
		expect(tokens).toContain('Item');
	});

	it('handles PascalCase', () => {
		const tokens = tokenize('GridItem');
		expect(tokens).toContain('grid');
		expect(tokens).toContain('item');
		expect(tokens).toContain('griditem');
		expect(tokens).toContain('Grid');
		expect(tokens).toContain('Item');
	});

	it('preserves original case tokens', () => {
		const tokens = tokenize('SwiftUI');
		expect(tokens).toContain('SwiftUI');
		expect(tokens).toContain('swiftui');
		expect(tokens).toContain('Swift');
		// Individual uppercase letters are split separately
		expect(tokens).toContain('U');
		expect(tokens).toContain('I');
	});

	it('handles complex mixed input', () => {
		// Note: colon is not a delimiter, so 'doc:' stays together
		const tokens = tokenize('doc://com.apple/MetalPerformanceShaders');
		expect(tokens).toContain('com');
		expect(tokens).toContain('apple');
		expect(tokens).toContain('metal');
		expect(tokens).toContain('performance');
		expect(tokens).toContain('shaders');
		expect(tokens).toContain('metalperformanceshaders');
	});
});

describe('createSearchTokens', () => {
	it('combines tokens from all inputs', () => {
		const tokens = createSearchTokens(
			'GridItem',
			'A view that displays items',
			'/documentation/SwiftUI/GridItem',
			['iOS', 'macOS'],
		);

		// From title
		expect(tokens).toContain('grid');
		expect(tokens).toContain('item');

		// From abstract
		expect(tokens).toContain('view');
		expect(tokens).toContain('displays');
		expect(tokens).toContain('items');

		// From path
		expect(tokens).toContain('swiftui');

		// From platforms
		expect(tokens).toContain('ios');
		expect(tokens).toContain('macos');
	});

	it('handles empty inputs gracefully', () => {
		const tokens = createSearchTokens('', '', '', []);
		expect(tokens).toEqual([]);
	});

	it('deduplicates tokens', () => {
		const tokens = createSearchTokens(
			'View',
			'A view component',
			'/view',
			[],
		);

		const viewCount = tokens.filter(t => t.toLowerCase() === 'view').length;
		// Should have 'view' and 'View' but not duplicates
		expect(viewCount).toBeLessThanOrEqual(2);
	});
});
