//* Junta todas as seções da home

import HeroSection from "../components/home/HeroSection";
import CategoriesSection from "../components/home/CategoriesSection";
import FeaturedSection from "../components/home/FeaturedSection";
import StatsSection from "../components/home/StatsSection";
import CallToActionSection from "../components/home/CallToActionSection";
import ExperiencesSection from "../components/home/ExperiencesSection";
import SEO from "../components/SEO";

function Home () {
    return (
        <>
            <SEO description="Farol Pitimbu — o guia digital do litoral sul da Paraíba. Passeios, gastronomia, hospedagem e serviços locais em Pitimbu." />
            <HeroSection />
            <CategoriesSection />
            <FeaturedSection />
            <ExperiencesSection />
            <StatsSection />
            <CallToActionSection />
        </>
    )
}

export default Home;