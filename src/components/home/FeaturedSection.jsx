//* Negócios em destaque
import FeaturedCard from '../ui/FeaturedCard';

function FeaturedSection() {
    return (
        <>
            <section className="bg-sand-dark flex flex-col gap-10 items-center py-16 md:py-24">
                <section className='container'>
                    <section className="flex flex-col md:flex-row md:items-end justify-between mb-12">
                        <div>
                            <h2 className='mb-4 text-3xl font-head font-bold'>Destaques da semana</h2>
                            <p className='text-balance text-muted-foreground'>Os passeios e experiências mais procuradas pelos visitantes</p>
                        </div>
                        <a className='flex justify-center mt-4 py-2 px-5 border-2 border-dark-ocean rounded-full' href="">Ver todos</a>
                    </section>
                    <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 justify-items-center w-full">
                        <FeaturedCard />
                    </section>
                </section>
            </section>
        </>
    );
}

export default FeaturedSection;
