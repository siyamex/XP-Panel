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
    api.get<{ files: FileInfo[]; path: string; total: number }>(`/filemanager/files/list?path=${encodeURIComponent(path)}`),

  read: (path: string) =>
    api.get<{ content: string; path: string }>(`/filemanager/files/read?path=${encodeURIComponent(path)}`),

  write: (path: string, content: string) =>
    api.put<{ success: boolean; path: string }>('/filemanager/files/write', { path, content }),

  delete: (path: string) =>
    api.delete(`/filemanager/files/delete?path=${encodeURIComponent(path)}`),

  mkdir: (path: string) =>
    api.post<{ success: boolean; path: string }>('/filemanager/files/mkdir', { path }),

  copy: (source: string, destination: string) =>
    api.post<{ success: boolean }>('/filemanager/files/copy', { source, destination }),

  move: (source: string, destination: string) =>
    api.post<{ success: boolean }>('/filemanager/files/move', { source, destination }),

  rename: (path: string, new_name: string) =>
    api.post<{ success: boolean }>('/filemanager/files/rename', { path, new_name }),

  downloadUrl: (path: string) =>
    `${process.env.NEXT_PUBLIC_API_URL}/api/v1/filemanager/files/download?path=${encodeURIComponent(path)}`,

  upload: (path: string, files: FileList) => {
    const form = new FormData()
    form.append('path', path)
    for (let i = 0; i < files.length; i++) {
      form.append('files', files[i])
    }
    return api.post<{ uploaded: Array<{ name: string; error?: string }>; count: string }>(
      '/filemanager/files/upload',
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } }
    )
  },

  compress: (paths: string[], output: string, format: 'zip' | 'tar.gz' = 'zip') =>
    api.post<{ success: boolean; output: string }>('/filemanager/files/compress', { paths, output, format }),

  extract: (path: string, destination?: string) =>
    api.post<{ success: boolean; destination: string }>('/filemanager/files/extract', { path, destination }),
}
