import { useEffect } from 'react';

const SITE_NAME = 'Farol Pitimbu';
const DEFAULT_DESCRIPTION =
    'Farol Pitimbu — o guia digital do litoral sul da Paraíba. Encontre passeios, gastronomia, hospedagem e serviços locais em Pitimbu.';

function SEO({ title, description = DEFAULT_DESCRIPTION }) {
    useEffect(() => {
        document.title = title ? `${title} | ${SITE_NAME}` : SITE_NAME;

        const meta = document.querySelector('meta[name="description"]');
        if (meta) meta.setAttribute('content', description);

        return () => {
            document.title = SITE_NAME;
            if (meta) meta.setAttribute('content', DEFAULT_DESCRIPTION);
        };
    }, [title, description]);

    return null;
}

export default SEO;
