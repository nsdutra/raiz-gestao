// ============================================================================
// js/telas/comercial.js — Raiz Gestão
//
// v0.13.0 (12/11/2026 — demanda 700f5659 F1, sessão 20261112-0844-crm-f1; ficha FICHA_CRM_AGENDA_OCUPACAO_RAIZ
// v1.2.0 aprovada pelo Nicola 12/11 08:40) — aba Bot WhatsApp: funil com os nomes do bot de hoje (Quero testar,
// "Contaram onde gastam tempo"); "Não criou o teste" separa E-mail já cadastrado, Limite do dia e Erro do sistema
// (antes tudo caía em "Erro ao criar"); "Quem entrou no bot" vira cartões (legível no celular) e o toque no
// cartão abre a linha do tempo do número: passos no bot, aberturas do link pessoal e o que viu no /amigos.
// Prospect deixa de usar --brass (exclusivo de IA). Fonte: gestao.fn_comercial_funil_whatsapp 1.1.0.
// Versão anterior: 0.12.0.
//
// v0.12.0 (02/11/2026 — demanda a28a6805, sessão 20261102-0827-bot-convite; de acordo do Nicola 02/11 13:58) — aba nova
// "Bot WhatsApp": funil do teste grátis criado na conversa do bot (números novos → botões → dados → teste criado),
// testes criados pelo bot (entrou no app / usou o bot depois) e "Quem entrou no bot" (número mascarado, cliente ou
// prospect, primeira vez ou recorrente, última ação). Fonte única: gestao.fn_comercial_funil_whatsapp (jsonb), com o
// mesmo filtro de período das outras listas. Versão anterior: 0.11.1.
//
// v0.11.1 (22/09/2026) — Ofertas por origem: "Oferta no Site" lista só as
// ofertas-base da origem 'site' (gestao.fn_comercial_oferta_site v2, plano
// pela campanha). Só a mensagem de lista vazia mudou neste arquivo.
//
// v0.11.0 — "Páginas mais navegadas" e "Origem do tráfego" (dentro de Visão
// Geral) ganharam filtro de período (data início/fim, padrão últimos 7
// dias) — um único filtro pras duas listas juntas. Requer
// gestao_fase6_filtro_periodo_comercial_v1.sql (fn_comercial_landing_paginas/
// _origem passaram a receber p_data_inicio/p_data_fim). Layout das duas
// listas deixou de ser 2 colunas lado a lado e virou empilhado em largura
// cheia — nome de página/origem longo não empurra mais o número pra fora
// (ver também gestaoBarra() em nav.js, que ganhou truncamento defensivo).
//
// v0.9.0 — volta a ser tela de topo (era js/telas/parametros-comercial.js,
// vivia dentro de Configurações — reverte a decisão da v0.8.4: Comercial
// é operação de uso diário, não deveria estar escondido atrás de
// "Configurações"). Ganhou uma 3ª aba: "Oferta no Site".
//
// Como agora pode ser a PRIMEIRA tela aberta (sem passar por
// Configurações antes), telaComercialInit() chama pmCarregarTudo() por
// conta própria — antes disso era responsabilidade só de Configurações,
// e Campanhas dependia de alguém já ter visitado lá primeiro.
//
// 3 abas:
//   Visão Geral    → funil geral, trials, landing (páginas/origem) —
//                    idêntico ao que já existia.
//   Oferta no Site → NOVA. Mostra o que a landing enxerga por plano
//                    (fn_ofertas_landing_ativas() é a referência pública;
//                    aqui uso gestao.fn_comercial_oferta_site(), que
//                    também mostra ofertas NÃO publicadas ainda, pro
//                    master saber o que falta). Pagamento (catálogo)
//                    mora aqui agora — saiu de Configurações/Catálogo.
//   Campanhas      → delega pra parametrosCampanhasInit() (sem duplicar
//                    nada) — lista já filtra oferta-base fora. Público
//                    (catálogo) mora aqui agora — mesma razão do Pagamento.
// ============================================================================

