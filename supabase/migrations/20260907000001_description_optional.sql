-- Descrição volta a ser opcional (decisão de 07/09/2026), revertendo o mínimo
-- de 40 caracteres imposto em 06/09 pela migration 0003.
--
-- Motivo: a exigência não sobreviveu ao contato com o acervo. Dos 78 negócios
-- publicados, 53 têm descrição com menos de 40 caracteres e 30 não têm endereço
-- nem bairro — somados, 59 cadastros ficaram impossíveis de salvar pelo painel,
-- porque o editor do /admin barrava a gravação inteira quando qualquer campo
-- não atendia ao contrato. Um mínimo que transforma a correção de um telefone
-- em reescrita de texto custa mais do que entrega: quem tem o que dizer escreve,
-- e quem não tem não deve ficar sem cadastro por isso.
--
-- O que muda: `description_required` e `description_too_short` deixam de existir.
-- O teto de 1500 caracteres continua, ainda sob `p_check_description`, mantendo
-- o parâmetro com sentido — o limite é checado quando a descrição é escrita,
-- nunca como pedágio para mexer em outro campo.
--
-- Nome, contato público e localização ficam exatamente como estavam.
--
-- A assinatura é preservada de propósito: `create or replace` mantém o
-- `revoke execute ... from public` da migration 20260906000010.

create or replace function public.assert_business_minimums(
    b public.businesses,
    p_check_description boolean default true,
    p_check_location boolean default true
)
returns void
language plpgsql
as $$
begin
    if coalesce(btrim(b.name), '') = '' or length(btrim(b.name)) < 2 then
        perform public.farol_error('name_required', 'Informe o nome do negócio (mínimo 2 caracteres).');
    end if;

    if length(btrim(b.name)) > 120 then
        perform public.farol_error('name_too_long', 'O nome do negócio deve ter no máximo 120 caracteres.');
    end if;

    -- Descrição é opcional: vazia é um estado válido. Só o teto é contrato.
    if p_check_description and length(btrim(coalesce(b.description, ''))) > 1500 then
        perform public.farol_error('description_too_long', 'A descrição pode ter no máximo 1500 caracteres.');
    end if;

    if p_check_location and not public.business_has_location(b) then
        perform public.farol_error('location_required', 'Informe o endereço, o bairro ou a área de atendimento.');
    end if;

    if not public.business_has_public_contact(b) then
        perform public.farol_error('contact_required', 'Informe ao menos um contato público válido: telefone, WhatsApp, e-mail, Instagram ou site.');
    end if;
end;
$$;
