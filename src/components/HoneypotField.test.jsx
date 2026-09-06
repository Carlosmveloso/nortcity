import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import HoneypotField from './HoneypotField';

describe('HoneypotField', () => {
    it('fica fora da tela e escondido de leitores de tela', () => {
        render(<HoneypotField value="" onChange={() => {}} />);
        const input = screen.getByDisplayValue('');
        expect(input).toHaveAttribute('aria-hidden', 'true');
        expect(input).toHaveAttribute('tabIndex', '-1');
        expect(input.style.position).toBe('absolute');
    });

    it('propaga o valor digitado (bot preenchendo o campo)', () => {
        const handleChange = vi.fn();
        render(<HoneypotField value="spam" onChange={handleChange} />);
        expect(screen.getByDisplayValue('spam')).toBeInTheDocument();
    });
});
