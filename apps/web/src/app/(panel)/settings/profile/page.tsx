'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, Camera, Save, Globe, Bell } from 'lucide-react'
import { motion } from 'framer-motion'

const profileSchema = z.object({
  first_name: z.string().min(1, 'Required'),
  last_name: z.string().min(1, 'Required'),
  email: z.string().email(),
  username: z.string().min(3),
  timezone: z.string(),
  language: z.string(),
})

type ProfileForm = z.infer<typeof profileSchema>

const TIMEZONES = ['UTC', 'America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Europe/Berlin', 'Europe/Paris', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney']
const LANGUAGES = [{ value: 'en', label: 'English' }, { value: 'de', label: 'Deutsch' }, { value: 'fr', label: 'Français' }, { value: 'es', label: 'Español' }, { value: 'ja', label: '日本語' }]

export default function ProfilePage() {
  const [saved, setSaved] = useState(false)
  const { register, handleSubmit, formState: { errors, isDirty } } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      first_name: 'Admin',
      last_name: 'User',
      email: 'admin@example.com',
      username: 'admin',
      timezone: 'UTC',
      language: 'en',
    },
  })

  const onSubmit = (data: ProfileForm) => {
    console.log('Profile update:', data)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Profile</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage your personal information and preferences</p>
      </div>

      {/* Avatar */}
      <div className="bg-card border rounded-xl p-6">
        <h2 className="font-semibold mb-4">Profile Picture</h2>
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="h-20 w-20 rounded-full bg-gradient-to-br from-primary to-primary/50 flex items-center justify-center text-primary-foreground text-2xl font-bold">
              AU
            </div>
            <button className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors">
              <Camera className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-1">
            <p className="font-medium text-sm">Admin User</p>
            <p className="text-xs text-muted-foreground">JPG, GIF or PNG. 1MB max.</p>
            <button className="text-xs text-primary hover:underline">Upload new picture</button>
          </div>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="bg-card border rounded-xl p-6 space-y-5">
        <h2 className="font-semibold">Personal Information</h2>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">First Name</label>
            <input {...register('first_name')} className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {errors.first_name && <p className="text-xs text-destructive">{errors.first_name.message}</p>}
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Last Name</label>
            <input {...register('last_name')} className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
            {errors.last_name && <p className="text-xs text-destructive">{errors.last_name.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Email Address</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input {...register('email')} type="email" className="w-full h-9 pl-9 pr-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium">Username</label>
          <div className="flex items-center">
            <span className="h-9 px-3 border border-r-0 rounded-l-md bg-muted text-sm flex items-center text-muted-foreground">@</span>
            <input {...register('username')} className="flex-1 h-9 px-3 rounded-r-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
          {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" />Timezone</label>
            <select {...register('timezone')} className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium flex items-center gap-1.5"><Bell className="h-3.5 w-3.5" />Language</label>
            <select {...register('language')} className="w-full h-9 px-3 rounded-md border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" disabled={!isDirty} className="flex items-center gap-2 h-9 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            <Save className="h-4 w-4" />Save Changes
          </button>
          {saved && (
            <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-green-500 font-medium">
              Profile saved!
            </motion.span>
          )}
        </div>
      </form>
    </div>
  )
}
