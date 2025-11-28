/**
 * Integration tests for Apple Developer Documentation API
 *
 * These tests make real HTTP requests to Apple's API.
 * Run with: pnpm test:integration
 */
import {
	describe, it, expect, beforeAll,
} from 'vitest';
import {HttpClient} from './http-client.js';
import type {
	FrameworkData,
	SymbolData,
	PrimaryContentSection,
	PlatformInfo,
} from './types/index.js';

// Use HttpClient directly to bypass cache
const httpClient = new HttpClient();

// Helper to fetch documentation
const fetchDoc = async <T>(path: string): Promise<T> =>
	httpClient.getDocumentation<T>(path);

describe('Apple Developer Documentation API', () => {
	describe('Technologies Endpoint', () => {
		it('returns valid technologies list', async () => {
			const response = await fetchDoc<{references: Record<string, unknown>}>('documentation/technologies');

			expect(response).toBeDefined();
			expect(response.references).toBeDefined();
			expect(typeof response.references).toBe('object');

			// Should have many technologies (100+)
			const techCount = Object.keys(response.references).length;
			expect(techCount).toBeGreaterThan(50);

			// Verify a known technology exists
			const swiftUiKey = Object.keys(response.references).find(k => k.includes('SwiftUI'));
			expect(swiftUiKey).toBeDefined();
		});

		it('technologies have required fields', async () => {
			const response = await fetchDoc<{references: Record<string, unknown>}>('documentation/technologies');

			// Check first few technologies for required structure
			const technologies = Object.values(response.references).slice(0, 5);

			for (const tech of technologies) {
				expect(tech).toHaveProperty('identifier');
				expect(tech).toHaveProperty('title');
				expect(tech).toHaveProperty('url');
			}
		});
	});

	describe('Framework Endpoint', () => {
		let swiftUiData: FrameworkData;

		beforeAll(async () => {
			swiftUiData = await fetchDoc<FrameworkData>('documentation/SwiftUI');
		});

		it('returns valid framework data for SwiftUI', () => {
			expect(swiftUiData).toBeDefined();
			expect(swiftUiData.metadata).toBeDefined();
			expect(swiftUiData.metadata.title).toBe('SwiftUI');
		});

		it('framework has abstract', () => {
			expect(swiftUiData.abstract).toBeDefined();
			expect(Array.isArray(swiftUiData.abstract)).toBe(true);
			expect(swiftUiData.abstract.length).toBeGreaterThan(0);

			// Abstract items should have text and type
			const firstItem = swiftUiData.abstract[0];
			expect(firstItem).toHaveProperty('text');
			expect(firstItem).toHaveProperty('type');
		});

		it('framework has platform information', () => {
			expect(swiftUiData.metadata.platforms).toBeDefined();
			expect(Array.isArray(swiftUiData.metadata.platforms)).toBe(true);
			expect(swiftUiData.metadata.platforms.length).toBeGreaterThan(0);

			// Check platform structure
			const platform = swiftUiData.metadata.platforms[0];
			expect(platform).toHaveProperty('name');
			expect(platform).toHaveProperty('introducedAt');
		});

		it('framework has topic sections', () => {
			expect(swiftUiData.topicSections).toBeDefined();
			expect(Array.isArray(swiftUiData.topicSections)).toBe(true);
			expect(swiftUiData.topicSections.length).toBeGreaterThan(0);

			// Check topic section structure
			const section = swiftUiData.topicSections[0];
			expect(section).toHaveProperty('title');
			expect(section).toHaveProperty('identifiers');
			expect(Array.isArray(section.identifiers)).toBe(true);
		});

		it('framework has references', () => {
			expect(swiftUiData.references).toBeDefined();
			expect(typeof swiftUiData.references).toBe('object');

			// Should have many references
			const refCount = Object.keys(swiftUiData.references).length;
			expect(refCount).toBeGreaterThan(10);

			// Check reference structure
			const firstRef = Object.values(swiftUiData.references)[0];
			expect(firstRef).toHaveProperty('title');
			expect(firstRef).toHaveProperty('url');
		});
	});

	describe('Symbol Endpoint', () => {
		let viewSymbol: SymbolData;

		beforeAll(async () => {
			viewSymbol = await fetchDoc<SymbolData>('documentation/SwiftUI/View');
		});

		it('returns valid symbol data for SwiftUI/View', () => {
			expect(viewSymbol).toBeDefined();
			expect(viewSymbol.metadata).toBeDefined();
			expect(viewSymbol.metadata.title).toBe('View');
		});

		it('symbol has correct kind', () => {
			expect(viewSymbol.metadata.symbolKind).toBeDefined();
			// View is a protocol
			expect(viewSymbol.metadata.symbolKind).toBe('protocol');
		});

		it('symbol has platform information', () => {
			expect(viewSymbol.metadata.platforms).toBeDefined();
			expect(Array.isArray(viewSymbol.metadata.platforms)).toBe(true);

			// Should support iOS
			const ios = viewSymbol.metadata.platforms.find((p: PlatformInfo) => p.name === 'iOS');
			expect(ios).toBeDefined();
			expect(ios?.introducedAt).toBeDefined();
		});

		it('symbol has primaryContentSections', () => {
			expect(viewSymbol.primaryContentSections).toBeDefined();
			expect(Array.isArray(viewSymbol.primaryContentSections)).toBe(true);
			expect(viewSymbol.primaryContentSections.length).toBeGreaterThan(0);
		});

		it('symbol has declaration section', () => {
			const declarationSection = viewSymbol.primaryContentSections
				.find((s: PrimaryContentSection) => s.kind === 'declarations');
			expect(declarationSection).toBeDefined();

			if (declarationSection?.kind === 'declarations') {
				expect(declarationSection.declarations).toBeDefined();
				expect(declarationSection.declarations.length).toBeGreaterThan(0);

				const decl = declarationSection.declarations[0];
				expect(decl.tokens).toBeDefined();
				expect(decl.languages).toContain('swift');
			}
		});

		it('symbol has topic sections', () => {
			expect(viewSymbol.topicSections).toBeDefined();
			expect(Array.isArray(viewSymbol.topicSections)).toBe(true);
		});

		it('symbol has references', () => {
			expect(viewSymbol.references).toBeDefined();
			expect(typeof viewSymbol.references).toBe('object');
		});
	});

	describe('Function Symbol', () => {
		let functionSymbol: SymbolData;

		beforeAll(async () => {
			functionSymbol = await fetchDoc<SymbolData>('documentation/SwiftUI/View/opacity(_:)');
		});

		it('returns valid function data', () => {
			expect(functionSymbol).toBeDefined();
			expect(functionSymbol.metadata.title).toContain('opacity');
		});

		it('function has parameters section', () => {
			const parametersSection = functionSymbol.primaryContentSections
				.find((s: PrimaryContentSection) => s.kind === 'parameters');
			expect(parametersSection).toBeDefined();

			if (parametersSection?.kind === 'parameters') {
				expect(parametersSection.parameters).toBeDefined();
				expect(parametersSection.parameters.length).toBeGreaterThan(0);

				const parameter = parametersSection.parameters[0];
				expect(parameter).toHaveProperty('name');
				expect(parameter).toHaveProperty('content');
			}
		});

		it('function has return value in content section', () => {
			const contentSection = functionSymbol.primaryContentSections
				.find((s: PrimaryContentSection) => s.kind === 'content');
			// Some functions have content sections with return value info
			// This is optional, so we just verify structure if present
			if (contentSection?.kind === 'content') {
				expect(contentSection.content).toBeDefined();
				expect(Array.isArray(contentSection.content)).toBe(true);
			}
		});
	});

	describe('Different Framework Types', () => {
		it('fetches UIKit framework', async () => {
			const uikit = await fetchDoc<FrameworkData>('documentation/UIKit');

			expect(uikit).toBeDefined();
			expect(uikit.metadata.title).toBe('UIKit');
			expect(uikit.references).toBeDefined();
		});

		it('fetches Foundation framework', async () => {
			const foundation = await fetchDoc<FrameworkData>('documentation/Foundation');

			expect(foundation).toBeDefined();
			expect(foundation.metadata.title).toBe('Foundation');
		});

		it('fetches Metal Performance Shaders framework', async () => {
			// This was the original bug - spaces in framework names
			const mps = await fetchDoc<FrameworkData>('documentation/MetalPerformanceShaders');

			expect(mps).toBeDefined();
			expect(mps.metadata.title).toBe('Metal Performance Shaders');
		});
	});

	describe('Edge Cases', () => {
		it('handles nested symbol paths', async () => {
			// Text has nested initializers
			const symbol = await fetchDoc<SymbolData>('documentation/SwiftUI/Text');

			expect(symbol).toBeDefined();
			expect(symbol.metadata.title).toBe('Text');
			expect(symbol.metadata.symbolKind).toBeDefined();
			// Verify it has nested members via topic sections
			expect(symbol.topicSections).toBeDefined();
		});

		it('handles symbols with special characters in path', async () => {
			// Function with operator-like name
			const symbol = await fetchDoc<SymbolData>('documentation/SwiftUI/View/opacity(_:)');

			expect(symbol).toBeDefined();
			expect(symbol.metadata).toBeDefined();
		});
	});

	describe('Response Validation', () => {
		it('all platform entries have required fields', async () => {
			const framework = await fetchDoc<FrameworkData>('documentation/SwiftUI');

			for (const platform of framework.metadata.platforms) {
				expect(typeof platform.name).toBe('string');
				expect(typeof platform.introducedAt).toBe('string');
				// Optional fields
				if (platform.beta !== undefined) {
					expect(typeof platform.beta).toBe('boolean');
				}

				if (platform.deprecated !== undefined) {
					expect(typeof platform.deprecated).toBe('boolean');
				}
			}
		});

		it('all references have required fields', async () => {
			const framework = await fetchDoc<FrameworkData>('documentation/SwiftUI');

			// Check first 10 symbol references (filter out non-symbol refs)
			const refs = Object.values(framework.references)
				.filter(ref => ref.title && ref.url)
				.slice(0, 10);
			expect(refs.length).toBeGreaterThan(0);
			for (const ref of refs) {
				expect(typeof ref.title).toBe('string');
				expect(typeof ref.url).toBe('string');
			}
		});

		it('declaration tokens have required fields', async () => {
			const symbol = await fetchDoc<SymbolData>('documentation/SwiftUI/View');

			const declSection = symbol.primaryContentSections
				.find((s: PrimaryContentSection) => s.kind === 'declarations');

			if (declSection?.kind === 'declarations') {
				const tokens = declSection.declarations[0]?.tokens ?? [];
				for (const token of tokens) {
					expect(typeof token.kind).toBe('string');
					expect(typeof token.text).toBe('string');
				}
			}
		});
	});
});
