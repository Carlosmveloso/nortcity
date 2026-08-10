import { Building2, Layers, RefreshCw } from "lucide-react";
import { businesses } from "./businesses";
import { popularCategories, otherCategories } from "./categories";

export const statsSection = [
    {
        icon: Building2,
        total: `${businesses.length}`,
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
