'use client'

import { useState } from 'react'
import { Shield, Download, Copy, Check, Upload } from 'lucide-react'
import { sslCsrApi } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

type Tab = 'generate' | 'import'

export default function SSLCSRPage() {
  const [tab, setTab] = useState<Tab>('generate')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)
  const [csrResult, setCsrResult] = useState<{ csr: string; private_key: string } | null>(null)
  const [importResult, setImportResult] = useState<{ id: string; expires_at: string } | null>(null)

  const [csrForm, setCsrForm] = useState({ domain: '', country: 'US', state: '', city: '', organization: '', email: '' })
  const [importForm, setImportForm] = useState({ domain: '', certificate: '', private_key: '', ca_bundle: '' })

  const handleGenerate = async () => {
    if (!csrForm.domain) return
    setLoading(true)
    try {
      const { data } = await sslCsrApi.generateCSR(csrForm)
      setCsrResult(data)
      toast.success('CSR generated successfully')
    } catch {
      toast.error('Failed to generate CSR')
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    if (!importForm.domain || !importForm.certificate || !importForm.private_key) return
    setLoading(true)
    try {
      const { data } = await sslCsrApi.importSSL(importForm)
      setImportResult(data)
      toast.success('SSL certificate imported')
    } catch {
      toast.error('Failed to import certificate')
    } finally {
      setLoading(false)
    }
  }

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
    toast.success('Copied to clipboard')
  }

  const download = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">SSL / TLS</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate CSRs or import custom certificates</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        {(['generate', 'import'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {t === 'generate' ? 'Generate CSR' : 'Import Certificate'}
          </button>
        ))}
      </div>

      {tab === 'generate' && (
        <div className="space-y-4">
          <div className="bg-card border rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-sm flex items-center gap-2"><Shield className="h-4 w-4" />CSR Details</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-xs font-medium text-muted-foreground">Domain (Common Name)</label>
                <input value={csrForm.domain} onChange={e => setCsrForm(f => ({ ...f, domain: e.target.value }))}
                  placeholder="example.com" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Country Code</label>
                <input value={csrForm.country} onChange={e => setCsrForm(f => ({ ...f, country: e.target.value.toUpperCase().slice(0, 2) }))}
                  maxLength={2} placeholder="US" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background font-mono focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">State / Province</label>
                <input value={csrForm.state} onChange={e => setCsrForm(f => ({ ...f, state: e.target.value }))}
                  placeholder="California" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">City</label>
                <input value={csrForm.city} onChange={e => setCsrForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="San Francisco" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Organization</label>
                <input value={csrForm.organization} onChange={e => setCsrForm(f => ({ ...f, organization: e.target.value }))}
                  placeholder="Acme Corp" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input value={csrForm.email} onChange={e => setCsrForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="admin@example.com" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <button onClick={handleGenerate} disabled={!csrForm.domain || loading}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {loading ? 'Generating...' : 'Generate CSR + Private Key'}
            </button>
          </div>

          {csrResult && (
            <div className="space-y-3">
              {[
                { label: 'Certificate Signing Request (CSR)', content: csrResult.csr, key: 'csr', filename: `${csrForm.domain}.csr` },
                { label: 'Private Key — Keep this secret!', content: csrResult.private_key, key: 'key', filename: `${csrForm.domain}.key` },
              ].map(item => (
                <div key={item.key} className="bg-card border rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold">{item.label}</h3>
                    <div className="flex gap-2">
                      <button onClick={() => copy(item.content, item.key)} className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted transition-colors">
                        {copied === item.key ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}Copy
                      </button>
                      <button onClick={() => download(item.content, item.filename)} className="flex items-center gap-1 px-2 py-1 text-xs border rounded hover:bg-muted transition-colors">
                        <Download className="h-3 w-3" />Download
                      </button>
                    </div>
                  </div>
                  <pre className="text-xs font-mono bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap break-all max-h-40">
                    {item.content}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'import' && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-sm flex items-center gap-2"><Upload className="h-4 w-4" />Import Custom Certificate</h2>
          <div>
            <label className="text-xs font-medium text-muted-foreground">Domain</label>
            <input value={importForm.domain} onChange={e => setImportForm(f => ({ ...f, domain: e.target.value }))}
              placeholder="example.com" className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {[
            { label: 'Certificate (PEM)', field: 'certificate' as const, placeholder: '-----BEGIN CERTIFICATE-----\n...' },
            { label: 'Private Key (PEM)', field: 'private_key' as const, placeholder: '-----BEGIN RSA PRIVATE KEY-----\n...' },
            { label: 'CA Bundle (optional)', field: 'ca_bundle' as const, placeholder: '-----BEGIN CERTIFICATE-----\n...' },
          ].map(({ label, field, placeholder }) => (
            <div key={field}>
              <label className="text-xs font-medium text-muted-foreground">{label}</label>
              <textarea value={importForm[field]} onChange={e => setImportForm(f => ({ ...f, [field]: e.target.value }))}
                rows={5} placeholder={placeholder}
                className="mt-1 w-full border border-input rounded-lg px-3 py-2 text-xs bg-background font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring" />
            </div>
          ))}
          <button onClick={handleImport} disabled={!importForm.domain || !importForm.certificate || !importForm.private_key || loading}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {loading ? 'Importing...' : 'Import Certificate'}
          </button>
          {importResult && (
            <div className="text-xs bg-green-500/10 border border-green-500/20 text-green-500 rounded-lg px-3 py-2">
              Certificate imported. Expires: {new Date(importResult.expires_at).toLocaleDateString()}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
