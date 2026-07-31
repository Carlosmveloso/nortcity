import ExperienceCard from '../ui/ExperienceCard';
import { experiencesSection } from '../../data/experiencesSection';

function ExperiencesSection() {
    return (
        <section className="py-16 md:py-24 px-6 bg-background">
            <div className='container'>
                <div className="text-center mb-12">
                    <h2 className="font-head font-bold text-foreground text-3xl mb-4">
                        {experiencesSection.title}
                    </h2>
                    <p className="text-muted-foreground mx-auto">
                        {experiencesSection.description}
                    </p>
                </div>
                <div className='grid grid-cols-1 md:grid-cols-2 gap-6'>
                    {experiencesSection.experiences.map((experience, index) => (
                        <ExperienceCard key={`${experience.title}-${index}`} experience={experience} />
                    ))}
                </div>
            </div>
        </section>
    );
}

export default ExperiencesSection;
