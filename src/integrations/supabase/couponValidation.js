// Validação e utilização: tudo por RPC. Validadores, utilizações e
// lançamentos não têm leitura direta para quem não é admin.
import { supabase } from './client';

async function call(name, args = {}) {
    const { data, error } = await supabase.rpc(name, args);
    return { data: data ?? null, error: error ?? null };
}

export const validationRpc = {
    myBusinesses: () => call('my_validation_businesses'),
    verify: (businessId, input) => call('verify_coupon', { p_business_id: businessId, p_input: input }),
    confirm: (businessId, input) => call('confirm_coupon_usage', { p_business_id: businessId, p_input: input }),
    listValidators: (businessId) => call('owner_list_validators', { p_business_id: businessId }),
    addValidator: (businessId, email) => call('owner_add_validator', { p_business_id: businessId, p_email: email }),
    deactivateValidator: (validatorId) => call('owner_deactivate_validator', { p_validator_id: validatorId }),
    usages: (businessId, from, to) =>
        call('list_coupon_usages', { p_business_id: businessId ?? null, p_from: from ?? null, p_to: to ?? null }),
};