const PCO_ABAS = [
    { id: 'visao', label: 'Visão Geral', init: () => pcoVisaoGeralInit() },
    { id: 'oferta', label: 'Oferta no Site', init: () => pcoOfertaInit() },
    { id: 'campanhas', label: 'Campanhas', init: () => pcoCampanhasInit() },
    { id: 'bot', label: 'Bot WhatsApp', init: () => pcoBotInit() } // v0.12.0
];

async function telaComercialInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    const ok = await pmCarregarTudo();
    if (!ok) return; // pmErro() já escreveu a mensagem em #area-conteudo

    area.innerHTML = `
        <div class="flex gap-2 mb-4 border-b overflow-x-auto" style="border-color:var(--line)">
            ${PCO_ABAS.map(a => `<button onclick="pcoMudarAba('${a.id}')" id="pco-tab-${a.id}" class="pm-subaba px-3.5 py-2 text-xs font-bold whitespace-nowrap">${a.label}</button>`).join('')}
        </div>
        <div id="pco-conteudo" class="min-w-0"></div>
    `;
    pcoMudarAba('visao');
}

function pcoMudarAba(nome) {
    document.querySelectorAll('[id^="pco-tab-"]').forEach(b => {
        b.style.color = 'var(--sage)';
        b.style.borderBottom = 'none';
    });
    const ativa = document.getElementById('pco-tab-' + nome);
    ativa.style.color = 'var(--pine)';
    ativa.style.borderBottom = '3px solid var(--brass)';
    const aba = PCO_ABAS.find(a => a.id === nome);
    if (aba) aba.init();
}

// ----------------------------------------------------------------------------
// Visão Geral — funil, trials, landing.
//
// v0.11.0 — "Páginas mais navegadas" e "Origem do tráfego" ganharam filtro
// de período (data início/fim, padrão últimos 7 dias — pmco-* usa o par de
// inputs de gestaoFiltroPeriodoHtml()/gestaoLerFiltroPeriodo() de nav.js).
// O MESMO período filtra as duas listas juntas (é um único filtro, não um
// por lista). Funil e Trials continuam nos 30 dias fixos de antes — não
// foram pedidos nesta rodada, ver gestao.fn_comercial_funil()/_trials().
//
// Layout: as duas listas deixaram de ficar lado a lado (md:grid-cols-2) e
// passaram a empilhar em largura cheia — nome de página/origem longo (URL,
// domínio) precisa de espaço pra não empurrar o número pra fora. gestaoBarra()
// também ganhou truncamento defensivo (nav.js v0.11.0), mas a largura cheia
// é o que resolve de verdade aqui.
// ----------------------------------------------------------------------------
async function pcoVisaoGeralInit() {
    const el = document.getElementById('pco-conteudo');
    el.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    const [{ data: funil, error: e1 }, { data: trials, error: e2 }] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_comercial_funil'),
        dbAuth.schema('gestao').rpc('fn_comercial_trials')
    ]);
    if (e1 || e2) {
        el.innerHTML = `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)">
            <strong>Não foi possível carregar:</strong> ${[e1, e2].filter(Boolean).map(e => e.message).join(' | ')}
        </div>`;
        return;
    }

    const f = (funil && funil[0]) || {};

    el.innerHTML = `
        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            Funil (últimos 30 dias)
            ${gestaoInfoIcone('Funil simplificado: visitas à landing, trials iniciados, trials que converteram pra plano pago. Não é CRM completo — não há tabela de lead/proposta/negociação.')}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            ${gestaoCardMetrica('Visitas à landing', f.visitas_landing_30d ?? 0)}
            ${gestaoCardMetrica('Trials iniciados', f.trials_iniciados_30d ?? 0)}
            ${gestaoCardMetrica('Convertidos p/ plano pago', f.convertidos_30d ?? 0, 'green')}
            ${gestaoCardMetrica('Trials ativos agora', f.trials_ativos ?? 0)}
            ${gestaoCardMetrica('Trials vencendo (7d)', f.trials_expirando_7d ?? 0, Number(f.trials_expirando_7d) > 0 ? 'amber' : 'green')}
        </div>

        <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Trials em andamento</h2>
        <div id="pco-trials" class="space-y-2 mb-6"></div>

        <div class="flex items-center justify-between gap-2 flex-wrap mb-3">
            <h2 class="text-sm font-extrabold flex items-center" style="color:var(--ink)">
                Landing — páginas e origem do tráfego
                ${gestaoInfoIcone('Mesmo filtro de período aplicado às duas listas juntas: Páginas mais navegadas e Origem do tráfego. Fonte: comercial.eventos_landing.')}
            </h2>
            <div class="flex items-center gap-2 flex-wrap">
                ${gestaoFiltroPeriodoHtml('pco', 7)}
                <button onclick="pcoAtualizarLanding()" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Aplicar</button>
            </div>
        </div>

        <div class="space-y-6">
            <div>
                <h3 class="text-xs font-bold uppercase tracking-wide mb-2" style="color:var(--sage)">Páginas mais navegadas</h3>
                <div id="pco-paginas" class="space-y-2"></div>
            </div>
            <div>
                <h3 class="text-xs font-bold uppercase tracking-wide mb-2" style="color:var(--sage)">Origem do tráfego</h3>
                <div id="pco-origens" class="space-y-2"></div>
            </div>
        </div>
    `;

    document.getElementById('pco-trials').innerHTML = (trials || []).map(t => {
        const urgente = t.dias_restantes <= 2;
        return `
            <div class="p-3 rounded-xl border-2" style="border-color:${urgente ? 'var(--danger)' : 'var(--line)'};background:${urgente ? 'var(--danger-bg)' : '#fff'}">
                <div class="flex items-center justify-between">
                    <p class="text-sm font-bold" style="color:var(--ink)">${t.nome_empresa}</p>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${urgente ? 'var(--danger)' : 'var(--warning-bg)'};color:${urgente ? '#fff' : 'var(--warning)'}">${t.dias_restantes} dia(s) restante(s)</span>
                </div>
                <p class="text-xs mt-1" style="color:var(--sage)">
                    Porte: ${t.faixa_imoveis_estimada || 'não informado'} · uso app: ${t.uso_app_periodo} ações · uso bot: ${t.uso_bot_periodo} eventos
                </p>
            </div>
        `;
    }).join('') || `<p class="text-sm text-center py-6" style="color:var(--sage)">Nenhum trial ativo agora.</p>`;

    await pcoAtualizarLanding();
}

