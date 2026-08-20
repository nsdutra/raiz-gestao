// ============================================================================
// js/telas/parametros-comercial.js — Raiz Gestão
//
// v0.8.4 (novo arquivo) — "Comercial" deixou de ser item do menu
// principal e virou área dentro de Parâmetros, com 2 abas internas:
//   Visão Geral → funil geral, trials em andamento, landing (páginas/
//                 origem) — mesmo conteúdo que vivia em js/telas/
//                 comercial.js (removido; não é mais carregado).
//   Campanhas   → delega pra parametrosCampanhasInit() (já existente,
//                 sem duplicar nada) — que agora também mostra o
//                 Desempenho de cada campanha embutido no próprio wizard,
//                 em vez de abrir drawer noutra tela.
//
// Motivo da mudança: "Comercial" e "Campanhas" são o mesmo domínio
// (vendas/aquisição) — juntar os dois embaixo de Parâmetros reduz 1 item
// do menu principal e deixa mais óbvio que configurar campanha e ver
// funil geral são parte da mesma área de trabalho.
// ============================================================================

const PCO_ABAS = [
    { id: 'visao', label: 'Visão Geral', init: () => pcoVisaoGeralInit() },
    { id: 'campanhas', label: 'Campanhas', init: () => parametrosCampanhasInit() }
];

async function parametrosComercialInit() {
    const c = document.getElementById('pm-conteudo-area');
    c.innerHTML = `
        <div class="flex gap-2 mb-4 border-b overflow-x-auto" style="border-color:var(--line)">
            ${PCO_ABAS.map(a => `<button onclick="pcoMudarAba('${a.id}')" id="pco-tab-${a.id}" class="pm-subaba px-3.5 py-2 text-xs font-bold whitespace-nowrap">${a.label}</button>`).join('')}
        </div>
        <div id="pco-conteudo"></div>
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
// Visão Geral — funil, trials, landing (idêntico ao antigo comercial.js,
// só que renderiza dentro de #pco-conteudo em vez de #area-conteudo).
// ----------------------------------------------------------------------------
async function pcoVisaoGeralInit() {
    const el = document.getElementById('pco-conteudo');
    el.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    const [
        { data: funil, error: e1 }, { data: trials, error: e2 },
        { data: paginas, error: e3 }, { data: origens, error: e4 }
    ] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_comercial_funil'),
        dbAuth.schema('gestao').rpc('fn_comercial_trials'),
        dbAuth.schema('gestao').rpc('fn_comercial_landing_paginas'),
        dbAuth.schema('gestao').rpc('fn_comercial_landing_origem')
    ]);
    if (e1 || e2 || e3 || e4) {
        el.innerHTML = `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)">
            <strong>Não foi possível carregar:</strong> ${[e1, e2, e3, e4].filter(Boolean).map(e => e.message).join(' | ')}
        </div>`;
        return;
    }

    const f = (funil && funil[0]) || {};
    const maiorPagina = Math.max(1, ...(paginas || []).map(p => Number(p.qtd)));
    const maiorOrigem = Math.max(1, ...(origens || []).map(o => Number(o.qtd)));

    el.innerHTML = `
        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            Funil (últimos 30 dias)
            ${gestaoInfoIcone('Funil simplificado com o que existe hoje no banco: visitas à landing, trials iniciados e trials que converteram pra plano pago. Não há tabela de lead/proposta/negociação ainda — não é um funil de CRM completo.')}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            ${gestaoCardMetrica('Visitas à landing', f.visitas_landing_30d ?? 0)}
            ${gestaoCardMetrica('Trials iniciados', f.trials_iniciados_30d ?? 0)}
            ${gestaoCardMetrica('Convertidos p/ plano pago', f.convertidos_30d ?? 0, 'green')}
            ${gestaoCardMetrica('Trials ativos agora', f.trials_ativos ?? 0)}
            ${gestaoCardMetrica('Trials vencendo (7d)', f.trials_expirando_7d ?? 0, Number(f.trials_expirando_7d) > 0 ? 'amber' : 'green')}
        </div>

        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            Trials em andamento
            ${gestaoInfoIcone('Uso app/bot conta ações desde o início do trial até agora (log_acessos e ia_eventos_log). Dimensionamento vem do porte informado na criação do trial.')}
        </h2>
        <div id="pco-trials" class="space-y-2 mb-6"></div>

        <div class="grid md:grid-cols-2 gap-6">
            <div>
                <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Páginas mais navegadas (30d)</h2>
                <div class="space-y-2">
                    ${(paginas || []).map(p => gestaoBarra(p.pagina, p.qtd, maiorPagina)).join('') || `<p class="text-sm" style="color:var(--sage)">Sem eventos de landing nos últimos 30 dias.</p>`}
                </div>
            </div>
            <div>
                <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Origem do tráfego (30d)</h2>
                <div class="space-y-2">
                    ${(origens || []).map(o => gestaoBarra(o.origem, o.qtd, maiorOrigem)).join('') || `<p class="text-sm" style="color:var(--sage)">Sem eventos de landing nos últimos 30 dias.</p>`}
                </div>
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
}
