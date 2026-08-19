// ============================================================================
// js/telas/financeiro.js — Raiz Gestão
//
// v0.6.0 (novo): resumo financeiro real, a partir de
// comercial.plano_contratado_item_pagamentos (parcelas com status
// pago/pendente já existentes no schema). Custos operacionais (Supabase,
// IA, WhatsApp/Meta, e-mail) NÃO têm fonte de dado no banco — não são
// lançados aqui como número fictício; a seção fica marcada como pendente.
// ============================================================================

async function telaFinanceiroInit() {
    const [{ data: resumo, error: e1 }, { data: porPlano, error: e2 }] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_financeiro_resumo'),
        dbAuth.schema('gestao').rpc('fn_financeiro_por_plano')
    ]);
    if (e1 || e2) { gestaoErro([e1, e2].filter(Boolean).map(e => e.message).join(' | ')); return; }

    const r = (resumo && resumo[0]) || { recebido_mes_atual: 0, a_receber_futuro: 0, inadimplente: 0, qtd_parcelas_inadimplentes: 0 };
    const maiorPlano = Math.max(1, ...(porPlano || []).map(p => Number(p.recebido_mes_atual)));

    document.getElementById('area-conteudo').innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            ${gestaoCardMetrica('Recebido no mês', gestaoFormatarMoedaBR(r.recebido_mes_atual), 'green')}
            ${gestaoCardMetrica('A receber (futuro)', gestaoFormatarMoedaBR(r.a_receber_futuro))}
            ${gestaoCardMetrica('Inadimplente (' + r.qtd_parcelas_inadimplentes + ' parcelas)', gestaoFormatarMoedaBR(r.inadimplente), r.inadimplente > 0 ? 'red' : 'green')}
        </div>

        <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Receita do mês por plano</h2>
        <div class="space-y-2 mb-6">
            ${(porPlano || []).map(p => `
                <div>
                    <div class="flex justify-between text-xs mb-1"><span style="color:var(--ink)">${p.plano_codigo}</span><b>${gestaoFormatarMoedaBR(p.recebido_mes_atual)}</b></div>
                    <div class="h-2 rounded-full" style="background:var(--line)">
                        <div class="h-2 rounded-full" style="width:${(Number(p.recebido_mes_atual) / maiorPlano) * 100}%;background:var(--pine)"></div>
                    </div>
                </div>
            `).join('') || `<p class="text-sm" style="color:var(--sage)">Nenhum pagamento recebido este mês ainda.</p>`}
        </div>

        <div class="p-4 rounded-xl border-2" style="border-color:var(--line);background:var(--paper)">
            <p class="text-xs font-bold mb-1" style="color:var(--ink)">Custos operacionais — não disponível</p>
            <p class="text-xs" style="color:var(--sage)">Supabase, IA, WhatsApp/Meta, domínios e e-mail ainda não têm lançamento de custo no banco. Precisa de uma tabela de custos operacionais (proposta, não implementada) antes de calcular margem real.</p>
        </div>
    `;
}