async function pcoAtualizarLanding() {
    const wrapPaginas = document.getElementById('pco-paginas');
    const wrapOrigens = document.getElementById('pco-origens');
    if (!wrapPaginas || !wrapOrigens) return; // saiu da aba antes de terminar de carregar

    wrapPaginas.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;
    wrapOrigens.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    const { inicio, fim } = gestaoLerFiltroPeriodo('pco');
    const [{ data: paginas, error: e1 }, { data: origens, error: e2 }] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_comercial_landing_paginas', { p_data_inicio: inicio, p_data_fim: fim }),
        dbAuth.schema('gestao').rpc('fn_comercial_landing_origem', { p_data_inicio: inicio, p_data_fim: fim })
    ]);
    if (e1 || e2) {
        const msg = `<p class="text-sm" style="color:var(--danger)">Erro: ${[e1, e2].filter(Boolean).map(e => e.message).join(' | ')}</p>`;
        wrapPaginas.innerHTML = msg;
        wrapOrigens.innerHTML = msg;
        return;
    }

    const maiorPagina = Math.max(1, ...(paginas || []).map(p => Number(p.qtd)));
    const maiorOrigem = Math.max(1, ...(origens || []).map(o => Number(o.qtd)));

    wrapPaginas.innerHTML = (paginas || []).map(p => gestaoBarra(p.pagina, p.qtd, maiorPagina)).join('')
        || `<p class="text-sm" style="color:var(--sage)">Sem eventos de landing no período selecionado.</p>`;
    wrapOrigens.innerHTML = (origens || []).map(o => gestaoBarra(o.origem, o.qtd, maiorOrigem)).join('')
        || `<p class="text-sm" style="color:var(--sage)">Sem eventos de landing no período selecionado.</p>`;
}

