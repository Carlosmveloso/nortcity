//* Junta todas as seções da home

import HeroSection from "../components/home/HeroSection";
import CategoriesSection from "../components/home/CategoriesSection";
import FeaturedSection from "../components/home/FeaturedSection";
import StatsSection from "../components/home/StatsSection";
import CallToActionSection from "../components/home/CallToActionSection";
import ExperiencesSection from "../components/home/ExperiencesSection";
import { usePageMeta } from '../hooks/usePageMeta';
import { staticPageMeta } from '../lib/siteMeta';

function Home () {
    usePageMeta(staticPageMeta('/'));

    return (
        <>
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