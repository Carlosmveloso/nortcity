import { test, expect } from './fixtures';

test.use({ role: 'anon', initialStatus: 'active' });

test('WhatsApp leva o nome e a origem Farol nos cards e na ficha', async ({ page, api }) => {
    api.business.name = 'Café & Mar';
    api.business.whatsapp = '83988887777';
    const message = 'Olá! Encontrei Café & Mar no Farol Pitimbu e gostaria de mais informações.';
    for (const path of ['/explorar', '/negocio/restaurante-fixture']) {
        await page.goto(path);
        const link = page.locator('main a[data-analytics$="whatsapp"]');
        await expect(link).toBeVisible();
        const url = new URL(await link.getAttribute('href'));
        expect(url.origin).toBe('https://wa.me');
        expect(url.pathname).toBe('/5583988887777');
        expect(url.searchParams.get('text')).toBe(message);
        await expect(link).toHaveAttribute('target', '_blank');
    }
});
