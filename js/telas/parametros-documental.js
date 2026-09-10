// ============================================================================
// js/telas/parametros-documental.js — Motor Documental no Raiz Gestão
// Versão: 0.1.0 · 09/09/2026
//
// v0.1.0 — FASE 4 do Motor Documental (A.20), que fecha junto as fases que
// faltavam do A.12 (categorias & padrões) e A.13 (padrões de ocorrência).
// Três abas, uma tela:
//   1. Catálogo   — os subtipos globais (cofre_controle_subtipos): categoria,
//      titular, gera controle, guarda arquivo, complexidade, antecedência/
//      reforço/recorrência, campos, validações, regra de vencimento, sinônimos,
//      como reconhecer, prompt específico e estratégia de IA (modelo por etapa
//      + gatilhos do revisor). Grava por fn_cofre_catalogo_upsert — a MESMA
//      função da migration de seed, sem caminho paralelo.
//   2. Versões    — histórico de cofre_prompt_versoes (snapshot automático por
//      trigger), com diff do que mudou e "restaurar esta versão".
//   3. Assertividade — o que a auditoria (cofre_extracoes_documento) mostra:
//      volume, % confirmado sem edição, campos mais corrigidos, custo/tokens e
//      latência por etapa, taxa de revisor. Filtros: empresa · período ·
//      usuário · subtipo · canal (D7).
// Nada de lógica documental nova aqui: a tela só edita o catálogo que o motor
// (_shared_cofre/motor_documental.ts) já lê em runtime — mudar um prompt aqui
// muda o comportamento sem deploy.
// ============================================================================

const PD_VERSAO = '0.1.0';
let pdAba = 'catalogo';
let pdSubtipos = [];
let pdCategorias = [];
let pdSubtipoAberto = null;
let pdFiltroTexto = '';
let pdFiltroTipoAtivo = '';
let pdMetricas = null;
let pdFiltrosMetrica = { empresa: '', de: '', ate: '', pessoa: '', subtipo: '', canal: '' };

function pdEsc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pdJson(v) { try { return JSON.stringify(v ?? null, null, 2); } catch { return ''; } }
function pdParse(txt, fallback) { const t = (txt || '').trim(); if (!t) return fallback; try { return JSON.parse(t); } catch { return undefined; } }

