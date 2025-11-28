import {describe, it, expect} from 'vitest';
import {
	extractFrameworkName,
	normalizeSymbolPath,
	removeLeadingSlash,
	extractTechnologyPath,
} from './path-utils.js';

describe('extractFrameworkName', () => {
	it('extracts framework name from full identifier', () => {
		expect(extractFrameworkName('doc://com.apple.documentation/documentation/SwiftUI'))
			.toBe('SwiftUI');
	});

	it('extracts framework name from simple path', () => {
		expect(extractFrameworkName('documentation/UIKit'))
			.toBe('UIKit');
	});

	it('handles single segment', () => {
		expect(extractFrameworkName('SwiftUI'))
			.toBe('SwiftUI');
	});

	it('returns empty string for empty input', () => {
		expect(extractFrameworkName(''))
			.toBe('');
	});

	it('handles Metal Performance Shaders style names', () => {
		expect(extractFrameworkName('doc://com.apple.documentation/documentation/MetalPerformanceShaders'))
			.toBe('MetalPerformanceShaders');
	});
});

describe('normalizeSymbolPath', () => {
	it('removes doc:// prefix', () => {
		expect(normalizeSymbolPath('doc://com.apple.documentation/documentation/SwiftUI/View'))
			.toBe('documentation/SwiftUI/View');
	});

	it('preserves paths without prefix', () => {
		expect(normalizeSymbolPath('documentation/SwiftUI/View'))
			.toBe('documentation/SwiftUI/View');
	});

	it('handles empty string', () => {
		expect(normalizeSymbolPath(''))
			.toBe('');
	});
});

describe('removeLeadingSlash', () => {
	it('removes leading slash', () => {
		expect(removeLeadingSlash('/documentation/SwiftUI'))
			.toBe('documentation/SwiftUI');
	});

	it('preserves paths without leading slash', () => {
		expect(removeLeadingSlash('documentation/SwiftUI'))
			.toBe('documentation/SwiftUI');
	});

	it('handles empty string', () => {
		expect(removeLeadingSlash(''))
			.toBe('');
	});

	it('handles single slash', () => {
		expect(removeLeadingSlash('/'))
			.toBe('');
	});
});

describe('extractTechnologyPath', () => {
	it('extracts technology path from full identifier', () => {
		expect(extractTechnologyPath('doc://com.apple.documentation/documentation/SwiftUI'))
			.toBe('SwiftUI');
	});

	it('removes documentation prefix', () => {
		expect(extractTechnologyPath('documentation/UIKit'))
			.toBe('UIKit');
	});

	it('handles simple input', () => {
		expect(extractTechnologyPath('SwiftUI'))
			.toBe('SwiftUI');
	});
});
