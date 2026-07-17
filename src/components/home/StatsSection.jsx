//* Números do projeto
import StatsCard from '../ui/StatsCard';

function StatsSection() {
    return (
        <>
            <section className="bg-gradient-ocean py-16 md:py-24">
                <section className="flex flex-col gap-8 lg:flex-row lg:justify-evenly lg:px-10">
                    <StatsCard />
                </section>
            </section>
        </>
    );
}

export default StatsSection;
