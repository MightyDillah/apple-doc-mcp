import js from '@eslint/js';
import globals from 'globals';
import n from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default tseslint.config(
	{
		ignores: ['dist/**', 'node_modules/**', '.cache/**', '*.d.ts'],
	},
	js.configs.recommended,
	...tseslint.configs.recommendedTypeChecked,
	{
		files: ['src/**/*.ts'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: globals.node,
			parserOptions: {
				projectService: true,
				tsconfigRootDir: import.meta.dirname,
			},
		},
		plugins: {
			n,
		},
		rules: {
			complexity: ['warn', 20],
			'max-depth': ['warn', 4],
			'no-console': ['error', { allow: ['error', 'warn'] }],
			'no-await-in-loop': 'off',
			'n/no-missing-import': 'off',
			'n/no-process-exit': 'off',
			'@typescript-eslint/require-await': 'off',
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{ prefer: 'type-imports' },
			],
			'@typescript-eslint/no-floating-promises': 'error',
			'@typescript-eslint/no-misused-promises': 'error',
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					argsIgnorePattern: '^_',
					caughtErrorsIgnorePattern: '^_',
				},
			],
			'@typescript-eslint/member-ordering': 'off',
		},
	},
	eslintConfigPrettier,
);
