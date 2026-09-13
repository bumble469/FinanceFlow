'use client'

import { useState } from 'react'
import { CalendarDays, Briefcase } from 'lucide-react'

import { Reveal } from '@/components/animate/reveal'

export function UseCasesSection() {
  const [active, setActive] = useState<'project' | 'event'>('project')

  const content = {
    project: {
      title: 'Projects',
      points: [
        'Departments and phases with their own budgets',
        'Task dependencies, milestones, and extension requests',
        'Resource cost analysis and budget variance tracking',
      ],
    },
    event: {
      title: 'Events',
      points: [
        'Ticketing, stalls, and per-department cost splitting',
        'Attendance, ticket revenue, and break-even tracking',
        'Hardware requests and rental cost tracking',
      ],
    },
  }

  const current = content[active]

  return (
    <section className="relative w-full py-20 md:py-32 bg-transparent">
      <div className="mx-auto max-w-5xl px-6 lg:px-8">
        <Reveal>
          <div className="text-center space-y-4 mb-12">
            <h2 className="text-3xl md:text-5xl font-bold text-foreground text-balance">Built for both</h2>
            <p className="mx-auto max-w-xl text-lg text-muted-foreground">
              One platform, two plan types — each with structure that fits.
            </p>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="flex justify-center gap-3 mb-10">
            <button
              onClick={() => setActive('project')}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border transition-colors ${
                active === 'project'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              <Briefcase className="h-4 w-4" /> Projects
            </button>
            <button
              onClick={() => setActive('event')}
              className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium border transition-colors ${
                active === 'event'
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-transparent text-muted-foreground border-border hover:border-primary/40'
              }`}
            >
              <CalendarDays className="h-4 w-4" /> Events
            </button>
          </div>

          <div className="rounded-2xl border border-border bg-card/40 backdrop-blur-sm p-8 md:p-12">
            <h3 className="text-2xl font-semibold text-foreground mb-6">{current.title}</h3>
            <ul className="space-y-4">
              {current.points.map((p) => (
                <li key={p} className="flex items-start gap-3 text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  )
}