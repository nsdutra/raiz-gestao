// ============================================================================
// js/telas/comercial.js — Raiz Gestão
//
// v0.7.0 (novo): Comercial com dado real — não é mais placeholder.
//
// Fonte de dados (ver changelog de gestao_fase2_uso_comercial_v1.sql):
//   - "trial" = licencas.plano_codigo = 'trial' (mecanismo já em produção,
//     fn_criar_trial/fn_entrar_trial_convite).
//   - Dimensionamento = clientes.faixa_imoveis_estimada, capturada na
//     criação do trial.
//   - Funil é deliberadamente simplificado (landing → trial → convertido)
//     porque não existe tabela de lead/proposta/negociação no schema
//     ainda — não é um funil de CRM completo, e a tela deixa isso
//     explícito via ícone de informação.
// ============================================================================

async function telaComercialInit() {
    const [
        { data: funil, error: e1 }, { data: trials, error: e2 },
        { data: paginas, error: e3 }, { data: origens, error: e4 }
    ] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_comercial_funil'),
        dbAuth.schema('gestao').rpc('fn_comercial_trials'),
        dbAuth.schema('gestao').rpc('fn_comercial_landing_paginas'),
        dbAuth.schema('gestao').rpc('fn_comercial_landing_origem')
    ]);
    if (e1 || e2 || e3 || e4) { gestaoErro([e1, e2, e3, e4].filter(Boolean).map(e => e.message).join(' | ')); return; }

    const f = (funil && funil[0]) || {};
    const maiorPagina = Math.max(1, ...(paginas || []).map(p => Number(p.qtd)));
    const maiorOrigem = Math.max(1, ...(origens || []).map(o => Number(o.qtd)));

    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
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
        <div id="comercial-trials" class="space-y-2 mb-6"></div>

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

    document.getElementById('comercial-trials').innerHTML = (trials || []).map(t => {
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
