'use client'

import Link from 'next/link'
import {
  Globe, Plus, Database, Mail, HardDrive,
  Container, Shield, Bot, FolderOpen, Key,
  Code2, Server,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface QuickAction {
  href: string
  icon: React.ElementType
  label: string
  description: string
  color: string
}

const ACTIONS: QuickAction[] = [
  { href: '/domains?action=add',  icon: Globe,      label: 'Add Domain',     description: 'Create a new hosted domain',    color: 'text-blue-500 bg-blue-500/10' },
  { href: '/databases?action=new',icon: Database,   label: 'New Database',   description: 'Create MySQL or PostgreSQL DB', color: 'text-green-500 bg-green-500/10' },
  { href: '/email?action=new',    icon: Mail,       label: 'Add Mailbox',    description: 'Create an email account',       color: 'text-amber-500 bg-amber-500/10' },
  { href: '/ssl',                  icon: Key,        label: 'Issue SSL',      description: "Free Let's Encrypt certificate",color: 'text-purple-500 bg-purple-500/10' },
  { href: '/backups?action=run',  icon: HardDrive,  label: 'Run Backup',     description: 'Manual backup now',            color: 'text-orange-500 bg-orange-500/10' },
  { href: '/docker',               icon: Container,  label: 'Containers',     description: 'Manage Docker containers',      color: 'text-cyan-500 bg-cyan-500/10' },
  { href: '/security',             icon: Shield,     label: 'Security',       description: 'Security score & firewall',     color: 'text-red-500 bg-red-500/10' },
  { href: '/ai',                   icon: Bot,        label: 'AI Assistant',   description: 'Ask the AI anything',           color: 'text-indigo-500 bg-indigo-500/10' },
  { href: '/files',                icon: FolderOpen, label: 'File Manager',   description: 'Browse & edit files',           color: 'text-teal-500 bg-teal-500/10' },
  { href: '/php',                  icon: Code2,      label: 'PHP Settings',   description: 'Manage PHP versions & config',  color: 'text-violet-500 bg-violet-500/10' },
  { href: '/monitoring',           icon: Server,     label: 'Monitoring',     description: 'Live server metrics',           color: 'text-sky-500 bg-sky-500/10' },
  { href: '/marketplace',          icon: Plus,       label: 'Install App',    description: 'One-click WordPress, Laravel…', color: 'text-pink-500 bg-pink-500/10' },
]

interface QuickActionsProps {
  className?: string
  cols?: 2 | 3 | 4
}

export function QuickActions({ className, cols = 4 }: QuickActionsProps) {
  const colClass = { 2: 'grid-cols-2', 3: 'grid-cols-3', 4: 'grid-cols-2 sm:grid-cols-4' }[cols]

  return (
    <div className={cn(`grid gap-2 ${colClass}`, className)}>
      {ACTIONS.map(({ href, icon: Icon, label, description, color }) => (
        <Link
          key={href}
          href={href}
          className="group flex items-center gap-3 rounded-lg border border-border bg-card p-3 hover:bg-accent/50 hover:border-accent-foreground/20 transition-colors"
        >
          <div className={cn('rounded-lg p-2 shrink-0 transition-transform group-hover:scale-110', color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{label}</div>
            <div className="text-xs text-muted-foreground truncate">{description}</div>
          </div>
        </Link>
      ))}
    </div>
  )
}
