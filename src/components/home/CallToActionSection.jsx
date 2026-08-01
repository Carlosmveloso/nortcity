import { callToAction } from '../../data/callToAction';
import CtaPromisse from '../ui/CtaPromisse';
import Reveal from '../ui/Reveal';
import { ArrowRight } from "lucide-react";

function CallToActionSection() {
    return (
        <section className="py-16 md:py-24 bg-background">
            <div className="container">
                <Reveal className="relative bg-card rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-2 gap-8 p-6 sm:p-8 md:p-12 lg:p-16">
                    <div>
                        <h2 className="font-head text-3xl md:text-4xl text-foreground font-bold mb-4">
                            {callToAction.title}
                        </h2>
                        <p className="text-lg text-muted-foreground mb-6 text-balance">{callToAction.description}</p>
                        <ul className='space-y-3 mb-8'>
                            {callToAction.promisses.map((promisse) => (
                                <CtaPromisse key={promisse.promisse} promisse={promisse} />
                            ))}
                        </ul>
                        <button
                            type="button"
                            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-secondary px-6 py-4 text-base font-medium text-secondary-foreground shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:bg-turquoise-light hover:shadow-xl sm:px-10 sm:text-lg lg:w-auto"
                        >
                            {callToAction.cta} <ArrowRight className="h-5 w-5 shrink-0" aria-hidden="true" />
                        </button>
                    </div>
                    <div className="hidden md:flex items-center justify-center">
                        <div className="relative flex items-center justify-center">
                            <div className="h-64 w-64 rounded-full bg-gradient-ocean opacity-20 blur-2xl" aria-hidden="true"></div>
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                <span className="font-head text-6xl font-bold text-blue-secondary">100%</span>
                                <span className="text-lg font-medium text-foreground">Gratuito</span>
                                <span className="text-sm text-muted-foreground">para começar</span>
                            </div>
                        </div>
                    </div>
                </Reveal>
            </div>
        </section>
    );
}

export default CallToActionSection;
