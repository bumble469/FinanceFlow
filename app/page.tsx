'use client';

import { useEffect, useState } from 'react';
import { AppShell } from "@/components/layout/app-shell";
import { OverviewPage } from "@/components/overview/overview-page";
import { authClient } from '@/lib/auth-client';
import { LandingHeader } from "@/components/landing/header";
import { HeroSection } from "@/components/landing/hero";
import { FeaturesSection } from "@/components/landing/features";
import { HowItWorksSection } from "@/components/landing/how-it-works";
import { WhyFinanceFlowSection } from "@/components/landing/why-financeflow";
import { UseCasesSection } from "@/components/landing/use-cases";
import { CTASection } from "@/components/landing/cta-section";
import { LandingFooter } from "@/components/landing/footer";
import { VantaBackground } from "@/components/landing/vanta-background";
import { useFinancialStore } from '@/lib/store';
import { Loader } from '@/components/shared/loader';

type AuthState = 'checking' | 'authed' | 'guest';

export default function Home() {
  const currentUser = useFinancialStore((s) => s.currentUser);
  const setCurrentUser = useFinancialStore((s) => s.setCurrentUser);
  const [authState, setAuthState] = useState<AuthState>(currentUser ? 'authed' : 'checking');

  useEffect(() => {
    if (currentUser) {
      setAuthState('authed');
      return;
    }
    let cancelled = false;
    async function checkAuth() {
      try {
        const res = await authClient.request('/api/auth/me');
        const user = res.data?.data;
        if (cancelled) false;
        if (user) {
          authClient.setUser(user);
          setCurrentUser(user);
          setAuthState('authed');
        } else {
          setAuthState('guest');
        }
      } catch (err) {
        if (!cancelled) setAuthState('guest');
      }
    }
    checkAuth();
  }, []);

  if (authState === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader />
      </div>
    );
  }

  return (
    <>
      {authState === 'authed' ? (
        <AppShell>
          <OverviewPage />
        </AppShell>
      ) : (
        <div className="relative min-h-screen">
          <VantaBackground />
          <div className="relative z-10">
            <LandingHeader />
            <HeroSection />
            <WhyFinanceFlowSection />
            <FeaturesSection />
            <UseCasesSection />
            <HowItWorksSection />
            <CTASection />
            <LandingFooter />
          </div>
        </div>
      )}
    </>
  );
}