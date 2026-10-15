'use client'

import * as React from 'react'
import { useTheme } from 'next-themes'
import '@/app/system-theme.css'

/**
 * next-themes resolves "system" to plain light/dark, which made System look
 * identical to Dark. This adds a `theme-system` class on <html> whenever the
 * user picked "System", so system-theme.css can give it a greyish palette.
 * Render it inside <ThemeProvider>.
 */
export function SystemThemeSync() {
  const { theme } = useTheme()

  React.useEffect(() => {
    document.documentElement.classList.toggle('theme-system', theme === 'system')
  }, [theme])

  return null
}
