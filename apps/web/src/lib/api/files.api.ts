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

  upload: (path: string, files: FileList) => {
    const form = new FormData()
    form.append('path', path)
    for (let i = 0; i < files.length; i++) form.append('files', files[i])
    // Do NOT set Content-Type — browser must auto-set it with the multipart boundary
    return api.post<{ uploaded: Array<{ name: string; error?: string }>; count: string }>(
      '/files/upload', form, { headers: { 'Content-Type': undefined } }
    )
  },

  compress: (paths: string[], output: string, format: 'zip' | 'tar.gz' | 'tar' | 'gz' | 'bz2' = 'zip') =>
    api.post<{ success: boolean; output: string }>('/files/compress', { paths, output, format }),

  extract: (path: string, destination?: string) =>
    api.post<{ success: boolean; destination: string }>('/files/extract', { path, destination }),
}
