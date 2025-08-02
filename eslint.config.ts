import type { Linter } from 'eslint'
import neostandard, { resolveIgnoresFromGitignore } from 'neostandard'

const config: Linter.Config[] = [
  ...neostandard({
    noStyle: true,
    ts: true,
    ignores: [...resolveIgnoresFromGitignore()],
  }),
]

export default config
