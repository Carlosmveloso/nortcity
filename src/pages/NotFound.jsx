import ComingSoon from '../components/ui/ComingSoon';
import { usePageMeta } from '../hooks/usePageMeta';
import { notFoundMeta } from '../lib/siteMeta';

function NotFound() {
    usePageMeta(notFoundMeta());

    return (
        <ComingSoon
            title="Página não encontrada"
            description="A página que você procura não existe ou foi movida."
        />
    );
}

export default NotFound;
