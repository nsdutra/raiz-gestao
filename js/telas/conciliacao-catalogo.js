// ============================================================================
// js/telas/conciliacao-catalogo.js — Raiz Gestão
// Versão: 1.0.0 · 18/09/2026
//
// v1.0.0 — Extraída da aba "Conciliação" de catalogo-patrimonio.js v1.0.0
// (Onda 2 da PROPOSTA_CATALOGO_GESTAO v1.3.0), a pedido do Nicola: a visão
// de conciliação não tem relação com categoria/subtipo do patrimônio — é
// outro assunto (regras de conciliação bancária), então merece card próprio
// no PM_HUB em vez de aba dentro de "Catálogo do patrimônio". Nenhuma
// mudança de comportamento — mesmo código, mesma RPC, mesmas tabelas, só
// virou tela independente (telaConciliacaoCatalogoInit) com prefixo próprio
// (cc* em vez de cp*) pra não colidir com o catalogo-patrimonio.js.
//
// fn_gestao_conciliacao_visao (já existente, sem outra tela chamando antes
// da Onda 2) e conciliacao_fontes/conciliacao_regras (globais, master-only)
// — SOMENTE LEITURA por ora: LOG-01 exige função central para toda escrita
// relevante, e nenhuma RPC de escrita para essas duas tabelas foi revisada/
// avisada ainda. CRUD completo fica pra entrega futura, nota em d9937a2b.
// ============================================================================

const CC_VERSAO = '1.0.0';

let ccFontes = [];
let ccRegras = [];
let ccVisao = null;
let ccFiltro = { de: '', ate: '' };

