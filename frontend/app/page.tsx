import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/NavBar";
import { AiCopilotSection } from "@/components/landing/AiCopilotSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { HeroSection } from "@/components/landing/HeroSection";
import { WorkflowBand } from "@/components/landing/WorkflowBand";
import { connection } from "next/server";

export default async function Home() {
  await connection();
  const aiEnabled = process.env.AI_ENABLED === "true";

  return (
    <div className="min-h-screen overflow-hidden bg-[#09090B] text-zinc-50">
      <div className="relative mx-auto w-full max-w-[1440px] px-6 py-9 lg:px-10 xl:px-[72px] 2xl:px-[110px]">
        <Navbar aiEnabled={aiEnabled} />

        <main>
          <HeroSection />
          {aiEnabled ? <AiCopilotSection /> : null}
          <FeaturesSection />
          <WorkflowBand />
        </main>

        <Footer />
      </div>
    </div>
  );
}
