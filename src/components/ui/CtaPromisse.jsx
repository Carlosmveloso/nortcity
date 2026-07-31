import { CircleCheckBig } from 'lucide-react';

function CtaPromisse({ promisse }) {
    return (
        <li className="flex gap-3 items-center text-foreground">
            <CircleCheckBig className='w-5 h-5 shrink-0 text-blue-secondary' aria-hidden="true" /> {promisse.promisse}
        </li>
    );
}

export default CtaPromisse;
