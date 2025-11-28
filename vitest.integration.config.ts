import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		include: ['src/**/*.integration.test.ts'],
		testTimeout: 30_000, // 30 seconds for API calls
		hookTimeout: 30_000,
	},
});
