// ============================================================================
// js/telas/catalogo-patrimonio.js — Raiz Gestão
// Versão: 1.2.0 · 18/09/2026
//
// v1.2.0 — Item 2 do feedback do Nicola (rodada 2): a aba Aplicabilidade
// trocou a lista de chips (flex-wrap, quebrava/amontoava quando um subtipo
// tinha vínculo com muitas categorias — caso extremo: "Não classificado",
// 8/8) por uma matriz de largura fixa (sempre 8 células, uma por categoria
// macro — nunca quebra linha, nada escondido ou resumido). Célula vazia =
// clique cria o vínculo direto (cpAplAdicionarRapido, sem abrir formulário);
// célula preenchida = clique remove (com confirmação). Vínculos por código
// (tipo de ativo específico, não a categoria toda) continuam raros e ficam
// como chips numa linha compacta abaixo da matriz. Combinado com o Nicola:
// não esconder/resumir dado, só mudar o formato.
//
// v1.1.0 — Feedback do Nicola testando a Onda 2: a aba Conciliação saiu
// daqui e virou tela própria (js/telas/conciliacao-catalogo.js) — não tem
// relação com categoria/subtipo do patrimônio, é outro assunto (regras de
// conciliação bancária). 5 abas agora: Subtipos · Aplicabilidade · Tipos de
// ativo · Campos do tipo · Calendário & partes. Nenhuma mudança de
// comportamento nas abas que ficaram.
//
// v1.0.0 — Onda 2 da PROPOSTA_CATALOGO_GESTAO v1.3.0 (§12.11), depois da
// Onda 1 (M1–M12) reorganizar o catálogo em dois eixos: ativo (categoria
// macro + tipo de ativo) e controle/documento (natureza → subtipo →
// modelo/calendário). Card novo no PM_HUB de Configurações, ao lado de
// "Motor Documental" e "Partes padrão" (parametros-master.js).
//
// 6 abas: Subtipos · Aplicabilidade · Tipos de ativo · Campos do tipo ·
// Calendário & partes · Conciliação.
//
// Toda escrita passa pelas RPCs de catalogo_upsert_v4 (M11) — SECURITY
// DEFINER + fn_sou_master() + grava em log_acessos (LOG-01/LOG-02), nunca
// INSERT/UPDATE direto nas tabelas do catálogo:
//   fn_cofre_catalogo_upsert        → cofre_controle_subtipos (aba Subtipos)
//   fn_cofre_categoria_upsert       → cofre_categorias
//   fn_cofre_tipo_ativo_upsert      → ativo_tipos (aba Tipos de ativo)
//   fn_cofre_campo_tipo_upsert      → ativo_tipos_campos (aba Campos do tipo)
//   fn_cofre_aplicabilidade_upsert  → cofre_subtipo_aplicabilidade (aba Aplicabilidade)
//   fn_cofre_calendario_upsert      → cofre_calendario_tributo (aba Calendário & partes)
//
// CAN-05 (absorção do Motor Documental): a aba Subtipos passa a ser a ÚNICA
// porta de escrita dos campos ESTRUTURAIS do subtipo (categoria, titular,
// tipos de ativo aplicáveis, antecedência/reforço/recorrência, parcelamento
// padrão, gera controle, guarda arquivo, ativo). parametros-documental.js
// (Motor Documental › Catálogo) teve essas mesmas colunas REMOVIDAS do seu
// formulário nesta entrega — fica só com a lente de IA (prompt, sinônimos,
// como reconhecer, estratégia, complexidade, campos, validações, regra de
// vencimento). Uma porta de escrita (fn_cofre_catalogo_upsert), duas
// lentes, sem convivência — cada aba manda só as chaves que edita; o resto
// do registro fica intocado (a função faz coalesce por chave presente).
//
// Aba Conciliação: fn_gestao_conciliacao_visao já existe (nenhuma tela
// chamava) e conciliacao_fontes/conciliacao_regras já são globais e
// master-only — mas nenhuma RPC de escrita para essas duas tabelas foi
// revisada/avisada nesta onda (não fazia parte do pacote de RPCs de M11),
// então esta aba é SOMENTE LEITURA por ora (LOG-01 exige função central
// para toda escrita relevante — não dá pra fazer INSERT/UPDATE direto só
// porque a RLS permitiria). CRUD completo de fontes/regras fica pra uma
// entrega futura, registrado em nota na demanda d9937a2b.
//
// Cores/tokens: DESIGN_SYSTEM_RAIZ_PATRIMONIO (var(--pine)/--sage/--ink/
// --line/--danger/--warning/--success/--info). Gramática: a já
// estabelecida em parametros-documental.js/partes-padrao.js (decisão
// e3a0cc5b — REGRAS_EXPERIENCIA não rege o Gestão como um todo, mas os
// itens de PRODUTO usados aqui: status nas 5 semânticas, rótulo verbo +
// objeto, toast no passado, vazio num formato só, sentence case).
// ============================================================================

const CP_VERSAO = '1.2.0';
let cpAba = 'subtipos';

// ---- estado por aba --------------------------------------------------------
let cpCategorias = [];
let cpTiposAtivo = [];
let cpCamposTipo = [];
let cpSubtipos = [];
let cpAplicabilidade = [];
let cpCalendario = [];
let cpPartesPadrao = [];

let cpSubtipoAberto = null;
let cpSubtipoNovo = false;
let cpFiltroSubtipo = '';

let cpCategoriaEditCodigo = null;
let cpCategoriaNova = false;

let cpTipoAtivoEditId = null;
let cpTipoAtivoNovo = false;

let cpCampoEditId = null;
let cpCampoNovo = false;
let cpFiltroCategoriaCampo = '';

let cpAplicSubtipoAberto = null;
let cpAplicNovoAberto = false;

let cpCalendarioEditId = null;
let cpCalendarioNovo = false;
let cpCalendarioSubtipoAberto = null;

const CP_CATEGORIAS_ATIVO = ['imovel_predial', 'imovel_territorial', 'veiculo', 'embarcacao', 'aeronave', 'vida', 'bem_valor', 'outro'];
// Rótulo amigável do eixo do ATIVO (ativo_tipos.categoria — CHECK fixo, 8
// valores). Não confundir com cofre_categorias (eixo do controle/documento,
// usado só no campo "Categoria macro" do form de Subtipos).
const CP_CATEGORIA_ATIVO_LABEL = {
    imovel_predial: 'imóvel predial', imovel_territorial: 'imóvel territorial',
    veiculo: 'veículo', embarcacao: 'embarcação', aeronave: 'aeronave',
    vida: 'vida', bem_valor: 'bem de valor', outro: 'outro',
};
// Abreviação de 4 letras pra caber na matriz de aplicabilidade (largura fixa,
// nunca quebra linha — ver changelog v1.2.0).
const CP_CATEGORIA_ATIVO_ABREV = {
    imovel_predial: 'Pred', imovel_territorial: 'Terr',
    veiculo: 'Veíc', embarcacao: 'Emb', aeronave: 'Aero',
    vida: 'Vida', bem_valor: 'Bem', outro: 'Outro',
};
const CP_NATUREZAS = [
    { v: 'documento', r: 'documento' },
    { v: 'manutencao', r: 'manutenção' },
    { v: 'seguro', r: 'seguro' },
    { v: 'taxa', r: 'taxa' },
    { v: 'tributo', r: 'tributo' },
];
const CP_TITULARES = [
    { v: 'pessoa', r: 'pessoa' },
    { v: 'ativo', r: 'ativo' },
    { v: 'contrato', r: 'contrato' },
    { v: 'empresa', r: 'empresa' },
];

