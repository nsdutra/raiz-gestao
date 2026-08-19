// ============================================================================
// js/telas/cockpit.js — Raiz Gestão
//
// v0.6.0 (novo): home do módulo. Fila de atenção unificada + indicadores
// rápidos, todos vindos de gestao.fn_cockpit_atencao() e
// gestao.fn_financeiro_resumo() (dados reais — ver changelog do SQL).
// ============================================================================

const COCKPIT_ICONE_TIPO = {
    licenca_vencendo: '⏳', licenca_vencida: '⛔', baixo_acesso: '📉',
    inadimplencia: '💸', feedback_baixo: '⚠️'
};

async function telaCockpitInit() {
    const [{ data: atencao, error: e1 }, { data: fin, error: e2 }, { data: empresas, error: e3 }] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_cockpit_atencao'),
        dbAuth.schema('gestao').rpc('fn_financeiro_resumo'),
        dbAuth.schema('gestao').rpc('fn_lista_empresas')
    ]);

    if (e1 || e2 || e3) { gestaoErro([e1, e2, e3].filter(Boolean).map(e => e.message).join(' | ')); return; }

    const finResumo = (fin && fin[0]) || { recebido_mes_atual: 0, a_receber_futuro: 0, inadimplente: 0 };
    const totalEmpresas = (empresas || []).length;
    const empresasAtivas = (empresas || []).filter(e => e.licenca_status === 'ativo').length;

    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            ${gestaoCardMetrica('Empresas ativas', `${empresasAtivas} / ${totalEmpresas}`)}
            ${gestaoCardMetrica('Recebido no mês', gestaoFormatarMoedaBR(finResumo.recebido_mes_atual), 'green')}
            ${gestaoCardMetrica('A receber', gestaoFormatarMoedaBR(finResumo.a_receber_futuro))}
            ${gestaoCardMetrica('Inadimplente', gestaoFormatarMoedaBR(finResumo.inadimplente), finResumo.inadimplente > 0 ? 'red' : 'green')}
        </div>

        <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Fila de atenção</h2>
        <div id="cockpit-atencao" class="space-y-2"></div>
    `;

    const wrap = document.getElementById('cockpit-atencao');
    if (!atencao || atencao.length === 0) {
        wrap.innerHTML = `<p class="text-sm text-center py-8" style="color:var(--sage)">Nada pedindo atenção agora. 🎉</p>`;
        return;
    }

    wrap.innerHTML = atencao.map(a => `
        <button onclick="gestaoAbrirTela('empresas'); setTimeout(() => empresasAbrirFicha('${a.cliente_id}'), 150)"
            class="w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition"
            style="border-color:${a.tone === 'red' ? 'var(--danger)' : 'var(--warning)'};background:${a.tone === 'red' ? 'var(--danger-bg)' : 'var(--warning-bg)'}">
            <span class="text-lg flex-none">${COCKPIT_ICONE_TIPO[a.tipo] || '•'}</span>
            <div class="min-w-0 flex-1">
                <p class="text-sm font-bold truncate" style="color:var(--ink)">${a.titulo}</p>
                <p class="text-xs truncate" style="color:var(--sage)">${a.subtitulo}</p>
            </div>
        </button>
    `).join('');
}
