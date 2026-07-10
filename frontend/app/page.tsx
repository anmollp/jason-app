import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/NavBar";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { WorkflowBand } from "@/components/landing/WorkflowBand";

export default function Home() {
  return (
    <div className="min-h-screen overflow-hidden bg-[#09090B] text-zinc-50">
      <div className="relative mx-auto w-full max-w-[1440px] px-6 py-9 lg:px-10 xl:px-[72px] 2xl:px-[110px]">
        <Navbar />

        <main>
          <HeroSection />
          <FeaturesSection />
          <WorkflowBand />
        </main>

        <Footer />
      </div>
    </div>
  );
}
