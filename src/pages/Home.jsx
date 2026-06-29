//* Junta todas as seções da home

import HeroSection from "../components/home/HeroSection";
import CategoriesSection from "../components/home/CategoriesSection";
import FeaturedSection from "../components/home/FeaturedSection";
import StastSection from "../components/home/StatsSection";
import CallToActionSection from "../components/home/CallToActionSection";

function Home () {
    return (
        <main>
            <HeroSection />
            <CategoriesSection />
            <FeaturedSection />
            <StastSection />
            <CallToActionSection />
        </main>
    )
}

export default Home;