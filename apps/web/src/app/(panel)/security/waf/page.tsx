'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Shield, ShieldCheck, ShieldAlert, ToggleLeft, ToggleRight } from 'lucide-react'
import { modsecApi } from '@/lib/api/hosting.api'
import { toast } from 'sonner'

const MODES = [
  { value: 'On', label: 'Enforcing', desc: 'Block malicious requests', color: 'text-green-500' },
  { value: 'DetectionOnly', label: 'Detection Only', desc: 'Log but do not block', color: 'text-amber-500' },
  { value: 'Off', label: 'Disabled', desc: 'WAF is inactive', color: 'text-red-500' },
]

export default function WAFPage() {
  const qc = useQueryClient()

  const { data: status } = useQuery({
    queryKey: ['modsec-status'],
    queryFn: () => modsecApi.getStatus().then(r => r.data),
  })

  const { data: rulesData, isLoading } = useQuery({
    queryKey: ['modsec-rules'],
    queryFn: () => modsecApi.listRules().then(r => r.data),
  })

  const setModeMutation = useMutation({
    mutationFn: (mode: string) => modsecApi.setMode(mode),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['modsec-status'] }); toast.success('WAF mode updated') },
    onError: () => toast.error('Failed to update mode'),
  })

  const toggleRuleMutation = useMutation({
    mutationFn: (d: { file: string; line: number; enabled: boolean }) => modsecApi.toggleRule(d),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['modsec-rules'] }),
  })

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ModSecurity WAF</h1>
        <p className="text-muted-foreground text-sm mt-1">Web Application Firewall rules and configuration</p>
      </div>

      {/* Status card */}
      <div className="bg-card border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          {status?.installed ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <ShieldAlert className="h-5 w-5 text-amber-500" />
          )}
          <div>
            <h2 className="font-semibold text-sm">ModSecurity Status</h2>
            <p className="text-xs text-muted-foreground">
              {status?.installed ? 'Installed and available' : 'Not installed — install ModSecurity to enable WAF'}
            </p>
          </div>
        </div>

        {status?.installed && (
          <div className="flex gap-2">
            {MODES.map(m => (
              <button key={m.value} onClick={() => setModeMutation.mutate(m.value)}
                className={`flex-1 flex flex-col items-center p-3 rounded-lg border transition-all ${
                  status.mode === m.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:bg-muted'
                }`}>
                <Shield className={`h-4 w-4 mb-1 ${status.mode === m.value ? m.color : 'text-muted-foreground'}`} />
                <span className="text-xs font-medium">{m.label}</span>
                <span className="text-[10px] text-muted-foreground mt-0.5">{m.desc}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Rules */}
      {status?.installed && (
        <div className="bg-card border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b">
            <span className="font-semibold text-sm">Rules ({rulesData?.total ?? 0})</span>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Loading rules...</div>
          ) : !rulesData?.rules.length ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No rules found in {'/etc/modsecurity/rules'}
            </div>
          ) : (
            <div className="divide-y max-h-[500px] overflow-y-auto">
              {(rulesData.rules as Array<{ id: string; file: string; line: number; message: string; enabled: boolean }>).map((rule, i) => (
                <div key={i} className="flex items-center justify-between px-5 py-2.5 hover:bg-muted/30">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono text-muted-foreground w-16">{rule.id || '—'}</span>
                    <div>
                      <p className="text-sm">{rule.message}</p>
                      <p className="text-xs text-muted-foreground">{rule.file}:{rule.line}</p>
                    </div>
                  </div>
                  <button onClick={() => toggleRuleMutation.mutate({ file: rule.file, line: rule.line, enabled: !rule.enabled })}>
                    {rule.enabled
                      ? <ToggleRight className="h-5 w-5 text-green-500" />
                      : <ToggleLeft className="h-5 w-5 text-muted-foreground" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!status?.installed && (
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold text-sm mb-2">Installation</h2>
          <pre className="text-xs font-mono bg-muted/50 rounded-lg p-3 overflow-x-auto">
{`# Ubuntu/Debian
apt install libapache2-mod-security2
a2enmod security2

# CentOS/RHEL
yum install mod_security

# Enable OWASP Core Rule Set
git clone https://github.com/coreruleset/coreruleset /etc/modsecurity/crs`}
          </pre>
        </div>
      )}
    </div>
  )
}