// ----------------------------------------------------------------------------
// Oferta no Site — NOVA. Checklist por plano + catálogo de Pagamento.
// ----------------------------------------------------------------------------
async function pcoOfertaInit() {
    const el = document.getElementById('pco-conteudo');
    el.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    const { data: ofertas, error } = await dbAuth.schema('gestao').rpc('fn_comercial_oferta_site');
    if (error) {
        el.innerHTML = `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)">
            <strong>Não foi possível carregar:</strong> ${error.message}
            <br><span class="text-xs">Confira se gestao_fase4_oferta_base_v1.sql já foi rodada.</span>
        </div>`;
        return;
    }

    el.innerHTML = `
        <div class="p-3 rounded-xl mb-4" style="background:var(--info-bg);color:var(--info)">
            <b class="text-xs">Fonte de verdade</b>
            <p class="text-xs mt-1">Plano técnico (Configurações → Planos & Limites) define o que a empresa contrata. Oferta no Site define preço, trial, destaque e copy — publicação valida os dois lados.</p>
        </div>

        <div class="grid md:grid-cols-3 gap-3 mb-5" id="pco-ofertas-grid"></div>

        <div class="rounded-2xl border-2 p-4" style="border-color:var(--line);background:#fff">
            <div class="flex items-center justify-between gap-2 flex-wrap">
                <div>
                    <b class="text-sm" style="color:var(--ink)">Formas & opções de pagamento</b>
                    <p class="text-[11px] mt-0.5" style="color:var(--sage)">Catálogo usado ao montar o preço de qualquer oferta ou campanha.</p>
                </div>
                <button onclick="pcoAlternarPagamento()" id="pco-pgto-toggle" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2" style="border-color:var(--line)">Mostrar</button>
            </div>
            <div id="pco-pagamento-wrapper" class="hidden mt-3"></div>
        </div>
    `;

    document.getElementById('pco-ofertas-grid').innerHTML = (ofertas || []).map(o => {
        const checks = [
            { label: 'Plano ativo', ok: !!o.plano_ativo },
            { label: 'Oferta pública cadastrada', ok: !!o.codigo_publico },
            { label: 'Trial configurado', ok: !!o.duracao_dias, texto: o.duracao_dias ? o.duracao_dias + ' dias' : 'sem trial' },
            { label: 'Preço cadastrado', ok: o.preco_minimo != null, texto: o.preco_minimo != null ? gestaoFormatarMoedaBR(o.preco_minimo) : 'sem preço' },
            { label: 'Limite de imóveis aplicado', ok: o.limite_imoveis != null, texto: o.limite_imoveis != null ? String(o.limite_imoveis) : 'sem limite técnico' }
        ];
        return `
            <div class="rounded-2xl border-2 p-4" style="border-color:${o.publicado ? 'var(--success)' : 'var(--line)'};background:#fff">
                <div class="flex items-center justify-between">
                    <h3 class="text-base font-extrabold" style="color:var(--ink)">${o.plano_nome}</h3>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${o.publicado ? 'var(--success-bg)' : 'var(--warning-bg)'};color:${o.publicado ? 'var(--success)' : 'var(--warning)'}">${o.publicado ? 'publicado' : (o.status || 'rascunho')}</span>
                </div>
                <p class="text-xl font-extrabold mt-1" style="color:var(--ink)">${o.preco_minimo != null ? gestaoFormatarMoedaBR(o.preco_minimo) + '<span class="text-xs font-normal">/mês</span>' : '—'}</p>
                <p class="text-xs" style="color:var(--sage)">${o.duracao_dias ? o.duracao_dias + ' dias de trial' : 'sem trial configurado'}${o.limite_imoveis ? ' · até ' + o.limite_imoveis + ' imóveis' : ''}</p>
                <div class="space-y-1.5 mt-3">
                    ${checks.map(c => `
                        <div class="flex items-center justify-between text-xs">
                            <span style="color:var(--ink)">${c.label}</span>
                            <span style="color:${c.ok ? 'var(--success)' : 'var(--warning)'}">${c.texto || (c.ok ? 'ok' : 'faltando')}</span>
                        </div>
                    `).join('')}
                    <div class="flex items-center justify-between text-xs">
                        <span style="color:var(--ink)">Limite de usuários</span>
                        <span style="color:var(--sage)">copy, sem trava técnica</span>
                    </div>
                </div>
                <div class="flex gap-2 mt-4">
                    <button onclick="pcoEditarOferta('${o.campanha_id}')" class="flex-1 text-xs font-bold py-2 rounded-lg text-white" style="background:var(--pine)">Editar</button>
                    ${o.codigo_publico ? `<a href="https://www.raizpatrimonio.com.br/?utm_source=gestao&utm_medium=oferta_no_site&utm_campaign=${o.codigo_publico}" target="_blank" rel="noopener" class="flex-1 text-xs font-bold py-2 rounded-lg border-2 text-center" style="border-color:var(--line)">Abrir landing</a>` : ''}
                </div>
            </div>
        `;
    }).join('') || `<p class="text-sm text-center py-6 col-span-3" style="color:var(--sage)">Nenhuma oferta-base do site encontrada — confira se a campanha tem plano (plano_codigo), origem 'site' e tipo_oferta='oferta_base'.</p>`;
}

