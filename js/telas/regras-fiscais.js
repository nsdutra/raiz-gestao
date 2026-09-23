// ============================================================================
// js/telas/regras-fiscais.js — Raiz Gestão
// Versão: 1.0.0 · 23/09/2026
//
// v1.0.0 (23/09/2026) — NOVO. Frente fiscal, Fase 1 (PLANO_IMPLEMENTACAO_
// FISCAL_RAIZ v1.0.0; demanda 976fcbf6). Card "Regras fiscais" no PM_HUB
// (parametros-master.js v0.9.6): regras fiscais versionadas de
// public.fiscal_parametros (migration fiscal_parametros_versionados_v1).
//
//   · Lista uma linha por CHAVE, mostrando a versão que vale hoje (ou a mais
//     recente, conforme o filtro), com valor, maturidade regulatória,
//     vigência e fonte.
//   · Tocar na linha abre o histórico de versões da chave, com as ações
//     permitidas por versão: tornar vigente (proposta) e revogar (vigente,
//     exige motivo). Revogar uma versão que encerrou a anterior devolve a
//     vigência à anterior (fiscal_parametros_revogar_reabre_anterior_v1).
//   · "Nova versão" NUNCA edita valor: cria versão nova, encerra a vigência
//     da anterior no dia anterior ao início da nova. "+" cria chave nova
//     (versão 1).
//
// Leitura direto de public.fiscal_parametros (policy fiscal_parametros_
// leitura: SELECT pra qualquer authenticated — é regra pública). Escrita só
// por RPC, master-only, logadas em gestao.log_acoes (LOG-01):
//   gestao.fn_fiscal_parametro_versionar(p_chave, p_tipo_valor, p_valor,
//     p_valor_texto, p_descricao, p_vigencia_inicio, p_status, p_maturidade,
//     p_fonte_nome, p_fonte_url, p_fonte_consultada_em, p_observacao)
//   gestao.fn_fiscal_parametro_status(p_id, p_status, p_motivo)
//
// Quem consome as regras: fn_fiscal_parametro(chave, data) — única leitura
// no banco. App, bot e funções fiscais nunca leem a tabela direto.
//
// Helpers reaproveitados (carregados antes no index.html): pmBotaoToggle,
// pmIconeEditar, pmVazio (parametros-master.js), gestaoCardMetrica (nav.js),
// classes .rz-chip/.rz-chips/.rz-on/.rz-badge (index.html).
// ============================================================================

const RF_VERSAO = '1.0.0';

let rfLinhas = [];            // todas as versões de todas as chaves
let rfFiltro = 'vigentes';    // vigentes | proposta | revogadas | todas
let rfChaveAberta = null;     // chave com histórico aberto
let rfModoForm = null;        // null | 'nova_versao' | 'nova_chave'

const RF_TIPOS = ['numero', 'percentual', 'moeda', 'data', 'codigo', 'texto'];
const RF_MATURIDADES = ['maduro', 'parcial', 'incerto'];
const RF_MATURIDADE_COR = {
    maduro:  { bg: '#dcfce7', fg: '#166534', txt: 'maduro' },
    parcial: { bg: '#fef3c7', fg: '#92400e', txt: 'parcial' },
    incerto: { bg: '#fee2e2', fg: '#991b1b', txt: 'incerto' },
    sistema: { bg: '#f1f5f9', fg: '#64748b', txt: 'critério do sistema' },
};
const RF_STATUS_COR = {
    vigente:  { bg: '#dcfce7', fg: '#166534' },
    proposta: { bg: '#e0e7ff', fg: '#3730a3' },
    revogada: { bg: '#f1f5f9', fg: '#64748b' },
};

function rfEsc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function rfData(d) { if (!d) return '—'; const [a, m, dd] = String(d).slice(0, 10).split('-'); return `${dd}/${m}/${a}`; }
function rfHoje() { return new Date().toISOString().slice(0, 10); }
function rfAmanha() { const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().slice(0, 10); }

