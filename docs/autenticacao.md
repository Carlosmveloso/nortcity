# Cadastro, confirmação de e-mail e login

## Implementação

`src/pages/Entrar.jsx` usa Supabase Auth com e-mail/senha. O fluxo atual é o implicit padrão do cliente Supabase: o serviço verifica o link de e-mail e devolve a sessão no fragmento da URL; o SDK consome o fragmento e persiste a sessão. Não foi desabilitada a confirmação de e-mail.

O cadastro e o reenvio definem `emailRedirectTo` como a origem atual + `/entrar?confirmacao=1`. O endereço deve estar permitido no Supabase. O parâmetro `confirmacao=1` sozinho não comprova confirmação: a tela exige uma sessão carregada para mostrar acesso confirmado.

- Cadastro sem sessão continua fora das áreas privadas e orienta conferir o e-mail. A resposta não promete que uma conta nova foi criada, pois o Supabase pode ocultar cadastros duplicados.
- `email_not_confirmed` mostra orientação específica e oferece reenvio. `invalid_credentials` continua indicando e-mail/senha incorretos.
- Erros de confirmação em query/fragmento são apresentados sem expor descrições remotas ou tokens. Links antigos que retornam à home com erro são encaminhados à tela de entrada.
- Reenvio é uma ação explícita do usuário, sem recadastrar a conta. Há intervalo local de um minuto após pedidos bem-sucedidos; o rate limit do servidor continua sendo a autoridade.
- Link expirado/usado orienta tentar login antes de pedir outro: a conta pode já ter sido confirmada.

## Conferência no Supabase de produção

Em 02/10/2026, leitura da configuração hospedada confirmou Site URL `https://farolpitimbu.com.br`, Redirect URLs contendo `https://farolpitimbu.com.br/**` e confirmação de e-mail habilitada. Esse padrão já permite `/entrar?confirmacao=1`; nenhuma configuração remota foi alterada. O template de e-mail, SMTP e o envio real em produção não foram validados por essa leitura.

Não é possível determinar as configurações hospedadas pelo `supabase/config.toml`, que descreve o ambiente local. Não use `supabase config push` para corrigir somente redirects.

No projeto que atende o site, conferir em **Authentication → URL Configuration**:

- Site URL: `https://farolpitimbu.com.br`.
- Redirect URLs: permitir `https://farolpitimbu.com.br/entrar?confirmacao=1`.
- Se houver outros domínios realmente usados (como www), conferir a canonicalização e permitir apenas seus retornos necessários.
- No projeto de desenvolvimento, permitir o retorno do respectivo localhost, por exemplo `http://localhost:5173/entrar?confirmacao=1`. Não reutilizar produção para testes de escrita.

Em **Authentication → Email Templates → Confirm signup**, o botão deve usar o link de verificação do Supabase, por exemplo `href="{{ .ConfirmationURL }}"`. Um link contendo apenas SiteURL/RedirectTo abre o site sem verificar o e-mail. Templates personalizados com TokenHash e uma rota própria exigem implementação compatível; essa aplicação usa o fluxo padrão, não uma rota de verificação server-side.

Quando houver erro real, registrar somente: texto/código exibido, data/hora, domínio e caminho de retorno sem parâmetros sensíveis. Não compartilhar senha, access_token, refresh_token, token_hash ou URL completa de confirmação. Logs de Auth e o estado de confirmação do usuário no painel permitem distinguir email_not_confirmed, credenciais incorretas, expiração e falha de servidor.

## Validação e limites

### Teste manual com e-mail real no desenvolvimento

Use o projeto separado `farol-pitimbu-dev`, configurado em `.env.development.local`, com as migrations aplicadas. Confira o destino efetivo antes de abrir o cadastro. A CLI deve estar vinculada ao projeto de desenvolvimento; prefira explicitar `--project-ref` nos comandos remotos.

Em 02/10/2026, o usuário confirmou manualmente o acesso e um novo login após sair da conta nesse ambiente. A falha de retorno no celular ocorreu ao abrir um link de localhost em outro dispositivo; esse teste não determina a causa do relato original em produção.

1. No projeto de desenvolvimento, configure Site URL como `http://localhost:5173` e permita `http://localhost:5173/entrar?confirmacao=1` em Redirect URLs. Mantenha a confirmação de e-mail habilitada.
2. Execute `npm run dev -- --host localhost --port 5173 --strictPort` e abra `http://localhost:5173/entrar`. A porta fixa evita que o Vite escolha uma URL diferente da permitida.
3. Cadastre-se com o e-mail da sua conta da equipe Supabase. Sem SMTP próprio, o envio padrão é limitado a endereços da equipe e tem limite reduzido de envios; não use um alias diferente esperando que seja autorizado.
4. Confira a mensagem de confirmação pendente. Antes de abrir o e-mail, tente entrar: deve aparecer a orientação de e-mail não confirmado.
5. Abra a confirmação mais recente no mesmo computador, mantendo o servidor ligado. O retorno deve chegar a `/entrar?confirmacao=1` e mostrar a sessão ativa.
6. Acesse Meu Negócio, recarregue a página, saia pelo menu e entre novamente com a mesma senha. Uma conta nova não terá negócios cadastrados.

Este roteiro cria uma conta real apenas no banco de desenvolvimento. Não copie o catálogo, usuários ou segredos de publicação de produção. Para registrar um erro, compartilhe somente o texto exibido e o caminho da página, sem tokens nem o link completo do e-mail.

Referência de envio: [SMTP padrão e suas restrições](https://supabase.com/docs/guides/auth/auth-smtp).

`e2e/auth.spec.js` exercita cadastro sem sessão, tentativa de login antes de confirmar, reenvio, rate limit, link expirado voltando à home, callback válido e persistência após reload. Executa em desktop/mobile com respostas simuladas; não envia e-mails nem cria usuários reais. `src/lib/authFeedback.test.js` verifica tradução por código e tratamento seguro dos parâmetros de erro.

Em 02/10/2026, a correção de autenticação foi publicada pelos PRs [#33](https://github.com/Carlosmveloso/nortcity/pull/33) e [#34](https://github.com/Carlosmveloso/nortcity/pull/34), commit de produção `fc85edd3f7498de4f3dc851dc9e8770a132f5335`. A Vercel concluiu com sucesso; requisições GET ao domínio público confirmaram `/entrar` e o JavaScript contendo reenvio, retorno explícito e confirmação de sessão. As demais melhorias locais não fizeram parte desses PRs. O teste de confirmação por e-mail real em produção continua pendente; a verificação dos arquivos publicados não comprova a entrega dos e-mails nem a resolução do relato original.

Referências: [redirects](https://supabase.com/docs/guides/auth/redirect-urls), [templates de e-mail](https://supabase.com/docs/guides/auth/auth-email-templates), [reenvio](https://supabase.com/docs/reference/javascript/auth-resend) e [códigos de erro](https://supabase.com/docs/guides/auth/debugging/error-codes).
