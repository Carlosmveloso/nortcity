//* Convite para cadastrar negócio
import { callToAction } from '../../data/callToAction';
import CtaPromisse from '../ui/CtaPromisse';
import { ArrowRight } from "lucide-react";

function CallToActionSection() {
    return (
        <>
            <section className="container py-16 md:py-24 bg-background">
                <div className="relative overflow-hidden flex flex-col items-center p-8 md:p-12 lg:p-16 rounded-3xl bg-card shadow-xl">
                    <div className="absolute top-0 right-0 h-full w-1/2 bg-linear-to-l from-turquoise/10 to-transparent"></div>
                    <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-turquoise/20 blur-3xl"></div>
                    <h2 className="font-head text-3xl md:text-4xl text-foreground font-bold mb-4">
                        {callToAction.title}
                    </h2>
                    <p className="text-lg text-muted-foreground mb-6 text-balance">{callToAction.description}</p>
                    <ul className='space-y-3 mb-8'>
                        <CtaPromisse />
                    </ul>
                    <button className='flex gap-2 items-center justify-center whitespace-nowrap font-medium bg-blue-secondary shadow-lg rounded-4xl px-10 py-4 text-lg text-secondary-foreground'>
                        {callToAction.cta} <ArrowRight className='w-5 h-5'/>
                    </button>
                </div>
            </section>
        </>
    );
}

export default CallToActionSection;
