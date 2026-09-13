'use client'

import { Reveal } from '@/components/animate/reveal'
import { Stagger, StaggerItem } from '@/components/animate/stagger'
import { BlobBackground } from '@/components/landing/blob-background'

export function WhyFinanceFlowSection() {
  const reasons = [
    {
      number: '01',
      title: 'One source of truth',
      description: 'Work and money live on the same record — no separate spreadsheet to reconcile after the fact.',
    },
    {
      number: '02',
      title: 'Permissions that actually hold',
      description: 'Every role and every action is checked server-side, not just hidden in the UI.',
    },
    {
      number: '03',
      title: 'Built for how teams really work',
      description: 'Departments and phases for projects, ticketing and stalls for events — not a generic template.',
    },
    {
      number: '04',
      title: 'Nothing gets lost',
      description: 'Extension requests, submissions, and approvals are all logged with full history.',
    },
  ]

  return (
    <section id="why" className="relative w-full py-20 md:py-32 bg-transparent overflow-hidden">
      <BlobBackground variant="subtle" />
      <div className="mx-auto max-w-6xl px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-16 items-start">
          <Reveal>
            <div className="space-y-4 md:sticky md:top-32">
              <h2 className="text-3xl md:text-5xl font-bold text-foreground text-balance">
                Why teams pick FinanceFlow
              </h2>
              <p className="text-lg text-muted-foreground max-w-md">
                Most tools make you choose between managing the work or managing the budget. FinanceFlow does both, together.
              </p>
            </div>
          </Reveal>

          <Stagger>
            <div className="space-y-10">
              {reasons.map((r) => (
                <StaggerItem key={r.number}>
                  <div className="flex gap-5">
                    <span className="text-sm font-bold text-primary pt-1 shrink-0">{r.number}</span>
                    <div className="space-y-1.5 border-l border-border pl-5">
                      <h3 className="text-lg font-semibold text-foreground">{r.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{r.description}</p>
                    </div>
                  </div>
                </StaggerItem>
              ))}
            </div>
          </Stagger>
        </div>
      </div>
    </section>
  )
}