// pattern-check: skip — one-time Monaco environment wiring (workers + bundled
// loader); module-scope side-effect config, no abstraction.
//
// Point @monaco-editor/react at the BUNDLED monaco-editor instead of its default
// CDN loader, so the JSON config panel works offline inside Electron. Vite's
// `?worker` imports bundle the editor + JSON language workers; MonacoEnvironment
// hands the right one to Monaco by label. Importing this module once (before the
// first <Editor/> mounts) is enough — it self-installs on load.
import * as monaco from 'monaco-editor'
import { loader } from '@monaco-editor/react'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'

// Monaco asks for a worker by language label; JSON gets the json worker, the
// rest (tokenizer/diff) get the base editor worker.
;(
    self as unknown as { MonacoEnvironment: monaco.Environment }
).MonacoEnvironment = {
    getWorker(_workerId: string, label: string): Worker {
        if (label === 'json') return new jsonWorker()
        return new editorWorker()
    },
}

loader.config({ monaco })

export { monaco }
