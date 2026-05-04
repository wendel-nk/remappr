/** @type {import("tailwindcss").Config} */
import trac from 'tailwindcss-react-aria-components'
import contQueries from '@tailwindcss/container-queries'
import defaultTheme from 'tailwindcss/defaultTheme'

export default {
    content: [
        './src/renderer/index.html',
        './src/renderer/src/**/*.{js,ts,jsx,tsx}',
    ],
    theme: {
        fontSize: {
            xs: '0.4rem',
        },
        extend: {
            fontFamily: {
                sans: ['InterVariable', ...defaultTheme.fontFamily.sans],
            },
        },

        fontFamily: {
            keycap: ['Inter', 'system-ui'],
        },
    },
    plugins: [contQueries, trac({prefix: 'rac'})],
}