function rfValor(l) {
    if (l.valor == null && (l.valor_texto == null || l.valor_texto === '')) return '<span style="color:var(--sage)">sem valor</span>';
    switch (l.tipo_valor) {
        case 'percentual': return rfEsc(Number(l.valor).toLocaleString('pt-BR')) + '%';
        case 'moeda': return 'R$ ' + rfEsc(Number(l.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        case 'data': return rfData(l.valor_texto);
        case 'codigo': return `<span class="font-mono">${rfEsc(l.valor_texto)}</span>`;
        case 'texto': return rfEsc(l.valor_texto);
        default: return rfEsc(l.valor != null ? Number(l.valor).toLocaleString('pt-BR') : l.valor_texto);
    }
}

function rfBadgeMaturidade(m) {
    const c = RF_MATURIDADE_COR[m || 'sistema'];
    return `<span class="rz-badge" style="background:${c.bg};color:${c.fg}">${c.txt}</span>`;
}
function rfBadgeStatus(s) {
    const c = RF_STATUS_COR[s] || RF_STATUS_COR.revogada;
    return `<span class="rz-badge" style="background:${c.bg};color:${c.fg}">${rfEsc(s)}</span>`;
}

function rfValeHoje(l) {
    const h = rfHoje();
    return l.status === 'vigente' && l.vigencia_inicio <= h && (!l.vigencia_fim || l.vigencia_fim >= h);
}

// ---------------------------------------------------------------- ENTRADA
async function telaRegrasFiscaisInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="mb-1 flex items-start gap-3">
            <div class="flex-1">
                <h1 class="text-lg font-extrabold" style="color:var(--ink)">Regras fiscais</h1>
                <p class="text-xs" style="color:var(--sage)">Limites, datas, códigos e percentuais da Reforma Tributária usados pelo app, pelo bot e pelas funções fiscais. Toda mudança cria versão nova com fonte e vigência — nada é sobrescrito.</p>
            </div>
            ${pmBotaoToggle('rf-nova-chave', 'rfAbrirNovaChave()')}
        </div>
        <div id="rf-conteudo" class="mt-3"><p class="text-xs" style="color:var(--sage)">Carregando…</p></div>`;
    await rfCarregar();
}

async function rfCarregar() {
    const cont = document.getElementById('rf-conteudo');
    try {
        if (typeof dbAuth === 'undefined') throw new Error('cliente Supabase (dbAuth) não disponível nesta tela.');
        const { data, error } = await dbAuth.from('fiscal_parametros').select('*')
            .order('chave', { ascending: true }).order('versao', { ascending: false });
        if (error) throw new Error(error.message);
        rfLinhas = data || [];
    } catch (err) {
        cont.innerHTML = `
            <div class="p-4 rounded-xl text-xs" style="background:#fee2e2;color:#991b1b">
                Não consegui carregar as regras: ${rfEsc(err.message || String(err))}
            </div>`;
        return;
    }
    rfRender();
}

// Uma linha por chave: a versão que vale hoje; se nenhuma vale hoje, a de
// maior versão que passa no filtro.
function rfRepresentantes() {
    const porChave = {};
    rfLinhas.forEach(l => { (porChave[l.chave] = porChave[l.chave] || []).push(l); });
    const out = [];
    Object.keys(porChave).sort().forEach(ch => {
        const vs = porChave[ch];
        const noFiltro = vs.filter(l =>
            rfFiltro === 'todas' ? true :
            rfFiltro === 'vigentes' ? l.status === 'vigente' :
            rfFiltro === 'proposta' ? l.status === 'proposta' : l.status === 'revogada');
        if (!noFiltro.length) return;
        const hoje = noFiltro.find(rfValeHoje);
        out.push({ rep: hoje || noFiltro[0], total: vs.length });
    });
    return out;
}

function rfRender() {
    const cont = document.getElementById('rf-conteudo');
    const chaves = new Set(rfLinhas.map(l => l.chave));
    const valendo = new Set(rfLinhas.filter(rfValeHoje).map(l => l.chave));
    const propostas = rfLinhas.filter(l => l.status === 'proposta').length;
    const fracas = rfLinhas.filter(l => rfValeHoje(l) && (l.maturidade === 'parcial' || l.maturidade === 'incerto')).length;
    const cont_ = (f) => f === 'todas' ? rfLinhas.length : rfLinhas.filter(l => f === 'vigentes' ? l.status === 'vigente' : f === 'proposta' ? l.status === 'proposta' : l.status === 'revogada').length;
    const reps = rfRepresentantes();

    cont.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            ${gestaoCardMetrica('Regras', chaves.size, null, 'Chaves distintas em public.fiscal_parametros.')}
            ${gestaoCardMetrica('Valendo hoje', valendo.size, valendo.size < chaves.size ? 'amber' : null, 'Chaves com uma versão vigente que cobre a data de hoje.')}
            ${gestaoCardMetrica('Em proposta', propostas, propostas ? 'amber' : null, 'Versões ainda sem valor confirmado em fonte oficial — não são usadas pelo sistema.')}
            ${gestaoCardMetrica('Parcial ou incerto', fracas, fracas ? 'amber' : null, 'Regras valendo hoje cuja base regulatória ainda não está madura — o app nunca mostra resultado vermelho com elas.')}
        </div>
        <div id="rf-form-wrapper" class="hidden mb-4"></div>
        <div class="rz-chips mb-3">
            ${[['vigentes', 'Vigentes'], ['proposta', 'Em proposta'], ['revogadas', 'Revogadas'], ['todas', 'Todas as versões']].map(([k, n]) =>
                `<button class="rz-chip ${rfFiltro === k ? 'rz-on' : ''}" onclick="rfFiltrar('${k}')">${n} <span class="rz-n">${cont_(k)}</span></button>`).join('')}
        </div>
        <div class="space-y-1.5">
            ${reps.map(({ rep: l, total }) => `
                <div>
                    <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 ${rfChaveAberta === l.chave ? '' : 'border-slate-300'} cursor-pointer"
                         style="${rfChaveAberta === l.chave ? 'border-color:var(--brass)' : ''}" onclick="rfAlternarChave('${l.chave}')">
                        <div class="min-w-0">
                            <p class="text-sm font-medium truncate" style="color:var(--ink)"><span class="font-mono text-xs">${rfEsc(l.chave)}</span> · ${rfValor(l)}</p>
                            <p class="text-xs truncate" style="color:var(--sage)">v${l.versao} · ${rfData(l.vigencia_inicio)} → ${l.vigencia_fim ? rfData(l.vigencia_fim) : 'sem fim'}${l.fonte_nome ? ' · ' + rfEsc(l.fonte_nome) : ''}${total > 1 ? ' · ' + total + ' versões' : ''}</p>
                        </div>
                        <div class="flex items-center gap-2 flex-none">
                            ${rfBadgeMaturidade(l.maturidade)}
                            ${rfBadgeStatus(l.status)}
                        </div>
                    </div>
                    ${rfChaveAberta === l.chave ? rfHistoricoHtml(l.chave) : ''}
                </div>`).join('') || pmVazio('Nenhuma regra neste filtro.')}
        </div>`;
}

function rfFiltrar(f) { rfFiltro = f; rfChaveAberta = null; rfFecharForm(); rfRender(); }
function rfAlternarChave(ch) { rfChaveAberta = (rfChaveAberta === ch ? null : ch); rfRender(); }

// ------------------------------------------------------------ HISTÓRICO
function rfHistoricoHtml(chave) {
    const vs = rfLinhas.filter(l => l.chave === chave).sort((a, b) => b.versao - a.versao);
    const atual = vs.find(rfValeHoje) || vs[0];
    return `
        <div class="mt-1 mb-2 ml-3 p-3 rounded-xl border" style="border-color:var(--line);background:#fff">
            <div class="flex items-center justify-between mb-2">
                <p class="text-xs font-bold" style="color:var(--ink)">${rfEsc(atual.descricao || chave)}</p>
                <button onclick="rfAbrirNovaVersao('${chave}')" class="text-xs font-bold px-3 py-1.5 rounded-lg text-white flex-none" style="background:var(--pine)">Nova versão</button>
            </div>
            <div class="space-y-2">
                ${vs.map(l => `
                    <div class="p-2 rounded-lg border" style="border-color:var(--line)">
                        <div class="flex items-center justify-between gap-2">
                            <p class="text-xs" style="color:var(--ink)"><b>v${l.versao}</b> · ${rfValor(l)} · ${rfData(l.vigencia_inicio)} → ${l.vigencia_fim ? rfData(l.vigencia_fim) : 'sem fim'}${rfValeHoje(l) ? ' · <b style="color:var(--success)">vale hoje</b>' : ''}</p>
                            <div class="flex items-center gap-1 flex-none">${rfBadgeMaturidade(l.maturidade)} ${rfBadgeStatus(l.status)}</div>
                        </div>
                        <p class="text-[11px] mt-1" style="color:var(--sage)">
                            ${l.fonte_nome ? 'Fonte: ' + (l.fonte_url ? `<a href="${rfEsc(l.fonte_url)}" target="_blank" rel="noopener" style="color:var(--info);text-decoration:underline">${rfEsc(l.fonte_nome)}</a>` : rfEsc(l.fonte_nome)) : 'Sem fonte'}${l.fonte_consultada_em ? ' · consultada em ' + rfData(l.fonte_consultada_em) : ''}
                            ${l.observacao ? '<br>' + rfEsc(l.observacao) : ''}
                        </p>
                        ${l.status !== 'revogada' ? `
                        <div class="flex items-center gap-2 mt-2">
                            ${l.status === 'proposta' ? `<button onclick="rfTornarVigente('${l.id}')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg border" style="border-color:var(--pine);color:var(--pine)">Tornar vigente</button>` : ''}
                            <input id="rf-motivo-${l.id}" type="text" placeholder="Motivo para revogar" class="flex-1 p-1.5 border rounded text-[11px]">
                            <button onclick="rfRevogar('${l.id}')" class="text-[11px] font-bold px-2.5 py-1 rounded-lg border" style="border-color:var(--danger);color:var(--danger)">Revogar</button>
                        </div>
                        <p id="rf-status-${l.id}" class="text-[11px] mt-1" style="color:var(--danger)"></p>` : ''}
                    </div>`).join('')}
            </div>
        </div>`;
}

async function rfTornarVigente(id) {
    const st = document.getElementById('rf-status-' + id);
    st.textContent = 'Salvando…';
    const { error } = await dbAuth.schema('gestao').rpc('fn_fiscal_parametro_status', { p_id: id, p_status: 'vigente', p_motivo: null });
    if (error) { st.textContent = 'Erro: ' + error.message; return; }
    await rfCarregar();
}

async function rfRevogar(id) {
    const st = document.getElementById('rf-status-' + id);
    const motivo = (document.getElementById('rf-motivo-' + id).value || '').trim();
    if (!motivo) { st.textContent = 'Escreva o motivo da revogação.'; return; }
    st.textContent = 'Salvando…';
    const { error } = await dbAuth.schema('gestao').rpc('fn_fiscal_parametro_status', { p_id: id, p_status: 'revogada', p_motivo: motivo });
    if (error) { st.textContent = 'Erro: ' + error.message; return; }
    await rfCarregar();
}

// ------------------------------------------------------------ FORMULÁRIO
function rfFormHtml(base, novaChave) {
    const b = base || {};
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <p class="text-sm font-bold" style="color:var(--ink)">${novaChave ? 'Nova regra' : 'Nova versão de <span class="font-mono">' + rfEsc(b.chave) + '</span>'}</p>
            <p class="text-xs" style="color:var(--sage)">${novaChave
                ? 'Cria a versão 1 de uma chave nova. Só crie se alguma função fiscal for ler esta chave.'
                : 'A versão atual continua valendo até o dia anterior ao início desta. Nada é apagado.'}</p>
            ${novaChave ? `
            <div>
                <label class="block text-xs font-bold text-gray-600">Chave <span style="color:var(--danger)">*</span></label>
                <input type="text" id="rf-f-chave" placeholder="ex.: limite_pf_locacao_receita" class="w-full p-2 border rounded mt-1 text-sm font-mono">
                <p class="text-[10px] mt-1" style="color:var(--sage)">Letras minúsculas, números e _.</p>
            </div>` : ''}
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Tipo do valor <span style="color:var(--danger)">*</span></label>
                    <select id="rf-f-tipo" class="w-full p-2 border rounded mt-1 text-sm">
                        ${RF_TIPOS.map(t => `<option value="${t}" ${b.tipo_valor === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Valor</label>
                    <input type="text" id="rf-f-valor" value="${rfEsc(b.valor != null ? b.valor : (b.valor_texto || ''))}" placeholder="número (ex.: 251380) ou texto/código/data (AAAA-MM-DD)" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Descrição (o que a regra significa)</label>
                <textarea id="rf-f-descricao" rows="2" class="w-full p-2 border rounded mt-1 text-sm">${rfEsc(b.descricao || '')}</textarea>
            </div>
            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Vale a partir de <span style="color:var(--danger)">*</span></label>
                    <input type="date" id="rf-f-inicio" value="${novaChave ? rfHoje() : rfAmanha()}" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Status</label>
                    <select id="rf-f-status" class="w-full p-2 border rounded mt-1 text-sm">
                        <option value="vigente">vigente</option>
                        <option value="proposta">proposta (não usada ainda)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Maturidade</label>
                    <select id="rf-f-maturidade" class="w-full p-2 border rounded mt-1 text-sm">
                        <option value="">critério do sistema (não é lei)</option>
                        ${RF_MATURIDADES.map(m => `<option value="${m}" ${b.maturidade === m ? 'selected' : ''}>${m}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
                <div class="col-span-2">
                    <label class="block text-xs font-bold text-gray-600">Fonte oficial (nome)</label>
                    <input type="text" id="rf-f-fonte-nome" value="${rfEsc(b.fonte_nome || '')}" placeholder="ex.: LC 214/2025, art. 251, § 5º" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Consultada em</label>
                    <input type="date" id="rf-f-fonte-data" value="${rfHoje()}" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Fonte oficial (URL)</label>
                <input type="url" id="rf-f-fonte-url" value="${rfEsc(b.fonte_url || '')}" placeholder="https://www.gov.br/…" class="w-full p-2 border rounded mt-1 text-sm">
                <p class="text-[10px] mt-1" style="color:var(--sage)">Só fonte oficial: Receita Federal, Ministério da Fazenda, Portal da NFS-e, CGIBS, Planalto.</p>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Observação</label>
                <input type="text" id="rf-f-obs" value="" placeholder="ex.: correção pelo IPCA publicada em …" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div class="flex gap-2">
                <button onclick="rfSalvarForm()" class="flex-1 text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">${novaChave ? 'Criar regra' : 'Criar versão'}</button>
                <button onclick="rfFecharForm()" class="px-4 py-2.5 rounded-lg text-sm font-bold border" style="border-color:var(--line);color:var(--sage)">Cancelar</button>
            </div>
            <p id="rf-f-status" class="text-[11px]" style="color:var(--danger)"></p>
        </div>`;
}

function rfAbrirNovaVersao(chave) {
    const vs = rfLinhas.filter(l => l.chave === chave).sort((a, b) => b.versao - a.versao);
    const base = vs.find(rfValeHoje) || vs[0];
    rfModoForm = 'nova_versao';
    const w = document.getElementById('rf-form-wrapper');
    w.dataset.chave = chave;
    w.classList.remove('hidden');
    w.innerHTML = rfFormHtml(base, false);
    w.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function rfAbrirNovaChave() {
    rfModoForm = 'nova_chave';
    const w = document.getElementById('rf-form-wrapper');
    if (!w) return;
    w.dataset.chave = '';
    w.classList.remove('hidden');
    w.innerHTML = rfFormHtml(null, true);
    w.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function rfFecharForm() {
    rfModoForm = null;
    const w = document.getElementById('rf-form-wrapper');
    if (!w) return;
    w.classList.add('hidden');
    w.innerHTML = '';
}

async function rfSalvarForm() {
    const st = document.getElementById('rf-f-status');
    const w = document.getElementById('rf-form-wrapper');
    const chave = rfModoForm === 'nova_chave'
        ? (document.getElementById('rf-f-chave').value || '').trim()
        : w.dataset.chave;
    const tipo = document.getElementById('rf-f-tipo').value;
    const bruto = (document.getElementById('rf-f-valor').value || '').trim();
    const status = document.getElementById('rf-f-status').value;
    const inicio = document.getElementById('rf-f-inicio').value;
    const maturidade = document.getElementById('rf-f-maturidade').value || null;
    const fonteNome = (document.getElementById('rf-f-fonte-nome').value || '').trim() || null;
    const fonteUrl = (document.getElementById('rf-f-fonte-url').value || '').trim() || null;
    const fonteData = document.getElementById('rf-f-fonte-data').value || null;
    const descricao = (document.getElementById('rf-f-descricao').value || '').trim() || null;
    const obs = (document.getElementById('rf-f-obs').value || '').trim() || null;

    if (!chave) { st.textContent = 'Informe a chave.'; return; }
    if (!inicio) { st.textContent = 'Informe o início da vigência.'; return; }

    const numerico = ['numero', 'percentual', 'moeda'].includes(tipo);
    let valor = null, valorTexto = null;
    if (bruto) {
        if (numerico) {
            const n = Number(bruto.replace(/\./g, '').replace(',', '.'));
            if (!Number.isFinite(n)) { st.textContent = 'O valor precisa ser um número (ex.: 251380 ou 70).'; return; }
            valor = n;
        } else {
            if (tipo === 'data' && !/^\d{4}-\d{2}-\d{2}$/.test(bruto)) { st.textContent = 'Data no formato AAAA-MM-DD.'; return; }
            valorTexto = bruto;
        }
    }
    if (status === 'vigente' && valor == null && valorTexto == null) { st.textContent = 'Regra vigente precisa de valor. Sem valor, salve como proposta.'; return; }
    if (status === 'vigente' && maturidade && !fonteNome) { st.textContent = 'Regra vigente com maturidade regulatória precisa da fonte oficial.'; return; }

    st.style.color = 'var(--sage)';
    st.textContent = 'Salvando…';
    const { error } = await dbAuth.schema('gestao').rpc('fn_fiscal_parametro_versionar', {
        p_chave: chave, p_tipo_valor: tipo, p_valor: valor, p_valor_texto: valorTexto,
        p_descricao: descricao, p_vigencia_inicio: inicio, p_status: status, p_maturidade: maturidade,
        p_fonte_nome: fonteNome, p_fonte_url: fonteUrl, p_fonte_consultada_em: fonteData, p_observacao: obs,
    });
    if (error) { st.style.color = 'var(--danger)'; st.textContent = 'Erro: ' + error.message; return; }

    rfChaveAberta = chave;
    rfFecharForm();
    await rfCarregar();
}
