-- Sprint 3 — estado de utilização do cupom (16/10/2026).
--
-- Sozinha numa migration de propósito: o PostgreSQL não deixa usar um valor
-- novo de enum na mesma transação em que ele foi criado, e cada migration
-- roda numa transação. As regras que usam `used` estão na migration seguinte.
alter type coupon_status add value if not exists 'used';
alter type coupon_event_action add value if not exists 'used';