function cpEsc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function cpJson(v) { try { return JSON.stringify(v ?? null, null, 2); } catch { return ''; } }
function cpParse(txt, fallback) { const t = (txt || '').trim(); if (!t) return fallback; try { return JSON.parse(t); } catch { return undefined; } }
function cpLista(v) { return String(v || '').split(',').map(x => x.trim()).filter(Boolean); }

// ---------------------------------------------------------------- ENTRADA
async function telaCatalogoPatrimonioInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="mb-1">
            <h1 class="text-lg font-extrabold" style="color:var(--ink)">Catálogo do patrimônio</h1>
            <p class="text-xs" style="color:var(--sage)">Os dois eixos do catálogo global: o que um ativo É (categoria + tipo) e o que se CONTROLA sobre ele (natureza → subtipo → aplicabilidade → calendário). Vale pra todas as empresas.</p>
        </div>
        <div class="rz-chips mt-3" id="cp-abas"></div>
        <div id="cp-conteudo" class="mt-3"><p class="text-xs" style="color:var(--sage)">Carregando…</p></div>`;
    cpRenderAbas();
    try {
        await cpCarregarTudo();
    } catch (err) {
        document.getElementById('cp-conteudo').innerHTML = `
            <div class="p-4 rounded-xl text-xs" style="background:#fee2e2;color:#991b1b">
                Não consegui carregar o catálogo: ${cpEsc(err.message || String(err))}<br>
                Se o erro for de permissão, confira se sua conta está em <b>plataforma_operadores</b> — este catálogo só é editável pelo operador da plataforma.
            </div>`;
        return;
    }
    cpRenderAba();
}

function cpRenderAbas() {
    const abas = [
        { id: 'subtipos', rotulo: 'Subtipos' },
        { id: 'aplicabilidade', rotulo: 'Aplicabilidade' },
        { id: 'tipos-ativo', rotulo: 'Tipos de ativo' },
        { id: 'campos-tipo', rotulo: 'Campos do tipo' },
        { id: 'calendario', rotulo: 'Calendário & partes' },
    ];
    document.getElementById('cp-abas').innerHTML = abas.map(a =>
        `<button type="button" onclick="cpTrocarAba('${a.id}')" class="rz-chip ${cpAba === a.id ? 'rz-on' : ''}">${a.rotulo}</button>`).join('');
}

function cpTrocarAba(id) {
    cpAba = id;
    cpSubtipoAberto = null; cpCategoriaEditCodigo = null; cpTipoAtivoEditId = null;
    cpCampoEditId = null; cpAplicSubtipoAberto = null; cpCalendarioEditId = null;
    cpRenderAbas(); cpRenderAba();
}

function cpRenderAba() {
    if (cpAba === 'subtipos') return cpRenderSubtipos();
    if (cpAba === 'aplicabilidade') return cpRenderAplicabilidade();
    if (cpAba === 'tipos-ativo') return cpRenderTiposAtivo();
    if (cpAba === 'campos-tipo') return cpRenderCamposTipo();
    return cpRenderCalendario();
}

async function cpCarregarTudo() {
    if (typeof dbAuth === 'undefined') throw new Error('cliente Supabase (dbAuth) não disponível nesta tela.');
    const [rCat, rTa, rCampos, rSub, rApl, rCal, rPartes] = await Promise.all([
        dbAuth.from('cofre_categorias').select('*').is('cliente_id', null).order('ordem', { nullsFirst: false }).order('nome'),
        dbAuth.from('ativo_tipos').select('*').is('cliente_id', null).order('categoria').order('ordem', { nullsFirst: false }).order('nome'),
        dbAuth.from('ativo_tipos_campos').select('*').order('categoria').order('ordem', { nullsFirst: false }),
        dbAuth.from('cofre_controle_subtipos').select('*').is('cliente_id', null).neq('tipo', 'sistema').order('tipo').order('ordem', { nullsFirst: false }).order('nome'),
        dbAuth.from('cofre_subtipo_aplicabilidade').select('*'),
        dbAuth.from('cofre_calendario_tributo').select('*').order('uf', { nullsFirst: true }),
        dbAuth.from('cofre_partes_padrao').select('id, nome, uf, municipio_ibge, subtipo_id').order('nome'),
    ]);
    for (const r of [rCat, rTa, rCampos, rSub, rApl, rCal, rPartes]) if (r.error) throw new Error(r.error.message);
    cpCategorias = rCat.data || [];
    cpTiposAtivo = rTa.data || [];
    cpCamposTipo = rCampos.data || [];
    cpSubtipos = rSub.data || [];
    cpAplicabilidade = rApl.data || [];
    cpCalendario = rCal.data || [];
    cpPartesPadrao = rPartes.data || [];
}

function cpNomeSubtipo(id) { const s = cpSubtipos.find(x => x.id === id); return s ? s.nome : '(subtipo removido)'; }
function cpNomeCategoria(codigo) { const c = cpCategorias.find(x => x.codigo === codigo); return c ? c.nome : codigo; }
function cpNomeTipoAtivo(codigo) { const t = cpTiposAtivo.find(x => x.codigo === codigo); return t ? t.nome : codigo; }

// ============================================================== 1. SUBTIPOS
// Campos ESTRUTURAIS do subtipo (CAN-05 — a lente de IA fica só no Motor
// Documental). Escreve por fn_cofre_catalogo_upsert, mandando só estas
// chaves — o que o Motor Documental grava (prompt, campos, validações...)
// fica intocado porque a função só atualiza a chave presente no payload.
function cpRenderSubtipos() {
    const cont = document.getElementById('cp-conteudo');
    const t = cpFiltroSubtipo.toLowerCase();
    const lista = cpSubtipos.filter(s => !t || s.nome.toLowerCase().includes(t) || s.codigo.includes(t));
    const semAplicabilidade = cpSubtipos.filter(s => !cpAplicabilidade.some(a => a.subtipo_id === s.id)).length;
    const semAntecedencia = cpSubtipos.filter(s => s.tipo !== 'documento' && s.antecedencia_padrao_dias == null).length;

    cont.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            ${gestaoCardMetrica('Subtipos', cpSubtipos.length)}
            ${gestaoCardMetrica('Ativos', cpSubtipos.filter(s => s.ativo).length)}
            ${gestaoCardMetrica('Sem aplicabilidade', semAplicabilidade, semAplicabilidade ? 'amber' : null, 'Subtipo sem nenhuma linha em cofre_subtipo_aplicabilidade — não aparece como sugestão em nenhum ativo.')}
            ${gestaoCardMetrica('Sem antecedência', semAntecedencia, semAntecedencia ? 'amber' : null, 'Vale só pra taxa/tributo/seguro/manutenção — documento não tem vencimento fixo.')}
        </div>
        <div class="flex items-center justify-between gap-2 mb-2">
            <input id="cp-sub-busca" value="${cpEsc(cpFiltroSubtipo)}" oninput="cpBuscarSubtipo(this.value)" placeholder="Buscar por nome ou código…" class="flex-1 min-w-[160px] p-2 border rounded-lg text-xs">
            ${pmBotaoToggle('cp-sub-novo', 'cpAbrirSubtipoNovo()')}
        </div>
        ${cpSubtipoNovo ? cpFormSubtipo(null) : ''}
        <div class="space-y-2">${lista.map(cpLinhaSubtipo).join('') || pmVazio('Nenhum subtipo encontrado com esse filtro.')}</div>`;
}

