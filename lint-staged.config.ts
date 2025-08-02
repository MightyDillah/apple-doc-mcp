import type { Configuration } from "lint-staged";

const config: Configuration = {
  "**/*.{js,jsx,ts,tsx,json,css,scss,md}": (stagedFiles) => [
    `prettier --write ${stagedFiles.join(" ")}`,
    `eslint --fix ${stagedFiles.join(" ")}`,
  ],
  "**/*.{ts,tsx}": () => "bunx tsc --noEmit",
};

export default config;
