'use client'

import { LayoutTemplate, UsersRound, LineChart } from 'lucide-react'

import { Reveal } from '@/components/animate/reveal'
import { Stagger, StaggerItem } from '@/components/animate/stagger'

export function HowItWorksSection() {
  const steps = [
    {
      icon: LayoutTemplate,
      number: '01',
      title: 'Create a Plan',
      description:
        'Start a Project or an Event plan. Each gets its own dashboard, budget, and structure — departments and phases for projects, ticketing and stalls for events.',
    },
    {
      icon: UsersRound,
      number: '02',
      title: 'Bring in Your Team',
      description:
        'Invite members, assign roles, and set granular permissions. Split costs across departments, track hardware, and manage who can approve what.',
    },
    {
      icon: LineChart,
      title: 'Monitor & Analyze',
      description:
        'Watch tasks move, milestones extend or complete, and money flow through analytics, timeline charts, and live presence indicators.',
      number: '03',
    },
  ]

  return (
    <section id="about" className="relative w-full py-20 md:py-32 bg-transparent">
      <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-chart-2/10 blur-[120px] -z-10" />

      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="space-y-12">
          <Reveal>
            <div className="space-y-4 text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-foreground text-balance">
                How FinanceFlow works
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Three steps from a blank plan to a fully tracked project or event.
              </p>
            </div>
          </Reveal>

          <Reveal delay={0.15}>
            <Stagger>
              <div className="grid md:grid-cols-3 gap-10">
                {steps.map((step, index) => {
                  const Icon = step.icon
                  return (
                    <StaggerItem key={index}>
                      <div className="relative space-y-5 rounded-2xl border border-border/60 bg-card/30 backdrop-blur-sm p-6">
                        <div className="h-1.5 w-14 rounded-full bg-gradient-to-r from-primary to-chart-2" />
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-11 h-11 rounded-full bg-primary/10">
                            <span className="text-primary font-bold text-sm">{step.number}</span>
                          </div>
                          <div className="w-10 h-10 rounded-full bg-secondary/60 flex items-center justify-center">
                            <Icon className="h-5 w-5 text-primary" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <h3 className="text-lg font-semibold text-foreground">{step.title}</h3>
                          <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
                        </div>
                      </div>
                    </StaggerItem>
                  )
                })}
              </div>
            </Stagger>
          </Reveal>
        </div>
      </div>
    </section>
  )
}