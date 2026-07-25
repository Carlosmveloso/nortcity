import { callToAction } from '../../data/callToAction';
import { CircleCheckBig } from 'lucide-react';

function CtaPromisse() {
    return (
        <>
            {callToAction.promisses.map((promisse) => {
                return (
                    <li key={promisse.promisse} className="flex gap-3 items-center text-foreground whitespace-nowrap">
                        <CircleCheckBig className='w-5 h-5 text-blue-secondary'/> {promisse.promisse}
                    </li>
                );
            })}
        </>
    );
}

export default CtaPromisse;
