import StatsCard from '../ui/StatsCard';
import { statsSection } from '../../data/statsSection';

function StatsSection() {
    return (
        <section className="bg-gradient-ocean py-16 md:py-24">
            <div className="flex flex-col gap-8 lg:flex-row lg:justify-evenly lg:px-10">
                {statsSection.map((stat, index) => (
                    <StatsCard key={`${stat.title}-${index}`} stat={stat} />
                ))}
            </div>
        </section>
    );
}

export default StatsSection;
