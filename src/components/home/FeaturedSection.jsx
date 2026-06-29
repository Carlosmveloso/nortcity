//* Negócios em destaque
import FeaturedCard from '../ui/FeaturedCard';

function FeaturedSection() {
    return (
        <>
            <section className="bg-sand flex flex-col gap-10 items-center py-16">
                <section className="w-9/10">
                    <h2 className='mb-4 text-3xl font-head font-bold'>Destaques da semana</h2>
                    <p className='text-balance text-muted-foreground'>Os passeios e experiências mais procuradas pelos visitantes</p>
                    <a className='flex justify-center mt-4 py-2 px-5 border-2 border-dark-ocean rounded-full' href="">Ver todos</a>
                </section>
                <section className="w-9/10">
                    <FeaturedCard />
                </section>
            </section>
        </>
    );
}

export default FeaturedSection;