function pcoAlternarPagamento() {
    const wrap = document.getElementById('pco-pagamento-wrapper');
    const btn = document.getElementById('pco-pgto-toggle');
    const abrindo = wrap.classList.contains('hidden');
    wrap.classList.toggle('hidden');
    btn.textContent = abrindo ? 'Esconder' : 'Mostrar';
    if (abrindo && !wrap.dataset.carregado) {
        wrap.dataset.carregado = '1';
        wrap.innerHTML = `<div id="pm-conteudo-subaba"></div>`;
        pmRenderPagamento();
    }
}

function pcoEditarOferta(campanhaId) {
    pcoMudarAba('campanhas');
    setTimeout(() => { if (typeof pcAbrirCampanha === 'function') pcAbrirCampanha(campanhaId); }, 50);
}

// ----------------------------------------------------------------------------
// Campanhas — delega pro wizard já existente + catálogo de Público.
// parametrosCampanhasInit() (parametros-campanhas.js) procura o container
// nesta ordem: #pco-campanhas-wizard → #pco-conteudo → #pm-conteudo-area
// — por isso cria a div com esse id ANTES de chamar.
// ----------------------------------------------------------------------------
function pcoCampanhasInit() {
    const el = document.getElementById('pco-conteudo');
    el.innerHTML = `
        <div id="pco-campanhas-wizard" class="min-w-0"></div>
        <div class="rounded-2xl border-2 p-4 mt-5" style="border-color:var(--line);background:#fff">
            <div class="flex items-center justify-between gap-2 flex-wrap">
                <div>
                    <b class="text-sm" style="color:var(--ink)">Público de oferta</b>
                    <p class="text-[11px] mt-0.5" style="color:var(--sage)">Nesta fase, só "prospect" está em uso.</p>
                </div>
                <button onclick="pcoAlternarPublico()" id="pco-publico-toggle" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2" style="border-color:var(--line)">Mostrar</button>
            </div>
            <div id="pco-publico-wrapper" class="hidden mt-3"></div>
        </div>
    `;
    parametrosCampanhasInit();
}

function pcoAlternarPublico() {
    const wrap = document.getElementById('pco-publico-wrapper');
    const btn = document.getElementById('pco-publico-toggle');
    const abrindo = wrap.classList.contains('hidden');
    wrap.classList.toggle('hidden');
    btn.textContent = abrindo ? 'Esconder' : 'Mostrar';
    if (abrindo && !wrap.dataset.carregado) {
        wrap.dataset.carregado = '1';
        wrap.innerHTML = `<div id="pm-conteudo-subaba"></div>`;
        pmRenderPublico();
    }
}


// ----------------------------------------------------------------------------
// v0.12.0 — Bot WhatsApp: teste grátis pela conversa + quem entrou no bot.
// gestao.fn_comercial_funil_whatsapp(p_data_inicio, p_data_fim) → { funil[], trials[], entradas[] }.
// ----------------------------------------------------------------------------
async function pcoBotInit() {
    const el = document.getElementById('pco-conteudo');
    el.innerHTML = `
        <div class="flex items-center justify-between gap-2 flex-wrap mb-4">
            <h2 class="text-sm font-extrabold flex items-center" style="color:var(--ink)">
                Teste grátis pelo bot
                ${gestaoInfoIcone('Número que não está em nenhum cadastro e fala com o bot recebe a apresentação do Raiz e pode criar o teste grátis na conversa (Essencial, Patrimônio ou Plus, 30 dias, pela faixa de imóveis). Contagem por número distinto em cada etapa. Fonte: ia_eventos_log e clientes de origem whatsapp-bot.')}
            </h2>
            <div class="flex items-center gap-2 flex-wrap">
                ${gestaoFiltroPeriodoHtml('pcb', 7)}
                <button onclick="pcoBotAtualizar()" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Aplicar</button>
            </div>
        </div>
        <div id="pcb-corpo"></div>
    `;
    await pcoBotAtualizar();
}

