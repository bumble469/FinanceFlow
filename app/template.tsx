import { SystemThemeSync } from '@/components/system-theme-sync'

/**
 * Next.js wraps every page in this template, inside the root layout (and so
 * inside <ThemeProvider>). It mounts the sync that gives the "System" theme
 * its own greyish palette (see app/system-theme.css).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SystemThemeSync />
      {children}
    </>
  )
}
