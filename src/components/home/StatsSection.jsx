import StatsCard from '../ui/StatsCard';
import Reveal from '../ui/Reveal';
import { buildStatsSection } from '../../data/statsSection';
import { useBusinessCount } from '../../hooks/useBusinessCatalog';

function StatsSection() {
    const { data: businessCount } = useBusinessCount();
    const statsSection = buildStatsSection(businessCount);

    return (
        <section className="bg-gradient-ocean py-16 md:py-24">
            <div className="flex flex-col gap-8 lg:flex-row lg:justify-evenly lg:px-10">
                {statsSection.map((stat, index) => (
                    <Reveal key={`${stat.title}-${index}`} delay={index * 120}>
                        <StatsCard stat={stat} />
                    </Reveal>
                ))}
            </div>
        </section>
    );
}

export default StatsSection;
