// pattern-check: skip — plain string constants, no abstraction
export const GITHUB_OWNER = 'Wolffyx'
export const GITHUB_REPO = 'remappr'
export const REPO_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`
export const APP_VERSION =
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
