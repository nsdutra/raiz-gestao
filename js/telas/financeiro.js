// ============================================================================
// js/telas/financeiro.js — Raiz Gestão
// Versão: 0.8.0 · 30/09/2026
//
// v0.8.0 (30/09/2026, demanda 1899fe67, ficha F10 frente 1) — bloco "Pagamentos
// de plano a confirmar" no topo: lista fn_gestao_pagamentos_pendentes (Pix que
// o cliente disse ter pago, e cobranças abertas vencidas) com Confirmar (valor
// recebido + data; renova ou troca a licença no banco) e Recusar (motivo
// obrigatório; o cliente vê o aviso no app). Tudo é feito pelas funções
// fn_gestao_pagamento_confirmar / _recusar (master, SECURITY DEFINER); esta
// tela não escreve em tabela. Versão anterior: v0.7.0.
//
// v0.7.0: ícones de informação explicando a origem de cada número.
//
// v0.6.0 (novo): resumo financeiro real, a partir de
// comercial.plano_contratado_item_pagamentos (parcelas com status
// pago/pendente já existentes no schema). Custos operacionais NÃO têm
// fonte de dado no banco — não são lançados aqui como número fictício; a
// seção fica marcada como pendente.
// ============================================================================

async function telaFinanceiroInit() {
    const [{ data: resumo, error: e1 }, { data: porPlano, error: e2 }] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_financeiro_resumo'),
        dbAuth.schema('gestao').rpc('fn_financeiro_por_plano')
    ]);
    if (e1 || e2) { gestaoErro([e1, e2].filter(Boolean).map(e => e.message).join(' | ')); return; }

    // v0.8.0 — pendências de pagamento de plano (fonte: F10). Falha aqui não derruba o resto.
    const { data: pend, error: e3 } = await dbAuth.rpc('fn_gestao_pagamentos_pendentes');
    if (e3) console.warn('[financeiro] pagamentos pendentes:', e3.message);
    const blocoPend = finPagBloco(e3 ? null : (pend || []));

    const r = (resumo && resumo[0]) || { recebido_mes_atual: 0, a_receber_futuro: 0, inadimplente: 0, qtd_parcelas_inadimplentes: 0 };
    const maiorPlano = Math.max(1, ...(porPlano || []).map(p => Number(p.recebido_mes_atual)));

    document.getElementById('area-conteudo').innerHTML = `
        ${blocoPend}
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            ${gestaoCardMetrica('Recebido no mês', gestaoFormatarMoedaBR(r.recebido_mes_atual), 'green', 'Soma de comercial.plano_contratado_item_pagamentos com status=pago e data_pgto dentro do mês atual, dividido pelas parcelas do contrato.')}
            ${gestaoCardMetrica('A receber (futuro)', gestaoFormatarMoedaBR(r.a_receber_futuro), null, 'Parcelas com status=pendente cujo período ainda não venceu.')}
            ${gestaoCardMetrica('Inadimplente (' + r.qtd_parcelas_inadimplentes + ' parcelas)', gestaoFormatarMoedaBR(r.inadimplente), r.inadimplente > 0 ? 'red' : 'green', 'Parcelas com status=pendente cujo período_fim já passou.')}
        </div>

        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            Receita do mês por plano
            ${gestaoInfoIcone('Mesma base de "Recebido no mês", agrupada por plano_codigo do contrato.')}
        </h2>
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


// ---------------------------------------------------------------------------
// v0.8.0 — Pagamentos de plano a confirmar (F10)
// ---------------------------------------------------------------------------
function finPagEsc(v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function finPagBloco(lista) {
    if (lista === null) {
        return `<div class="p-3 rounded-xl border-2 mb-6 text-xs" style="border-color:var(--warning);background:var(--warning-bg);color:var(--warning)">Não foi possível carregar os pagamentos de plano a confirmar agora.</div>`;
    }
    if (!lista.length) return '';
    const dt = d => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
    return `
        <div class="mb-6" id="finpag-bloco">
            <div class="p-3 rounded-xl mb-2" style="background:var(--danger);color:#fff">
                <p class="text-sm font-extrabold">${lista.length} pagamento(s) de plano aguardando você</p>
                <p class="text-xs" style="opacity:.85">Confira o Pix no extrato pelo código da cobrança e confirme ou recuse. O cliente é avisado no app.</p>
            </div>
            <div class="space-y-2">
                ${lista.map(p => `
                <div class="p-3 rounded-xl border-2" style="border-color:var(--danger);background:#fff" data-item="${finPagEsc(p.item_id)}">
                    <div class="flex justify-between gap-2">
                        <div class="min-w-0">
                            <p class="text-sm font-bold truncate" style="color:var(--ink)">${finPagEsc(p.cliente_nome)}</p>
                            <p class="text-xs" style="color:var(--sage)">${finPagEsc(p.plano_codigo)} · ${finPagEsc(p.tipo)} · código <b>${finPagEsc(p.txid)}</b></p>
                            <p class="text-xs" style="color:var(--sage)">${p.status === 'informado' ? 'Cliente informou o pagamento em ' + dt(p.informado_em) : 'Cobrança aberta em ' + dt(p.criado_em) + ' (sem aviso de pagamento)'}</p>
                        </div>
                        <b class="text-sm flex-none" style="color:var(--ink)">${gestaoFormatarMoedaBR(p.valor)}</b>
                    </div>
                    <div class="flex gap-2 mt-2">
                        <button type="button" class="text-xs font-bold px-3 py-2 rounded-lg" style="background:var(--pine);color:#fff" onclick="finPagAbrir('${finPagEsc(p.item_id)}','confirmar',${Number(p.valor)})">Confirmar</button>
                        <button type="button" class="text-xs font-bold px-3 py-2 rounded-lg border-2" style="border-color:var(--danger);color:var(--danger);background:#fff" onclick="finPagAbrir('${finPagEsc(p.item_id)}','recusar',${Number(p.valor)})">Recusar</button>
                    </div>
                    <div class="hidden mt-2" id="finpag-painel-${finPagEsc(p.item_id)}"></div>
                </div>`).join('')}
            </div>
        </div>`;
}

function finPagAbrir(itemId, modo, valor) {
    const el = document.getElementById('finpag-painel-' + itemId);
    if (!el) return;
    const hoje = new Date().toISOString().slice(0, 10);
    el.classList.remove('hidden');
    el.innerHTML = modo === 'confirmar'
        ? `<div class="grid grid-cols-2 gap-2">
               <label class="text-[11px] font-bold" style="color:var(--sage)">Valor recebido (R$)
                   <input id="finpag-valor-${itemId}" type="number" step="0.01" min="0" value="${valor}" class="w-full border-2 rounded-lg px-2 py-1.5 text-sm" style="border-color:var(--line);color:var(--ink)"></label>
               <label class="text-[11px] font-bold" style="color:var(--sage)">Data do recebimento
                   <input id="finpag-data-${itemId}" type="date" value="${hoje}" class="w-full border-2 rounded-lg px-2 py-1.5 text-sm" style="border-color:var(--line);color:var(--ink)"></label>
           </div>
           <p class="text-[11px] mt-1" style="color:var(--sage)">Valor diferente do cobrado é aceito; a diferença fica registrada.</p>
           <button type="button" class="mt-2 text-xs font-bold px-3 py-2 rounded-lg" style="background:var(--pine);color:#fff" id="finpag-ok-${itemId}" onclick="finPagConfirmar('${itemId}')">Confirmar recebimento</button>
           <p class="text-xs mt-1 hidden" id="finpag-msg-${itemId}" style="color:var(--danger)"></p>`
        : `<label class="text-[11px] font-bold" style="color:var(--sage)">Motivo da recusa (o cliente vê)
               <textarea id="finpag-motivo-${itemId}" rows="2" class="w-full border-2 rounded-lg px-2 py-1.5 text-sm" style="border-color:var(--line);color:var(--ink)" placeholder="Ex.: não localizei o Pix no extrato"></textarea></label>
           <button type="button" class="mt-2 text-xs font-bold px-3 py-2 rounded-lg" style="background:var(--danger);color:#fff" id="finpag-ok-${itemId}" onclick="finPagRecusar('${itemId}')">Recusar pagamento</button>
           <p class="text-xs mt-1 hidden" id="finpag-msg-${itemId}" style="color:var(--danger)"></p>`;
}

async function finPagExecutar(itemId, rpc, args) {
    const btn = document.getElementById('finpag-ok-' + itemId);
    const msg = document.getElementById('finpag-msg-' + itemId);
    if (btn) btn.disabled = true;
    const { error } = await dbAuth.rpc(rpc, args);
    if (error) {
        if (msg) { msg.textContent = error.message; msg.classList.remove('hidden'); }
        if (btn) btn.disabled = false;
        return;
    }
    telaFinanceiroInit();
}

function finPagConfirmar(itemId) {
    const valor = parseFloat(document.getElementById('finpag-valor-' + itemId)?.value);
    const data = document.getElementById('finpag-data-' + itemId)?.value;
    const msg = document.getElementById('finpag-msg-' + itemId);
    if (!(valor > 0) || !data) { if (msg) { msg.textContent = 'Informe o valor recebido e a data.'; msg.classList.remove('hidden'); } return; }
    finPagExecutar(itemId, 'fn_gestao_pagamento_confirmar', { p_item_id: itemId, p_valor_recebido: valor, p_data: data });
}

function finPagRecusar(itemId) {
    const motivo = (document.getElementById('finpag-motivo-' + itemId)?.value || '').trim();
    const msg = document.getElementById('finpag-msg-' + itemId);
    if (motivo.length < 5) { if (msg) { msg.textContent = 'Escreva o motivo (o cliente vê).'; msg.classList.remove('hidden'); } return; }
    finPagExecutar(itemId, 'fn_gestao_pagamento_recusar', { p_item_id: itemId, p_motivo: motivo });
}
