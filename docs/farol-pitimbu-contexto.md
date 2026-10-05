# Contexto do projeto — Farol Pitimbu

Revisado em 05/10/2026 contra o código deste repositório. Estado implementado não é confirmação de deployment nem de configuração remota.

## Produto

Guia de turismo e diretório de negócios de Pitimbu/PB. Visitantes descobrem negócios e experiências; proprietários cadastram e acompanham seus negócios; administradores fazem curadoria e moderação. O nome do repositório é `nortcity`.

## ATUAL — arquitetura e fluxos

- React 19 + Vite 8, JavaScript/JSX e JSDoc, Tailwind 4, React Router 7. Componentes próprios, sem TypeScript/shadcn/React Query.
- Tokens em `src/index.css`: Ocean `#094f66`, Turquesa `#04c6db`, Areia `#f4f1ea`, Sol `#ffad0a`; Inter e Poppins. Reutilize as classes existentes.
- Catálogo real via Supabase; busca paginada pela RPC `search_businesses`. Conteúdo editorial e curadoria permanecem em `src/data/`.
- Auth por e-mail/senha, roles `user`/`admin` efetivas, proteção de rotas e autorização no banco por RLS/RPCs.
- Favoritos por conta: salvar/remover nos cards e na ficha, lista privada em `/favoritos`, apenas negócios ativos visíveis. Migration de 04/10/2026 homologada no desenvolvimento e aplicada em produção em 05/10/2026.
- Cadastro e Meu Negócio: zero ou um negócio por proprietário; edição de pendente/rejeitado, reenvio, consulta de suspensão e edição moderada de publicado.
- Admin: criação/edição, aprovação/rejeição/suspensão, categorias, duplicatas, vínculo/remoção de proprietário e revisão de propostas.
- Upload de capa em Storage. Capas propostas ficam em caminho privado de revisão até aprovação.
- Analytics administrativo: sessões, eventos, comportamento e agregações diárias. Não equivale a métricas comerciais disponíveis ao proprietário.
- Build consulta negócios publicados e gera sitemap, HTML de metadados e imagens de compartilhamento. Trigger registra mudanças relevantes e função SQL solicita rebuild por Deploy Hook; exige configuração remota de Vault, pg_net e pg_cron.
- Contato via EmailJS. Mapas via Leaflet. Integrações Vercel de analytics/performance presentes.

Rotas e limites de acesso estão em `src/App.jsx`; tabelas, grants, policies e funções estão em `supabase/migrations/`. Tipos em `src/integrations/supabase/types.js` são JSDoc manual, não schema gerado.

## Regras a preservar

Consulte [regras-de-negocio.md](regras-de-negocio.md) para propriedade, categorias, transições de status, campos simples/sensíveis e concorrência. Código, migrations e testes devem confirmar qualquer afirmação de implementação. Decisões em aberto não autorizam mudanças automáticas de produto.

## FUTURO — sem implementação completa

- Avaliações e Google OAuth.
- Assinaturas, cobrança/Stripe, planos pagos, destaques patrocinados e ferramentas comerciais para proprietários.
- Galeria comercial, selo de verificação e moderação de fotos por IA.
- Permissões próprias de moderador, equipes e múltiplos negócios por conta.

Nomes, preços e benefícios de planos nos documentos antigos são propostas históricas, não ofertas atuais nem decisões comerciais fechadas. A página Planos apresenta o cadastro gratuito disponível e informa que os recursos pagos estão em planejamento.

## Desenvolvimento, validação e operação

Use [README](../README.md), [ambientes](ambientes.md) e [testes](testes.md). Os testes PGlite verificam SQL em banco descartável; os testes de navegador verificam a interface com API simulada. Serviços reais, e-mails, Storage, agendamento e deployment exigem conferência no ambiente de destino.

## Histórico

A especificação anterior foi preservada integralmente em [contexto-produto-2026-09.md](historico/contexto-produto-2026-09.md). O guia anterior do Claude, com incidentes e lições, está em [guia-claude-2026-09.md](historico/guia-claude-2026-09.md). Esses registros misturam propostas e versões antigas; use-os como histórico, não como descrição atual.
