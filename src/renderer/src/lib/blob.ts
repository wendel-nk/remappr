import type { ExportedFile } from '@firmware/types'

export function exportedContentToString(content: string | Uint8Array): string {
    if (typeof content === 'string') return content
    return new TextDecoder().decode(content)
}

export function downloadExports(files: ExportedFile[]): void {
    files.forEach((f, i) => {
        const part: BlobPart =
            typeof f.content === 'string'
                ? f.content
                : new Uint8Array(
                      f.content.buffer.slice(
                          f.content.byteOffset,
                          f.content.byteOffset + f.content.byteLength,
                      ) as ArrayBuffer,
                  )
        const blob = new Blob([part], { type: f.mime })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = f.filename
        document.body.appendChild(link)
        setTimeout((): void => {
            link.click()
            document.body.removeChild(link)
            URL.revokeObjectURL(url)
        }, i * 100)
    })
}
