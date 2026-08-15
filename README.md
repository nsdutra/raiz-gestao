# Raiz Gestão

Módulo de Gestão da Raiz Patrimônio — painel interno (master), separado do
app de Imóveis. Reúne parâmetros master, licenciamento, visão consolidada
de empresas e (fases futuras) financeiro, saúde do sistema e suporte.

**Não é o app do cliente.** O app de Imóveis fica no repositório
`beta-raiz-patrimonio` / `app.raizpatrimonio.com.br`. Este aqui é só pra
você (Nicola/Raízes Tech).

## Documentos de referência
- `MODULO_GESTAO_ESTRATEGIA_ARQUITETURA.md` — estratégia e fases
- `DESIGN_SYSTEM_RAIZ_PATRIMONIO.md`, seção 1.1 — paleta deste módulo
- `MODELO_LICENCAS_ACESSO_LIMITES.md` v4.0 — schema de licenciamento

## Stack
Mesmo padrão do app de Imóveis: HTML/CSS/JS puro, sem build step, hospedado
no GitHub Pages. Supabase (mesmo projeto, mesma `anon key`) via
`js/supabase-client.js`.

## Estrutura
```
index.html               shell da aplicação + login
css/tokens.css            paleta do Módulo de Gestão (ardósia + cobre)
js/supabase-client.js     conexão Supabase (mesmo login do app de Imóveis)
js/telas/                 uma tela por arquivo
```

## Deploy
GitHub Pages, branch `main`, subdomínio `gestao.raizpatrimonio.com.br`
(configurado em Settings → Pages → Custom domain).

## Versão
v0.1.0 — esqueleto inicial (login + shell). Tela de Parâmetros Master entra
depois que `comercial_fase1_v1.sql` estiver rodado em produção.
