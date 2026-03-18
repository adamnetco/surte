import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import HeroSection from "@/components/surte/HeroSection";
import CategoryGrid from "@/components/surte/CategoryGrid";
import FeaturedProducts from "@/components/surte/FeaturedProducts";
import BannerCarousel from "@/components/surte/BannerCarousel";
import TestimonialsSection from "@/components/surte/TestimonialsSection";
import GallerySection from "@/components/surte/GallerySection";
import BrandsSection from "@/components/surte/BrandsSection";
import FloatingCart from "@/components/surte/FloatingCart";

const Index = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main>
        <HeroSection />
        <BannerCarousel />
        <CategoryGrid />
        <FeaturedProducts />
        <BrandsSection />
        <GallerySection />
        <TestimonialsSection />
      </main>
      <FloatingCart />
      <BottomNav />
    </div>
  );
};

export default Index;