function ccEsc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------------------------------------------------------------- ENTRADA
async function telaConciliacaoCatalogoInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="mb-1">
            <h1 class="text-lg font-extrabold" style="color:var(--ink)">Conciliação</h1>
            <p class="text-xs" style="color:var(--sage)">Visão das fontes e regras de conciliação automática — globais, valem pra todas as empresas.</p>
        </div>
        <div id="cc-conteudo" class="mt-3"><p class="text-xs" style="color:var(--sage)">Carregando…</p></div>`;
    await ccRenderConciliacao();
}

async function ccRenderConciliacao() {
    const cont = document.getElementById('cc-conteudo');
    cont.innerHTML = `<p class="text-xs" style="color:var(--sage)">Carregando visão de conciliação…</p>`;
    try {
        if (typeof dbAuth === 'undefined') throw new Error('cliente Supabase (dbAuth) não disponível nesta tela.');
        if (!ccFontes.length && !ccRegras.length) {
            const [rf, rr] = await Promise.all([
                dbAuth.from('conciliacao_fontes').select('*').order('emissor_tipo').order('tipo_documento'),
                dbAuth.from('conciliacao_regras').select('*').order('prioridade'),
            ]);
            if (rf.error) throw new Error(rf.error.message);
            if (rr.error) throw new Error(rr.error.message);
            ccFontes = rf.data || [];
            ccRegras = rr.data || [];
        }
        const f = ccFiltro;
        const { data, error } = await dbAuth.rpc('fn_gestao_conciliacao_visao', { p_data_inicio: f.de || null, p_data_fim: f.ate || null });
        if (error) throw new Error(error.message);
        ccVisao = data || [];
    } catch (err) {
        cont.innerHTML = `
            <div class="p-4 rounded-xl text-xs" style="background:#fee2e2;color:#991b1b">
                Não consegui carregar: ${ccEsc(err.message || String(err))}<br>
                Se o erro for de permissão, confira se sua conta está em <b>plataforma_operadores</b> — esta visão só é acessível pelo operador da plataforma.
            </div>`;
        return;
    }
    ccRenderConteudo();
}

function ccRenderConteudo() {
    const cont = document.getElementById('cc-conteudo');
    const v = ccVisao || [];
    const totalQtd = v.reduce((a, x) => a + (x.quantidade || 0), 0);
    const semRegra = v.filter(x => !x.regra_codigo || x.regra_codigo === '—').reduce((a, x) => a + (x.quantidade || 0), 0);
    const f = ccFiltro;
    cont.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            ${gestaoCardMetrica('Fontes cadastradas', ccFontes.length, null, 'conciliacao_fontes — todas globais e master-only.')}
            ${gestaoCardMetrica('Regras cadastradas', ccRegras.length, null, 'conciliacao_regras — todas globais e master-only.')}
            ${gestaoCardMetrica('Lançamentos sem regra', semRegra, semRegra ? 'amber' : null, 'No período filtrado — fingerprint que caiu em nenhuma regra ativa.')}
        </div>
        <div class="flex flex-wrap items-center gap-2 mb-3">
            <label class="text-[10px] font-semibold" style="color:var(--sage)">De <input type="date" value="${f.de}" onchange="ccFiltroData('de', this.value)" class="p-2 border rounded-lg text-xs ml-1"></label>
            <label class="text-[10px] font-semibold" style="color:var(--sage)">Até <input type="date" value="${f.ate}" onchange="ccFiltroData('ate', this.value)" class="p-2 border rounded-lg text-xs ml-1"></label>
        </div>
        <div class="border rounded-xl p-3 mb-3" style="border-color:var(--line)">
            <p class="text-xs font-bold mb-2">Visão por empresa × regra (${totalQtd} lançamento(s))</p>
            <div class="space-y-1 max-h-64 overflow-auto">${v.length ? v.map(x => `
                <div class="flex items-center justify-between text-[11px] gap-2">
                    <span class="truncate">${ccEsc(x.nome_empresa)} · <span class="font-mono">${ccEsc(x.regra_codigo || '—')}</span> · ${ccEsc(x.status_conciliacao)}</span>
                    <span class="flex-none" style="color:var(--sage)">${x.quantidade} · ${gestaoFormatarMoedaBR(x.valor_total)}</span>
                </div>`).join('') : `<p class="text-[11px]" style="color:var(--sage)">Sem lançamentos no período.</p>`}</div>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="border rounded-xl p-3" style="border-color:var(--line)">
                <p class="text-xs font-bold mb-2">Fontes (${ccFontes.length})</p>
                <div class="space-y-1 max-h-64 overflow-auto">${ccFontes.map(x => `
                    <div class="text-[11px]"><span class="font-mono">${ccEsc(x.codigo)}</span> — ${ccEsc(x.emissor_nome || x.emissor_tipo)} · ${ccEsc(x.tipo_documento)}
                        <span class="rz-badge ml-1" style="background:${x.status === 'ativo' ? '#dcfce7' : '#f1f5f9'};color:${x.status === 'ativo' ? '#166534' : '#64748b'}">${ccEsc(x.status)}</span></div>`).join('') || pmVazio('Nenhuma fonte cadastrada.')}</div>
            </div>
            <div class="border rounded-xl p-3" style="border-color:var(--line)">
                <p class="text-xs font-bold mb-2">Regras (${ccRegras.length})</p>
                <div class="space-y-1 max-h-64 overflow-auto">${ccRegras.map(x => `
                    <div class="text-[11px]"><span class="font-mono">${ccEsc(x.codigo)}</span> — ${ccEsc(x.nome)} · prioridade ${x.prioridade}
                        <span class="rz-badge ml-1" style="background:${x.ativa ? '#dcfce7' : '#fee2e2'};color:${x.ativa ? '#166534' : '#991b1b'}">${x.ativa ? 'ativa' : 'inativa'}</span></div>`).join('') || pmVazio('Nenhuma regra cadastrada.')}</div>
            </div>
        </div>
        <p class="text-[10px] mt-3" style="color:var(--sage)">Edição de fontes e regras ainda não está nesta tela — fica pra uma entrega futura (nota em d9937a2b). Por ora, cadastro é só por SQL Editor, sempre com fn_sou_master().</p>`;
}

function ccFiltroData(chave, valor) { ccFiltro[chave] = valor; ccRenderConciliacao(); }
