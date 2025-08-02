import type { Configuration } from 'lint-staged'

const config: Configuration = {
  '**/*.{js,jsx,ts,tsx,vue,json,css,scss,md}': stagedFiles => [
    `prettier --write ${stagedFiles.join(' ')}`,
    `eslint --fix ${stagedFiles.join(' ')}`,
  ],
  '**/*.{ts,tsx,vue}': () => 'vue-tsc --noEmit',
}

export default config
