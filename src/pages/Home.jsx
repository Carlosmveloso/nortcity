//* Junta todas as seções da home

import HeroSection from "../components/home/HeroSection";
import CategoriesSection from "../components/home/CategoriesSection";
import FeaturedSection from "../components/home/FeaturedSection";
import StatsSection from "../components/home/StatsSection";
import CallToActionSection from "../components/home/CallToActionSection";
import ExperiencesSection from "../components/home/ExperiencesSection";

function Home () {
    return (
        <main>
            <HeroSection />
            <CategoriesSection />
            <FeaturedSection />
            <ExperiencesSection />
            <StatsSection />
            <CallToActionSection />

        </main>
    )
}

export default Home;