async function telaParametrosDocumentalInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="mb-1">
            <h1 class="text-lg font-extrabold" style="color:var(--ink)">Motor Documental</h1>
            <p class="text-xs" style="color:var(--sage)">O catálogo que o app e o bot usam pra ler documentos: o que cada tipo é, quais campos tem, como valida, quando vence e o que a IA recebe. Mudança aqui vale na hora, sem deploy.</p>
        </div>
        <div class="rz-chips mt-3" id="pd-abas"></div>
        <div id="pd-conteudo" class="mt-3"><p class="text-xs" style="color:var(--sage)">Carregando…</p></div>`;
    pdRenderAbas();
    await pdCarregarCatalogo();
    pdRenderAba();
}

function pdRenderAbas() {
    const abas = [
        { id: 'catalogo', rotulo: 'Catálogo' },
        { id: 'versoes', rotulo: 'Versões de prompt' },
        { id: 'assertividade', rotulo: 'Assertividade' },
    ];
    document.getElementById('pd-abas').innerHTML = abas.map(a =>
        `<button type="button" onclick="pdTrocarAba('${a.id}')" class="rz-chip ${pdAba === a.id ? 'rz-on' : ''}">${a.rotulo}</button>`).join('');
}

function pdTrocarAba(id) { pdAba = id; pdSubtipoAberto = null; pdRenderAbas(); pdRenderAba(); }

function pdRenderAba() {
    if (pdAba === 'catalogo') return pdRenderCatalogo();
    if (pdAba === 'versoes') return pdRenderVersoes();
    return pdRenderAssertividade();
}

// ---------------------------------------------------------------- CATÁLOGO
async function pdCarregarCatalogo() {
    const [rs, rc] = await Promise.all([
        dbAuth.from('cofre_controle_subtipos').select('*').is('cliente_id', null).order('tipo').order('ordem', { nullsFirst: false }).order('nome'),
        dbAuth.from('cofre_categorias').select('id, codigo, nome, grupo').is('cliente_id', null).order('ordem'),
    ]);
    pdSubtipos = rs.data || [];
    pdCategorias = rc.data || [];
    if (rs.error) console.error('[documental] catálogo:', rs.error.message);
}

function pdRenderCatalogo() {
    const cont = document.getElementById('pd-conteudo');
    const tiposAtivo = [...new Set(pdSubtipos.flatMap(s => s.tipo_ativo_aplicavel || []))].sort();
    const lista = pdSubtipos.filter(s => {
        const t = pdFiltroTexto.toLowerCase();
        const bateTexto = !t || s.nome.toLowerCase().includes(t) || s.codigo.includes(t) || (s.sinonimos || []).some(x => String(x).toLowerCase().includes(t));
        const bateTipo = !pdFiltroTipoAtivo || (s.tipo_ativo_aplicavel || []).includes(pdFiltroTipoAtivo);
        return bateTexto && bateTipo;
    });
    const ativos = pdSubtipos.filter(s => s.ativo).length;
    const noClassificador = pdSubtipos.filter(s => s.ia_reconhece).length;
    const comCampos = pdSubtipos.filter(s => (s.campos || []).length).length;

    cont.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            ${gestaoCardMetrica('Subtipos globais', pdSubtipos.length)}
            ${gestaoCardMetrica('Ativos', ativos)}
            ${gestaoCardMetrica('No classificador', noClassificador, null, 'Entram no prompt que decide o tipo do documento (ia_reconhece).')}
            ${gestaoCardMetrica('Com campos definidos', comCampos)}
        </div>
        <div class="flex flex-wrap gap-2 mb-3">
            <input id="pd-busca" value="${pdEsc(pdFiltroTexto)}" oninput="pdBuscar(this.value)" placeholder="Buscar por nome, código ou sinônimo…" class="flex-1 min-w-[200px] p-2 border rounded-lg text-xs">
            <select onchange="pdFiltrarTipoAtivo(this.value)" class="p-2 border rounded-lg text-xs">
                <option value="">Todos os tipos de ativo</option>
                ${tiposAtivo.map(t => `<option value="${t}" ${pdFiltroTipoAtivo === t ? 'selected' : ''}>${pdEsc(t)}</option>`).join('')}
            </select>
        </div>
        <div class="space-y-2">${lista.map(pdLinhaSubtipo).join('') || `<p class="text-xs" style="color:var(--sage)">Nada encontrado.</p>`}</div>`;
}

