import ExperienceCard from '../ui/ExperienceCard';
import { experiencesSection } from '../../data/experiencesSection';

function ExperiencesSection() {
    return (
        <>
            <section className="py-16 px-6 bg-background">
                <div className="text-center mb-12">
                    <h2 className="font-head font-bold text-foreground text-3xl mb-4">
                        {experiencesSection.title}
                    </h2>
                    <p className="text-muted-foreground mx-auto">
                        {experiencesSection.description}
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
