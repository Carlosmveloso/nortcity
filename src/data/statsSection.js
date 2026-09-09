import { Building2, Layers, RefreshCw } from "lucide-react";
import { popularCategories, otherCategories } from "./categories";

// O total de negócios vem do banco (useBusinessCount), não de um arquivo: até
// 09/09/2026 esta seção anunciava 81 cadastros com 80 publicados, porque contava
// as linhas do catálogo estático. Enquanto a contagem não chega, o card mostra
// "—" em vez de piscar "0".
export function buildStatsSection(businessCount) {
    return [
        {
            icon: Building2,
            total: businessCount === null ? '—' : `${businessCount}`,
            title: 'Negócios cadastrados',
            description: 'Empresas e profissionais locais',
        },
        {
            icon: Layers,
            total: `${popularCategories.length + otherCategories.length}`,
            title: 'Categorias',
            description: 'Passeios, hospedagem, gastronimia e mais',
        },
        {
            icon: RefreshCw,
            total: 'Semanal',
            title: 'Atualizado',
            description: 'Informações sempre em dia',
        },
    ];
}
