'use client';

import { useEffect, useState } from 'react';
import { TopNav } from "@/components/layout/top-nav";
import { OverviewPage } from "@/components/overview/overview-page";
import { authClient } from '@/lib/auth-client';
import { useSnackbar } from '@/lib/useSnackbar';
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
export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const setCurrentUser = useFinancialStore((s) => s.setCurrentUser);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await authClient.request('/api/auth/me');

        const user = res.data?.data;
        if (user) {
          authClient.setUser(user);
          setCurrentUser(user);
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      } catch (err) {
        setIsAuthenticated(false);
      }
    }

    checkAuth();
  }, []);

  return (
    <>
      {isAuthenticated ? (
        <div className="min-h-screen bg-background">
          <TopNav />
          <main className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
            <OverviewPage />
          </main>
        </div>
      ) : (
        <div className="relative min-h-screen bg-background">
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