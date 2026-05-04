import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintConfigPrettier from '@electron-toolkit/eslint-config-prettier'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginStorybook from 'eslint-plugin-storybook'
import eslintPluginJsxA11y from 'eslint-plugin-jsx-a11y'

export default defineConfig(
    {
        ignores: [
            '**/node_modules',
            '**/dist',
            '**/out',
            '**/out-types',
            '**/build',
            'src-tauri/target/**',
        ],
    },
    tseslint.configs.recommended,
    eslintPluginReact.configs.flat.recommended,
    eslintPluginReact.configs.flat['jsx-runtime'],
    eslintPluginJsxA11y.flatConfigs.recommended,
    eslintPluginStorybook.configs['flat/recommended'],
    {
        settings: {
            react: {
                version: 'detect',
            },
        },
    },
    {
        files: ['**/*.{ts,tsx}'],
        plugins: {
            'react-hooks': eslintPluginReactHooks,
            'react-refresh': eslintPluginReactRefresh,
        },
        rules: {
            ...eslintPluginReactHooks.configs.recommended.rules,
            ...eslintPluginReactRefresh.configs.vite.rules,
            '@typescript-eslint/no-unused-vars': [
                'error',
                {
                    argsIgnorePattern: '^_',
                    varsIgnorePattern: '^_',
                    caughtErrorsIgnorePattern: '^_',
                },
            ],
        },
    },
    {
        // lib/ must stay pure: no React, no Zustand, no I/O, no UI features.
        files: ['src/renderer/src/lib/**/*.{ts,tsx}'],
        rules: {
            'no-restricted-imports': [
                'error',
                {
                    patterns: [
                        {
                            group: [
                                'react',
                                'react-dom',
                                'zustand',
                                'zustand/*',
                                '@/services/*',
                                '@/stores/*',
                                '@/hooks/*',
                                '@/features/*',
                                '@/components/*',
                                '@/ui/*',
                            ],
                            message:
                                'lib/ is for pure logic only. Move React/Zustand/IO code to hooks/, services/, stores/, or features/.',
                        },
                    ],
                },
            ],
        },
    },
    eslintConfigPrettier,
)
