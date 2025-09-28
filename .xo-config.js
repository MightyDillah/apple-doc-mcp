module.exports = {
	// Enable TypeScript support
	typescript: true,

	// Use the project's TypeScript configuration
	tsconfig: './tsconfig.json',

	// File extensions to lint
	extensions: ['ts'],

	// Envs for Node.js environment
	node: true,

	// Rules to customize
	rules: {

	},

	// Ignore patterns
	ignores: [
		'dist/**',
		'node_modules/**',
		'*.d.ts'
	]
};
