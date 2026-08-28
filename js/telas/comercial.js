// ============================================================================
// js/telas/comercial.js — Raiz Gestão
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
    { id: 'campanhas', label: 'Campanhas', init: () => pcoCampanhasInit() }
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

    const { inicio, fim } = gestaoLerFiltroPeriodo('pco', 7);
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
    }).join('') || `<p class="text-sm text-center py-6 col-span-3" style="color:var(--sage)">Nenhuma oferta-base encontrada — confira se planos.id_campanha aponta pra uma campanha com tipo_oferta='oferta_base'.</p>`;
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
