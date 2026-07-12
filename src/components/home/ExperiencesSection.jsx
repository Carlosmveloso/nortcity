import ExperienceCard from '../ui/ExperienceCard';

function ExperiencesSection() {
    return (
        <>
            <section className="py-16 px-6 bg-background">
                <div className="text-center mb-12">
                    <h2 className="font-head font-bold text-foreground text-3xl mb-4">
                        Explorar por experiência
                    </h2>
                    <p className="text-muted-foreground mx-auto">
                        Roteiros e guias especiais para aproveitar o melhor de pitimbu.
                    </p>
                </div>
                <div className='flex flex-col gap-6'>
                    <ExperienceCard />
                </div>
            </section>
        </>
    );
}

export default ExperiencesSection;