function pcoBotEsc(t) { return String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function pcoBotData(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

async function pcoBotAtualizar() {
    const corpo = document.getElementById('pcb-corpo');
    if (!corpo) return;
    corpo.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;
    const { inicio, fim } = gestaoLerFiltroPeriodo('pcb');
    const { data, error } = await dbAuth.schema('gestao').rpc('fn_comercial_funil_whatsapp', { p_data_inicio: inicio, p_data_fim: fim });
    if (error) {
        corpo.innerHTML = `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)"><strong>Não foi possível carregar:</strong> ${pcoBotEsc(error.message)}</div>`;
        return;
    }
    const funil = (data && data.funil) || [];
    const trials = (data && data.trials) || [];
    const entradas = (data && data.entradas) || [];
    const n = etapa => Number((funil.find(f => f.etapa === etapa) || {}).numeros || 0);
    const novos = n('apresentacao');
    const criados = n('trial_criado');
    const taxa = novos > 0 ? Math.round((criados / novos) * 100) + '%' : '—';
    const maior = Math.max(1, ...funil.map(f => Number(f.numeros || 0)));
    const clientes = entradas.filter(e => e.tipo === 'cliente').length;

    const grupo = g => funil.filter(f => (f.grupo || 'funil') === g);
    const naoCriou = grupo('nao_criou').reduce((t, f) => t + Number(f.numeros || 0), 0);
    window.__pcbEntradas = entradas;

    corpo.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            ${gestaoCardMetrica('Números novos no bot', novos)}
            ${gestaoCardMetrica('Testes criados', criados, criados > 0 ? 'green' : undefined)}
            ${gestaoCardMetrica('Conversão', taxa)}
            ${gestaoCardMetrica('Entraram no bot (período)', entradas.length, undefined, clientes + ' cliente(s) · ' + (entradas.length - clientes) + ' prospect(s)')}
        </div>

        <h3 class="text-xs font-bold mb-2" style="color:var(--sage)">Funil por etapa (números distintos)</h3>
        <div class="space-y-2 mb-4">${grupo('funil').map(f => gestaoBarra(f.nome, Number(f.numeros || 0), maior)).join('')}</div>

        <h3 class="text-xs font-bold mb-2 flex items-center" style="color:var(--sage)">
            Não criou o teste · ${naoCriou}
            ${gestaoInfoIcone('Quem confirmou os dados e o teste não foi criado, pelo motivo: e-mail que já tem conta no Raiz, limite de testes do dia ou falha do sistema (só esta pede correção).')}
        </h3>
        <div class="space-y-2 mb-4">${grupo('nao_criou').map(f => gestaoBarra(f.nome, Number(f.numeros || 0), maior)).join('')}</div>

        <h3 class="text-xs font-bold mb-2" style="color:var(--sage)">Outros caminhos</h3>
        <div class="space-y-2 mb-6">${grupo('outros').map(f => gestaoBarra(f.nome, Number(f.numeros || 0), maior)).join('')}</div>

        <h3 class="text-xs font-bold mb-2" style="color:var(--sage)">Testes criados pelo bot</h3>
        <div class="space-y-2 mb-6">${trials.map(t => `
            <div class="p-3 rounded-xl border-2" style="border-color:var(--line);background:var(--card,#fff)">
                <div class="flex items-center justify-between gap-2 flex-wrap">
                    <p class="text-sm font-bold" style="color:var(--ink)">${pcoBotEsc(t.empresa)}</p>
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:var(--warning-bg);color:var(--warning)">${pcoBotEsc(t.plano || '—')} · até ${t.expira_em ? new Date(t.expira_em).toLocaleDateString('pt-BR') : '—'}</span>
                </div>
                <p class="text-xs mt-1" style="color:var(--sage)">Criado ${pcoBotData(t.criado_em)} · porte ${pcoBotEsc(t.faixa || 'não informado')} · ${t.entrou_no_app ? '✅ entrou no app' : '⏳ ainda não entrou no app'} · ${t.usou_bot_depois ? '✅ usou o bot' : '⏳ ainda não usou o bot'}</p>
            </div>`).join('') || `<p class="text-sm" style="color:var(--sage)">Nenhum teste criado pelo bot no período.</p>`}</div>

        <h3 class="text-xs font-bold mb-2 flex items-center" style="color:var(--sage)">
            Quem entrou no bot
            ${gestaoInfoIcone('Todos os números que falaram com o bot no período, clientes e prospects. Número mascarado (LGPD). Toque no cartão para ver a linha do tempo: passos no bot, aberturas do link pessoal e o que viu no /amigos.')}
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">${entradas.map((e, i) => pcoBotCartao(e, i)).join('') || `<p class="text-sm" style="color:var(--sage)">Ninguém falou com o bot no período.</p>`}</div>
    `;
}

// v0.13.0 — cartão de um número; o toque abre/fecha a linha do tempo (fn_comercial_funil_whatsapp 1.1.0, chave `linha`).
function pcoBotCartao(e, i) {
    const tipo = e.tipo === 'cliente'
        ? `<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:var(--success-bg);color:var(--success)">Cliente</span>`
        : `<span class="text-xs font-bold px-2 py-0.5 rounded-full" style="background:var(--info-bg,#e8f0f5);color:var(--info,#3d6b8c)">Prospect</span>`;
    const temLinha = Array.isArray(e.linha) && e.linha.length > 0;
    return `
        <button type="button" onclick="pcoBotAlternarLinha(${i})" class="text-left w-full p-3 rounded-xl border-2" style="border-color:var(--line);background:var(--card,#fff);min-height:44px" aria-expanded="false" id="pcb-c-${i}">
            <div class="flex items-center justify-between gap-2">
                <p class="text-sm font-bold" style="color:var(--ink)">${pcoBotEsc(e.numero)} ${e.primeira_vez ? '<span class="text-xs font-normal" style="color:var(--sage)">· 1ª vez</span>' : ''}</p>
                ${tipo}
            </div>
            ${e.empresas ? `<p class="text-xs mt-1" style="color:var(--ink)">${pcoBotEsc(e.empresas)}</p>` : ''}
            <p class="text-xs mt-1" style="color:var(--sage)">${pcoBotEsc(e.ultima_acao || '—')} · ${pcoBotData(e.ultimo_em)} · ${Number(e.eventos || 0)} evento(s)${temLinha ? ' · ver linha do tempo ›' : ''}</p>
            <div id="pcb-l-${i}" hidden></div>
        </button>`;
}

function pcoBotAlternarLinha(i) {
    const e = (window.__pcbEntradas || [])[i];
    const box = document.getElementById('pcb-l-' + i);
    const btn = document.getElementById('pcb-c-' + i);
    if (!e || !box) return;
    if (!box.hidden) { box.hidden = true; btn && btn.setAttribute('aria-expanded', 'false'); return; }
    const cor = { bot: 'var(--sage)', link: 'var(--info,#3d6b8c)', amigos: 'var(--success)' };
    const nome = { bot: 'bot', link: 'link pessoal', amigos: '/amigos' };
    box.innerHTML = `<div class="mt-3 pl-3" style="border-left:2px solid var(--line)">${(e.linha || []).map(p => `
        <div class="py-1">
            <p class="text-xs" style="color:var(--ink)"><span style="color:${cor[p.origem] || 'var(--sage)'}">●</span> ${pcoBotEsc(p.o_que)}</p>
            <p class="text-xs" style="color:var(--sage)">${pcoBotData(p.em)} · ${nome[p.origem] || p.origem}</p>
        </div>`).join('') || '<p class="text-xs" style="color:var(--sage)">Sem passos no período.</p>'}</div>`;
    box.hidden = false;
    btn && btn.setAttribute('aria-expanded', 'true');
}
