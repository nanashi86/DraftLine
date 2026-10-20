import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
  {
    // The service worker template: worker globals, plus placeholders the build fills in.
    files: ['src/pwa/sw.template.js'],
    languageOptions: {
      globals: { ...globals.serviceworker, __PRECACHE__: 'readonly', __CORE_FONTS_CSS__: 'readonly' },
    },
  },
  {
    files: ['src/pwa/vitePlugin.js', 'vite.config.js'],
    languageOptions: { globals: globals.node },
  },
])
