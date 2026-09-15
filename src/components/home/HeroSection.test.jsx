import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { HERO_IMAGE } from '../../lib/siteMeta';
import HeroSection from './HeroSection';

// O fundo do hero saiu de uma classe Tailwind (`bg-[url('...')]`) para `style`,
// porque o caminho agora vem de HERO_IMAGE — a mesma constante que gera o card
// de compartilhamento. A classe estática aparecia no CSS do build; o style só
// existe depois da renderização, então é aqui que se vê se ele continua lá.
describe('HeroSection', () => {
    function renderHero() {
        const { container } = render(
            <MemoryRouter>
                <HeroSection />
            </MemoryRouter>
        );

        return container.querySelector('section');
    }

    it('aplica a imagem do hero como fundo, com o gradiente por cima', () => {
        const section = renderHero();

        expect(section).toHaveStyle({
            backgroundImage: `linear-gradient(rgba(0,0,0,0.30),rgba(0,0,0,0.10)), url('${HERO_IMAGE}')`,
        });
    });

    // Estas continuam sendo classes: só a imagem foi para o style.
    it('mantém o enquadramento do fundo nas classes do Tailwind', () => {
        const section = renderHero();

        expect(section).toHaveClass('bg-cover', 'bg-center', 'bg-no-repeat', 'h-screen');
    });

    it('renderiza a busca da home', () => {
        renderHero();

        expect(screen.getByRole('search')).toBeInTheDocument();
    });
});
