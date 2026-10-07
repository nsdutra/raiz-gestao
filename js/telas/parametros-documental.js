// ============================================================================
// js/telas/parametros-documental.js — Motor Documental no Raiz Gestão
// Versão: 0.4.0 · 07/10/2026
//
// v0.4.0 (07/10/2026, dem 6f4df8cc, sessão 20261007-1844-chamado-documento; ficha F1–F5 aprovada pelo
// Nicola 07/10 19:59) — aba nova "Leituras": as leituras do motor de todas as empresas, com filtros
// (empresa, canal, só fracas, só com chamado). Abrir uma leitura mostra o arquivo (link de 5 min pela
// edge gestao-documento), o que a IA leu, quem enviou (contato para falar em off), a configuração
// inicial e os chamados. "Resolver" aplica tipo, nome, ativo e vencimento no documento do cliente
// (fn_gestao_documento_aplicar) e conclui o chamado — nada vai para o cliente. "Ler de novo como este
// tipo" relê com a IA forçando o tipo (não conta na cota do cliente, não abre outro chamado).
// pdVerArquivo fica global: a ficha do chamado em suporte-backlog.js usa o mesmo botão.
// Versão anterior: 0.3.0 · 04/10/2026
//
// v0.3.0 (04/10/2026, frente D · fatia D1, demanda 00b919b6, sessão 20261004-1800-indicadores,
// "De acordo com D1" do Nicola às 22:06) — Assertividade ganha o que faltava para ler
// performance e oportunidade por espécie e tipo de documento, numa função do banco
// (fn_gestao_motor_assertividade, nova — a conta sai do JS, CAN-01):
//   — KPIs novos: reconhecidas (caiu num tipo do catálogo), aguardando revisão, tempo p90,
//     custo médio por leitura (US$, tokens × gestao.ia_precos_modelo) e quantas viraram chamado.
//   — Tabela por espécie (1º nível do catálogo) com abertura por tipo: leituras, reconhecidas,
//     sem edição, confiança média, chamados e nível de oportunidade.
//   — "Onde mexer primeiro": os 5 tipos com mais leituras perdidas (não reconhecidas +
//     corrigidas + chamados).
//   — Ficam como estavam: filtros, "Campos mais corrigidos" e o total de tokens.
//   Os filtros de usuário e de tipo continuam valendo só para os campos mais corrigidos.
// Versão anterior: 0.2.0 · 18/09/2026
//
// v0.2.0 — CAN-05 (Onda 2 da PROPOSTA_CATALOGO_GESTAO v1.3.0): a aba
// Catálogo perde os campos ESTRUTURAIS do subtipo — categoria, titular,
// tipos de ativo aplicáveis, antecedência/reforço/recorrência, parcelamento
// padrão, gera controle, guarda arquivo, ativo. Esses campos migraram pra
// aba Subtipos de js/telas/catalogo-patrimonio.js (novo), que passa a ser a
// ÚNICA porta de edição deles. Esta tela fica só com a LENTE DE IA: prompt
// específico, sinônimos, como reconhecer, estratégia (classificador/
// extrator/revisor/limiar/gatilhos), complexidade, campos, validações e
// regra de vencimento — mais "no classificador" (ia_reconhece), que decide
// se o subtipo entra no prompt do classificador, e é uma decisão de IA, não
// estrutural. Uma porta de escrita (fn_cofre_catalogo_upsert — CONTINUA a
// mesma função, sem caminho paralelo), duas lentes, sem convivência: esta
// tela só manda no payload as chaves que edita, então os campos que saíram
// do formulário não são tocados (a função faz coalesce por chave presente).
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

const PD_VERSAO = '0.4.0';
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
    // v0.1.1 — erro visível: a v0.1.0 engolia qualquer falha e a tela ficava
    // muda ("não carrega nada"). Agora mostra a causa, que na maioria das
    // vezes é RLS/permissão ou o arquivo não ter subido.
    try {
        await pdCarregarCatalogo();
        if (!pdSubtipos.length) {
            document.getElementById('pd-conteudo').innerHTML = `
                <div class="p-4 rounded-xl text-xs" style="background:var(--info-bg);color:var(--info)">
                    Nenhum subtipo global voltou do banco. Isso costuma ser um destes:<br>
                    1) sua conta não está em <b>plataforma_operadores</b> (o Gestão lê o catálogo global como operador da plataforma);<br>
                    2) o catálogo ainda não foi semeado (fase 1 do Motor Documental).<br>
                    Se o erro for outro, ele aparece no console do navegador.
                </div>`;
            return;
        }
    } catch (err) {
        document.getElementById('pd-conteudo').innerHTML = `<div class="p-4 rounded-xl text-xs" style="background:#fee2e2;color:#991b1b">Não consegui carregar o catálogo: ${pdEsc(err.message || String(err))}</div>`;
        return;
    }
    pdRenderAba();
}

