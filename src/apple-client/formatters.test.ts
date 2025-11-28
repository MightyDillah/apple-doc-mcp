import {describe, it, expect} from 'vitest';
import {extractText, formatPlatforms} from './formatters.js';

describe('extractText', () => {
	it('extracts text from abstract array', () => {
		const abstract = [
			{text: 'A ', type: 'text'},
			{text: 'view', type: 'codeVoice'},
			{text: ' that displays content.', type: 'text'},
		];
		expect(extractText(abstract)).toBe('A view that displays content.');
	});

	it('returns empty string for empty array', () => {
		expect(extractText([])).toBe('');
	});

	it('returns empty string for undefined', () => {
		expect(extractText(undefined as unknown as Array<{text: string; type: string}>)).toBe('');
	});

	it('handles single item', () => {
		const abstract = [{text: 'Hello', type: 'text'}];
		expect(extractText(abstract)).toBe('Hello');
	});
});

describe('formatPlatforms', () => {
	it('formats single platform', () => {
		const platforms = [{name: 'iOS', introducedAt: '14.0'}];
		expect(formatPlatforms(platforms)).toBe('iOS 14.0');
	});

	it('formats multiple platforms', () => {
		const platforms = [
			{name: 'iOS', introducedAt: '14.0'},
			{name: 'macOS', introducedAt: '11.0'},
		];
		expect(formatPlatforms(platforms)).toBe('iOS 14.0, macOS 11.0');
	});

	it('shows beta indicator', () => {
		const platforms = [{name: 'visionOS', introducedAt: '1.0', beta: true}];
		expect(formatPlatforms(platforms)).toBe('visionOS 1.0 (Beta)');
	});

	it('returns "All platforms" for empty array', () => {
		expect(formatPlatforms([])).toBe('All platforms');
	});

	it('returns "All platforms" for undefined', () => {
		expect(formatPlatforms(undefined as unknown as Array<{name: string; introducedAt: string}>)).toBe('All platforms');
	});

	it('handles mixed beta and non-beta', () => {
		const platforms = [
			{name: 'iOS', introducedAt: '17.0'},
			{name: 'visionOS', introducedAt: '1.0', beta: true},
		];
		expect(formatPlatforms(platforms)).toBe('iOS 17.0, visionOS 1.0 (Beta)');
	});
});
