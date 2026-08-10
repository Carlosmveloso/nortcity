import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

function ComingSoon({ title, description }) {
    return (
        <section className="min-h-screen flex flex-col items-center justify-center gap-4 px-4 py-32 text-center bg-background">
            <span className="rounded-full bg-turquoise/10 px-4 py-1 text-sm font-semibold text-turquoise">
                Em construção
            </span>
            <h1 className="font-head text-3xl font-extrabold text-dark-ocean md:text-4xl">{title}</h1>
            <p className="max-w-md text-dark-ocean/70">{description}</p>
            <Link
                to="/"
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-turquoise px-6 py-3 font-bold text-sand"
            >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                Voltar para a home
            </Link>
        </section>
    );
}

export default ComingSoon;