function pdBuscar(v) { pdFiltroTexto = v; const foco = document.activeElement?.id; pdRenderCatalogo(); if (foco === 'pd-busca') { const el = document.getElementById('pd-busca'); el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
function pdFiltrarTipoAtivo(v) { pdFiltroTipoAtivo = v; pdRenderCatalogo(); }

function pdLinhaSubtipo(s) {
    const aberto = pdSubtipoAberto === s.codigo;
    const cat = pdCategorias.find(c => c.codigo === s.categoria_codigo);
    const selos = [
        s.ativo ? '' : '<span class="rz-badge" style="background:#fee2e2;color:#991b1b">inativo</span>',
        s.ia_reconhece ? '<span class="rz-badge" style="background:#dcfce7;color:#166534">classificador</span>' : '',
        s.gera_controle_padrao ? '<span class="rz-badge" style="background:#e0e7ff;color:#3730a3">gera controle</span>' : '',
        s.complexidade === 'complexo' ? '<span class="rz-badge" style="background:#fef3c7;color:#92400e">complexo</span>' : '',
    ].filter(Boolean).join(' ');
    return `
    <div class="border rounded-xl overflow-hidden" style="border-color:var(--line)">
        <button type="button" onclick="pdAbrirSubtipo('${s.codigo}')" class="w-full text-left p-3 flex items-start justify-between gap-2" style="background:${aberto ? '#faf9f5' : '#fff'}">
            <div class="min-w-0">
                <p class="text-sm font-bold" style="color:var(--ink)">${pdEsc(s.nome)} ${selos}</p>
                <p class="text-[11px] font-mono" style="color:var(--sage)">${pdEsc(s.codigo)} · ${pdEsc(s.tipo)}${cat ? ' → ' + pdEsc(cat.nome) : ''}${(s.tipo_ativo_aplicavel || []).length ? ' · ' + pdEsc((s.tipo_ativo_aplicavel || []).join(', ')) : ''}</p>
            </div>
            <span class="text-xs" style="color:var(--sage)">${aberto ? '▲' : '▼'}</span>
        </button>
        ${aberto ? pdFormSubtipo(s) : ''}
    </div>`;
}

function pdAbrirSubtipo(codigo) { pdSubtipoAberto = pdSubtipoAberto === codigo ? null : codigo; pdRenderCatalogo(); }

function pdFormSubtipo(s) {
    const est = s.ia_estrategia || {};
    const modelos = ['haiku', 'sonnet', 'opus'];
    const gat = ['campo_obrigatorio_ausente', 'validacao_falhou', 'confianca_baixa', 'titular_divergente', 'ativo_divergente'];
    const sel = (v, opts, id) => `<select id="${id}" class="w-full p-1.5 border rounded text-[11px]">${opts.map(o => `<option value="${o.v}" ${v === o.v ? 'selected' : ''}>${pdEsc(o.r)}</option>`).join('')}</select>`;
    return `
    <div class="p-3 border-t space-y-3" style="border-color:var(--line);background:#faf9f5">
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><label class="text-[10px] font-semibold">Categoria</label>
                ${sel(s.categoria_codigo, [{ v: '', r: '— nenhuma —' }].concat(pdCategorias.map(c => ({ v: c.codigo, r: `${c.grupo} › ${c.nome}` }))), `pd-cat-${s.codigo}`)}</div>
            <div><label class="text-[10px] font-semibold">Titular</label>
                ${sel(s.titular_escopo, [{ v: '', r: '—' }, { v: 'pessoa', r: 'pessoa' }, { v: 'ativo', r: 'ativo' }, { v: 'contrato', r: 'contrato' }], `pd-tit-${s.codigo}`)}</div>
            <div><label class="text-[10px] font-semibold">Complexidade</label>
                ${sel(s.complexidade, [{ v: 'padrao', r: 'padrão' }, { v: 'semi_estruturado', r: 'semi-estruturado' }, { v: 'complexo', r: 'complexo' }], `pd-cx-${s.codigo}`)}</div>
            <div class="flex flex-col gap-1 justify-end pb-1">
                <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="pd-ativo-${s.codigo}" ${s.ativo ? 'checked' : ''}> ativo</label>
                <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="pd-ia-${s.codigo}" ${s.ia_reconhece ? 'checked' : ''}> no classificador</label>
            </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2">
            <div><label class="text-[10px] font-semibold">Antecedência (dias)</label><input type="number" id="pd-ant-${s.codigo}" value="${s.antecedencia_padrao_dias ?? ''}" class="w-full p-1.5 border rounded text-[11px]"></div>
            <div><label class="text-[10px] font-semibold">Reforço (dias)</label><input type="number" id="pd-ref-${s.codigo}" value="${s.repeticao_padrao_dias ?? ''}" class="w-full p-1.5 border rounded text-[11px]"></div>
            <div><label class="text-[10px] font-semibold">Repete a cada</label><input type="number" id="pd-rec-${s.codigo}" value="${s.recorrencia_padrao_intervalo ?? ''}" class="w-full p-1.5 border rounded text-[11px]" placeholder="vazio = não repete"></div>
            <div><label class="text-[10px] font-semibold">Unidade</label>
                ${sel(s.recorrencia_padrao_unidade, [{ v: '', r: '—' }, { v: 'dia', r: 'dia(s)' }, { v: 'semana', r: 'semana(s)' }, { v: 'mes', r: 'mês(es)' }, { v: 'ano', r: 'ano(s)' }], `pd-recu-${s.codigo}`)}</div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="pd-ctl-${s.codigo}" ${s.gera_controle_padrao ? 'checked' : ''}> gera item de controle</label>
            <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="pd-arq-${s.codigo}" ${s.manter_arquivo_padrao ? 'checked' : ''}> guarda o arquivo por padrão</label>
            <div><label class="text-[10px] font-semibold">Tipos de ativo (vírgula)</label><input id="pd-ta-${s.codigo}" value="${pdEsc((s.tipo_ativo_aplicavel || []).join(','))}" class="w-full p-1.5 border rounded text-[11px]"></div>
        </div>
        <div><label class="text-[10px] font-semibold">Sinônimos (vírgula) — entram no prompt do classificador</label>
            <input id="pd-sin-${s.codigo}" value="${pdEsc((s.sinonimos || []).join(', '))}" class="w-full p-1.5 border rounded text-[11px]"></div>
        <div><label class="text-[10px] font-semibold">Como reconhecer</label>
            <textarea id="pd-rec2-${s.codigo}" rows="2" class="w-full p-1.5 border rounded text-[11px]">${pdEsc(s.como_reconhecer || '')}</textarea></div>
        <div><label class="text-[10px] font-semibold">Prompt específico <span style="color:var(--sage)">(versão atual: ${s.prompt_versao ?? 1} — salvar cria uma versão nova)</span></label>
            <textarea id="pd-prompt-${s.codigo}" rows="4" class="w-full p-1.5 border rounded text-[11px] font-mono">${pdEsc(s.prompt_especifico || '')}</textarea></div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div><label class="text-[10px] font-semibold">Classificador</label>${sel(est.classificador || 'haiku', modelos.map(m => ({ v: m, r: m })), `pd-mc-${s.codigo}`)}</div>
            <div><label class="text-[10px] font-semibold">Extrator</label>${sel(est.extrator || 'haiku', modelos.map(m => ({ v: m, r: m })), `pd-me-${s.codigo}`)}</div>
            <div><label class="text-[10px] font-semibold">Revisor</label>${sel(est.revisor || 'sonnet', [{ v: '', r: '— sem revisor —' }].concat(modelos.map(m => ({ v: m, r: m }))), `pd-mr-${s.codigo}`)}</div>
        </div>
        <div>
            <label class="text-[10px] font-semibold">Gatilhos do revisor · limiar de confiança
                <input type="number" step="0.05" min="0" max="1" id="pd-lim-${s.codigo}" value="${est.limiar_confianca ?? 0.75}" class="ml-2 w-20 p-1 border rounded text-[11px]"></label>
            <div class="flex flex-wrap gap-2 mt-1">${gat.map(g => `<label class="text-[11px] flex items-center gap-1"><input type="checkbox" class="pd-gat-${s.codigo}" value="${g}" ${(est.gatilhos_revisor || []).includes(g) ? 'checked' : ''}> ${g}</label>`).join('')}</div>
        </div>
        <details><summary class="text-[11px] font-semibold cursor-pointer">Campos, validações e regra de vencimento (JSON)</summary>
            <div class="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
                <div><label class="text-[10px] font-semibold">campos</label><textarea id="pd-campos-${s.codigo}" rows="8" class="w-full p-1.5 border rounded text-[10px] font-mono">${pdEsc(pdJson(s.campos))}</textarea></div>
                <div><label class="text-[10px] font-semibold">validações</label><textarea id="pd-val-${s.codigo}" rows="8" class="w-full p-1.5 border rounded text-[10px] font-mono">${pdEsc(pdJson(s.validacoes))}</textarea></div>
                <div><label class="text-[10px] font-semibold">regra_vencimento</label><textarea id="pd-regra-${s.codigo}" rows="8" class="w-full p-1.5 border rounded text-[10px] font-mono">${pdEsc(pdJson(s.regra_vencimento))}</textarea></div>
            </div>
        </details>
        <div class="flex items-center gap-2">
            <button onclick="pdSalvarSubtipo('${s.codigo}')" class="px-3 py-1.5 rounded-lg text-xs font-bold text-white" style="background:var(--pine)">Salvar</button>
            <span id="pd-status-${s.codigo}" class="text-[11px]" style="color:var(--sage)"></span>
        </div>
    </div>`;
}

async function pdSalvarSubtipo(codigo) {
    const s = pdSubtipos.find(x => x.codigo === codigo); if (!s) return;
    const g = id => document.getElementById(`${id}-${codigo}`);
    const st = document.getElementById(`pd-status-${codigo}`);
    const campos = pdParse(g('pd-campos').value, []);
    const validacoes = pdParse(g('pd-val').value, []);
    const regra = pdParse(g('pd-regra').value, null);
    if (campos === undefined || validacoes === undefined || regra === undefined) {
        st.textContent = '⚠️ JSON inválido em campos/validações/regra — corrija antes de salvar.'; st.style.color = 'var(--danger)'; return;
    }
    const lista = v => String(v || '').split(',').map(x => x.trim()).filter(Boolean);
    const payload = {
        codigo, tipo: s.tipo, nome: s.nome,
        categoria_codigo: g('pd-cat').value || null,
        titular_escopo: g('pd-tit').value || null,
        complexidade: g('pd-cx').value,
        ativo: g('pd-ativo').checked,
        ia_reconhece: g('pd-ia').checked,
        gera_controle_padrao: g('pd-ctl').checked,
        manter_arquivo_padrao: g('pd-arq').checked,
        tipo_ativo_aplicavel: lista(g('pd-ta').value),
        sinonimos: lista(g('pd-sin').value),
        como_reconhecer: g('pd-rec2').value.trim() || null,
        prompt_especifico: g('pd-prompt').value.trim() || null,
        antecedencia_padrao_dias: g('pd-ant').value === '' ? null : Number(g('pd-ant').value),
        repeticao_padrao_dias: g('pd-ref').value === '' ? null : Number(g('pd-ref').value),
        recorrencia_padrao_intervalo: g('pd-rec').value === '' ? null : Number(g('pd-rec').value),
        recorrencia_padrao_unidade: g('pd-recu').value || null,
        campos, validacoes, regra_vencimento: regra,
        ia_estrategia: {
            classificador: g('pd-mc').value, extrator: g('pd-me').value,
            revisor: g('pd-mr').value || null,
            limiar_confianca: Number(g('pd-lim').value) || 0.75,
            gatilhos_revisor: [...document.querySelectorAll(`.pd-gat-${codigo}:checked`)].map(e => e.value),
        },
    };
    st.textContent = 'Salvando…'; st.style.color = 'var(--sage)';
    const { error } = await dbAuth.rpc('fn_cofre_catalogo_upsert', { r: payload });
    if (error) { st.textContent = '❌ ' + error.message; st.style.color = 'var(--danger)'; return; }
    st.textContent = '✅ salvo — vale na próxima leitura, sem deploy'; st.style.color = 'var(--ok, #166534)';
    await pdCarregarCatalogo();
}

// ---------------------------------------------------------------- VERSÕES
async function pdRenderVersoes() {
    const cont = document.getElementById('pd-conteudo');
    cont.innerHTML = `<p class="text-xs" style="color:var(--sage)">Carregando versões…</p>`;
    const { data, error } = await dbAuth.rpc('fn_gestao_prompt_versoes', { p_subtipo_codigo: null, p_limite: 200 });
    if (error) { cont.innerHTML = `<p class="text-xs" style="color:var(--danger)">${pdEsc(error.message)}</p>`; return; }
    const linhas = data || [];
    if (!linhas.length) { cont.innerHTML = `<p class="text-xs" style="color:var(--sage)">Nenhuma versão registrada ainda. O snapshot é criado quando um prompt muda no Catálogo.</p>`; return; }
    cont.innerHTML = `
        <p class="text-[11px] mb-2" style="color:var(--sage)">Cada alteração de prompt vira uma versão automática. A extração registra em qual versão foi lida — é assim que dá pra comparar assertividade antes e depois.</p>
        <div class="space-y-2">${linhas.map(v => `
            <div class="border rounded-xl p-3" style="border-color:var(--line)">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <p class="text-sm font-bold" style="color:var(--ink)">${pdEsc(v.subtipo_nome || v.subtipo_codigo || '—')} <span class="text-[11px] font-normal" style="color:var(--sage)">v${v.versao} · ${pdEsc(v.subtipo_codigo || '')}</span></p>
                        <p class="text-[11px]" style="color:var(--sage)">${new Date(v.criado_em).toLocaleString('pt-BR')}${v.criado_por_nome ? ' · ' + pdEsc(v.criado_por_nome) : ''}${v.motivo ? ' · ' + pdEsc(v.motivo) : ''}</p>
                    </div>
                    <button onclick="pdRestaurarVersao('${v.id}')" class="px-2 py-1 rounded text-[11px] font-semibold" style="background:#f1f5f9">Restaurar</button>
                </div>
                <pre class="text-[10px] mt-2 whitespace-pre-wrap" style="color:#475569;max-height:150px;overflow:auto">${pdEsc(v.prompt_especifico || '(sem prompt específico nesta versão)')}</pre>
            </div>`).join('')}</div>`;
}

async function pdRestaurarVersao(id) {
    if (!confirm('Restaurar este prompt?\n\nO texto atual vira uma versão nova no histórico — nada se perde.')) return;
    const { data: linhas, error } = await dbAuth.rpc('fn_gestao_prompt_versoes', { p_subtipo_codigo: null, p_limite: 1000 });
    const data = (linhas || []).find(v => v.id === id);
    if (error || !data) { alert('Não consegui ler a versão: ' + (error?.message || 'não encontrada')); return; }
    const s = pdSubtipos.find(x => x.codigo === data.subtipo_codigo);
    if (!s) { alert('O subtipo desta versão não existe mais no catálogo.'); return; }
    const { error: e2 } = await dbAuth.rpc('fn_cofre_catalogo_upsert', {
        r: { codigo: s.codigo, tipo: s.tipo, nome: s.nome, prompt_especifico: data.prompt_especifico ?? null, campos: data.campos ?? undefined, validacoes: data.validacoes ?? undefined, regra_vencimento: data.regra_vencimento ?? undefined, ia_estrategia: data.ia_estrategia ?? undefined, como_reconhecer: data.como_reconhecer ?? undefined }
    });
    if (e2) { alert('Não consegui restaurar: ' + e2.message); return; }
    await pdCarregarCatalogo();
    pdRenderVersoes();
}

// ----------------------------------------------------------- ASSERTIVIDADE
async function pdRenderAssertividade() {
    const cont = document.getElementById('pd-conteudo');
    cont.innerHTML = `<p class="text-xs" style="color:var(--sage)">Carregando métricas…</p>`;
    const f = pdFiltrosMetrica;
    // Cross-tenant por função SECURITY DEFINER (a RLS da tabela é por tenant) —
    // mesmo padrão das outras telas do Gestão. Gate de master_plataforma dentro.
    const [rx, rc] = await Promise.all([
        dbAuth.rpc('fn_gestao_extracoes_documental', {
            p_cliente_id: f.empresa || null, p_de: f.de || null, p_ate: f.ate || null,
            p_pessoa_id: f.pessoa || null, p_subtipo: f.subtipo || null, p_canal: f.canal || null, p_limite: 1000,
        }),
        dbAuth.from('clientes').select('id, nome_empresa').order('nome_empresa'),
    ]);
    if (rx.error) { cont.innerHTML = `<p class="text-xs" style="color:var(--danger)">${pdEsc(rx.error.message)}</p>`; return; }
    pdMetricas = rx.data || [];
    const empresas = rc.data || [];

    const total = pdMetricas.length;
    const confirmados = pdMetricas.filter(e => e.status_revisao === 'confirmado').length;
    const corrigidos = pdMetricas.filter(e => e.status_revisao === 'corrigido').length;
    const revisados = pdMetricas.filter(e => e.execucao_ia?.revisor?.acionado).length;
    const revisados_pct = total ? Math.round(revisados / total * 100) : 0;
    const semEdicao = (confirmados + corrigidos) ? Math.round(confirmados / (confirmados + corrigidos) * 100) : null;

    let tokens = 0, ms = 0, comTempo = 0;
    pdMetricas.forEach(e => {
        (e.execucao_ia?.etapas || []).forEach(et => { tokens += (et.tokens_entrada || 0) + (et.tokens_saida || 0); });
        if (e.execucao_ia?.total_ms) { ms += e.execucao_ia.total_ms; comTempo++; }
    });

    // campos mais corrigidos: compara o lido com o confirmado
    const corrigidosPorCampo = {};
    pdMetricas.forEach(e => {
        const conf = e.confirmado?.dados_estruturados;
        if (!conf || !e.campos) return;
        Object.keys(conf).forEach(k => {
            const antes = e.campos[k] ?? null, depois = conf[k] ?? null;
            if (String(antes ?? '') !== String(depois ?? '')) corrigidosPorCampo[k] = (corrigidosPorCampo[k] || 0) + 1;
        });
    });
    const topCampos = Object.entries(corrigidosPorCampo).sort((a, b) => b[1] - a[1]).slice(0, 10);

    const porSubtipo = {};
    pdMetricas.forEach(e => {
        const k = e.subtipo_codigo || '—';
        porSubtipo[k] = porSubtipo[k] || { n: 0, ok: 0, corr: 0, rev: 0 };
        porSubtipo[k].n++;
        if (e.status_revisao === 'confirmado') porSubtipo[k].ok++;
        if (e.status_revisao === 'corrigido') porSubtipo[k].corr++;
        if (e.execucao_ia?.revisor?.acionado) porSubtipo[k].rev++;
    });

    const subtiposUnicos = [...new Set(pdMetricas.map(e => e.subtipo_codigo).filter(Boolean))].sort();
    const pessoasUnicas = [...new Map(pdMetricas.filter(e => e.pessoa_id).map(e => [e.pessoa_id, e.pessoa_nome || e.pessoa_id])).entries()];

    cont.innerHTML = `
        <div class="flex flex-wrap gap-2 mb-3">
            <select onchange="pdFiltroMetrica('empresa', this.value)" class="p-2 border rounded-lg text-xs">
                <option value="">Todas as empresas</option>
                ${empresas.map(c => `<option value="${c.id}" ${f.empresa === c.id ? 'selected' : ''}>${pdEsc(c.nome_empresa)}</option>`).join('')}
            </select>
            <input type="date" value="${f.de}" onchange="pdFiltroMetrica('de', this.value)" class="p-2 border rounded-lg text-xs">
            <input type="date" value="${f.ate}" onchange="pdFiltroMetrica('ate', this.value)" class="p-2 border rounded-lg text-xs">
            <select onchange="pdFiltroMetrica('pessoa', this.value)" class="p-2 border rounded-lg text-xs">
                <option value="">Todos os usuários</option>
                ${pessoasUnicas.map(([id, nome]) => `<option value="${id}" ${f.pessoa === id ? 'selected' : ''}>${pdEsc(nome)}</option>`).join('')}
            </select>
            <select onchange="pdFiltroMetrica('subtipo', this.value)" class="p-2 border rounded-lg text-xs">
                <option value="">Todos os tipos</option>
                ${subtiposUnicos.map(c => `<option value="${c}" ${f.subtipo === c ? 'selected' : ''}>${pdEsc(c)}</option>`).join('')}
            </select>
            <select onchange="pdFiltroMetrica('canal', this.value)" class="p-2 border rounded-lg text-xs">
                <option value="">Todos os canais</option>
                ${['app', 'bot'].map(c => `<option value="${c}" ${f.canal === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            ${gestaoCardMetrica('Leituras', total)}
            ${gestaoCardMetrica('Confirmadas sem edição', semEdicao === null ? '—' : semEdicao + '%', semEdicao !== null && semEdicao < 70 ? 'amber' : null, 'Do que o cliente revisou, quanto ficou exatamente como a IA leu.')}
            ${gestaoCardMetrica('Revisor acionado', revisados_pct + '%', revisados_pct > 40 ? 'amber' : null, 'Segunda leitura por gatilho — quanto maior, mais caro.')}
            ${gestaoCardMetrica('Tempo médio', comTempo ? Math.round(ms / comTempo / 100) / 10 + ' s' : '—')}
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="border rounded-xl p-3" style="border-color:var(--line)">
                <p class="text-xs font-bold mb-2">Campos mais corrigidos</p>
                ${topCampos.length ? topCampos.map(([c, n]) => gestaoBarra(c, n, topCampos[0][1])).join('')
                    : `<p class="text-[11px]" style="color:var(--sage)">Nenhuma correção registrada no período — ou ninguém revisou ainda.</p>`}
                <p class="text-[10px] mt-2" style="color:var(--sage)">É a lista que diz onde mexer no prompt ou nos campos do catálogo.</p>
            </div>
            <div class="border rounded-xl p-3" style="border-color:var(--line)">
                <p class="text-xs font-bold mb-2">Por tipo de documento</p>
                <div class="space-y-1">${Object.entries(porSubtipo).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `
                    <div class="flex items-center justify-between text-[11px]">
                        <span class="font-mono">${pdEsc(k)}</span>
                        <span style="color:var(--sage)">${v.n} leitura(s) · ${v.ok} ok · ${v.corr} corrigida(s) · ${v.rev} revisor</span>
                    </div>`).join('') || `<p class="text-[11px]" style="color:var(--sage)">Sem dados.</p>`}</div>
            </div>
        </div>
        <p class="text-[10px] mt-3" style="color:var(--sage)">Tokens somados no período: ${tokens.toLocaleString('pt-BR')}. Fonte: cofre_extracoes_documento (campos × confirmado, execucao_ia, prompt_versao).</p>`;
}

function pdFiltroMetrica(chave, valor) { pdFiltrosMetrica[chave] = valor; pdRenderAssertividade(); }
