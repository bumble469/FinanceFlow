'use client'

import { BarChart3, Users, TrendingUp, Clock, Shield, Zap } from 'lucide-react'

import { Reveal } from '@/components/animate/reveal'
import { Stagger, StaggerItem } from '@/components/animate/stagger'

export function FeaturesSection() {
  const features = [
    {
      icon: BarChart3,
      title: 'Multi-Plan Management',
      description:
        'Create and manage multiple financial plans - projects, events, or business operations. Track each independently with dedicated dashboards.',
    },
    {
      icon: Users,
      title: 'Team Management',
      description:
        'Organize team members by roles and teams. Track individual costs and assignments across your organization.',
    },
    {
      icon: TrendingUp,
      title: 'Real-time Analytics',
      description:
        'Monitor expenses, budgets, and financial health with real-time metrics and color-coded status indicators.',
    },
    {
      icon: Clock,
      title: 'Event Planning Mode',
      description:
        'Switch to event mode to track attendance, ticket prices, revenue, and break-even analysis for events.',
    },
    {
      icon: Shield,
      title: 'Secure & Private',
      description:
        'Enterprise-grade security with JWT authentication, encrypted passwords, and secure session management.',
    },
    {
      icon: Zap,
      title: 'What-If Scenarios',
      description:
        'Test different scenarios with simulation mode - adjust costs, team size, and revenue to see impacts instantly.',
    },
  ]

  return (
    <section
      id="features"
      className="w-full py-20 md:py-32 bg-secondary/15 backdrop-blur-[2px]"
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="space-y-12">

          {/* Section Header */}
          <Reveal>
            <div className="space-y-4 text-center">
              <h2 className="text-3xl md:text-5xl font-bold text-foreground text-balance">
                Powerful Features for Smart Financial Management
              </h2>
              <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
                Everything you need to manage finances efficiently, whether
                you're running a startup, planning an event, or managing a team.
              </p>
            </div>
          </Reveal>

          {/* Features Grid */}
          <Reveal delay={0.15}>
            <Stagger>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                {features.map((feature, index) => {
                  const Icon = feature.icon
                  return (
                    <StaggerItem key={index}>
                      <div className="group relative rounded-lg border border-border bg-background p-8 hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5">
                        {/* Icon */}
                        <div className="mb-4 inline-flex items-center justify-center rounded-lg bg-primary/10 p-3">
                          <Icon className="h-6 w-6 text-primary" />
                        </div>

                        {/* Content */}
                        <h3 className="mb-2 text-lg font-semibold text-foreground">
                          {feature.title}
                        </h3>
                        <p className="text-muted-foreground text-sm leading-relaxed">
                          {feature.description}
                        </p>

                        {/* Hover Accent */}
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
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
