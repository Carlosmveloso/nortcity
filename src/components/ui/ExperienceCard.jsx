import { ArrowRight } from "lucide-react"

function ExperienceCard({ experience }) {
    return (
        <a
            href="#"
            className="group relative block aspect-video overflow-hidden rounded-2xl shadow-lg"
        >
            <img
                src={experience.bgImg}
                alt={experience.title}
                loading="lazy"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-dark-ocean/85 via-dark-ocean/50 to-transparent" />
            <div className="absolute inset-0 flex items-center p-6 md:p-8">
                <div className="max-w-md">
                    <p className="font-head font-bold text-xl md:text-2xl text-card mb-2">
                        {experience.title}
                    </p>
                    <p className="text-card/80 mb-4">{experience.description}</p>
                    <span className="inline-flex items-center gap-2 text-turquoise-light font-medium transition-all duration-300 group-hover:gap-3">
                        Explorar
                        <ArrowRight size={16} aria-hidden="true" />
                    </span>
                </div>
            </div>
        </a>
    );
}

export default ExperienceCard;
