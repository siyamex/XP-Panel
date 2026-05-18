'use client'

import { useState, useEffect, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Save, X, AlertTriangle } from 'lucide-react'
import { filesApi } from '@/lib/api/files.api'
import { toast } from 'sonner'

interface Props {
  path: string
  initialContent: string
  onClose: () => void
}

function getLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    go: 'go', py: 'python', php: 'php', rb: 'ruby', rs: 'rust',
    java: 'java', c: 'c', cpp: 'cpp', h: 'c',
    html: 'html', css: 'css', scss: 'scss', less: 'less',
    json: 'json', yaml: 'yaml', yml: 'yaml', toml: 'toml',
    xml: 'xml', md: 'markdown', sh: 'shell', bash: 'shell',
    sql: 'sql', conf: 'ini', ini: 'ini', env: 'ini', nginx: 'nginx',
  }
  return map[ext] ?? 'plaintext'
}

export function CodeEditor({ path, initialContent, onClose }: Props) {
  const [content, setContent] = useState(initialContent)
  const [isDirty, setIsDirty] = useState(false)
  const [MonacoEditor, setMonacoEditor] = useState<React.ComponentType<{
    value: string
    language: string
    theme: string
    onChange?: (v: string | undefined) => void
    options: Record<string, unknown>
    height: string
  }> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Dynamically import Monaco (it's huge — only load when needed)
  useEffect(() => {
    import('@monaco-editor/react').then((m) => {
      setMonacoEditor(() => m.default)
    }).catch(() => {
      // Monaco not available — fall back to textarea
    })
  }, [])

  const saveMutation = useMutation({
    mutationFn: () => filesApi.write(path, content),
    onSuccess: () => {
      setIsDirty(false)
      toast.success('File saved')
    },
    onError: () => toast.error('Failed to save file'),
  })

  const handleChange = (value: string) => {
    setContent(value)
    setIsDirty(value !== initialContent)
  }

  const handleClose = () => {
    if (isDirty && !confirm('You have unsaved changes. Discard them?')) return
    onClose()
  }

  const language = getLanguage(path)
  const fileName = path.split('/').pop() ?? path

  return (
    <div className="flex flex-col h-full bg-background rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/20">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-medium truncate max-w-xs">{fileName}</span>
          {isDirty && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{language}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => saveMutation.mutate()}
            disabled={!isDirty || saveMutation.isPending}
            className="flex items-center gap-1.5 h-7 px-3 rounded bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Save className="w-3.5 h-3.5" />
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleClose}
            className="p-1.5 rounded hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 min-h-0">
        {MonacoEditor ? (
          <MonacoEditor
            height="100%"
            language={language}
            theme="vs-dark"
            value={content}
            onChange={(v) => handleChange(v ?? '')}
            options={{
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
              lineNumbers: 'on',
              renderLineHighlight: 'line',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
            }}
          />
        ) : (
          // Fallback: plain textarea when Monaco isn't loaded yet
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => handleChange(e.target.value)}
            className="w-full h-full resize-none bg-[#1e1e1e] text-[#d4d4d4] font-mono text-sm p-4 focus:outline-none"
            spellCheck={false}
          />
        )}
      </div>
    </div>
  )
}
