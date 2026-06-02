/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react'

export type Theme = 'dark' | 'light' | 'system'

export const THEME_NAMES = [
    'default',
    'claude',
    'supabase',
    't3-chat',
    'vercel',
    'twitter',
    'bubblegum',
    'catppuccin',
] as const
export type ThemeName = (typeof THEME_NAMES)[number]

type ThemeProviderProps = {
    children: React.ReactNode
    defaultTheme?: Theme
    defaultThemeName?: ThemeName
    storageKey?: string
    nameStorageKey?: string
}

type ThemeProviderState = {
    theme: Theme
    setTheme: (theme: Theme) => void
    themeName: ThemeName
    setThemeName: (name: ThemeName) => void
}

const initialState: ThemeProviderState = {
    theme: 'system',
    setTheme: () => null,
    themeName: 'default',
    setThemeName: () => null,
}

const ThemeProviderContext = createContext<ThemeProviderState>(initialState)

export function ThemeProvider({
    children,
    defaultTheme = 'system',
    defaultThemeName = 'default',
    storageKey = 'vite-ui-theme',
    nameStorageKey = 'vite-ui-theme-name',
    ...props
}: ThemeProviderProps): JSX.Element {
    const [theme, setTheme] = useState<Theme>(
        (): Theme =>
            (localStorage.getItem(storageKey) as Theme) || defaultTheme,
    )
    const [themeName, setThemeName] = useState<ThemeName>((): ThemeName => {
        const stored = localStorage.getItem(nameStorageKey) as ThemeName | null
        return stored && THEME_NAMES.includes(stored)
            ? stored
            : defaultThemeName
    })

    useEffect(() => {
        const root = window.document.documentElement

        root.classList.remove('light', 'dark')

        if (theme === 'system') {
            const systemTheme = window.matchMedia(
                '(prefers-color-scheme: dark)',
            ).matches
                ? 'dark'
                : 'light'

            root.classList.add(systemTheme)
            return
        }

        root.classList.add(theme)
    }, [theme])

    useEffect(() => {
        const root = window.document.documentElement
        if (themeName === 'default') {
            root.removeAttribute('data-theme')
        } else {
            root.setAttribute('data-theme', themeName)
        }
    }, [themeName])

    const value = {
        theme,
        setTheme: (theme: Theme): void => {
            localStorage.setItem(storageKey, theme)
            setTheme(theme)
        },
        themeName,
        setThemeName: (name: ThemeName): void => {
            localStorage.setItem(nameStorageKey, name)
            setThemeName(name)
        },
    }

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    )
}

export const useTheme = (): ThemeProviderState => {
    const context = useContext(ThemeProviderContext)

    if (context === undefined)
        throw new Error('useTheme must be used within a ThemeProvider')

    return context
}
