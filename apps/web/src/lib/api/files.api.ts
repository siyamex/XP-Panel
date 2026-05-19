import { api } from './client'

export interface FileInfo {
  name: string
  path: string
  size: number
  is_dir: boolean
  mode: string
  modified_at: string
  mime_type?: string
  extension?: string
}

export const filesApi = {
  list: (path: string = '/') =>
    api.get<{ files: FileInfo[]; path: string; total: number }>(`/files/list?path=${encodeURIComponent(path)}`),

  search: (path: string, q: string) =>
    api.get<{ files: FileInfo[]; total: number; query: string }>(`/files/search?path=${encodeURIComponent(path)}&q=${encodeURIComponent(q)}`),

  read: (path: string) =>
    api.get<{ content: string; path: string }>(`/files/read?path=${encodeURIComponent(path)}`),

  write: (path: string, content: string) =>
    api.put<{ success: boolean; path: string }>('/files/write', { path, content }),

  newFile: (path: string) =>
    api.post<{ success: boolean; path: string }>('/files/newfile', { path }),

  delete: (path: string) =>
    api.delete(`/files/delete?path=${encodeURIComponent(path)}`),

  mkdir: (path: string) =>
    api.post<{ success: boolean; path: string }>('/files/mkdir', { path }),

  copy: (source: string, destination: string) =>
    api.post<{ success: boolean }>('/files/copy', { source, destination }),

  move: (source: string, destination: string) =>
    api.post<{ success: boolean }>('/files/move', { source, destination }),

  rename: (path: string, new_name: string) =>
    api.post<{ success: boolean }>('/files/rename', { path, new_name }),

  chmod: (path: string, mode: string) =>
    api.put<{ success: boolean; path: string; mode: string }>('/files/chmod', { path, mode }),

  downloadUrl: (path: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/files/download?path=${encodeURIComponent(path)}`,

  upload: async (path: string, files: FileList): Promise<{ data: { uploaded: Array<{ name: string; error?: string }>; count: string } }> => {
    const form = new FormData()
    form.append('path', path)
    for (let i = 0; i < files.length; i++) form.append('files', files[i])

    // Use fetch directly — axios default Content-Type header breaks multipart boundary
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
    const headers: HeadersInit = {}
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('xp-auth')
        if (stored) {
          const { state } = JSON.parse(stored)
          if (state?.accessToken) headers['Authorization'] = `Bearer ${state.accessToken}`
        }
      } catch { /* ignore */ }
    }

    const resp = await fetch(`${apiBase}/api/v1/files/upload`, {
      method: 'POST',
      headers,
      body: form,
    })

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: { message: 'Upload failed' } }))
      throw Object.assign(new Error(err?.error?.message ?? 'Upload failed'), { response: { data: err } })
    }
    return { data: await resp.json() }
  },

  compress: (paths: string[], output: string, format: 'zip' | 'tar.gz' | 'tar' | 'gz' | 'bz2' = 'zip') =>
    api.post<{ success: boolean; output: string }>('/files/compress', { paths, output, format }),

  extract: (path: string, destination?: string) =>
    api.post<{ success: boolean; destination: string }>('/files/extract', { path, destination }),
}