function cpBuscarSubtipo(v) { cpFiltroSubtipo = v; const foco = document.activeElement?.id; cpRenderSubtipos(); if (foco === 'cp-sub-busca') { const el = document.getElementById('cp-sub-busca'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }

function cpAbrirSubtipoNovo() { cpSubtipoNovo = !cpSubtipoNovo; cpSubtipoAberto = null; cpRenderSubtipos(); }

function cpLinhaSubtipo(s) {
    const aberto = cpSubtipoAberto === s.codigo;
    const nAplic = cpAplicabilidade.filter(a => a.subtipo_id === s.id).length;
    const selos = [
        s.ativo ? '' : '<span class="rz-badge" style="background:#fee2e2;color:#991b1b">inativo</span>',
        `<span class="rz-badge" style="background:#f1f5f9;color:#475569">${cpEsc((s.titular_escopo || []).join(', ') || 'sem titular')}</span>`,
        nAplic ? '' : '<span class="rz-badge" style="background:#fef3c7;color:#92400e">sem aplicabilidade</span>',
    ].filter(Boolean).join(' ');
    return `
    <div class="border rounded-xl overflow-hidden" style="border-color:var(--line)">
        <button type="button" onclick="cpAbrirSubtipo('${s.codigo}')" class="w-full text-left p-3 flex items-start justify-between gap-2" style="background:${aberto ? '#faf9f5' : '#fff'}">
            <div class="min-w-0">
                <p class="text-sm font-bold" style="color:var(--ink)">${cpEsc(s.nome)} ${selos}</p>
                <p class="text-[11px] font-mono" style="color:var(--sage)">${cpEsc(s.codigo)} · ${cpEsc(s.tipo)}${s.categoria_codigo ? ' → ' + cpEsc(cpNomeCategoria(s.categoria_codigo)) : ''}</p>
            </div>
            <span class="text-xs" style="color:var(--sage)">${aberto ? '▲' : '▼'}</span>
        </button>
        ${aberto ? cpFormSubtipo(s) : ''}
    </div>`;
}

function cpAbrirSubtipo(codigo) { cpSubtipoAberto = cpSubtipoAberto === codigo ? null : codigo; cpSubtipoNovo = false; cpRenderSubtipos(); }

function cpFormSubtipo(s) {
    const novo = !s;
    const id = novo ? 'novo' : s.codigo;
    const sel = (v, opts, idc) => `<select id="${idc}" class="w-full p-1.5 border rounded text-[11px]">${opts.map(o => `<option value="${o.v}" ${v === o.v ? 'selected' : ''}>${cpEsc(o.r)}</option>`).join('')}</select>`;
    const titulares = novo ? [] : (s.titular_escopo || []);
    return `
    <div class="p-3 border-t space-y-3" style="border-color:var(--line);background:#faf9f5">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><label class="text-[10px] font-semibold">Código ${novo ? '<span style="color:var(--danger)">*</span>' : ''}</label>
                <input id="cp-cod-${id}" value="${novo ? '' : cpEsc(s.codigo)}" ${novo ? '' : 'disabled'} placeholder="ex.: iptu_global" class="w-full p-1.5 border rounded text-[11px] font-mono ${novo ? '' : 'bg-slate-100'}"></div>
            <div><label class="text-[10px] font-semibold">Nome ${novo ? '<span style="color:var(--danger)">*</span>' : ''}</label>
                <input id="cp-nome-${id}" value="${novo ? '' : cpEsc(s.nome)}" class="w-full p-1.5 border rounded text-[11px]"></div>
            <div><label class="text-[10px] font-semibold">Natureza</label>${sel(novo ? 'documento' : s.tipo, CP_NATUREZAS, `cp-tipo-${id}`)}</div>
            <div><label class="text-[10px] font-semibold">Categoria macro</label>
                ${sel(novo ? '' : (s.categoria_codigo || ''), [{ v: '', r: '— nenhuma —' }].concat(cpCategorias.map(c => ({ v: c.codigo, r: c.nome }))), `cp-cat-${id}`)}</div>
        </div>
        <div>
            <label class="text-[10px] font-semibold">Titular (pode marcar mais de um)</label>
            <div class="flex flex-wrap gap-2 mt-1">${CP_TITULARES.map(t => `<label class="text-[11px] flex items-center gap-1"><input type="checkbox" class="cp-tit-${id}" value="${t.v}" ${titulares.includes(t.v) ? 'checked' : ''}> ${t.r}</label>`).join('')}</div>
        </div>
        <div>
            <label class="text-[10px] font-semibold">Tipos de ativo aplicáveis (vírgula, código — ex.: carro,moto)</label>
            <input id="cp-ta-${id}" value="${cpEsc((s && s.tipo_ativo_aplicavel || []).join(','))}" class="w-full p-1.5 border rounded text-[11px]">
            <p class="text-[10px] mt-0.5" style="color:var(--sage)">Lista curta e antiga — a aba Aplicabilidade (cofre_subtipo_aplicabilidade) é a fonte que vale pra sugestão de modelo. Deixe em branco se este subtipo não é restrito por tipo de ativo.</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><label class="text-[10px] font-semibold">Antecedência (dias)</label><input type="number" id="cp-ant-${id}" value="${novo ? '' : (s.antecedencia_padrao_dias ?? '')}" class="w-full p-1.5 border rounded text-[11px]"></div>
            <div><label class="text-[10px] font-semibold">Reforço (dias)</label><input type="number" id="cp-ref-${id}" value="${novo ? '' : (s.repeticao_padrao_dias ?? '')}" class="w-full p-1.5 border rounded text-[11px]"></div>
            <div><label class="text-[10px] font-semibold">Repete a cada</label><input type="number" id="cp-rec-${id}" value="${novo ? '' : (s.recorrencia_padrao_intervalo ?? '')}" class="w-full p-1.5 border rounded text-[11px]" placeholder="vazio = não repete"></div>
            <div><label class="text-[10px] font-semibold">Unidade</label>
                ${sel(novo ? '' : (s.recorrencia_padrao_unidade || ''), [{ v: '', r: '—' }, { v: 'dia', r: 'dia(s)' }, { v: 'semana', r: 'semana(s)' }, { v: 'mes', r: 'mês(es)' }, { v: 'ano', r: 'ano(s)' }], `cp-recu-${id}`)}</div>
        </div>
        <div>
            <label class="text-[10px] font-semibold">Parcelamento padrão
                <span class="ml-2">
                    <button type="button" onclick="cpPreencherParcelamento('${id}','mensal')" class="text-[10px] px-2 py-0.5 rounded-full border" style="border-color:var(--line);color:var(--sage)">usar padrão mensal</button>
                    <button type="button" onclick="cpPreencherParcelamento('${id}','anual')" class="text-[10px] px-2 py-0.5 rounded-full border ml-1" style="border-color:var(--line);color:var(--sage)">usar padrão anual</button>
                </span>
            </label>
            <textarea id="cp-parc-${id}" rows="2" class="w-full p-1.5 border rounded text-[10px] font-mono">${novo ? '' : cpEsc(cpJson(s.parcelamento_padrao))}</textarea>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="cp-ativo-${id}" ${novo || s.ativo ? 'checked' : ''}> ativo</label>
            <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="cp-ctl-${id}" ${novo ? 'checked' : (s.gera_controle_padrao ? 'checked' : '')}> gera item de controle</label>
            <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="cp-arq-${id}" ${!novo && s.manter_arquivo_padrao ? 'checked' : ''}> guarda o arquivo por padrão</label>
        </div>
        <div class="flex items-center gap-2">
            <button onclick="cpSalvarSubtipo('${id}', ${novo})" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style="background:var(--pine)">${novo ? 'Criar subtipo' : 'Salvar alterações'}</button>
            <span id="cp-status-${id}" class="text-[11px]" style="color:var(--sage)"></span>
        </div>
    </div>`;
}

function cpPreencherParcelamento(id, padrao) {
    const valor = padrao === 'mensal'
        ? { opcoes: [1, 4, 12], padrao: 1, intervalo_dias: 7 }
        : { opcoes: [1, 4, 12], padrao: 1, intervalo_dias: 30 };
    document.getElementById(`cp-parc-${id}`).value = cpJson(valor);
}

async function cpSalvarSubtipo(id, novo) {
    const g = sufixo => document.getElementById(`cp-${sufixo}-${id}`);
    const st = document.getElementById(`cp-status-${id}`);
    const codigo = novo ? g('cod').value.trim() : id;
    const nome = g('nome').value.trim();
    if (novo && !codigo) { st.textContent = 'Informe o código do subtipo.'; st.style.color = 'var(--danger)'; return; }
    if (!nome) { st.textContent = 'Informe o nome.'; st.style.color = 'var(--danger)'; return; }
    const parc = cpParse(g('parc').value, null);
    if (parc === undefined) { st.textContent = '⚠️ JSON inválido em parcelamento padrão.'; st.style.color = 'var(--danger)'; return; }
    const titulares = [...document.querySelectorAll(`.cp-tit-${id}:checked`)].map(e => e.value);
    const payload = {
        codigo, nome, tipo: g('tipo').value,
        categoria_codigo: g('cat').value || null,
        titular_escopo: titulares.length ? titulares : null,
        tipo_ativo_aplicavel: cpLista(g('ta').value),
        antecedencia_padrao_dias: g('ant').value === '' ? null : Number(g('ant').value),
        repeticao_padrao_dias: g('ref').value === '' ? null : Number(g('ref').value),
        recorrencia_padrao_intervalo: g('rec').value === '' ? null : Number(g('rec').value),
        recorrencia_padrao_unidade: g('recu').value || null,
        parcelamento_padrao: parc,
        gera_controle_padrao: g('ctl').checked,
        manter_arquivo_padrao: g('arq').checked,
        ativo: g('ativo').checked,
    };
    st.textContent = 'Salvando…'; st.style.color = 'var(--sage)';
    const { error } = await dbAuth.rpc('fn_cofre_catalogo_upsert', { r: payload });
    if (error) { st.textContent = '❌ ' + error.message; st.style.color = 'var(--danger)'; return; }
    await cpCarregarTudo();
    cpSubtipoNovo = false; cpSubtipoAberto = codigo;
    cpRenderSubtipos();
}

// ========================================================= 2. APLICABILIDADE
// A razão de ser da onda 2 — sem ela, a curadoria da onda 3 exige SQL.
function cpRenderAplicabilidade() {
    const cont = document.getElementById('cp-conteudo');
    const semAplic = cpSubtipos.filter(s => !cpAplicabilidade.some(a => a.subtipo_id === s.id));
    cont.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            ${gestaoCardMetrica('Vínculos', cpAplicabilidade.length)}
            ${gestaoCardMetrica('Overrides', cpAplicabilidade.filter(a => a.override).length, null, 'Vínculo que substitui a herança padrão da categoria — ex.: TUF é taxa mesmo estando em subcategoria de tributo.')}
            ${gestaoCardMetrica('Subtipos sem aplicabilidade', semAplic.length, semAplic.length ? 'amber' : null)}
            ${gestaoCardMetrica('Inativos', cpAplicabilidade.filter(a => !a.ativo).length)}
        </div>
        <div class="flex items-center justify-between gap-2 mb-2">
            <p class="text-xs" style="color:var(--sage)">Agrupado por subtipo — abra um subtipo pra ver e editar a quais categorias/tipos de ativo ele se aplica.</p>
            ${pmBotaoToggle('cp-apl-novo', 'cpAplAbrirNovo()')}
        </div>
        ${cpAplicNovoAberto ? cpFormAplicabilidade(null) : ''}
        <div class="space-y-2">${cpSubtipos.map(cpLinhaAplicabilidade).join('') || pmVazio('Nenhum subtipo cadastrado ainda.')}</div>`;
    // innerHTML-inserted script não executa — popula os seletores de valor
    // aqui, depois do DOM estar montado, em vez de embutir script no HTML.
    if (cpAplicNovoAberto) cpAplAtualizarValores('novo');
    if (cpAplicSubtipoAberto) cpAplAtualizarValores(cpAplicSubtipoAberto);
}

function cpLinhaAplicabilidade(s) {
    const vinculos = cpAplicabilidade.filter(a => a.subtipo_id === s.id);
    const aberto = cpAplicSubtipoAberto === s.id;
    // v1.2.0 — matriz de largura fixa (8 categorias macro, sempre 8 células)
    // no lugar da lista de chips que quebrava linha e amontoava quando um
    // subtipo (ex.: "Não classificado") tinha vínculo com todas as 8
    // categorias. Nada é escondido/resumido — GAP + proposta discutidos com
    // o Nicola em 18/09/2026; ele preferiu isso a truncar em "+N" ou colapsar
    // pra "todas as categorias". Clique numa célula vazia cria o vínculo de
    // categoria direto (sem abrir o formulário); clique numa célula
    // preenchida remove (com confirmação, igual já era com os chips).
    // Vínculos escopo_tipo='codigo' (tipo de ativo específico, não a
    // categoria toda) são raros — ficam numa segunda linha compacta abaixo
    // da matriz, sem entrar na grade de 8 colunas.
    const porCategoria = {};
    vinculos.filter(a => a.escopo_tipo === 'categoria').forEach(a => { porCategoria[a.escopo_valor] = a; });
    const vinculosCodigo = vinculos.filter(a => a.escopo_tipo === 'codigo');

    const matriz = `
        <div class="grid grid-cols-4 sm:grid-cols-8 gap-1 mt-1.5" role="group" aria-label="Categorias macro aplicáveis a ${cpEsc(s.nome)}">
            ${CP_CATEGORIAS_ATIVO.map(cat => {
                const v = porCategoria[cat];
                const rotulo = CP_CATEGORIA_ATIVO_LABEL[cat] || cat;
                const abrev = CP_CATEGORIA_ATIVO_ABREV[cat] || cat.slice(0, 4);
                let bg = '#fff', fg = 'var(--sage)', border = 'var(--line)', titulo = `${rotulo} — clique pra vincular`;
                if (v && v.ativo) {
                    if (v.override) { bg = '#fef3c7'; fg = '#92400e'; border = '#f2d98a'; titulo = `${rotulo} — override (clique pra remover)`; }
                    else { bg = '#e0e7ff'; fg = '#3730a3'; border = '#c7d2fe'; titulo = `${rotulo} — vinculado (clique pra remover)`; }
                } else if (v && !v.ativo) {
                    bg = '#f1f5f9'; fg = '#94a3b8'; border = '#e2e8f0'; titulo = `${rotulo} — vínculo inativo`;
                }
                const acao = v ? `cpAplRemover('${v.id}')` : `cpAplAdicionarRapido('${s.id}','${cat}')`;
                return `<button type="button" onclick="event.stopPropagation();${acao}" title="${cpEsc(titulo)}"
                    class="rounded-lg text-[10px] font-bold py-1.5 text-center" style="background:${bg};color:${fg};border:1px solid ${border}">${abrev}</button>`;
            }).join('')}
        </div>
        ${vinculosCodigo.length ? `<div class="flex flex-wrap gap-1 mt-1.5">${vinculosCodigo.map(a => `
            <span class="rz-badge inline-flex items-center gap-1" style="background:${a.ativo ? (a.override ? '#fef3c7' : '#e0e7ff') : '#f1f5f9'};color:${a.ativo ? (a.override ? '#92400e' : '#3730a3') : '#94a3b8'}">
                ${cpEsc(cpNomeTipoAtivo(a.escopo_valor))}${a.override ? ' (override)' : ''}
                <button type="button" onclick="event.stopPropagation();cpAplRemover('${a.id}')" title="Remover" style="line-height:1">×</button>
            </span>`).join(' ')}</div>` : ''}`;

    // Nota: o cabeçalho é um <div> clicável (não <button>) porque contém a
    // matriz, que tem os próprios <button> de célula — <button> dentro de
    // <button> é HTML inválido e quebra o parser. As células chamam
    // event.stopPropagation() pra não disparar o toggle do subtipo junto.
    return `
    <div class="border rounded-xl overflow-hidden" style="border-color:var(--line)">
        <div role="button" tabindex="0" onclick="cpAplToggleSubtipo('${s.id}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();cpAplToggleSubtipo('${s.id}')}" class="w-full text-left p-3 flex items-start justify-between gap-2 cursor-pointer" style="background:${aberto ? '#faf9f5' : '#fff'}">
            <div class="min-w-0 flex-1">
                <p class="text-sm font-bold" style="color:var(--ink)">${cpEsc(s.nome)}</p>
                <p class="text-[11px] font-mono" style="color:var(--sage)">${cpEsc(s.codigo)} · ${vinculos.length ? vinculos.length + ' vínculo(s)' : 'sem vínculo'}</p>
                ${matriz}
            </div>
            <span class="text-xs flex-none" style="color:var(--sage)">${aberto ? '▲' : '▼'}</span>
        </div>
        ${aberto ? cpFormAplicabilidade(s) : ''}
    </div>`;
}

// Atalho de 1 clique pra vincular subtipo × categoria macro direto na
// matriz — cobre o caso comum (sem override, sem tipo de ativo específico).
// Pra override ou vínculo por código, abre o subtipo e usa o formulário.
async function cpAplAdicionarRapido(subtipoId, categoria) {
    const { error } = await dbAuth.rpc('fn_cofre_aplicabilidade_upsert', { r: { subtipo_id: subtipoId, escopo_tipo: 'categoria', escopo_valor: categoria, override: false } });
    if (error) { alert('Erro: ' + error.message); return; }
    await cpCarregarTudo();
    cpRenderAplicabilidade();
}

function cpAplToggleSubtipo(id) { cpAplicSubtipoAberto = cpAplicSubtipoAberto === id ? null : id; cpAplicNovoAberto = false; cpRenderAplicabilidade(); }
function cpAplAbrirNovo() { cpAplicNovoAberto = !cpAplicNovoAberto; cpAplicSubtipoAberto = null; cpRenderAplicabilidade(); }

function cpFormAplicabilidade(subtipoFixo) {
    const idf = subtipoFixo ? subtipoFixo.id : 'novo';
    return `
    <div class="p-3 border-t space-y-2" style="border-color:var(--line);background:#faf9f5">
        ${subtipoFixo ? '' : `
        <div><label class="text-[10px] font-semibold">Subtipo</label>
            <select id="cp-apl-sub-${idf}" class="w-full p-1.5 border rounded text-[11px]">
                ${cpSubtipos.map(s => `<option value="${s.id}">${cpEsc(s.nome)}</option>`).join('')}
            </select></div>`}
        <div class="grid grid-cols-2 gap-2">
            <div><label class="text-[10px] font-semibold">Tipo de escopo</label>
                <select id="cp-apl-tipo-${idf}" onchange="cpAplAtualizarValores('${idf}')" class="w-full p-1.5 border rounded text-[11px]">
                    <option value="categoria">categoria macro</option>
                    <option value="codigo">tipo de ativo (código)</option>
                </select></div>
            <div><label class="text-[10px] font-semibold">Valor</label>
                <select id="cp-apl-valor-${idf}" class="w-full p-1.5 border rounded text-[11px]"></select></div>
        </div>
        <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="cp-apl-over-${idf}"> override (substitui a herança padrão da categoria pra este subtipo)</label>
        <div class="flex items-center gap-2">
            <button onclick="cpAplSalvar('${idf}', ${subtipoFixo ? `'${subtipoFixo.id}'` : 'null'})" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style="background:var(--pine)">Adicionar vínculo</button>
            <span id="cp-apl-status-${idf}" class="text-[11px]" style="color:var(--sage)"></span>
        </div>
    </div>`;
}

function cpAplAtualizarValores(idf) {
    const tipoEl = document.getElementById(`cp-apl-tipo-${idf}`);
    const valorEl = document.getElementById(`cp-apl-valor-${idf}`);
    if (!tipoEl || !valorEl) return;
    const opts = tipoEl.value === 'categoria'
        ? CP_CATEGORIAS_ATIVO.map(c => ({ v: c, r: CP_CATEGORIA_ATIVO_LABEL[c] || c }))
        : cpTiposAtivo.map(t => ({ v: t.codigo, r: `${t.nome} (${t.categoria})` }));
    valorEl.innerHTML = opts.map(o => `<option value="${cpEsc(o.v)}">${cpEsc(o.r)}</option>`).join('');
}

async function cpAplSalvar(idf, subtipoIdFixo) {
    const st = document.getElementById(`cp-apl-status-${idf}`);
    const subtipo_id = subtipoIdFixo || document.getElementById(`cp-apl-sub-${idf}`).value;
    const escopo_tipo = document.getElementById(`cp-apl-tipo-${idf}`).value;
    const escopo_valor = document.getElementById(`cp-apl-valor-${idf}`).value;
    const override = document.getElementById(`cp-apl-over-${idf}`).checked;
    if (!subtipo_id || !escopo_valor) { st.textContent = 'Selecione o subtipo e o valor.'; st.style.color = 'var(--danger)'; return; }
    st.textContent = 'Salvando…'; st.style.color = 'var(--sage)';
    const { error } = await dbAuth.rpc('fn_cofre_aplicabilidade_upsert', { r: { subtipo_id, escopo_tipo, escopo_valor, override } });
    if (error) { st.textContent = '❌ ' + error.message; st.style.color = 'var(--danger)'; return; }
    await cpCarregarTudo();
    cpAplicNovoAberto = false; cpAplicSubtipoAberto = subtipo_id;
    cpRenderAplicabilidade();
}

async function cpAplRemover(id) {
    if (!confirm('Remover este vínculo de aplicabilidade?\n\nO subtipo deixa de ser sugerido pra essa categoria/tipo de ativo.')) return;
    const { error } = await dbAuth.rpc('fn_cofre_aplicabilidade_upsert', { r: { id, ativo: false } });
    if (error) { alert('Erro: ' + error.message); return; }
    await cpCarregarTudo();
    cpRenderAplicabilidade();
}

// ========================================================= 3. TIPOS DE ATIVO
function cpRenderTiposAtivo() {
    const cont = document.getElementById('cp-conteudo');
    cont.innerHTML = `
        <div class="flex items-center justify-between mb-2">
            <p class="text-xs" style="color:var(--sage)">${cpTiposAtivo.length} tipo(s) de ativo, em ${CP_CATEGORIAS_ATIVO.length} categorias macro fixas.</p>
            ${pmBotaoToggle('cp-ta-novo', 'cpTaAbrirNovo()')}
        </div>
        ${cpTipoAtivoNovo ? cpFormTipoAtivo(null) : ''}
        <div class="space-y-3">${CP_CATEGORIAS_ATIVO.map(cat => {
        const tipos = cpTiposAtivo.filter(t => t.categoria === cat);
        if (!tipos.length) return '';
        return `<div>
                <p class="text-[11px] font-bold uppercase tracking-wide mb-1" style="color:var(--sage)">${cpEsc(cat)}</p>
                <div class="space-y-1.5">${tipos.map(cpLinhaTipoAtivo).join('')}</div>
            </div>`;
    }).join('') || pmVazio('Nenhum tipo de ativo cadastrado ainda.')}</div>`;
}

function cpTaAbrirNovo() { cpTipoAtivoNovo = !cpTipoAtivoNovo; cpTipoAtivoEditId = null; cpRenderTiposAtivo(); }

function cpLinhaTipoAtivo(t) {
    const aberto = cpTipoAtivoEditId === t.id;
    return `
    <div class="border rounded-xl overflow-hidden" style="border-color:var(--line)">
        <button type="button" onclick="cpTaAbrirEdicao('${t.id}')" class="w-full text-left px-3 py-2 flex items-center justify-between gap-2" style="background:${aberto ? '#faf9f5' : '#fff'}">
            <p class="text-sm font-medium" style="color:var(--ink)">${cpEsc(t.nome)} <span class="text-[11px] font-mono font-normal" style="color:var(--sage)">${cpEsc(t.codigo)}</span>${t.ativo ? '' : ' <span class="rz-badge" style="background:#fee2e2;color:#991b1b">inativo</span>'}</p>
            <span class="text-xs" style="color:var(--sage)">${aberto ? '▲' : '▼'}</span>
        </button>
        ${aberto ? cpFormTipoAtivo(t) : ''}
    </div>`;
}

function cpTaAbrirEdicao(id) { cpTipoAtivoEditId = cpTipoAtivoEditId === id ? null : id; cpTipoAtivoNovo = false; cpRenderTiposAtivo(); }

function cpFormTipoAtivo(t) {
    const novo = !t;
    const id = novo ? 'novo' : t.id;
    return `
    <div class="p-3 border-t space-y-2" style="border-color:var(--line);background:#faf9f5">
        <div class="grid grid-cols-2 gap-2">
            <div><label class="text-[10px] font-semibold">Categoria macro</label>
                <select id="cp-ta-cat-${id}" class="w-full p-1.5 border rounded text-[11px]">${CP_CATEGORIAS_ATIVO.map(c => `<option value="${c}" ${!novo && t.categoria === c ? 'selected' : ''}>${cpEsc(c)}</option>`).join('')}</select></div>
            <div><label class="text-[10px] font-semibold">Código ${novo ? '<span style="color:var(--danger)">*</span>' : ''}</label>
                <input id="cp-ta-cod-${id}" value="${novo ? '' : cpEsc(t.codigo)}" ${novo ? '' : 'disabled'} class="w-full p-1.5 border rounded text-[11px] font-mono ${novo ? '' : 'bg-slate-100'}"></div>
        </div>
        <div><label class="text-[10px] font-semibold">Nome</label><input id="cp-ta-nome-${id}" value="${novo ? '' : cpEsc(t.nome)}" class="w-full p-1.5 border rounded text-[11px]"></div>
        <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="cp-ta-ativo-${id}" ${novo || t.ativo ? 'checked' : ''}> ativo</label>
        <div class="flex items-center gap-2">
            <button onclick="cpTaSalvar('${id}', ${novo})" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style="background:var(--pine)">${novo ? 'Criar tipo' : 'Salvar alterações'}</button>
            <span id="cp-ta-status-${id}" class="text-[11px]" style="color:var(--sage)"></span>
        </div>
    </div>`;
}

async function cpTaSalvar(id, novo) {
    const g = suf => document.getElementById(`cp-ta-${suf}-${id}`);
    const st = document.getElementById(`cp-ta-status-${id}`);
    const codigo = novo ? g('cod').value.trim() : id;
    const nome = g('nome').value.trim();
    if (novo && !codigo) { st.textContent = 'Informe o código.'; st.style.color = 'var(--danger)'; return; }
    if (!nome) { st.textContent = 'Informe o nome.'; st.style.color = 'var(--danger)'; return; }
    const payload = novo
        ? { categoria: g('cat').value, codigo, nome, ativo: g('ativo').checked }
        : { id, categoria: g('cat').value, nome, ativo: g('ativo').checked };
    st.textContent = 'Salvando…'; st.style.color = 'var(--sage)';
    const { error } = await dbAuth.rpc('fn_cofre_tipo_ativo_upsert', { r: payload });
    if (error) { st.textContent = '❌ ' + error.message; st.style.color = 'var(--danger)'; return; }
    await cpCarregarTudo();
    cpTipoAtivoNovo = false; cpTipoAtivoEditId = null;
    cpRenderTiposAtivo();
}

// ========================================================= 4. CAMPOS DO TIPO
function cpRenderCamposTipo() {
    const cont = document.getElementById('cp-conteudo');
    cont.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
            <select onchange="cpFiltrarCategoriaCampo(this.value)" class="p-2 border rounded-lg text-xs">
                <option value="">Todas as categorias</option>
                ${CP_CATEGORIAS_ATIVO.map(c => `<option value="${c}" ${cpFiltroCategoriaCampo === c ? 'selected' : ''}>${cpEsc(c)}</option>`).join('')}
            </select>
            ${pmBotaoToggle('cp-campo-novo', 'cpCampoAbrirNovo()')}
        </div>
        ${cpCampoNovo ? cpFormCampo(null) : ''}
        <div class="space-y-1.5">${cpCamposTipo.filter(c => !cpFiltroCategoriaCampo || c.categoria === cpFiltroCategoriaCampo).map(cpLinhaCampo).join('') || pmVazio('Nenhum campo cadastrado com esse filtro.')}</div>`;
    // innerHTML-inserted script não executa — popula o seletor de tipo
    // de ativo aqui, depois do DOM estar montado.
    if (cpCampoNovo) cpCampoAtualizarTipos('novo', null);
    if (cpCampoEditId) {
        const c = cpCamposTipo.find(x => x.id === cpCampoEditId);
        if (c) cpCampoAtualizarTipos(cpCampoEditId, c.tipo_detalhe_id || '');
    }
}

function cpFiltrarCategoriaCampo(v) { cpFiltroCategoriaCampo = v; cpRenderCamposTipo(); }
function cpCampoAbrirNovo() { cpCampoNovo = !cpCampoNovo; cpCampoEditId = null; cpRenderCamposTipo(); }

function cpLinhaCampo(c) {
    const aberto = cpCampoEditId === c.id;
    const tipo = c.tipo_detalhe_id ? cpTiposAtivo.find(t => t.id === c.tipo_detalhe_id) : null;
    return `
    <div class="border rounded-xl overflow-hidden" style="border-color:var(--line)">
        <button type="button" onclick="cpCampoAbrirEdicao('${c.id}')" class="w-full text-left px-3 py-2 flex items-center justify-between gap-2" style="background:${aberto ? '#faf9f5' : '#fff'}">
            <p class="text-sm font-medium" style="color:var(--ink)">${cpEsc(c.label)} ${c.obrigatorio ? '<span class="rz-badge" style="background:#fee2e2;color:#991b1b">obrigatório</span>' : ''}
                <span class="text-[11px] font-mono font-normal" style="color:var(--sage)">${cpEsc(c.categoria)}${tipo ? ' → ' + cpEsc(tipo.nome) : ' (toda a categoria)'} · ${cpEsc(c.chave)}</span></p>
            <span class="text-xs" style="color:var(--sage)">${aberto ? '▲' : '▼'}</span>
        </button>
        ${aberto ? cpFormCampo(c) : ''}
    </div>`;
}

function cpCampoAbrirEdicao(id) { cpCampoEditId = cpCampoEditId === id ? null : id; cpCampoNovo = false; cpRenderCamposTipo(); }

function cpFormCampo(c) {
    const novo = !c;
    const id = novo ? 'novo' : c.id;
    return `
    <div class="p-3 border-t space-y-2" style="border-color:var(--line);background:#faf9f5">
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div><label class="text-[10px] font-semibold">Categoria</label>
                <select id="cp-campo-cat-${id}" onchange="cpCampoAtualizarTipos('${id}')" class="w-full p-1.5 border rounded text-[11px]">${CP_CATEGORIAS_ATIVO.map(cat => `<option value="${cat}" ${!novo && c.categoria === cat ? 'selected' : ''}>${cpEsc(cat)}</option>`).join('')}</select></div>
            <div><label class="text-[10px] font-semibold">Tipo de ativo (vazio = toda a categoria)</label>
                <select id="cp-campo-tipo-${id}" class="w-full p-1.5 border rounded text-[11px]"></select></div>
            <div><label class="text-[10px] font-semibold">Chave ${novo ? '<span style="color:var(--danger)">*</span>' : ''}</label>
                <input id="cp-campo-chave-${id}" value="${novo ? '' : cpEsc(c.chave)}" placeholder="ex.: uf_emplacamento" class="w-full p-1.5 border rounded text-[11px] font-mono"></div>
        </div>
        <div><label class="text-[10px] font-semibold">Rótulo</label><input id="cp-campo-label-${id}" value="${novo ? '' : cpEsc(c.label)}" class="w-full p-1.5 border rounded text-[11px]"></div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><label class="text-[10px] font-semibold">Tipo de dado</label>
                <select id="cp-campo-dado-${id}" class="w-full p-1.5 border rounded text-[11px]">
                    ${['text', 'number', 'date', 'boolean'].map(o => `<option value="${o}" ${!novo && c.tipo_dado === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
            <label class="text-[11px] flex items-center gap-1 mt-4"><input type="checkbox" id="cp-campo-obr-${id}" ${!novo && c.obrigatorio ? 'checked' : ''}> obrigatório</label>
            <label class="text-[11px] flex items-center gap-1 mt-4"><input type="checkbox" id="cp-campo-masc-${id}" ${!novo && c.mascarar ? 'checked' : ''}> mascarar</label>
            <label class="text-[11px] flex items-center gap-1 mt-4"><input type="checkbox" id="cp-campo-ident-${id}" ${!novo && c.identificador ? 'checked' : ''}> é identificador</label>
        </div>
        <div><label class="text-[10px] font-semibold">Motivo da exigência (aparece pro cliente)</label>
            <input id="cp-campo-motivo-${id}" value="${novo ? '' : cpEsc(c.motivo_exigencia || '')}" class="w-full p-1.5 border rounded text-[11px]"></div>
        <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="cp-campo-ativo-${id}" ${novo || c.ativo ? 'checked' : ''}> ativo</label>
        <div class="flex items-center gap-2">
            <button onclick="cpCampoSalvar('${id}', ${novo})" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style="background:var(--pine)">${novo ? 'Criar campo' : 'Salvar alterações'}</button>
            <span id="cp-campo-status-${id}" class="text-[11px]" style="color:var(--sage)"></span>
        </div>
    </div>`;
}

function cpCampoAtualizarTipos(id, tipoAtual) {
    const catEl = document.getElementById(`cp-campo-cat-${id}`);
    const tipoEl = document.getElementById(`cp-campo-tipo-${id}`);
    if (!catEl || !tipoEl) return;
    const tipos = cpTiposAtivo.filter(t => t.categoria === catEl.value);
    tipoEl.innerHTML = `<option value="">— toda a categoria —</option>` + tipos.map(t => `<option value="${t.id}" ${tipoAtual === t.id ? 'selected' : ''}>${cpEsc(t.nome)}</option>`).join('');
}

async function cpCampoSalvar(id, novo) {
    const g = suf => document.getElementById(`cp-campo-${suf}-${id}`);
    const st = document.getElementById(`cp-campo-status-${id}`);
    const chave = g('chave').value.trim();
    const label = g('label').value.trim();
    if (!chave || !label) { st.textContent = 'Informe chave e rótulo.'; st.style.color = 'var(--danger)'; return; }
    const payload = {
        categoria: g('cat').value,
        tipo_detalhe_id: g('tipo').value || null,
        chave, label,
        tipo_dado: g('dado').value,
        obrigatorio: g('obr').checked,
        mascarar: g('masc').checked,
        identificador: g('ident').checked,
        motivo_exigencia: g('motivo').value.trim() || null,
        ativo: g('ativo').checked,
    };
    if (!novo) payload.id = id;
    st.textContent = 'Salvando…'; st.style.color = 'var(--sage)';
    const { error } = await dbAuth.rpc('fn_cofre_campo_tipo_upsert', { r: payload });
    if (error) { st.textContent = '❌ ' + error.message; st.style.color = 'var(--danger)'; return; }
    await cpCarregarTudo();
    cpCampoNovo = false; cpCampoEditId = null;
    cpRenderCamposTipo();
}

// ================================================= 5. CALENDÁRIO & PARTES
function cpRenderCalendario() {
    const cont = document.getElementById('cp-conteudo');
    const subtiposComCalendario = [...new Set(cpCalendario.map(c => c.subtipo_id))];
    cont.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-3">
            ${gestaoCardMetrica('Calendários', cpCalendario.length)}
            ${gestaoCardMetrica('Subtipos com calendário', subtiposComCalendario.length)}
            ${gestaoCardMetrica('Partes padrão cadastradas', cpPartesPadrao.length, null, 'Gerencie o cadastro completo (nome, WhatsApp, e-mail) no card "Partes padrão".')}
        </div>
        <div class="flex items-center justify-between gap-2 mb-2">
            <p class="text-xs" style="color:var(--sage)">Prioridade sobre o subtipo (fn_parte_padrao_resolver): calendário por município → calendário por UF → padrão do subtipo.</p>
            ${pmBotaoToggle('cp-cal-novo', 'cpCalAbrirNovo()')}
        </div>
        ${cpCalendarioNovo ? cpFormCalendario(null) : ''}
        <div class="space-y-2">${cpCalendario.map(cpLinhaCalendario).join('') || pmVazio('Nenhum calendário de tributo cadastrado ainda.')}</div>`;
}

function cpCalAbrirNovo() { cpCalendarioNovo = !cpCalendarioNovo; cpCalendarioEditId = null; cpRenderCalendario(); }

function cpLinhaCalendario(c) {
    const aberto = cpCalendarioEditId === c.id;
    const local = c.municipio_ibge ? `IBGE ${c.municipio_ibge}` : (c.uf ? `UF ${c.uf}` : 'Nacional');
    const parte = cpPartesPadrao.find(p => p.id === c.parte_padrao_id);
    return `
    <div class="border rounded-xl overflow-hidden" style="border-color:var(--line)">
        <button type="button" onclick="cpCalAbrirEdicao('${c.id}')" class="w-full text-left px-3 py-2 flex items-center justify-between gap-2" style="background:${aberto ? '#faf9f5' : '#fff'}">
            <p class="text-sm font-medium" style="color:var(--ink)">${cpEsc(cpNomeSubtipo(c.subtipo_id))} <span class="text-[11px] font-normal" style="color:var(--sage)">${local}${c.exercicio ? ' · ' + c.exercicio : ''}${parte ? ' · ' + cpEsc(parte.nome) : ''}</span>${c.ativo ? '' : ' <span class="rz-badge" style="background:#fee2e2;color:#991b1b">inativo</span>'}</p>
            <span class="text-xs" style="color:var(--sage)">${aberto ? '▲' : '▼'}</span>
        </button>
        ${aberto ? cpFormCalendario(c) : ''}
    </div>`;
}

function cpCalAbrirEdicao(id) { cpCalendarioEditId = cpCalendarioEditId === id ? null : id; cpCalendarioNovo = false; cpRenderCalendario(); }

function cpFormCalendario(c) {
    const novo = !c;
    const id = novo ? 'novo' : c.id;
    return `
    <div class="p-3 border-t space-y-2" style="border-color:var(--line);background:#faf9f5">
        <div><label class="text-[10px] font-semibold">Subtipo ${novo ? '<span style="color:var(--danger)">*</span>' : ''}</label>
            <select id="cp-cal-sub-${id}" ${novo ? '' : 'disabled'} class="w-full p-1.5 border rounded text-[11px] ${novo ? '' : 'bg-slate-100'}">
                ${cpSubtipos.map(s => `<option value="${s.id}" ${!novo && c.subtipo_id === s.id ? 'selected' : ''}>${cpEsc(s.nome)}</option>`).join('')}</select></div>
        <div class="grid grid-cols-3 gap-2">
            <div><label class="text-[10px] font-semibold">UF</label><input id="cp-cal-uf-${id}" value="${novo ? '' : cpEsc(c.uf || '')}" maxlength="2" class="w-full p-1.5 border rounded text-[11px] uppercase"></div>
            <div><label class="text-[10px] font-semibold">Município (IBGE)</label><input id="cp-cal-mun-${id}" value="${novo ? '' : cpEsc(c.municipio_ibge || '')}" class="w-full p-1.5 border rounded text-[11px]"></div>
            <div><label class="text-[10px] font-semibold">Exercício</label><input type="number" id="cp-cal-exe-${id}" value="${novo ? '' : (c.exercicio ?? '')}" class="w-full p-1.5 border rounded text-[11px]"></div>
        </div>
        <div><label class="text-[10px] font-semibold">Parte padrão (quem recolhe)</label>
            <select id="cp-cal-parte-${id}" class="w-full p-1.5 border rounded text-[11px]">
                <option value="">— nenhuma —</option>
                ${cpPartesPadrao.map(p => `<option value="${p.id}" ${!novo && c.parte_padrao_id === p.id ? 'selected' : ''}>${cpEsc(p.nome)}</option>`).join('')}</select></div>
        <div><label class="text-[10px] font-semibold">Parcelas (JSON)</label>
            <textarea id="cp-cal-parc-${id}" rows="2" class="w-full p-1.5 border rounded text-[10px] font-mono" placeholder='ex.: {"opcoes":[1,4,12],"padrao":1}'>${novo ? '' : cpEsc(cpJson(c.parcelas))}</textarea></div>
        <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="cp-cal-ativo-${id}" ${novo || c.ativo ? 'checked' : ''}> ativo</label>
        <div class="flex items-center gap-2">
            <button onclick="cpCalSalvar('${id}', ${novo})" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style="background:var(--pine)">${novo ? 'Criar calendário' : 'Salvar alterações'}</button>
            <span id="cp-cal-status-${id}" class="text-[11px]" style="color:var(--sage)"></span>
        </div>
    </div>`;
}

async function cpCalSalvar(id, novo) {
    const g = suf => document.getElementById(`cp-cal-${suf}-${id}`);
    const st = document.getElementById(`cp-cal-status-${id}`);
    const parcelas = cpParse(g('parc').value, null);
    if (parcelas === undefined) { st.textContent = '⚠️ JSON inválido em parcelas.'; st.style.color = 'var(--danger)'; return; }
    const payload = {
        uf: g('uf').value.trim().toUpperCase() || null,
        municipio_ibge: g('mun').value.trim() || null,
        exercicio: g('exe').value === '' ? null : Number(g('exe').value),
        parte_padrao_id: g('parte').value || null,
        parcelas,
        ativo: g('ativo').checked,
    };
    if (novo) payload.subtipo_id = g('sub').value; else payload.id = id;
    if (novo && !payload.subtipo_id) { st.textContent = 'Selecione o subtipo.'; st.style.color = 'var(--danger)'; return; }
    st.textContent = 'Salvando…'; st.style.color = 'var(--sage)';
    const { error } = await dbAuth.rpc('fn_cofre_calendario_upsert', { r: payload });
    if (error) { st.textContent = '❌ ' + error.message; st.style.color = 'var(--danger)'; return; }
    await cpCarregarTudo();
    cpCalendarioNovo = false; cpCalendarioEditId = null;
    cpRenderCalendario();
}

// ===================================================== 6. CONCILIAÇÃO
// Fecha d9937a2b. Só leitura por ora — ver nota no cabeçalho do arquivo.
// Conciliação saiu daqui — agora é tela própria (js/telas/conciliacao-catalogo.js,
// telaConciliacaoCatalogoInit), a pedido do Nicola: não tem relação com
// categoria/subtipo do patrimônio, é outro assunto (regras de conciliação
// bancária). Ver changelog v1.1.0 acima.
