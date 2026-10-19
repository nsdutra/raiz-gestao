// ============================================================================
// js/telas/catalogo-usos.js — Raiz Gestão
// Versão: 1.0.0 · 18/10/2026
//
// v1.0.0 (usos fatia 9 — demandas 3022603b, 2fb81d05, ec3aaef5; sessão 20261018-2230-usos-fatia9; FICHA_FATIA9_CATALOGOS_GESTAO_RAIZ
// v1.0.0, de acordo do Nicola 18/10 22:47, D9-1 a D9-7) — módulo novo. Cartão "Catálogo de usos" em Configurações: os catálogos da
// frente de usos editados sem SQL. Seis abas (Ramos · Tipos de contrato · Programas e fases · Itens sugeridos · Transições · Animais)
// e Alterações (quem mudou o quê, de gestao.log_acoes).
//   - Leitura: gestao.fn_catalogo_usos_ler() — os catálogos com "em uso por N", as listas fechadas do banco e as últimas alterações.
//   - Escrita: gestao.fn_catalogo_*_salvar(p jsonb) — só master; nada se apaga (desativa); campo travado quando o item está em uso
//     (a função recusa e diz o motivo; a tela já mostra o campo travado com o mesmo motivo, D9-3).
//   - Transições: só rótulo, exige motivo, botão, ordem e ativa (D9-4). Fase nova ou reordenada só vale para ciclos novos (D9-5).
//   - Tipos de ativo seguem na aba do Catálogo do patrimônio (D9-1); os itens sugeridos de tipo de ativo também.
// Gramática do Gestão (catalogo-patrimonio.js / alertas.js): lista agrupada, linha abre o formulário logo abaixo, Salvar com o
// resultado ao lado. Sem diálogo nativo (UXR-30): mensagens ficam no próprio formulário.
// ============================================================================

const CU_VERSAO = '1.0.0';
let cuAba = 'ramos';
let cuDados = null;        // retorno de gestao.fn_catalogo_usos_ler()
let cuAberto = null;       // chave da linha aberta (ou 'novo')
let cuFiltro = '';
let cuProgAberto = null;   // programa com as fases à mostra

const CU_ABAS = [
    { id: 'ramos', rotulo: 'Ramos' },
    { id: 'contratos', rotulo: 'Tipos de contrato' },
    { id: 'programas', rotulo: 'Programas e fases' },
    { id: 'itens', rotulo: 'Itens sugeridos' },
    { id: 'transicoes', rotulo: 'Transições' },
    { id: 'animais', rotulo: 'Animais' },
    { id: 'alteracoes', rotulo: 'Alterações' },
];

function cuEsc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cuJs(t) { return String(t ?? '').replace(/[^a-zA-Z0-9_.\-]/g, ''); }
function cuLista(tabela, coluna) { return (cuDados?.listas?.[`${tabela}.${coluna}`] || []); }
function cuBadge(txt, tom) {
    const cores = { ok: ['#dcfce7', '#166534'], neu: ['#f1f5f9', '#64748b'], av: ['#fbeee6', '#8f4322'], info: ['#e8f2f3', '#245a66'] };
    const [bg, fg] = cores[tom] || cores.neu;
    return `<span class="rz-badge" style="background:${bg};color:${fg}">${cuEsc(txt)}</span>`;
}
function cuEmUso(n, rotulo = 'em uso por') { return Number(n) > 0 ? cuBadge(`${rotulo} ${n}`, 'info') : cuBadge('sem uso', 'neu'); }
function cuSituacao(s) { return s === 'ativo' ? cuBadge('ativo', 'ok') : s === 'em_breve' ? cuBadge('em breve', 'av') : cuBadge(s || '—', 'neu'); }