function pdRenderAbas() {
    const abas = [
        { id: 'catalogo', rotulo: 'Catálogo' },
        { id: 'versoes', rotulo: 'Versões de prompt' },
        { id: 'assertividade', rotulo: 'Assertividade' },
        { id: 'leituras', rotulo: 'Leituras' },
    ];
    document.getElementById('pd-abas').innerHTML = abas.map(a =>
        `<button type="button" onclick="pdTrocarAba('${a.id}')" class="rz-chip ${pdAba === a.id ? 'rz-on' : ''}">${a.rotulo}</button>`).join('');
}

function pdTrocarAba(id) { pdAba = id; pdSubtipoAberto = null; pdLeituraAberta = null; pdRenderAbas(); pdRenderAba(); }

function pdRenderAba() {
    if (pdAba === 'catalogo') return pdRenderCatalogo();
    if (pdAba === 'versoes') return pdRenderVersoes();
    if (pdAba === 'leituras') return pdRenderLeituras();
    return pdRenderAssertividade();
}

// ---------------------------------------------------------------- CATÁLOGO
async function pdCarregarCatalogo() {
    if (typeof dbAuth === 'undefined') throw new Error('cliente Supabase (dbAuth) não disponível nesta tela.');
    const [rs, rc] = await Promise.all([
        dbAuth.from('cofre_controle_subtipos').select('*').is('cliente_id', null).order('tipo').order('ordem', { nullsFirst: false }).order('nome'),
        dbAuth.from('cofre_categorias').select('id, codigo, nome, grupo').is('cliente_id', null).order('ordem'),
    ]);
    if (rs.error) throw new Error(rs.error.message);
    pdSubtipos = rs.data || [];
    pdCategorias = rc.data || [];
    if (rc.error) console.warn('[documental] categorias:', rc.error.message);
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
        <p class="text-[11px] p-2 rounded-lg" style="background:#f1f5f9;color:#475569">Categoria, titular, tipos de ativo aplicáveis, antecedência/reforço/recorrência, parcelamento, "gera controle", "guarda arquivo" e "ativo" mudaram de lugar — edite em <b>Configurações › Catálogo do patrimônio › Subtipos</b>. Aqui fica só a lente de IA.</p>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2">
            <div><label class="text-[10px] font-semibold">Complexidade</label>
                ${sel(s.complexidade, [{ v: 'padrao', r: 'padrão' }, { v: 'semi_estruturado', r: 'semi-estruturado' }, { v: 'complexo', r: 'complexo' }], `pd-cx-${s.codigo}`)}</div>
            <div class="flex flex-col gap-1 justify-end pb-1">
                <label class="text-[11px] flex items-center gap-1"><input type="checkbox" id="pd-ia-${s.codigo}" ${s.ia_reconhece ? 'checked' : ''}> no classificador</label>
            </div>
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
    // v0.2.0 (CAN-05) — payload só manda as chaves desta lente (IA). Campo
    // estrutural (categoria/titular/tipos de ativo/antecedência/parcelamento/
    // gera controle/guarda arquivo/ativo) NÃO entra aqui de propósito: a
    // ausência da chave faz fn_cofre_catalogo_upsert preservar o valor atual
    // (coalesce), que só é editado agora por catalogo-patrimonio.js.
    const payload = {
        codigo, tipo: s.tipo, nome: s.nome,
        complexidade: g('pd-cx').value,
        ia_reconhece: g('pd-ia').checked,
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
    const [rx, rc, ra] = await Promise.all([
        dbAuth.rpc('fn_gestao_extracoes_documental', {
            p_cliente_id: f.empresa || null, p_de: f.de || null, p_ate: f.ate || null,
            p_pessoa_id: f.pessoa || null, p_subtipo: f.subtipo || null, p_canal: f.canal || null, p_limite: 1000,
        }),
        dbAuth.from('clientes').select('id, nome_empresa').order('nome_empresa'),
        // v0.3.0 (D1) — agregado por espécie/tipo no banco
        dbAuth.rpc('fn_gestao_motor_assertividade', { p_de: f.de || null, p_ate: f.ate || null, p_cliente_id: f.empresa || null, p_canal: f.canal || null }),
    ]);
    const ag = (ra && !ra.error && ra.data) ? ra.data : null;
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
        ${pdKpisAssertividade(ag, { total, semEdicao, revisados_pct, ms, comTempo })}
        ${pdEspeciesAssertividade(ag)}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="border rounded-xl p-3" style="border-color:var(--line)">
                <p class="text-xs font-bold mb-2">Campos mais corrigidos</p>
                ${topCampos.length ? topCampos.map(([c, n]) => gestaoBarra(c, n, topCampos[0][1])).join('')
                    : `<p class="text-[11px]" style="color:var(--sage)">Nenhuma correção registrada no período — ou ninguém revisou ainda.</p>`}
                <p class="text-[10px] mt-2" style="color:var(--sage)">É a lista que diz onde mexer no prompt ou nos campos do catálogo.</p>
            </div>
            ${pdOportunidades(ag)}
        </div>
        <p class="text-[10px] mt-3" style="color:var(--sage)">Tokens somados no período: ${tokens.toLocaleString('pt-BR')}. Fonte: cofre_extracoes_documento (campos × confirmado, execucao_ia, prompt_versao).</p>`;
}

function pdFiltroMetrica(chave, valor) { pdFiltrosMetrica[chave] = valor; pdRenderAssertividade(); }


// ---------------------------------------------------------------- v0.3.0 (D1)
const PD_ESPECIE_ROTULO = { sem_tipo: 'Sem tipo identificado', imovel: 'Imóvel', seguro: 'Seguro', veiculo: 'Veículo', contrato: 'Contrato',
    financeiro: 'Financeiro', societario: 'Societário', operacional: 'Operacional', pessoa: 'Pessoa', outros: 'Outros' };
const PD_OPORT = { alta: ['Alta', 'var(--danger)', 'var(--danger-bg)'], media: ['Média', 'var(--warning)', 'var(--warning-bg)'],
    baixa: ['Baixa', 'var(--success)', 'var(--success-bg)'], pouco_volume: ['Pouco volume', 'var(--sage)', '#eef0f1'], sem_uso: ['Sem uso ainda', 'var(--sage)', '#eef0f1'] };
let pdEspAberta = null;
const pdPct = (a, b) => b ? Math.round(a / b * 100) + '%' : '—';

function pdKpisAssertividade(ag, local) {
    const k = ag?.kpis || {};
    const semEd = k.sem_edicao_pct ?? local.semEdicao;
    return `<div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        ${gestaoCardMetrica('Leituras', k.leituras ?? local.total)}
        ${gestaoCardMetrica('Reconhecidas', k.reconhecidas_pct == null ? '—' : k.reconhecidas_pct + '%', k.reconhecidas_pct != null && k.reconhecidas_pct < 70 ? 'amber' : null, 'Leituras que caíram num tipo do catálogo (nem sem tipo, nem "outro").')}
        ${gestaoCardMetrica('Confirmadas sem edição', semEd == null ? '—' : semEd + '%', semEd != null && semEd < 70 ? 'amber' : null, 'Do que o cliente revisou, quanto ficou exatamente como a IA leu.')}
        ${gestaoCardMetrica('Aguardando revisão', k.aguardando_pct == null ? '—' : k.aguardando_pct + '%', k.aguardando_pct > 40 ? 'amber' : null, `${k.aguardando ?? 0} leitura(s) que ninguém confirmou nem corrigiu ainda.`)}
        ${gestaoCardMetrica('Revisor acionado', (k.revisor_pct ?? local.revisados_pct) + '%', (k.revisor_pct ?? local.revisados_pct) > 40 ? 'amber' : null, 'Segunda leitura por gatilho — quanto maior, mais caro.')}
        ${gestaoCardMetrica('Tempo', k.tempo_medio_s == null ? '—' : String(k.tempo_medio_s).replace('.', ',') + ' s', null, `Médio por leitura · 90% das leituras em até ${k.tempo_p90_s == null ? '—' : String(k.tempo_p90_s).replace('.', ',') + ' s'}.`)}
        ${gestaoCardMetrica('Custo por leitura', k.custo_medio_usd == null ? '—' : 'US$ ' + Number(k.custo_medio_usd).toFixed(3).replace('.', ','), null, 'Tokens de cada etapa × preço do modelo (gestao.ia_precos_modelo).')}
        ${gestaoCardMetrica('Viraram chamado', k.tickets ?? 0, k.tickets ? 'amber' : null, 'Leituras com chamado de suporte (o motor abre sozinho abaixo do limiar de confiança, ou o cliente pede).')}
    </div>`;
}

function pdEspeciesAssertividade(ag) {
    const esp = ag?.especies || [];
    if (!esp.length) return '';
    const linhas = esp.map(e => {
        const op = PD_OPORT[e.oportunidade] || PD_OPORT.baixa;
        const aberta = pdEspAberta === e.especie;
        const revisadas = e.confirmadas + e.corrigidas;
        let html = `<tr onclick="pdEspAberta = pdEspAberta === '${e.especie}' ? null : '${e.especie}'; pdRenderAssertividade()" style="cursor:pointer;border-top:1px solid var(--line)">
            <td class="p-2 font-bold">${e.tipos.length ? (aberta ? '▾ ' : '▸ ') : ''}${pdEsc(PD_ESPECIE_ROTULO[e.especie] || e.especie)}</td>
            <td class="p-2 text-right">${e.leituras}</td><td class="p-2 text-right">${pdPct(e.reconhecidas, e.leituras)}</td>
            <td class="p-2 text-right">${revisadas ? `${pdPct(e.confirmadas, revisadas)} (${e.confirmadas} de ${revisadas})` : '—'}</td>
            <td class="p-2 text-right">${e.confianca_media == null ? '—' : e.confianca_media + '%'}</td><td class="p-2 text-right">${e.tickets}</td>
            <td class="p-2"><span class="text-[11px] font-bold px-2 py-0.5 rounded-full" style="background:${op[2]};color:${op[1]}">${op[0]}</span></td></tr>`;
        if (aberta) html += e.tipos.map(t => {
            const rv = t.confirmadas + t.corrigidas;
            return `<tr style="background:#fbfbfa;font-size:11px"><td class="p-2 pl-6">${pdEsc(t.tipo)}</td><td class="p-2 text-right">${t.leituras}</td>
                <td class="p-2 text-right">${pdPct(t.reconhecidas, t.leituras)}</td><td class="p-2 text-right">${rv ? `${pdPct(t.confirmadas, rv)} (${t.corrigidas} corrigida(s))` : '—'}</td>
                <td class="p-2 text-right">${t.confianca_media == null ? '—' : t.confianca_media + '%'}</td><td class="p-2 text-right">${t.tickets}</td><td></td></tr>`;
        }).join('');
        return html;
    }).join('');
    return `<div class="border rounded-xl p-3 mb-3 overflow-x-auto" style="border-color:var(--line)">
        <p class="text-xs font-bold mb-2">Por espécie e tipo de documento</p>
        <table class="w-full text-xs" style="min-width:640px"><thead><tr style="color:var(--sage)">
            <th class="p-2 text-left">Espécie (clique para abrir os tipos)</th><th class="p-2 text-right">Leituras</th><th class="p-2 text-right">Reconhecidas</th>
            <th class="p-2 text-right">Sem edição</th><th class="p-2 text-right">Confiança média</th><th class="p-2 text-right">Chamados</th><th class="p-2 text-left">Oportunidade</th></tr></thead>
        <tbody>${linhas}</tbody></table>
        <p class="text-[10px] mt-2" style="color:var(--sage)">Espécie = 1º nível da categoria do catálogo. Oportunidade = leituras perdidas (não reconhecidas + corrigidas + chamados) ÷ leituras: alta a partir de 40%, média a partir de 20%; abaixo de 3 leituras, "pouco volume".</p>
    </div>`;
}

function pdOportunidades(ag) {
    const ops = ag?.oportunidades || [];
    return `<div class="border rounded-xl p-3" style="border-color:var(--line)">
        <p class="text-xs font-bold mb-2">Onde mexer primeiro</p>
        ${ops.length ? ops.map((o, i) => `<div class="flex gap-2 items-start py-1.5" style="${i ? 'border-top:1px solid var(--line)' : ''}">
            <span class="text-[11px] font-bold rounded-full flex-none text-white" style="background:var(--brass);width:22px;height:22px;display:grid;place-items:center">${i + 1}</span>
            <div class="flex-1 min-w-0"><p class="text-xs font-bold" style="color:var(--ink)">${pdEsc(o.tipo)} · ${pdEsc(PD_ESPECIE_ROTULO[o.especie] || o.especie)}</p>
            <p class="text-[11px]" style="color:var(--sage)">${o.leituras} leitura(s) · ${o.nao_reconhecidas} sem tipo útil · ${o.corrigidas} corrigida(s) · ${o.tickets} chamado(s)${o.confianca_media != null ? ' · confiança média ' + o.confianca_media + '%' : ''}</p></div>
        </div>`).join('') : `<p class="text-[11px]" style="color:var(--sage)">Nenhuma leitura perdida no período.</p>`}
        <p class="text-[10px] mt-2" style="color:var(--sage)">Ajuste no Catálogo (sinônimos, "como reconhecer", prompt específico) — a versão nova aparece em Versões para comparar antes e depois.</p>
    </div>`;
}


// ---------------------------------------------------------------- LEITURAS
// A equipe trata aqui o documento de uma leitura fraca, sem devolver nada ao cliente. Tudo é
// cross-tenant: a lista e a ficha vêm de funções do banco com checagem de master, e o arquivo só por
// link temporário da edge gestao-documento — a RLS do Storage não deixa o master ler outra empresa.
let pdFiltrosLeitura = { empresa: '', canal: '', fracas: true, chamado: false };
let pdLeituraAberta = null;   // extracao_id em foco; o chamado (supAbrirMotor) também preenche
let pdLeituraDet = null;
let pdLeituraAviso = '';
let pdEmpresasCache = null;
const PD_CANAL_ROTULO = { app: 'App', bot: 'WhatsApp', whatsapp: 'WhatsApp', gestao: 'Gestão' };
const PD_ESPERADO_ROTULO = { lista_ativos: 'Lista de ativos', documentos_ativos: 'Documentos dos ativos', contratos: 'Contratos de aluguel',
    contas_apolices: 'Contas e apólices', documentos_pessoas: 'Documentos de pessoas' };

function pdQuando(iso) { return iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'; }
function pdPctLeitura(c) { return c == null ? '' : ' · ' + Math.round(Number(c) * 100) + '%'; }

function pdSituacaoLeitura(l) {
    if (l.chamado_ativo) return ['Chamado aberto', 'var(--warning)', 'var(--warning-bg)'];
    if (l.status_revisao === 'descartado') return ['Descartada', 'var(--sage)', '#f1f0ea'];
    if (l.status_revisao === 'confirmado' || l.status_revisao === 'corrigido') return [l.chamado_id ? 'Resolvida pela equipe' : 'Conferida', 'var(--success)', 'var(--success-bg)'];
    if (l.fraca) return ['Sem revisão', 'var(--danger)', 'var(--danger-bg)'];
    return ['Lida', 'var(--sage)', '#f1f0ea'];
}

function pdFiltroLeitura(chave, valor) { pdFiltrosLeitura[chave] = valor; pdLeituraAviso = ''; pdRenderLeituras(); }
function pdAbrirLeitura(id) { pdLeituraAberta = id; pdLeituraAviso = ''; pdRenderLeituras(); }
function pdFecharLeitura() { pdLeituraAberta = null; pdLeituraDet = null; pdRenderLeituras(); }

async function pdRenderLeituras() {
    if (pdLeituraAberta) return pdRenderLeitura(pdLeituraAberta);
    const cont = document.getElementById('pd-conteudo');
    if (!cont) return;
    cont.innerHTML = `<p class="text-xs" style="color:var(--sage)">Carregando leituras…</p>`;
    const f = pdFiltrosLeitura;
    const [rl, rc] = await Promise.all([
        dbAuth.rpc('fn_gestao_leituras', { p_cliente_id: f.empresa || null, p_canal: f.canal || null, p_so_fracas: !!f.fracas, p_so_chamado: !!f.chamado, p_limite: 200 }),
        pdEmpresasCache ? Promise.resolve({ data: pdEmpresasCache }) : dbAuth.from('clientes').select('id, nome_empresa').order('nome_empresa'),
    ]);
    if (rl.error) { cont.innerHTML = `<p class="text-xs" style="color:var(--danger)">${pdEsc(rl.error.message)}</p>`; return; }
    pdEmpresasCache = rc.data || [];
    const linhas = rl.data || [];
    cont.innerHTML = `
        ${pdLeituraAviso ? `<div class="p-3 rounded-xl text-xs mb-3" style="background:var(--success-bg);color:var(--success)">${pdEsc(pdLeituraAviso)}</div>` : ''}
        <div class="flex flex-wrap gap-2 mb-3 items-center">
            <select onchange="pdFiltroLeitura('empresa', this.value)" class="p-2 border rounded-lg text-xs">
                <option value="">Todas as empresas</option>
                ${pdEmpresasCache.map(c => `<option value="${c.id}" ${f.empresa === c.id ? 'selected' : ''}>${pdEsc(c.nome_empresa)}</option>`).join('')}
            </select>
            <select onchange="pdFiltroLeitura('canal', this.value)" class="p-2 border rounded-lg text-xs">
                <option value="">Todos os canais</option>
                ${['app', 'bot', 'gestao'].map(c => `<option value="${c}" ${f.canal === c ? 'selected' : ''}>${PD_CANAL_ROTULO[c]}</option>`).join('')}
            </select>
            <label class="text-xs flex items-center gap-1.5 p-2 border rounded-lg"><input type="checkbox" ${f.fracas ? 'checked' : ''} onchange="pdFiltroLeitura('fracas', this.checked)"> Só fracas</label>
            <label class="text-xs flex items-center gap-1.5 p-2 border rounded-lg"><input type="checkbox" ${f.chamado ? 'checked' : ''} onchange="pdFiltroLeitura('chamado', this.checked)"> Só com chamado</label>
        </div>
        ${linhas.length ? `<div class="overflow-x-auto"><table class="w-full text-xs">
            <thead><tr style="color:var(--sage)"><th class="text-left p-2">Quando</th><th class="text-left p-2">Empresa</th><th class="text-left p-2">Documento</th><th class="text-left p-2">Leitura</th><th class="text-left p-2">Canal</th><th class="text-left p-2">Situação</th></tr></thead>
            <tbody>${linhas.map(l => {
                const [sit, cor, bg] = pdSituacaoLeitura(l);
                return `<tr onclick="pdAbrirLeitura('${l.extracao_id}')" class="cursor-pointer" style="border-top:1px solid var(--line)">
                    <td class="p-2 whitespace-nowrap">${pdQuando(l.criado_em)}</td>
                    <td class="p-2">${pdEsc(l.nome_empresa || '—')}</td>
                    <td class="p-2" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${pdEsc(l.documento_nome || 'sem documento no Cofre')}</td>
                    <td class="p-2 whitespace-nowrap"><span class="font-bold px-2 py-0.5 rounded-full" style="${l.fraca ? 'background:var(--danger-bg);color:var(--danger)' : 'background:#f1f0ea;color:var(--ink)'}">${pdEsc(l.tipo_nome || l.subtipo_codigo || 'Sem tipo')}${pdPctLeitura(l.confianca)}</span></td>
                    <td class="p-2">${pdEsc(PD_CANAL_ROTULO[l.canal] || l.canal || '—')}</td>
                    <td class="p-2 whitespace-nowrap"><span class="font-bold px-2 py-0.5 rounded-full" style="background:${bg};color:${cor}">${sit}</span></td>
                </tr>`; }).join('')}</tbody></table></div>`
        : `<p class="text-xs p-4 rounded-xl" style="background:#f1f0ea;color:var(--sage)">Nenhuma leitura com esses filtros.</p>`}
        <p class="text-[10px] mt-2" style="color:var(--sage)">Até 200 leituras, mais recentes primeiro. Clique numa linha para ver o arquivo e resolver.</p>`;
}

function pdValorCampo(v) {
    if (v == null || v === '') return '—';
    if (Array.isArray(v)) return v.map(pdValorCampo).join(' | ');
    if (typeof v === 'object') return Object.values(v).filter(x => x != null && x !== '' && typeof x !== 'object').join(' · ') || '—';
    return String(v);
}

async function pdRenderLeitura(id) {
    const cont = document.getElementById('pd-conteudo');
    if (!cont) return;
    cont.innerHTML = `<p class="text-xs" style="color:var(--sage)">Abrindo a leitura…</p>`;
    const { data, error } = await dbAuth.rpc('fn_gestao_leitura_detalhe', { p_extracao_id: id });
    if (error || !data) { cont.innerHTML = `<p class="text-xs" style="color:var(--danger)">${pdEsc(error?.message || 'Leitura não encontrada.')}</p><button onclick="pdFecharLeitura()" class="text-xs font-bold mt-2" style="color:var(--brass-deep)">‹ Leituras</button>`; return; }
    pdLeituraDet = data;
    const l = data.leitura || {}, d = data.documento, emp = data.empresa || {}, quem = data.enviado_por, cfg = data.configuracao;
    const dados = l.dados || {};
    const chamados = data.chamados || [];
    const chAtivo = chamados.some(c => c.ativo);
    const campos = Object.entries(l.campos || {}).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length));
    const tipos = pdSubtipos.filter(s => s.ativo !== false && !String(s.codigo || '').startsWith('sistema_'));
    const tipoAtual = d?.subtipo_codigo || l.subtipo_codigo || '';
    const vinc = (data.ativos_vinculados || [])[0]?.id || '';
    const venc = dados.vencimento?.data || l.campos?.validade || d?.validade_em || '';
    const nomeSug = dados.nomeSugerido || d?.nome || '';
    const zap = quem?.whatsapp ? String(quem.whatsapp).replace(/\D/g, '') : '';
    cont.innerHTML = `
        <button onclick="pdFecharLeitura()" class="text-xs font-bold mb-3" style="color:var(--brass-deep)">‹ Leituras</button>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div class="min-w-0">
            <div class="border rounded-xl p-3 mb-3" style="border-color:var(--line)">
                <p class="text-xs font-bold mb-2">Arquivo</p>
                ${d ? `<p class="text-xs mb-1" style="color:var(--ink);word-break:break-all">${pdEsc(d.nome || 'Documento')}</p>
                <p class="text-[11px] mb-2" style="color:var(--sage)">${pdEsc(d.mime || '')}${d.tamanho ? ' · ' + Math.max(1, Math.round(d.tamanho / 1024)) + ' KB' : ''} · ${d.nivel_acesso === 'restrito' ? 'restrito' : 'acesso da empresa'} · ${d.status === 'excluido' ? 'excluído' : 'no Cofre'}</p>
                ${d.tem_arquivo && d.status !== 'excluido' ? `<button onclick="pdVerArquivo('${d.id}', this)" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2" style="border-color:var(--brass);color:var(--brass-deep)">Ver arquivo</button>
                <p class="text-[10px] mt-1.5" style="color:var(--sage)">Abre em nova aba por um link que vale 5 min. A abertura fica registrada.</p>` : `<p class="text-[11px]" style="color:var(--sage)">O arquivo não está mais guardado.</p>`}`
                : `<p class="text-[11px]" style="color:var(--sage)">Esta leitura não chegou a virar documento no Cofre (leitura antes de salvar).</p>`}
            </div>
            <div class="border rounded-xl p-3" style="border-color:var(--line)">
                <p class="text-xs font-bold mb-2">O que a IA leu</p>
                <p class="text-xs mb-1"><b>${pdEsc(l.tipo_nome || l.subtipo_codigo || 'Sem tipo')}${pdPctLeitura(l.confianca)}</b> <span style="color:var(--sage)">· limite do tipo ${Math.round((l.limiar || 0.75) * 100)}%</span></p>
                ${l.tipo_detectado ? `<p class="text-[11px] mb-1" style="color:var(--sage)">${pdEsc(l.tipo_detectado)}</p>` : ''}
                ${dados.resumo ? `<p class="text-[11px] mb-2" style="color:var(--ink)">${pdEsc(dados.resumo)}</p>` : ''}
                ${campos.length ? `<table class="w-full text-[11px] mb-2"><tbody>${campos.map(([k, v]) => `<tr style="border-top:1px solid var(--line)"><td class="py-1 pr-2" style="color:var(--sage);white-space:nowrap">${pdEsc(k)}</td><td class="py-1" style="word-break:break-word">${pdEsc(pdValorCampo(v))}</td></tr>`).join('')}</tbody></table>` : ''}
                <p class="text-[10px]" style="color:var(--sage)">${pdEsc(PD_CANAL_ROTULO[l.canal] || l.canal || '')} · ${pdQuando(l.criado_em)} · motor ${pdEsc(l.motor_versao ?? '—')} · prompt v${pdEsc(l.prompt_versao ?? '—')} · ${l.etapas || 0} etapa(s)${l.total_ms ? ' · ' + Math.round(l.total_ms / 1000) + ' s' : ''} · ${pdEsc(l.status_revisao || '')}</p>
                ${(data.outras_leituras || []).length ? `<p class="text-[10px] mt-2" style="color:var(--sage)">Outras leituras deste documento: ${data.outras_leituras.map(o => `<a onclick="pdAbrirLeitura('${o.id}')" class="cursor-pointer underline">${pdEsc(o.subtipo_codigo || 'sem tipo')}${pdPctLeitura(o.confianca)} · ${pdEsc(PD_CANAL_ROTULO[o.canal] || o.canal)} · ${pdQuando(o.criado_em)}</a>`).join(' · ')}</p>` : ''}
            </div>
          </div>
          <div class="min-w-0">
            <div class="border rounded-xl p-3 mb-3" style="border-color:var(--line)">
                <p class="text-xs font-bold mb-2">Contexto</p>
                <table class="w-full text-[11px]"><tbody>
                    <tr><td class="py-1 pr-2" style="color:var(--sage)">Empresa</td><td class="py-1 font-bold">${pdEsc(emp.nome || '—')}</td></tr>
                    <tr><td class="py-1 pr-2" style="color:var(--sage)">Enviado por</td><td class="py-1">${pdEsc(quem?.nome || '—')} · ${pdEsc(PD_CANAL_ROTULO[l.canal] || l.canal || '')} · ${pdQuando(d?.criado_em || l.criado_em)}</td></tr>
                    <tr><td class="py-1 pr-2" style="color:var(--sage)">Contato em off</td><td class="py-1">${zap ? `${pdEsc(zap)} <button onclick="pdCopiar('${zap}', this)" class="font-bold underline" style="color:var(--brass-deep)">Copiar</button>` : '—'}${quem?.email ? ' · ' + pdEsc(quem.email) : ''}</td></tr>
                    ${cfg ? `<tr><td class="py-1 pr-2" style="color:var(--sage)">Configuração inicial</td><td class="py-1">esperado: ${pdEsc(PD_ESPERADO_ROTULO[cfg.esperado] || cfg.esperado || '—')}</td></tr>` : ''}
                    <tr><td class="py-1 pr-2" style="color:var(--sage)">Chamado</td><td class="py-1">${chamados.length ? chamados.map(c => `${pdEsc(String(c.id).slice(0, 8))} · ${c.ativo ? 'aberto' : 'concluído'}${c.severidade ? ' · ' + pdEsc(c.severidade) : ''}${c.ativo && c.sla_resolucao_ate ? ' · prazo ' + pdQuando(c.sla_resolucao_ate) : ''}`).join('<br>') : 'nenhum'}</td></tr>
                </tbody></table>
            </div>
            ${d && d.status !== 'excluido' ? `<div class="border-2 rounded-xl p-3" style="border-color:var(--brass)">
                <p class="text-xs font-bold mb-2">Resolver</p>
                <label class="text-[11px] block mb-1" style="color:var(--sage)">Tipo do documento</label>
                <select id="pd-res-tipo" class="w-full p-2 border rounded-lg text-xs mb-1">
                    ${tipos.map(s => `<option value="${pdEsc(s.codigo)}" ${s.codigo === tipoAtual ? 'selected' : ''}>${pdEsc(s.nome)}</option>`).join('')}
                </select>
                <div class="mb-2"><button onclick="pdReler(this)" class="text-[11px] font-bold underline" style="color:var(--brass-deep)">Ler de novo como este tipo</button> <span class="text-[10px]" style="color:var(--sage)">opcional · a IA relê e preenche os campos abaixo</span></div>
                <label class="text-[11px] block mb-1" style="color:var(--sage)">Nome no Cofre</label>
                <input id="pd-res-nome" value="${pdEsc(nomeSug)}" maxlength="200" class="w-full p-2 border rounded-lg text-xs mb-2">
                <label class="text-[11px] block mb-1" style="color:var(--sage)">Ativo</label>
                <select id="pd-res-ativo" class="w-full p-2 border rounded-lg text-xs mb-2">
                    <option value="">Sem ativo</option>
                    ${(data.ativos || []).map(a => `<option value="${a.id}" ${a.id === vinc ? 'selected' : ''}>${pdEsc(a.nome)}</option>`).join('')}
                </select>
                <label class="text-[11px] block mb-1" style="color:var(--sage)">Vence em</label>
                <input id="pd-res-venc" type="date" value="${pdEsc(String(venc).slice(0, 10))}" class="w-full p-2 border rounded-lg text-xs mb-2">
                <label class="text-[11px] block mb-1" style="color:var(--sage)">Nota interna (fica no chamado)</label>
                <textarea id="pd-res-nota" rows="2" class="w-full p-2 border rounded-lg text-xs mb-2"></textarea>
                <button onclick="pdAplicar(this)" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">${chAtivo ? 'Aplicar e concluir o chamado' : 'Aplicar no documento'}</button>
                <p id="pd-res-msg" class="text-[11px] mt-1.5" style="color:var(--sage)">Nada é enviado ao cliente.</p>
            </div>` : ''}
          </div>
        </div>`;
}

function pdCopiar(texto, btn) {
    try { navigator.clipboard.writeText(texto); if (btn) btn.textContent = 'Copiado'; } catch (_) { /* navegador sem clipboard: o número já está na tela */ }
}

// Global de propósito: a ficha do chamado (suporte-backlog.js) usa o mesmo botão.
// A aba é aberta antes da chamada à edge; aberta depois do await, o navegador bloqueia como pop-up.
async function pdVerArquivo(documentoId, btn) {
    const aba = window.open('', '_blank');
    if (btn) { btn.disabled = true; btn.textContent = 'Abrindo…'; }
    const { data, error } = await dbAuth.functions.invoke('gestao-documento', { body: { acao: 'ver', documento_id: documentoId } });
    if (btn) { btn.disabled = false; btn.textContent = 'Ver arquivo'; }
    if (error || !data?.url) {
        if (aba) aba.close();
        const msg = data?.erro || error?.message || 'Não consegui abrir o arquivo.';
        if (btn && btn.parentElement) { const p = document.createElement('p'); p.className = 'text-[11px] mt-1'; p.style.color = 'var(--danger)'; p.textContent = msg; btn.parentElement.appendChild(p); }
        return;
    }
    if (aba) aba.location.href = data.url; else window.open(data.url, '_blank');
}

async function pdReler(btn) {
    const msg = document.getElementById('pd-res-msg');
    const tipo = document.getElementById('pd-res-tipo')?.value;
    const docId = pdLeituraDet?.documento?.id;
    if (!tipo || !docId) return;
    btn.disabled = true; btn.textContent = 'Lendo… (até 1 min)';
    msg.style.color = 'var(--sage)'; msg.textContent = 'A IA está lendo o arquivo de novo.';
    const { data, error } = await dbAuth.functions.invoke('gestao-documento', { body: { acao: 'reler', documento_id: docId, subtipo_codigo: tipo } });
    btn.disabled = false; btn.textContent = 'Ler de novo como este tipo';
    if (error || !data?.ok) { msg.style.color = 'var(--danger)'; msg.textContent = data?.erro || error?.message || 'A releitura falhou.'; return; }
    if (data.extracao_id) { pdLeituraAberta = data.extracao_id; return pdRenderLeitura(data.extracao_id); }
    msg.textContent = 'Releitura feita. Recarregue a leitura para ver os campos.';
}

async function pdAplicar(btn) {
    const msg = document.getElementById('pd-res-msg');
    const tipo = document.getElementById('pd-res-tipo')?.value;
    if (!tipo) { msg.style.color = 'var(--danger)'; msg.textContent = 'Escolha o tipo do documento.'; return; }
    btn.disabled = true;
    const { data, error } = await dbAuth.rpc('fn_gestao_documento_aplicar', {
        p_extracao_id: pdLeituraDet.leitura.id,
        p_subtipo_codigo: tipo,
        p_nome: document.getElementById('pd-res-nome')?.value || null,
        p_ativo_id: document.getElementById('pd-res-ativo')?.value || null,
        p_validade_em: document.getElementById('pd-res-venc')?.value || null,
        p_nota: document.getElementById('pd-res-nota')?.value || null,
    });
    btn.disabled = false;
    if (error || !data?.ok) { msg.style.color = 'var(--danger)'; msg.textContent = error?.message || data?.mensagem || 'Não foi possível aplicar.'; return; }
    pdLeituraAviso = `${data.mensagem} Empresa: ${pdLeituraDet.empresa?.nome || '—'}. No app, o documento sai de "Com a equipe".`;
    pdLeituraAberta = null; pdLeituraDet = null;
    pdRenderLeituras();
}
