import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import BusinessCard from './BusinessCard';

function renderCard(business) {
    return render(
        <MemoryRouter>
            <BusinessCard business={{ id: 'x', name: 'Negócio X', categories: ['servicos'], ...business }} />
        </MemoryRouter>
    );
}

describe('BusinessCard', () => {
    // O caso real: JN Gessos foi cadastrado pelo /admin com WhatsApp e sem
    // telefone. O card lia `business.phone`, chamava phone.replace(...) em null
    // e a exceção subia até o ErrorBoundary — a segunda página de
    // /explorar?categoria=servicos virava "Algo deu errado".
    it('renderiza negócio sem telefone, com WhatsApp preenchido', () => {
        renderCard({ name: 'JN Gessos', phone: null, whatsapp: '(83) 99605-7329' });

        expect(screen.getByText('JN Gessos')).toBeInTheDocument();
        const url = new URL(screen.getByLabelText('Contatar JN Gessos pelo WhatsApp').href);
        expect(url.pathname).toBe('/5583996057329');
        expect(url.searchParams.get('text')).toBe('Olá! Encontrei JN Gessos no Farol Pitimbu e gostaria de mais informações.');
    });

    it('renderiza negócio sem telefone e sem WhatsApp, escondendo o botão', () => {
        renderCard({ name: 'Só Instagram', phone: null, whatsapp: null, instagram: 'sozinho' });

        expect(screen.getByText('Só Instagram')).toBeInTheDocument();
        expect(screen.queryByLabelText('Contatar Só Instagram pelo WhatsApp')).not.toBeInTheDocument();
        expect(screen.getByLabelText('Instagram de Só Instagram')).toBeInTheDocument();
    });

    it('usa o telefone como reserva quando não há WhatsApp', () => {
        renderCard({ name: 'Só Telefone', phone: '(83) 99804-9503', whatsapp: null });

        const url = new URL(screen.getByLabelText('Contatar Só Telefone pelo WhatsApp').href);
        expect(url.pathname).toBe('/5583998049503');
        expect(url.searchParams.get('text')).toBe('Olá! Encontrei Só Telefone no Farol Pitimbu e gostaria de mais informações.');
    });

    it('renderiza negócio sem subcategoria e sem descrição', () => {
        renderCard({ name: 'Mínimo', subcategory: null, description: null, phone: '83999999999' });

        expect(screen.getByText('Mínimo')).toBeInTheDocument();
    });
});
