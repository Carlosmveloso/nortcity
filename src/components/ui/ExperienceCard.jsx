import { ArrowRight } from "lucide-react"

import { experiencesSection } from '../../data/experiencesSection';

function ExperienceCard() {
    return (
        <>
            {experiencesSection.map((experience) => {
                return (
                    <section
                        key={experience.title}
                        style={{ backgroundImage: `url(${experience.bgImg})` }}
                        className="relative min-h-45 rounded-2xl overflow-hidden bg-cover bg-center shadow-lg"
                    >
                        <div className="absolute inset-0 bg-black/30" />
                        <div className="relative z-10 min-h-45 flex flex-col justify-center p-5">
                            <p className="font-head font-bold text-xl text-card mb-2">
                                {experience.title}
                            </p>
                            <p className="text-card/80 mb-4">{experience.description}</p>
                            <a href="" className="flex items-center gap-2 text-blue-secondary font-medium">
                                Explorar <ArrowRight size={16}/>
                            </a>
                        </div>
                    </section>
                );
            })}
        </>
    );
}

export default ExperienceCard;