// ---------------------------------------------------------------- ENTRADA
async function telaCatalogoUsosInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="mb-1">
            <h1 class="text-lg font-extrabold" style="color:var(--ink)">Catálogo de usos</h1>
            <p class="text-xs" style="color:var(--sage)">Como o ativo é usado: ramos, tipos de contrato, programas e fases, itens sugeridos, transições e categorias de animal. O app lê daqui; mudar não exige publicar código. Item em uso tem campos travados.</p>
        </div>
        <div class="rz-chips mt-3" id="cu-abas"></div>
        <div id="cu-conteudo" class="mt-3"><p class="text-xs" style="color:var(--sage)">Carregando…</p></div>`;
    cuRenderAbas();
    await cuCarregar();
}

async function cuCarregar() {
    const cont = document.getElementById('cu-conteudo');
    try {
        if (typeof dbAuth === 'undefined') throw new Error('cliente Supabase (dbAuth) não disponível nesta tela.');
        const { data, error } = await dbAuth.schema('gestao').rpc('fn_catalogo_usos_ler');
        if (error) throw new Error(error.message);
        cuDados = data || {};
    } catch (err) {
        if (cont) cont.innerHTML = `<div class="p-4 rounded-xl text-xs" style="background:#fee2e2;color:#991b1b">Não consegui carregar: ${cuEsc(err.message || String(err))}<br>Esta tela é só do master da plataforma.</div>`;
        return;
    }
    cuRender();
}

function cuRenderAbas() {
    const el = document.getElementById('cu-abas');
    if (!el) return;
    el.innerHTML = CU_ABAS.map(a => `<button type="button" onclick="cuTrocarAba('${a.id}')" class="rz-chip ${cuAba === a.id ? 'rz-on' : ''}">${a.rotulo}</button>`).join('');
}
function cuTrocarAba(id) { cuAba = id; cuAberto = null; cuFiltro = ''; cuProgAberto = null; cuRenderAbas(); cuRender(); }
function cuAbrir(chave) { cuAberto = cuAberto === chave ? null : chave; cuRender(); }
function cuBuscar(v) {
    cuFiltro = v; cuRender();
    const el = document.getElementById('cu-busca'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
}

function cuRender() {
    const cont = document.getElementById('cu-conteudo');
    if (!cont || !cuDados) return;
    const r = { ramos: cuRenderRamos, contratos: cuRenderContratos, programas: cuRenderProgramas, itens: cuRenderItens,
                transicoes: cuRenderTransicoes, animais: cuRenderAnimais, alteracoes: cuRenderAlteracoes }[cuAba];
    cont.innerHTML = r ? r() : '';
}

function cuCabecalho(texto, podeCriar) {
    return `<div class="flex flex-wrap items-center justify-between gap-2 mb-2">
        <input id="cu-busca" value="${cuEsc(cuFiltro)}" oninput="cuBuscar(this.value)" placeholder="Buscar por nome ou código…" class="flex-1 min-w-[220px] p-2 border rounded-lg text-xs">
        ${podeCriar ? pmBotaoToggle('cu-novo', "cuAbrir('novo')") : ''}
    </div>
    <p class="text-xs mb-2" style="color:var(--sage)">${texto}</p>`;
}
function cuBate(...campos) { const t = cuFiltro.trim().toLowerCase(); return !t || campos.some(c => String(c || '').toLowerCase().includes(t)); }

// ---------------------------------------------------------------- FORMULÁRIO GENÉRICO
// campos: [{ k, r (rótulo), t: 'texto'|'num'|'bool'|'lista'|'multi'|'json'|'area', op: [{v,r}], trava: bool, ajuda, chave: bool }]
function cuForm(id, campos, valores, motivoTrava, onSalvar) {
    const v = k => valores ? valores[k] : undefined;
    const campo = c => {
        const travado = (c.chave && valores) || (c.trava && motivoTrava);
        const dis = travado ? 'disabled' : '';
        const cls = `w-full p-1.5 border rounded text-[11px] ${travado ? 'bg-slate-100' : ''}`;
        const nm = `cu-${id}-${c.k}`;
        let inp;
        if (c.t === 'bool') {
            return `<label class="text-[11px] flex items-center gap-1 ${travado ? 'opacity-60' : ''}" title="${travado && !c.chave ? cuEsc(motivoTrava) : ''}"><input type="checkbox" id="${nm}" ${v(c.k) === true || (valores == null && c.padrao === true) ? 'checked' : ''} ${dis}> ${cuEsc(c.r)}</label>`;
        } else if (c.t === 'lista') {
            const atual = v(c.k) ?? c.padrao ?? '';
            inp = `<select id="${nm}" class="${cls}" ${dis}>${c.vazio !== false ? `<option value="">${cuEsc(c.vazio || '—')}</option>` : ''}${(c.op || []).map(o => `<option value="${cuEsc(o.v)}" ${String(atual) === String(o.v) ? 'selected' : ''}>${cuEsc(o.r)}</option>`).join('')}</select>`;
        } else if (c.t === 'multi') {
            const atual = new Set(v(c.k) || []);
            inp = `<div class="flex flex-wrap gap-1 p-1.5 border rounded ${travado ? 'bg-slate-100' : ''}" id="${nm}">${(c.op || []).map(o => `<label class="text-[11px] flex items-center gap-1 px-1.5 py-0.5 rounded" style="background:#f8fafc"><input type="checkbox" value="${cuEsc(o.v)}" ${atual.has(o.v) ? 'checked' : ''} ${dis}>${cuEsc(o.r)}</label>`).join('')}</div>`;
        } else if (c.t === 'json') {
            inp = `<textarea id="${nm}" rows="3" class="${cls} font-mono" ${dis}>${cuEsc(JSON.stringify(v(c.k) ?? c.padrao ?? null, null, 1))}</textarea>`;
        } else if (c.t === 'area') {
            inp = `<textarea id="${nm}" rows="2" class="${cls}" ${dis}>${cuEsc(v(c.k) ?? '')}</textarea>`;
        } else {
            inp = `<input id="${nm}" type="${c.t === 'num' ? 'number' : 'text'}" value="${cuEsc(v(c.k) ?? '')}" class="${cls} ${c.chave ? 'font-mono' : ''}" ${dis} ${c.max ? `maxlength="${c.max}"` : ''}>`;
        }
        const nota = travado && !c.chave ? `<span class="block text-[10px]" style="color:var(--warning)">travado: ${cuEsc(motivoTrava)}</span>` : (c.ajuda ? `<span class="block text-[10px]" style="color:var(--sage)">${cuEsc(c.ajuda)}</span>` : '');
        return `<div class="${c.t === 'multi' || c.t === 'json' || c.t === 'area' || c.largo ? 'col-span-2' : ''}"><label class="text-[10px] font-semibold">${cuEsc(c.r)}${c.obrig && !valores ? ' <span style="color:var(--danger)">*</span>' : ''}</label>${inp}${nota}</div>`;
    };
    const bools = campos.filter(c => c.t === 'bool');
    const outros = campos.filter(c => c.t !== 'bool');
    return `<div class="p-3 border-t space-y-2" style="border-color:var(--line);background:#faf9f5">
        <div class="grid grid-cols-2 gap-2">${outros.map(campo).join('')}</div>
        ${bools.length ? `<div class="flex flex-wrap gap-3">${bools.map(campo).join('')}</div>` : ''}
        <div class="flex items-center gap-2">
            <button type="button" onclick="${onSalvar}" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style="background:var(--pine)">${valores ? 'Salvar alterações' : 'Criar'}</button>
            <span id="cu-${id}-status" class="text-[11px]" style="color:var(--sage)"></span>
        </div>
    </div>`;
}

// Lê o formulário e devolve só o que mudou (mais as chaves). undefined = erro já mostrado.
function cuLer(id, campos, valores) {
    const out = {};
    for (const c of campos) {
        const el = document.getElementById(`cu-${id}-${c.k}`);
        if (!el || el.disabled && !c.chave) continue;
        let val;
        if (c.t === 'bool') val = el.checked;
        else if (c.t === 'num') val = el.value === '' ? null : Number(el.value);
        else if (c.t === 'multi') val = [...el.querySelectorAll('input:checked')].map(i => i.value);
        else if (c.t === 'json') {
            try { val = el.value.trim() ? JSON.parse(el.value) : null; }
            catch { cuStatus(id, `"${c.r}" não é uma lista válida.`, true); return undefined; }
        } else val = el.value.trim();
        if (c.chave) { out[c.k] = valores ? valores[c.k] : val; continue; }
        const antes = valores ? valores[c.k] : undefined;
        const vazio = (!c.t || c.t === 'lista' || c.t === 'area') ? '' : null; // texto e lista: vazio = ''
        if (!valores || JSON.stringify(antes ?? vazio) !== JSON.stringify(val ?? vazio)) out[c.k] = val;
    }
    return out;
}
function cuStatus(id, msg, erro) {
    const st = document.getElementById(`cu-${id}-status`);
    if (st) { st.textContent = msg; st.style.color = erro ? 'var(--danger)' : 'var(--sage)'; }
}
async function cuGravar(id, funcao, payload) {
    if (Object.keys(payload).length <= 1 && cuAberto !== 'novo') { cuStatus(id, 'Nada mudou.'); return false; }
    cuStatus(id, 'Salvando…');
    const { error } = await dbAuth.schema('gestao').rpc(funcao, { p: payload });
    if (error) { cuStatus(id, error.message, true); return false; }
    cuAberto = null;
    await cuCarregar();
    return true;
}

// ---------------------------------------------------------------- RAMOS
const CU_CAMPOS_RAMO = () => [
    { k: 'codigo', r: 'Código', chave: true, obrig: true, ajuda: 'letras minúsculas e _' },
    { k: 'nome', r: 'Nome', obrig: true },
    { k: 'unidade_singular', r: 'Unidade (singular)', ajuda: 'ex.: talhão, obra, lote' },
    { k: 'unidade_plural', r: 'Unidade (plural)' },
    { k: 'nome_subativo_singular', r: 'Parte (singular)', ajuda: 'ex.: unidade, área, integrante' },
    { k: 'nome_subativo_plural', r: 'Parte (plural)' },
    { k: 'icone', r: 'Ícone (Lucide)', ajuda: 'ex.: wheat, hard-hat, fence' },
    { k: 'ordem', r: 'Ordem', t: 'num' },
    { k: 'status', r: 'Situação', t: 'lista', vazio: false, op: cuLista('ativo_ramos', 'status').map(v => ({ v, r: v.replace('_', ' ') })) },
    { k: 'licenca_codigo', r: 'Licença', ajuda: 'código do módulo em licencas' },
    { k: 'tom', r: 'Tom (cor)', trava: true },
    { k: 'descricao', r: 'Descrição', t: 'area' },
    { k: 'soma_valor', r: 'soma valor de patrimônio', t: 'bool', trava: true, padrao: true },
    { k: 'tem_uso', r: 'tem uso (comercial · próprio)', t: 'bool' },
];
function cuRenderRamos() {
    const lista = (cuDados.ramos || []).filter(r => cuBate(r.nome, r.codigo));
    return cuCabecalho(`${lista.length} ramo(s). Soma valor e tom não mudam com ativos no ramo.`, true)
        + (cuAberto === 'novo' ? `<div class="border rounded-xl overflow-hidden mb-2" style="border-color:var(--line)">${cuForm('novo', CU_CAMPOS_RAMO(), null, '', "cuSalvarRamo('novo')")}</div>` : '')
        + `<div class="space-y-1.5">${lista.map(r => cuLinha(`ramo-${r.codigo}`, `${cuEsc(r.nome)} <span class="text-[11px] font-mono font-normal" style="color:var(--sage)">${cuEsc(r.codigo)}</span>`,
            `${cuEsc(r.unidade_singular)}/${cuEsc(r.unidade_plural)}${r.soma_valor ? ' · soma valor' : ' · contagem'}${r.licenca_codigo ? ' · licença ' + cuEsc(r.licenca_codigo) : ''}`,
            cuSituacao(r.status) + ' ' + cuEmUso(r.em_uso, 'ativos:'),
            () => cuForm(`ramo-${r.codigo}`, CU_CAMPOS_RAMO(), r, Number(r.em_uso) > 0 ? `o ramo tem ${r.em_uso} ativo(s)` : '', `cuSalvarRamo('${cuJs(r.codigo)}')`))).join('')}</div>`;
}
async function cuSalvarRamo(cod) {
    const id = cod === 'novo' ? 'novo' : `ramo-${cod}`;
    const r = cod === 'novo' ? null : (cuDados.ramos || []).find(x => x.codigo === cod);
    const p = cuLer(id, CU_CAMPOS_RAMO(), r); if (!p) return;
    if (!p.codigo) { cuStatus(id, 'Informe o código.', true); return; }
    await cuGravar(id, 'fn_catalogo_ramo_salvar', p);
}

// ---------------------------------------------------------------- LINHA (abre o formulário logo abaixo)
function cuLinha(chave, titulo, sub, direita, form) {
    const aberto = cuAberto === chave;
    return `<div class="border rounded-xl overflow-hidden" style="border-color:var(--line)">
        <button type="button" onclick="cuAbrir('${cuJs(chave)}')" class="w-full text-left px-3 py-2 flex items-center justify-between gap-2" style="background:${aberto ? '#faf9f5' : '#fff'}">
            <span class="min-w-0"><span class="block text-sm font-medium truncate" style="color:var(--ink)">${titulo}</span>${sub ? `<span class="block text-[11px] truncate" style="color:var(--sage)">${sub}</span>` : ''}</span>
            <span class="flex items-center gap-1.5 flex-none">${direita || ''}<span class="text-xs" style="color:var(--sage)">${aberto ? '▲' : '▼'}</span></span>
        </button>
        ${aberto ? form() : ''}
    </div>`;
}

// ---------------------------------------------------------------- TIPOS DE CONTRATO
function cuOpModelos() { return (cuDados.apoio?.modelos || []).map(m => ({ v: m.codigo, r: m.nome + (m.universal ? '' : ` · ${m.ramo}`) })); }
const CU_CAMPOS_CONTRATO = () => [
    { k: 'codigo', r: 'Código', chave: true, obrig: true },
    { k: 'nome', r: 'Nome', obrig: true },
    { k: 'modelo', r: 'Modelo de uso', t: 'lista', op: cuOpModelos(), trava: true, obrig: true },
    { k: 'forma_receita', r: 'Forma de receita', t: 'lista', op: cuLista('contrato_tipos', 'forma_receita').map(v => ({ v, r: v.replace(/_/g, ' ') })), trava: true, obrig: true },
    { k: 'recebimento', r: 'Recebimento', ajuda: 'ex.: locatário (boleto/PIX)' },
    { k: 'fim_vigencia', r: 'No fim da vigência', t: 'lista', vazio: false, op: cuLista('contrato_tipos', 'fim_vigencia').map(v => ({ v, r: v === 'segue_vigente' ? 'segue vigente (prazo indeterminado)' : 'conclui' })) },
    { k: 'reajuste_meses_padrao', r: 'Reajuste a cada (meses)', t: 'num' },
    { k: 'revisional_meses_padrao', r: 'Revisional a cada (meses)', t: 'num' },
    { k: 'prazo_meses_min', r: 'Prazo mínimo (meses)', t: 'num' },
    { k: 'prazo_meses_max', r: 'Prazo máximo (meses)', t: 'num' },
    { k: 'status', r: 'Situação', t: 'lista', vazio: false, op: cuLista('contrato_tipos', 'status').map(v => ({ v, r: v.replace('_', ' ') })) },
    { k: 'ordem', r: 'Ordem', t: 'num' },
    { k: 'descricao', r: 'Descrição', t: 'area' },
    { k: 'revisional_permitida', r: 'revisional permitida', t: 'bool', padrao: true },
    { k: 'aceita_filhos', r: 'aceita contratos filhos (compradores)', t: 'bool' },
];
function cuRenderContratos() {
    const lista = (cuDados.contrato_tipos || []).filter(c => cuBate(c.nome, c.codigo, c.modelo));
    const itensDe = cod => (cuDados.itens || []).filter(i => i.escopo_tipo === 'contrato_tipo' && i.escopo_valor === cod);
    return cuCabecalho(`${lista.length} tipo(s) de contrato. Com contratos, modelo de uso e forma de receita não mudam.`, true)
        + (cuAberto === 'novo' ? `<div class="border rounded-xl overflow-hidden mb-2" style="border-color:var(--line)">${cuForm('novo', CU_CAMPOS_CONTRATO(), null, '', "cuSalvarContrato('novo')")}</div>` : '')
        + `<div class="space-y-1.5">${lista.map(c => cuLinha(`ct-${c.codigo}`, `${cuEsc(c.nome)} <span class="text-[11px] font-mono font-normal" style="color:var(--sage)">${cuEsc(c.codigo)}</span>`,
            `${cuEsc(cuNomeModelo(c.modelo))} · ${cuEsc(String(c.forma_receita || '').replace(/_/g, ' '))}${c.reajuste_meses_padrao ? ` · reajuste ${c.reajuste_meses_padrao} m` : ''}${c.revisional_meses_padrao ? ` · revisional ${c.revisional_meses_padrao} m` : ''} · ${itensDe(c.codigo).length} item(ns) sugerido(s)`,
            cuSituacao(c.status) + ' ' + cuEmUso(c.em_uso, 'contratos:'),
            () => cuForm(`ct-${c.codigo}`, CU_CAMPOS_CONTRATO(), c, Number(c.em_uso) > 0 ? `o tipo tem ${c.em_uso} contrato(s)` : '', `cuSalvarContrato('${cuJs(c.codigo)}')`)
                + cuItensDoEscopo('contrato_tipo', c.codigo))).join('')}</div>`;
}
function cuNomeModelo(c) { const m = (cuDados.apoio?.modelos || []).find(x => x.codigo === c); return m ? m.nome : (c || '—'); }
async function cuSalvarContrato(cod) {
    const id = cod === 'novo' ? 'novo' : `ct-${cod}`;
    const c = cod === 'novo' ? null : (cuDados.contrato_tipos || []).find(x => x.codigo === cod);
    const p = cuLer(id, CU_CAMPOS_CONTRATO(), c); if (!p) return;
    if (!p.codigo) { cuStatus(id, 'Informe o código.', true); return; }
    await cuGravar(id, 'fn_catalogo_contrato_tipo_salvar', p);
}

// Itens sugeridos dentro da ficha do tipo de contrato, programa ou fase (atalho para a aba Itens sugeridos)
function cuItensDoEscopo(escopo, valor) {
    const itens = (cuDados.itens || []).filter(i => i.escopo_tipo === escopo && i.escopo_valor === valor);
    return `<div class="px-3 pb-3" style="background:#faf9f5">
        <p class="text-[10px] font-semibold mb-1" style="color:var(--sage)">Itens sugeridos (${itens.length})</p>
        ${itens.length ? itens.map(i => `<p class="text-[11px]" style="color:${i.ativo ? 'var(--ink)' : 'var(--sage)'}">• ${cuEsc(i.titulo_sugerido)}${i.frequencia_intervalo ? ` · a cada ${i.frequencia_intervalo} ${cuEsc(i.frequencia_unidade || '')}` : ''}${i.ativo ? '' : ' (desativado)'}</p>`).join('') : '<p class="text-[11px]" style="color:var(--sage)">Nenhum.</p>'}
        <button type="button" onclick="cuIrItens('${cuJs(escopo)}','${cuJs(valor)}')" class="mt-1 text-[11px] font-bold" style="color:var(--pine)">Editar itens sugeridos ›</button>
    </div>`;
}
function cuIrItens(escopo, valor) { cuAba = 'itens'; cuFiltro = valor; cuAberto = null; cuRenderAbas(); cuRender(); }

// ---------------------------------------------------------------- PROGRAMAS E FASES
const CU_CAMPOS_PROGRAMA = () => [
    { k: 'codigo', r: 'Código', chave: true, obrig: true },
    { k: 'nome', r: 'Nome', obrig: true },
    { k: 'ramo', r: 'Ramo', t: 'lista', op: (cuDados.ramos || []).map(r => ({ v: r.codigo, r: r.nome })) },
    { k: 'origem', r: 'Nasce de', t: 'lista', vazio: false, op: cuLista('programas', 'origem').map(v => ({ v, r: v === 'tipo' ? 'tipo de ativo' : 'uso (contrato)' })), obrig: true },
    { k: 'status', r: 'Situação', t: 'lista', vazio: false, op: cuLista('programas', 'status').map(v => ({ v, r: v.replace('_', ' ') })) },
    { k: 'ordem', r: 'Ordem', t: 'num' },
    { k: 'tipos', r: 'Tipos de ativo a que se aplica', t: 'multi', op: (cuDados.apoio?.tipos_ativo || []).map(t => ({ v: t.codigo, r: t.nome })) },
    { k: 'modelos', r: 'Usos a que se aplica', t: 'multi', op: cuOpModelos() },
    { k: 'ciclo_rotulo', r: 'Rótulo do ciclo', ajuda: 'ex.: Safra, Temporada' },
    { k: 'ciclo_nome_padrao', r: 'Nome padrão do ciclo', ajuda: 'ex.: Safra AA/AA' },
    { k: 'ciclo_duracao_meses', r: 'Duração do ciclo (meses)', t: 'num' },
    { k: 'ciclo_inicio_mes', r: 'Mês de início do ciclo', t: 'num' },
    { k: 'especie', r: 'Espécie (por animal)', t: 'lista', op: (cuDados.apoio?.especies || []).map(e => ({ v: e.codigo, r: e.nome })), trava: true },
    { k: 'ciclo_resultado', r: 'Resultado do ciclo (campos)', t: 'json', ajuda: '[{"campo":"sacas","rotulo":"Sacas colhidas","unidade":"sc"}]' },
    { k: 'descricao', r: 'Descrição', t: 'area' },
    { k: 'tem_ciclo', r: 'tem ciclo', t: 'bool', trava: true },
    { k: 'tem_etapas', r: 'tem etapas (obra)', t: 'bool', trava: true },
    { k: 'por_membro', r: 'ciclo por animal', t: 'bool', trava: true },
];
const CU_CAMPOS_FASE = () => [
    { k: 'codigo', r: 'Código', chave: true, obrig: true },
    { k: 'nome', r: 'Nome', obrig: true },
    { k: 'ordem', r: 'Ordem', t: 'num', trava: true },
    { k: 'entrada', r: 'Entra por', t: 'lista', vazio: false, op: cuLista('programa_fases', 'entrada').map(v => ({ v, r: { acao: 'ação do usuário', data: 'data', registro: 'registro', prazo: 'prazo' }[v] || v })), trava: true },
    { k: 'entrada_mes', r: 'Mês de entrada', t: 'num', trava: true },
    { k: 'prazo_dias', r: 'Prazo (dias)', t: 'num', trava: true },
    { k: 'marco_fase', r: 'Marco', trava: true },
    { k: 'aviso_rotulo', r: 'Rótulo do aviso', ajuda: 'ex.: Parto previsto; vazio = sem aviso' },
    { k: 'antecedencia_dias', r: 'Avisar com (dias)', t: 'num' },
    { k: 'opcional', r: 'opcional', t: 'bool', trava: true },
    { k: 'final', r: 'fase final', t: 'bool', trava: true },
    { k: 'automatica', r: 'muda sozinha na data', t: 'bool', trava: true },
    { k: 'ativo', r: 'ativa', t: 'bool', padrao: true },
];
function cuRenderProgramas() {
    const lista = (cuDados.programas || []).filter(g => cuBate(g.nome, g.codigo, g.ramo));
    const porRamo = {};
    lista.forEach(g => { const k = g.ramo || '(sem ramo)'; (porRamo[k] = porRamo[k] || []).push(g); });
    const nomeRamo = c => ((cuDados.ramos || []).find(r => r.codigo === c) || {}).nome || c;
    return cuCabecalho(`${lista.length} programa(s). Com execução, ciclo, etapas e "por animal" não mudam; com execução em andamento, a ordem e a entrada das fases também (fase nova vale para ciclos novos).`, true)
        + (cuAberto === 'novo' ? `<div class="border rounded-xl overflow-hidden mb-2" style="border-color:var(--line)">${cuForm('novo', CU_CAMPOS_PROGRAMA(), null, '', "cuSalvarPrograma('novo')")}</div>` : '')
        + `<div class="space-y-3">${Object.keys(porRamo).map(rm => `<div>
            <p class="text-[11px] font-bold uppercase tracking-wide mb-1" style="color:var(--sage)">${cuEsc(nomeRamo(rm))}</p>
            <div class="space-y-1.5">${porRamo[rm].map(g => {
                const fases = g.fases || [];
                const sub = [g.origem === 'tipo' ? 'nasce do tipo' : 'nasce do uso', g.tem_ciclo ? `ciclo${g.ciclo_rotulo ? ' = ' + g.ciclo_rotulo : ''}` : g.tem_etapas ? 'etapas' : 'sem ciclo',
                             fases.length ? `${fases.length} fase(s)` : '', g.por_membro ? 'por animal' : ''].filter(Boolean).join(' · ');
                return cuLinha(`pg-${g.codigo}`, `${cuEsc(g.nome)} <span class="text-[11px] font-mono font-normal" style="color:var(--sage)">${cuEsc(g.codigo)}</span>`, cuEsc(sub),
                    cuSituacao(g.status) + ' ' + cuEmUso(g.em_uso, 'execuções:'),
                    () => cuForm(`pg-${g.codigo}`, CU_CAMPOS_PROGRAMA(), g, Number(g.em_uso) > 0 ? `o programa tem ${g.em_uso} execução(ões)` : '', `cuSalvarPrograma('${cuJs(g.codigo)}')`)
                        + cuFasesDoPrograma(g) + cuItensDoEscopo('programa', g.codigo));
            }).join('')}</div></div>`).join('') || pmVazio('Nenhum programa com esse filtro.')}</div>`;
}
function cuFasesDoPrograma(g) {
    const fases = g.fases || [];
    const travaFase = Number(g.em_andamento) > 0 ? `o programa tem ${g.em_andamento} execução(ões) em andamento; crie uma fase nova` : '';
    const chaveNova = `fase-${g.codigo}-nova`;
    return `<div class="px-3 pb-3 space-y-1" style="background:#faf9f5">
        <p class="text-[10px] font-semibold" style="color:var(--sage)">Fases (${fases.length})</p>
        ${fases.map(f => {
            const ch = `fase-${g.codigo}-${f.codigo}`;
            const aberta = cuProgAberto === ch;
            return `<div class="border rounded-lg bg-white" style="border-color:var(--line)">
                <button type="button" onclick="cuAbrirFase('${cuJs(ch)}')" class="w-full text-left px-2 py-1.5 text-[11px] flex justify-between gap-2">
                    <span><b>${f.ordem} · ${cuEsc(f.nome)}</b> <span style="color:var(--sage)">entra por ${cuEsc(f.entrada)}${f.aviso_rotulo ? ' · aviso "' + cuEsc(f.aviso_rotulo) + '"' : ''}${f.automatica ? ' · automática' : ''}${f.ativo ? '' : ' · desativada'}</span></span><span style="color:var(--sage)">${aberta ? '▲' : '▼'}</span>
                </button>
                ${aberta ? cuForm(ch, CU_CAMPOS_FASE(), f, travaFase, `cuSalvarFase('${cuJs(g.codigo)}','${cuJs(f.codigo)}')`) : ''}
            </div>`;
        }).join('')}
        ${cuProgAberto === chaveNova ? `<div class="border rounded-lg bg-white" style="border-color:var(--line)">${cuForm(chaveNova, CU_CAMPOS_FASE(), null, '', `cuSalvarFase('${cuJs(g.codigo)}','')`)}</div>`
            : `<button type="button" onclick="cuAbrirFase('${cuJs(chaveNova)}')" class="text-[11px] font-bold" style="color:var(--pine)">+ Adicionar fase</button>`}
    </div>`;
}
function cuAbrirFase(ch) { cuProgAberto = cuProgAberto === ch ? null : ch; cuRender(); }
async function cuSalvarPrograma(cod) {
    const id = cod === 'novo' ? 'novo' : `pg-${cod}`;
    const g = cod === 'novo' ? null : (cuDados.programas || []).find(x => x.codigo === cod);
    const p = cuLer(id, CU_CAMPOS_PROGRAMA(), g ? Object.assign({}, g, { tipos: g.tipos || [], modelos: g.modelos || [] }) : null); if (!p) return;
    if (!p.codigo) { cuStatus(id, 'Informe o código.', true); return; }
    await cuGravar(id, 'fn_catalogo_programa_salvar', p);
}
async function cuSalvarFase(prog, cod) {
    const id = cod ? `fase-${prog}-${cod}` : `fase-${prog}-nova`;
    const g = (cuDados.programas || []).find(x => x.codigo === prog);
    const f = cod ? (g?.fases || []).find(x => x.codigo === cod) : null;
    const p = cuLer(id, CU_CAMPOS_FASE(), f); if (!p) return;
    if (!p.codigo) { cuStatus(id, 'Informe o código.', true); return; }
    p.programa_codigo = prog;
    if (Object.keys(p).length <= 2 && f) { cuStatus(id, 'Nada mudou.'); return; }
    cuStatus(id, 'Salvando…');
    const { error } = await dbAuth.schema('gestao').rpc('fn_catalogo_fase_salvar', { p });
    if (error) { cuStatus(id, error.message, true); return; }
    cuProgAberto = null;
    await cuCarregar();
}

// ---------------------------------------------------------------- ITENS SUGERIDOS
function cuOpEscopoValor(escopo) {
    if (escopo === 'contrato_tipo') return (cuDados.contrato_tipos || []).map(c => ({ v: c.codigo, r: c.nome }));
    if (escopo === 'fase') return (cuDados.programas || []).flatMap(g => (g.fases || []).map(f => ({ v: `${g.codigo}.${f.codigo}`, r: `${g.nome} › ${f.nome}` })));
    return (cuDados.programas || []).map(g => ({ v: g.codigo, r: g.nome }));
}
const CU_CAMPOS_ITEM = (escopo) => [
    { k: 'escopo_tipo', r: 'Vale para', t: 'lista', vazio: false, op: [{ v: 'contrato_tipo', r: 'tipo de contrato' }, { v: 'programa', r: 'programa' }, { v: 'fase', r: 'fase' }, { v: 'ciclo', r: 'ciclo (programa)' }], chave: true },
    { k: 'escopo_valor', r: 'Qual', t: 'lista', op: cuOpEscopoValor(escopo || 'contrato_tipo'), chave: true, obrig: true },
    { k: 'titulo_sugerido', r: 'Título', obrig: true, largo: true },
    { k: 'tipo', r: 'Tipo de item', t: 'lista', op: (cuDados.apoio?.tipos_item || []).map(t => ({ v: t.codigo, r: t.nome })), obrig: true },
    { k: 'subtipo_id', r: 'Subtipo', t: 'lista', op: (cuDados.apoio?.subtipos || []).map(s => ({ v: s.id, r: s.nome })) },
    { k: 'frequencia_intervalo', r: 'Repetir a cada', t: 'num' },
    { k: 'frequencia_unidade', r: 'Unidade', t: 'lista', op: ['dias', 'semanas', 'meses', 'anos'].map(v => ({ v, r: v })) },
    { k: 'antecedencia_alerta_dias', r: 'Avisar com (dias)', t: 'num' },
    { k: 'data_pedida', r: 'Data pedida', t: 'lista', op: cuLista('cofre_modelos_item_controle', 'data_pedida').map(v => ({ v, r: v.replace('_', ' ') })) },
    { k: 'automatico', r: 'vem marcado', t: 'bool' },
    { k: 'ativo', r: 'ativo', t: 'bool', padrao: true },
];
let cuNovoEscopo = 'contrato_tipo';
function cuRenderItens() {
    const nomeDe = i => (cuOpEscopoValor(i.escopo_tipo).find(o => o.v === i.escopo_valor) || {}).r || i.escopo_valor;
    const lista = (cuDados.itens || []).filter(i => cuBate(i.titulo_sugerido, i.escopo_valor, nomeDe(i)));
    const grupos = {};
    lista.forEach(i => { const k = `${i.escopo_tipo}|${i.escopo_valor}`; (grupos[k] = grupos[k] || []).push(i); });
    const rotEsc = { contrato_tipo: 'Tipo de contrato', programa: 'Programa', fase: 'Fase', ciclo: 'Ciclo' };
    return cuCabecalho(`${lista.length} item(ns) sugerido(s) de tipo de contrato, programa, fase e ciclo. Os de tipo de ativo ficam no Catálogo do patrimônio. Para mudar o destino de um item, desative e crie outro.`, true)
        + (cuAberto === 'novo' ? `<div class="border rounded-xl overflow-hidden mb-2" style="border-color:var(--line)">
              <div class="px-3 pt-2 flex gap-2 text-[11px]">${['contrato_tipo', 'programa', 'fase', 'ciclo'].map(e => `<button type="button" onclick="cuNovoEscopo='${e}';cuRender()" class="rz-chip ${cuNovoEscopo === e ? 'rz-on' : ''}">${rotEsc[e]}</button>`).join('')}</div>
              ${cuForm('novo', CU_CAMPOS_ITEM(cuNovoEscopo).map(c => c.k === 'escopo_tipo' ? Object.assign({}, c, { padrao: cuNovoEscopo, chave: false }) : c.k === 'escopo_valor' ? Object.assign({}, c, { chave: false }) : c), null, '', 'cuSalvarItem(null)')}</div>` : '')
        + `<div class="space-y-3">${Object.keys(grupos).map(k => {
            const [esc] = k.split('|'); const itens = grupos[k];
            return `<div><p class="text-[11px] font-bold uppercase tracking-wide mb-1" style="color:var(--sage)">${cuEsc(rotEsc[esc] || esc)} · ${cuEsc(nomeDe(itens[0]))}</p>
                <div class="space-y-1.5">${itens.map(i => cuLinha(`it-${i.id}`, cuEsc(i.titulo_sugerido),
                    `${cuEsc(i.tipo_nome || i.tipo)}${i.subtipo_nome ? ' · ' + cuEsc(i.subtipo_nome) : ''}${i.frequencia_intervalo ? ` · a cada ${i.frequencia_intervalo} ${cuEsc(i.frequencia_unidade || '')}` : ''}${i.automatico ? ' · vem marcado' : ''}`,
                    i.ativo ? cuBadge('ativo', 'ok') : cuBadge('desativado', 'neu'),
                    () => cuForm(`it-${i.id}`, CU_CAMPOS_ITEM(i.escopo_tipo), i, '', `cuSalvarItem('${cuJs(i.id)}')`))).join('')}</div></div>`;
        }).join('') || pmVazio('Nenhum item sugerido com esse filtro.')}</div>`;
}
async function cuSalvarItem(idItem) {
    const id = idItem ? `it-${idItem}` : 'novo';
    const i = idItem ? (cuDados.itens || []).find(x => x.id === idItem) : null;
    const campos = idItem ? CU_CAMPOS_ITEM(i.escopo_tipo) : CU_CAMPOS_ITEM(cuNovoEscopo).map(c => (c.k === 'escopo_tipo' || c.k === 'escopo_valor') ? Object.assign({}, c, { chave: false }) : c);
    const p = cuLer(id, campos, i); if (!p) return;
    if (idItem) { p.id = idItem; delete p.escopo_tipo; delete p.escopo_valor; if (Object.keys(p).length <= 1) { cuStatus(id, 'Nada mudou.'); return; } }
    else if (!p.escopo_valor) { cuStatus(id, 'Escolha para qual item vale.', true); return; }
    cuStatus(id, 'Salvando…');
    const { error } = await dbAuth.schema('gestao').rpc('fn_catalogo_item_sugerido_salvar', { p });
    if (error) { cuStatus(id, error.message, true); return; }
    cuAberto = null; await cuCarregar();
}

// ---------------------------------------------------------------- TRANSIÇÕES (D9-4: só rótulo, motivo, botão, ordem e ativa)
const CU_CAMPOS_TRANSICAO = () => [
    { k: 'rotulo', r: 'Rótulo do botão', max: 24, ajuda: 'até 24 caracteres' },
    { k: 'tipo_botao', r: 'Botão', t: 'lista', vazio: false, op: cuLista('status_transicoes', 'tipo_botao').map(v => ({ v, r: v === 'perigo' ? 'perigo (vermelho)' : 'neutro' })) },
    { k: 'ordem', r: 'Ordem', t: 'num' },
    { k: 'exige_motivo', r: 'exige motivo', t: 'bool' },
    { k: 'ativo', r: 'ativa', t: 'bool', padrao: true },
];
function cuRenderTransicoes() {
    const lista = (cuDados.transicoes || []).filter(t => cuBate(t.rotulo, t.entidade, t.de, t.para, t.recorte_valor));
    const grupos = {};
    lista.forEach(t => { const k = t.entidade + (t.recorte_valor ? ` · ${t.recorte_valor}` : ''); (grupos[k] = grupos[k] || []).push(t); });
    return cuCabecalho(`${lista.length} transição(ões). Entidade, de, para, gatilho e ação são código: transição nova é por migration.`, false)
        + `<div class="space-y-3">${Object.keys(grupos).sort().map(k => `<div>
            <p class="text-[11px] font-bold uppercase tracking-wide mb-1" style="color:var(--sage)">${cuEsc(k)}</p>
            <div class="space-y-1.5">${grupos[k].map(t => cuLinha(`tr-${t.id}`, cuEsc(t.rotulo || '(sem rótulo)'),
                `${cuEsc(t.de)} → ${cuEsc(t.para)} · ${cuEsc(t.gatilho)}${t.acao ? ' · ' + cuEsc(t.acao) : ''}${t.exige_motivo ? ' · pede motivo' : ''}`,
                (t.tipo_botao === 'perigo' ? cuBadge('perigo', 'av') + ' ' : '') + (t.ativo ? cuBadge('ativa', 'ok') : cuBadge('desativada', 'neu')),
                () => cuForm(`tr-${t.id}`, CU_CAMPOS_TRANSICAO(), t, '', `cuSalvarTransicao('${cuJs(t.id)}')`))).join('')}</div></div>`).join('') || pmVazio('Nenhuma transição com esse filtro.')}</div>`;
}
async function cuSalvarTransicao(idT) {
    const id = `tr-${idT}`;
    const t = (cuDados.transicoes || []).find(x => x.id === idT);
    const p = cuLer(id, CU_CAMPOS_TRANSICAO(), t); if (!p) return;
    if (!Object.keys(p).length) { cuStatus(id, 'Nada mudou.'); return; }
    p.id = idT;
    cuStatus(id, 'Salvando…');
    const { error } = await dbAuth.schema('gestao').rpc('fn_catalogo_transicao_salvar', { p });
    if (error) { cuStatus(id, error.message, true); return; }
    cuAberto = null; await cuCarregar();
}

// ---------------------------------------------------------------- ANIMAIS (categorias por espécie)
const CU_CAMPOS_CATEGORIA = () => [
    { k: 'especie', r: 'Espécie', t: 'lista', vazio: false, op: (cuDados.apoio?.especies || []).map(e => ({ v: e.codigo, r: e.nome })), chave: true },
    { k: 'codigo', r: 'Código', chave: true, obrig: true },
    { k: 'nome', r: 'Nome', obrig: true },
    { k: 'sexo', r: 'Sexo', t: 'lista', op: cuLista('membro_categorias', 'sexo').map(v => ({ v, r: v === 'femea' ? 'fêmea' : 'macho' })) },
    { k: 'idade_min_meses', r: 'Idade mínima (meses)', t: 'num' },
    { k: 'idade_max_meses', r: 'Idade máxima (meses)', t: 'num' },
    { k: 'partos_min', r: 'Partos (mínimo)', t: 'num' },
    { k: 'ordem', r: 'Ordem', t: 'num' },
    { k: 'automatica', r: 'a rotina recategoriza pela idade', t: 'bool', padrao: true },
];
function cuRenderAnimais() {
    const lista = (cuDados.membro_categorias || []).filter(m => cuBate(m.nome, m.codigo, m.especie));
    const porEsp = {};
    lista.forEach(m => { (porEsp[m.especie] = porEsp[m.especie] || []).push(m); });
    const nomeEsp = c => ((cuDados.apoio?.especies || []).find(e => e.codigo === c) || {}).nome || c;
    const novoCampos = CU_CAMPOS_CATEGORIA().map(c => c.k === 'especie' || c.k === 'codigo' ? Object.assign({}, c, { chave: false }) : c);
    return cuCabecalho(`${lista.length} categoria(s). A rotina diária recategoriza pela idade e pelos partos.`, true)
        + (cuAberto === 'novo' ? `<div class="border rounded-xl overflow-hidden mb-2" style="border-color:var(--line)">${cuForm('novo', novoCampos, null, '', "cuSalvarCategoria('','')")}</div>` : '')
        + `<div class="space-y-3">${Object.keys(porEsp).map(e => `<div>
            <p class="text-[11px] font-bold uppercase tracking-wide mb-1" style="color:var(--sage)">${cuEsc(nomeEsp(e))}</p>
            <div class="space-y-1.5">${porEsp[e].map(m => cuLinha(`mc-${m.especie}-${m.codigo}`, `${cuEsc(m.nome)} <span class="text-[11px] font-mono font-normal" style="color:var(--sage)">${cuEsc(m.codigo)}</span>`,
                [m.sexo === 'femea' ? 'fêmea' : m.sexo === 'macho' ? 'macho' : '', m.idade_min_meses != null || m.idade_max_meses != null ? `${m.idade_min_meses ?? 0} a ${m.idade_max_meses ?? '…'} meses` : '', m.partos_min ? `${m.partos_min}+ partos` : ''].filter(Boolean).join(' · '),
                cuEmUso(m.em_uso, 'animais:'),
                () => cuForm(`mc-${m.especie}-${m.codigo}`, CU_CAMPOS_CATEGORIA(), m, '', `cuSalvarCategoria('${cuJs(m.especie)}','${cuJs(m.codigo)}')`))).join('')}</div></div>`).join('') || pmVazio('Nenhuma categoria com esse filtro.')}</div>`;
}
async function cuSalvarCategoria(esp, cod) {
    const novo = !cod;
    const id = novo ? 'novo' : `mc-${esp}-${cod}`;
    const m = novo ? null : (cuDados.membro_categorias || []).find(x => x.especie === esp && x.codigo === cod);
    const campos = novo ? CU_CAMPOS_CATEGORIA().map(c => c.k === 'especie' || c.k === 'codigo' ? Object.assign({}, c, { chave: false }) : c) : CU_CAMPOS_CATEGORIA();
    const p = cuLer(id, campos, m); if (!p) return;
    if (!novo) { p.especie = esp; p.codigo = cod; }
    if (!p.codigo || !p.especie) { cuStatus(id, 'Informe espécie e código.', true); return; }
    if (!novo && Object.keys(p).length <= 2) { cuStatus(id, 'Nada mudou.'); return; }
    cuStatus(id, 'Salvando…');
    const { error } = await dbAuth.schema('gestao').rpc('fn_catalogo_membro_categoria_salvar', { p });
    if (error) { cuStatus(id, error.message, true); return; }
    cuAberto = null; await cuCarregar();
}

// ---------------------------------------------------------------- ALTERAÇÕES (gestao.log_acoes)
function cuRenderAlteracoes() {
    const rot = { ativo_ramos: 'Ramo', contrato_tipos: 'Tipo de contrato', programas: 'Programa', programa_fases: 'Fase', cofre_modelos_item_controle: 'Item sugerido',
                  status_transicoes: 'Transição', membro_categorias: 'Categoria de animal', ativo_tipos: 'Tipo de ativo' };
    const lista = (cuDados.alteracoes || []).filter(a => cuBate(a.detalhe?.chave, a.detalhe?.catalogo, a.quem));
    const fmt = v => v == null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v);
    return cuCabecalho(`${lista.length} alteração(ões) recente(s) nos catálogos, mais nova primeiro.`, false)
        + `<div class="space-y-1.5">${lista.map(a => {
            const d = a.detalhe || {}; const mud = d.mudou || {};
            const quando = a.em ? new Date(a.em).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
            return `<div class="border rounded-xl px-3 py-2" style="border-color:var(--line);background:#fff">
                <p class="text-[11px]" style="color:var(--sage)">${cuEsc(quando)} · ${cuEsc(a.quem || 'master')} · ${d.novo ? 'criou' : 'mudou'} ${cuEsc(rot[d.catalogo] || d.catalogo)} <b style="color:var(--ink)">${cuEsc(d.chave)}</b></p>
                ${d.novo ? '' : Object.keys(mud).map(k => `<p class="text-[11px]" style="color:var(--ink)">${cuEsc(k)}: <span style="color:var(--sage)">${cuEsc(fmt(mud[k].de))}</span> → ${cuEsc(fmt(mud[k].para))}</p>`).join('')}
            </div>`;
        }).join('') || pmVazio('Nenhuma alteração ainda.')}</div>`;
}
