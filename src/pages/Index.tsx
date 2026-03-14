import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import HeroSection from "@/components/surte/HeroSection";
import CategoryGrid from "@/components/surte/CategoryGrid";
import FeaturedProducts from "@/components/surte/FeaturedProducts";

const Index = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main>
        <HeroSection />
        <CategoryGrid />
        <FeaturedProducts />
      </main>
      <BottomNav />
    </div>
  );
};

export default Index;
