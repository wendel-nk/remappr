/* eslint-disable @typescript-eslint/explicit-function-return-type */
import fs from 'fs/promises'
import path from 'path'
import url from 'url'

const __filename = url.fileURLToPath(import.meta.url)
const __dirname = path.resolve(__filename, '../..')

/** @returns {Promise<void>} */
async function generateReleaseData() {
    const dataFilePath = path.resolve(
        __dirname,
        'src',
        'data',
        'release-data.json',
    )

    try {
        const response = await fetch(
            'https://api.github.com/repos/Wolffyx/remappr/releases/latest',
            {
                headers: process.env.GITHUB_TOKEN
                    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
                    : {},
            },
        )
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`)
        }

        const data = await response.json()
        await fs.mkdir(path.dirname(dataFilePath), { recursive: true })
        await fs.writeFile(dataFilePath, JSON.stringify(data))

        console.log('Release data generated successfully!')
    } catch (error) {
        // Check if existing release data exists, use it as fallback
        try {
            await fs.access(dataFilePath)
            console.log(
                'Warning: Could not fetch latest release data, using existing data',
            )
            console.log('Error details:', error.message)
        } catch {
            console.error(
                'Error generating release data and no fallback available:',
                error,
            )
            process.exit(1)
        }
    }
}

generateReleaseData()
