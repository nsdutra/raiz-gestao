// ============================================================================
// js/telas/parametros-campanhas.js — Raiz Gestão
//
// v0.8.2 — regras de negócio da fase atual (definidas 19/08/2026):
//   - Só 1 campanha ativa por vez (checklist da etapa 5 avisa; o bloqueio
//     de verdade é no banco, gestao.fn_publicar_campanha()).
//   - Categoria trial/cortesia é a única publicável (sem compra direta
//     sem trial ainda) — aviso na etapa 1, bloqueio no banco.
//   - Trial precisa ter a opção de pagamento grátis (R$ 0) marcada —
//     badge "GRÁTIS" na etapa 2, checklist na etapa 5.
//   - Público só usa "prospect" nesta fase — pré-selecionado ao criar
//     campanha nova (se já cadastrado em Catálogos), checklist confirma.
//
// v0.8.1 (novo arquivo) — "Campanhas & Landing": substitui o CRUD isolado
// de campanhas (v0.7.0, pmRenderCampanhas/pmFormCampanha/pmSalvarCampanha)
// por um wizard de 5 etapas: Oferta → Condições → Público → Landing →
// Publicar. Reaproveita o MESMO padrão de salvamento da v0.7.0 (upsert em
// plano_campanhas + substituir N pagamentos por completo em
// plano_campanhas_pagamentos) — só organizado em etapas e com os campos
// novos (status, plano vinculado, público, landing).
//
// Publicar/despublicar usa gestao.fn_publicar_campanha() (RPC transacional
// — liga status + campanha_landing.publicar juntos, valida landing/plano
// antes). Rascunho é salvo por escrita direta nas tabelas (mesmo padrão
// de todo o resto de Parâmetros).
// ============================================================================

let pcCampanhaId = null; // null = criando nova
let pcStep = 1;
let pcDraft = {};

function pcCampanhaVazia() {
    return {
        nome: '', categoria: 'trial', plano_codigo: '',
        duracao_tipo: 'dias_fixos', duracao_dias: '', tempo_aviso_dias: 3,
        inicio_vigencia: '', fim_vigencia: '',
        pagamentos: [],
        id_publico_oferta: '',
        landing: { codigo_publico: '', titulo: '', subtitulo: '', cta_texto: 'Começar agora', badge_texto: '', ordem: 100, destaque: false }
    };
}

async function parametrosCampanhasInit() {
    const c = document.getElementById('pm-conteudo-area');
    c.innerHTML = `
        <div class="grid lg:grid-cols-[300px_1fr] gap-5">
            <div>
                <div class="flex justify-between items-center mb-3">
                    <div>
                        <h2 class="text-sm font-extrabold" style="color:var(--ink)">Campanhas</h2>
                        <p class="text-[11px]" style="color:var(--sage)">Oferta comercial + publicação</p>
                    </div>
                    ${pmBotaoToggle('pc-nova', "pcNovaCampanha()")}
                </div>
                <div id="pc-lista" class="space-y-2"></div>
            </div>
            <div id="pc-wizard"></div>
        </div>
    `;
    pcRenderLista();
    if (pmCampanhas.length > 0) pcAbrirCampanha(pmCampanhas[0].id);
    else pcNovaCampanha();
}

function pcStatusChip(status) {
    const cores = {
        rascunho: ['var(--warning-bg)', 'var(--warning)'],
        publicada: ['var(--success-bg)', 'var(--success)'],
        pausada: ['var(--danger-bg)', 'var(--danger)'],
        encerrada: ['#e5e7eb', 'var(--sage)']
    };
    const [bg, cor] = cores[status] || cores.rascunho;
    return `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${bg};color:${cor}">${status || 'rascunho'}</span>`;
}

function pcRenderLista() {
    const el = document.getElementById('pc-lista');
    el.innerHTML = pmCampanhas.map(cp => {
        const landing = pmCampanhaLanding.find(l => l.campanha_id === cp.id);
        return `
        <button onclick="pcAbrirCampanha('${cp.id}')" id="pc-item-${cp.id}"
            class="w-full text-left p-3 rounded-xl border-2 ${cp.id === pcCampanhaId ? '' : ''}"
            style="border-color:${cp.id === pcCampanhaId ? 'var(--brass)' : 'var(--line)'};background:#fff">
            <div class="flex justify-between gap-2">
                <div class="min-w-0">
                    <b class="text-sm truncate block" style="color:var(--ink)">${cp.nome}</b>
                    <div class="text-[11px] mt-0.5" style="color:var(--sage)">${cp.categoria}</div>
                </div>
                ${pcStatusChip(cp.status)}
            </div>
            <div class="text-[10px] mt-2" style="color:var(--sage)">${landing ? landing.codigo_publico : 'sem landing configurada'}</div>
        </button>`;
    }).join('') || `<p class="text-xs text-center py-6" style="color:var(--sage)">Nenhuma campanha ainda.</p>`;
}

function pcNovaCampanha() {
    pcCampanhaId = null;
    pcDraft = pcCampanhaVazia();
    // Regra desta fase (19/08/2026): único público em uso é "prospect" —
    // pré-seleciona se já existir no catálogo, pra não depender do master
    // lembrar de escolher toda vez.
    const prospect = pmPublicoOferta.find(p => p.tipo_cliente === 'prospect');
    if (prospect) pcDraft.id_publico_oferta = prospect.id;
    pcStep = 1;
    document.querySelectorAll('[id^="pc-item-"]').forEach(b => b.style.borderColor = 'var(--line)');
    pcRenderWizard();
}

function pcAbrirCampanha(id) {
    const cp = pmCampanhas.find(x => x.id === id);
    if (!cp) return;
    pcCampanhaId = id;
    pcStep = 1;

    const planoVinculado = pmPlanos.find(p => p.id_campanha === id);
    const landing = pmCampanhaLanding.find(l => l.campanha_id === id);
    const pagIds = pmCampanhaPagamentos.filter(cpp => cpp.id_campanha === id).map(cpp => cpp.id_plano_pagamento);

    pcDraft = {
        nome: cp.nome, categoria: cp.categoria, plano_codigo: planoVinculado?.codigo || '',
        status: cp.status, duracao_tipo: cp.duracao_tipo, duracao_dias: cp.duracao_dias ?? '',
        tempo_aviso_dias: cp.tempo_aviso_dias, inicio_vigencia: cp.inicio_vigencia || '', fim_vigencia: cp.fim_vigencia || '',
        pagamentos: pagIds, id_publico_oferta: cp.id_publico_oferta || '',
        landing: landing
            ? { codigo_publico: landing.codigo_publico, titulo: landing.titulo, subtitulo: landing.subtitulo || '', cta_texto: landing.cta_texto, badge_texto: landing.badge_texto || '', ordem: landing.ordem, destaque: landing.destaque }
            : { codigo_publico: '', titulo: '', subtitulo: '', cta_texto: 'Começar agora', badge_texto: '', ordem: 100, destaque: false }
    };

    document.querySelectorAll('[id^="pc-item-"]').forEach(b => b.style.borderColor = 'var(--line)');
    const item = document.getElementById('pc-item-' + id);
    if (item) item.style.borderColor = 'var(--brass)';
    pcRenderWizard();
}

function pcSetStep(n) { pcStep = n; pcRenderWizard(); }

function pcPasso(n, label) {
    const estado = n < pcStep ? 'done' : n === pcStep ? 'active' : '';
    const cores = { done: ['var(--success)', 'var(--success)', '#fff'], active: ['var(--pine)', 'var(--pine)', '#fff'], '': ['var(--line)', '#fff', 'var(--sage)'] };
    const [borda, bg, cor] = cores[estado];
    return `
        <div class="flex items-center gap-1.5 flex-none">
            <span class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black" style="border:2px solid ${borda};background:${bg};color:${cor}">${n < pcStep ? '✓' : n}</span>
            <span class="text-[10px] font-bold whitespace-nowrap" style="color:var(--ink)">${label}</span>
        </div>
    `;
}

function pcRenderWizard() {
    const el = document.getElementById('pc-wizard');
    el.innerHTML = `
        <div class="p-4 md:p-5 rounded-2xl border-2" style="border-color:var(--line);background:#fff">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                    <div class="flex items-center gap-2">
                        <h3 class="text-lg font-extrabold" style="color:var(--ink)">${pcDraft.nome || 'Nova campanha'}</h3>
                        ${pcCampanhaId ? pcStatusChip(pcDraft.status) : ''}
                    </div>
                    <p class="text-xs mt-1" style="color:var(--sage)">Wizard de configuração e publicação da oferta.</p>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${pcCampanhaId ? `<button onclick="pcAbrirDesempenho()" class="px-3 py-2 rounded-xl text-xs font-bold border-2" style="border-color:var(--line)">📈 Desempenho</button>` : ''}
                    <button onclick="pcSalvar()" id="pc-btn-rascunho" class="px-3 py-2 rounded-xl text-xs font-bold text-white" style="background:var(--pine)">Salvar rascunho</button>
                </div>
            </div>
            <div class="flex items-center gap-2 mt-5 overflow-x-auto pb-1">
                ${pcPasso(1, 'Oferta')}<div class="w-6 border-t flex-none" style="border-color:var(--line)"></div>
                ${pcPasso(2, 'Condições')}<div class="w-6 border-t flex-none" style="border-color:var(--line)"></div>
                ${pcPasso(3, 'Público')}<div class="w-6 border-t flex-none" style="border-color:var(--line)"></div>
                ${pcPasso(4, 'Landing')}<div class="w-6 border-t flex-none" style="border-color:var(--line)"></div>
                ${pcPasso(5, 'Publicar')}
            </div>
            <div id="pc-step-body" class="mt-4"></div>
            <p id="pc-status" class="raiz-indicador-inline text-[11px] mt-2"></p>
        </div>
    `;
    pcRenderStepBody();
}

function pcRenderStepBody() {
    const b = document.getElementById('pc-step-body');
    if (pcStep === 1) b.innerHTML = pcStep1();
    if (pcStep === 2) b.innerHTML = pcStep2();
    if (pcStep === 3) b.innerHTML = pcStep3();
    if (pcStep === 4) { b.innerHTML = pcStep4(); pcAtualizarPreview(); }
    if (pcStep === 5) b.innerHTML = pcStep5();
}

function pcNavBotoes(voltar, avancar) {
    return `
        <div class="flex justify-between mt-5">
            ${voltar ? `<button onclick="pcSetStep(${voltar})" class="px-4 py-2 rounded-xl text-xs font-bold border-2" style="border-color:var(--line)">← Voltar</button>` : '<span></span>'}
            ${avancar ? `<button onclick="pcCampoParaDraft();pcSetStep(${avancar})" class="px-4 py-2 rounded-xl text-xs font-bold text-white" style="background:var(--pine)">Continuar →</button>` : ''}
        </div>
    `;
}

// Lê todos os inputs do passo atual de volta pro pcDraft antes de avançar
// (mais simples que um onchange por campo — o draft só precisa estar
// atualizado na hora de mudar de passo ou salvar).
function pcCampoParaDraft() {
    const g = id => document.getElementById(id);
    if (pcStep === 1) {
        pcDraft.nome = g('pc-nome')?.value.trim() || '';
        pcDraft.categoria = g('pc-categoria')?.value || 'trial';
        pcDraft.plano_codigo = g('pc-plano')?.value || '';
    }
    if (pcStep === 2) {
        pcDraft.inicio_vigencia = g('pc-inicio')?.value || '';
        pcDraft.fim_vigencia = g('pc-fim')?.value || '';
        pcDraft.duracao_tipo = g('pc-duracao-tipo')?.value || 'dias_fixos';
        pcDraft.duracao_dias = g('pc-duracao-dias')?.value || '';
        pcDraft.tempo_aviso_dias = g('pc-aviso')?.value || 3;
        pcDraft.pagamentos = Array.from(document.querySelectorAll('.pc-pgto-check:checked')).map(chk => chk.value);
    }
    if (pcStep === 3) {
        pcDraft.id_publico_oferta = g('pc-publico')?.value || '';
    }
    if (pcStep === 4) {
        pcDraft.landing.codigo_publico = g('pc-l-codigo')?.value.trim() || '';
        pcDraft.landing.titulo = g('pc-l-titulo')?.value.trim() || '';
        pcDraft.landing.subtitulo = g('pc-l-subtitulo')?.value.trim() || '';
        pcDraft.landing.cta_texto = g('pc-l-cta')?.value.trim() || 'Começar agora';
        pcDraft.landing.badge_texto = g('pc-l-badge')?.value.trim() || '';
        pcDraft.landing.ordem = Number(g('pc-l-ordem')?.value || 100);
        pcDraft.landing.destaque = !!g('pc-l-destaque')?.checked;
    }
}

// ----------------------------------------------------------------------------
// Etapa 1 — Oferta
// ----------------------------------------------------------------------------
function pcStep1() {
    const categoriaCompativel = pcDraft.categoria === 'trial' || pcDraft.categoria === 'cortesia';
    return `
        <div class="grid md:grid-cols-2 gap-3">
            <label class="text-xs font-bold" style="color:var(--ink)">Nome da campanha
                <input id="pc-nome" value="${pmEsc(pcDraft.nome)}" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
            </label>
            <label class="text-xs font-bold" style="color:var(--ink)">Categoria
                <select id="pc-categoria" onchange="pcCampoParaDraft();pcRenderStepBody()" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
                    ${['trial', 'cortesia', 'item', 'padrao'].map(v => `<option value="${v}" ${pcDraft.categoria === v ? 'selected' : ''}>${{ trial: 'Trial', cortesia: 'Cortesia', item: 'Item avulso', padrao: 'Padrão (venda normal)' }[v]}</option>`).join('')}
                </select>
            </label>
            <label class="text-xs font-bold" style="color:var(--ink)">Plano oferecido
                <select id="pc-plano" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
                    <option value="">— selecione —</option>
                    ${pmPlanos.filter(p => p.ativo).map(p => `<option value="${p.codigo}" ${pcDraft.plano_codigo === p.codigo ? 'selected' : ''}>${p.descricao}</option>`).join('')}
                </select>
                <span class="block text-[10px] mt-1 font-normal" style="color:var(--sage)">Usa planos.id_campanha (relação já existente) — ao salvar, este plano passa a apontar pra esta campanha.</span>
            </label>
            <label class="text-xs font-bold" style="color:var(--ink)">Status
                <input disabled value="${pcDraft.status || 'rascunho (será definido ao salvar)'}" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm bg-slate-50">
                <span class="block text-[10px] mt-1 font-normal" style="color:var(--sage)">Muda pra "publicada" só na etapa 5, depois de validar os requisitos.</span>
            </label>
        </div>
        ${!categoriaCompativel ? `
            <div class="p-3 rounded-xl mt-4" style="background:var(--warning-bg);color:var(--warning)">
                <b class="text-xs">Esta categoria não pode ser publicada ainda</b>
                <p class="text-xs mt-1">Nesta fase, a landing só suporta fluxo via trial — compra direta sem passar pelo trial ainda não existe. Você pode cadastrar como rascunho, mas a publicação (etapa 5) fica bloqueada pro tipo "${pcDraft.categoria === 'padrao' ? 'Padrão' : 'Item avulso'}" até existir checkout de verdade.</p>
            </div>
        ` : ''}
        ${pcNavBotoes(0, 2)}
    `;
}

// ----------------------------------------------------------------------------
// Etapa 2 — Condições comerciais
// ----------------------------------------------------------------------------
function pcStep2() {
    return `
        <div class="grid md:grid-cols-2 gap-3">
            <label class="text-xs font-bold" style="color:var(--ink)">Início de vigência
                <input type="date" id="pc-inicio" value="${pcDraft.inicio_vigencia}" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
            </label>
            <label class="text-xs font-bold" style="color:var(--ink)">Fim de vigência
                <input type="date" id="pc-fim" value="${pcDraft.fim_vigencia}" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
            </label>
            <label class="text-xs font-bold" style="color:var(--ink)">Duração da licença concedida
                <select id="pc-duracao-tipo" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
                    <option value="dias_fixos" ${pcDraft.duracao_tipo === 'dias_fixos' ? 'selected' : ''}>Dias fixos</option>
                    <option value="fim_do_mes" ${pcDraft.duracao_tipo === 'fim_do_mes' ? 'selected' : ''}>Até o fim do mês</option>
                    <option value="fim_do_ano" ${pcDraft.duracao_tipo === 'fim_do_ano' ? 'selected' : ''}>Até o fim do ano</option>
                </select>
            </label>
            <label class="text-xs font-bold" style="color:var(--ink)">Qtd. dias (se "dias fixos")
                <input type="number" min="0" id="pc-duracao-dias" value="${pcDraft.duracao_dias}" placeholder="ex.: 14" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
            </label>
            <label class="text-xs font-bold" style="color:var(--ink)">Avisar quantos dias antes de vencer
                <input type="number" min="0" id="pc-aviso" value="${pcDraft.tempo_aviso_dias}" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
            </label>
        </div>
        <div class="bg-slate-50 border-2 border-slate-300 rounded-xl p-3 mt-4">
            <div class="text-xs font-bold" style="color:var(--ink)">Opções de pagamento aceitas</div>
            <div class="grid md:grid-cols-2 gap-2 mt-2">
                ${pmPlanoPagamentos.map(p => `
                    <label class="bg-white border rounded-xl p-2.5 text-xs flex items-center gap-2">
                        <input type="checkbox" class="pc-pgto-check" value="${p.id}" ${pcDraft.pagamentos.includes(p.id) ? 'checked' : ''}>
                        <span style="color:var(--ink)">${p.nome} — ${Number(p.preco) === 0 ? '<b style="color:var(--success)">grátis</b>' : 'R$ ' + Number(p.preco).toFixed(2) + ' · ' + p.parcelas + 'x'}</span>
                        ${Number(p.preco) === 0 ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-none" style="background:var(--success-bg);color:var(--success)">GRÁTIS</span>` : ''}
                    </label>
                `).join('') || `<p class="text-xs" style="color:var(--sage)">Nenhuma opção cadastrada — cadastre em Catálogos Base → Pagamento primeiro.</p>`}
            </div>
            <p class="text-[10px] mt-2" style="color:var(--sage)"><b>Regra desta fase:</b> campanha de trial precisa ter a opção grátis (R$ 0, marcada acima) selecionada — é o que o cliente usa pra entrar no trial. Se também marcar opções pagas, elas ficam disponíveis pra ele ver os planos de upgrade durante o trial (só informativo por enquanto — a compra em si ainda não passa por aqui).</p>
        </div>
        ${pcNavBotoes(1, 3)}
    `;
}

// ----------------------------------------------------------------------------
// Etapa 3 — Público
// ----------------------------------------------------------------------------
function pcStep3() {
    return `
        <div class="grid md:grid-cols-2 gap-3">
            <label class="text-xs font-bold" style="color:var(--ink)">Público de oferta
                <select id="pc-publico" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
                    <option value="">Qualquer um (sem restrição)</option>
                    ${pmPublicoOferta.map(p => `<option value="${p.id}" ${pcDraft.id_publico_oferta === p.id ? 'selected' : ''}>${p.tipo_cliente}</option>`).join('')}
                </select>
                <span class="block text-[10px] mt-1 font-normal" style="color:var(--sage)">Cadastre novos tipos em Catálogos Base → Público de oferta.</span>
            </label>
        </div>
        <div class="p-3 rounded-xl mt-4" style="background:var(--info-bg)">
            <b class="text-xs" style="color:var(--info)">Regra desta fase</b>
            <p class="text-xs mt-1" style="color:var(--sage)">O único público em uso é "prospect" (empresa ainda não é cliente) — é o único caso possível hoje, já que a base ainda não tem cliente pagante. Campanhas voltadas a cliente existente (upsell, expansão) vão exigir identificação do cliente no fluxo — ficam pra mais adiante.</p>
        </div>
        ${pcNavBotoes(2, 4)}
    `;
}

// ----------------------------------------------------------------------------
// Etapa 4 — Landing (conteúdo público, sem HTML/JS)
// ----------------------------------------------------------------------------
function pcStep4() {
    return `
        <div class="grid xl:grid-cols-[1fr_360px] gap-4">
            <div class="space-y-3">
                <label class="text-xs font-bold block" style="color:var(--ink)">Código público / slug
                    <input id="pc-l-codigo" oninput="pcAtualizarPreview()" value="${pmEsc(pcDraft.landing.codigo_publico)}" placeholder="ex.: plus-lancamento-2026" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
                    <span class="block text-[10px] mt-1 font-normal" style="color:var(--sage)">Precisa ser único — é o identificador usado no UTM e na atribuição de trial/receita.</span>
                </label>
                <label class="text-xs font-bold block" style="color:var(--ink)">Título público
                    <input id="pc-l-titulo" oninput="pcAtualizarPreview()" value="${pmEsc(pcDraft.landing.titulo)}" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
                </label>
                <label class="text-xs font-bold block" style="color:var(--ink)">Subtítulo
                    <textarea id="pc-l-subtitulo" oninput="pcAtualizarPreview()" rows="2" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">${pmEsc(pcDraft.landing.subtitulo)}</textarea>
                </label>
                <div class="grid grid-cols-2 gap-3">
                    <label class="text-xs font-bold block" style="color:var(--ink)">CTA
                        <input id="pc-l-cta" oninput="pcAtualizarPreview()" value="${pmEsc(pcDraft.landing.cta_texto)}" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
                    </label>
                    <label class="text-xs font-bold block" style="color:var(--ink)">Ordem
                        <input type="number" id="pc-l-ordem" oninput="pcAtualizarPreview()" value="${pcDraft.landing.ordem}" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
                    </label>
                </div>
                <label class="text-xs font-bold block" style="color:var(--ink)">Badge (opcional)
                    <input id="pc-l-badge" oninput="pcAtualizarPreview()" value="${pmEsc(pcDraft.landing.badge_texto)}" placeholder="ex.: Oferta de lançamento" class="w-full mt-1 p-2.5 border rounded-xl font-normal text-sm">
                </label>
                <label class="flex items-center gap-2 text-xs font-bold" style="color:var(--ink)">
                    <input type="checkbox" id="pc-l-destaque" onchange="pcAtualizarPreview()" ${pcDraft.landing.destaque ? 'checked' : ''}> Destacar esta campanha (aparece primeiro se houver mais de uma ativa)
                </label>
                <div class="bg-slate-50 border-2 border-slate-300 rounded-xl p-3">
                    <b class="text-xs" style="color:var(--ink)">Contrato público</b>
                    <p class="text-[11px] mt-1" style="color:var(--sage)">A landing chama fn_ofertas_landing_ativas() — só título, subtítulo, CTA, plano comercial, duração e opções de pagamento públicas. Nunca expõe tabela comercial inteira. Sem HTML/JS salvo aqui de propósito.</p>
                </div>
            </div>
            <div>
                <div class="text-[10px] uppercase font-bold tracking-wide mb-2" style="color:var(--sage)">Preview (ilustrativo)</div>
                <div id="pc-preview" class="rounded-2xl border overflow-hidden" style="background:var(--paper);border-color:var(--line)"></div>
            </div>
        </div>
        ${pcNavBotoes(3, 5)}
    `;
}

function pcAtualizarPreview() {
    pcCampoParaDraft();
    const l = pcDraft.landing;
    const el = document.getElementById('pc-preview');
    if (!el) return;
    el.innerHTML = `
        <div class="px-4 py-3 border-b bg-white" style="border-color:var(--line)"><b class="text-sm">Raiz Patrimônio</b></div>
        <div class="p-5">
            ${l.badge_texto ? `<span class="text-[10px] font-bold px-2 py-1 rounded-full" style="background:var(--brass-light);color:var(--brass-deep)">${pmEsc(l.badge_texto)}</span>` : ''}
            <h3 class="text-xl font-extrabold mt-3" style="color:var(--ink)">${pmEsc(l.titulo) || 'Título da oferta'}</h3>
            <p class="text-sm mt-2" style="color:var(--sage)">${pmEsc(l.subtitulo) || 'Subtítulo da oferta.'}</p>
            <button class="w-full mt-4 py-3 rounded-full text-sm font-bold text-white" style="background:var(--pine)">${pmEsc(l.cta_texto) || 'Começar agora'}</button>
            <p class="text-[9px] text-center mt-2" style="color:var(--sage)">Preview ilustrativo — dados reais só depois de salvar.</p>
        </div>
    `;
}

// ----------------------------------------------------------------------------
// Etapa 5 — Revisar & Publicar
// ----------------------------------------------------------------------------
function pcCheck(label, ok) {
    return `<div class="flex items-center gap-3 p-3 border rounded-xl" style="border-color:var(--line)">
        <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-none" style="background:${ok ? 'var(--success-bg)' : 'var(--warning-bg)'};color:${ok ? 'var(--success)' : 'var(--warning)'}">${ok ? '✓' : '!'}</span>
        <span class="text-xs font-bold" style="color:var(--ink)">${label}</span>
    </div>`;
}

function pcValidacoes() {
    const hoje = new Date().toISOString().slice(0, 10);
    const planoObj = pmPlanos.find(p => p.codigo === pcDraft.plano_codigo);
    const vigenciaOk = !pcDraft.inicio_vigencia || !pcDraft.fim_vigencia || pcDraft.inicio_vigencia <= pcDraft.fim_vigencia;
    const dentroVigencia = (!pcDraft.inicio_vigencia || pcDraft.inicio_vigencia <= hoje) && (!pcDraft.fim_vigencia || pcDraft.fim_vigencia >= hoje);
    const categoriaCompativel = pcDraft.categoria === 'trial' || pcDraft.categoria === 'cortesia';
    const pagamentosSelecionados = pmPlanoPagamentos.filter(p => pcDraft.pagamentos.includes(p.id));
    const temOpcaoGratis = pagamentosSelecionados.some(p => Number(p.preco) === 0);
    const publicoObj = pmPublicoOferta.find(p => p.id === pcDraft.id_publico_oferta);
    const outraCampanhaAtiva = pmCampanhas.find(c => c.status === 'publicada' && c.id !== pcCampanhaId);

    return [
        { label: 'Categoria compatível com o fluxo atual (trial ou cortesia)', ok: categoriaCompativel },
        { label: 'Plano vinculado', ok: !!pcDraft.plano_codigo },
        { label: 'Plano está ativo', ok: !!planoObj?.ativo },
        { label: 'Vigência coerente (início ≤ fim)', ok: vigenciaOk },
        { label: 'Campanha dentro da vigência hoje', ok: dentroVigencia },
        { label: 'Tem ao menos 1 opção de pagamento marcada', ok: pcDraft.pagamentos.length > 0 },
        { label: pcDraft.categoria === 'trial' ? 'Inclui a opção grátis (R$ 0) — obrigatório pra trial' : 'Opção grátis (não obrigatório fora de trial)', ok: pcDraft.categoria === 'trial' ? temOpcaoGratis : true },
        { label: 'Público = prospect (única opção desta fase)', ok: publicoObj?.tipo_cliente === 'prospect' },
        { label: 'Conteúdo de landing preenchido (título + código público)', ok: !!(pcDraft.landing.titulo && pcDraft.landing.codigo_publico) },
        { label: outraCampanhaAtiva ? `Nenhuma outra campanha ativa (hoje: "${outraCampanhaAtiva.nome}" está publicada — pause-a antes)` : 'Nenhuma outra campanha ativa (regra: só 1 por vez)', ok: !outraCampanhaAtiva }
    ];
}

function pcStep5() {
    const checks = pcValidacoes();
    const tudoOk = checks.every(c => c.ok);
    return `
        <div class="flex justify-between">
            <div>
                <h3 class="font-extrabold text-sm" style="color:var(--ink)">5. Revisar &amp; Publicar</h3>
                <p class="text-xs mt-1" style="color:var(--sage)">Checklist antes de tornar a oferta pública.</p>
            </div>
        </div>
        <div class="space-y-2 mt-4">${checks.map(c => pcCheck(c.label, c.ok)).join('')}</div>
        ${!pcCampanhaId ? `<div class="p-3 rounded-xl mt-4" style="background:var(--warning-bg);color:var(--warning)"><b class="text-xs">Salve a campanha primeiro</b><p class="text-xs mt-1">Clique em "Salvar rascunho" no topo antes de publicar — a publicação precisa de um registro salvo.</p></div>` : ''}
        <div class="flex justify-between mt-5">
            <button onclick="pcSetStep(4)" class="px-4 py-2 rounded-xl text-xs font-bold border-2" style="border-color:var(--line)">← Voltar</button>
            <div class="flex gap-2">
                ${pcCampanhaId && pcDraft.status === 'publicada'
                    ? `<button onclick="pcPublicar(false)" class="px-4 py-2 rounded-xl text-xs font-bold text-white" style="background:var(--danger)">Pausar campanha</button>`
                    : `<button onclick="pcPublicar(true)" ${(!pcCampanhaId || !tudoOk) ? 'disabled' : ''} class="px-4 py-2 rounded-xl text-xs font-bold text-white" style="background:${tudoOk ? 'var(--brass)' : 'var(--sage)'}">Publicar campanha</button>`
                }
            </div>
        </div>
    `;
}

// ----------------------------------------------------------------------------
// Salvar rascunho (upsert campanha + plano vinculado + N pagamentos + landing)
// ----------------------------------------------------------------------------
async function pcSalvar() {
    pcCampoParaDraft();
    const status = document.getElementById('pc-status');
    if (!pcDraft.nome || !pcDraft.categoria || !pcDraft.duracao_tipo) {
        if (status) status.textContent = 'Preencha ao menos nome, categoria e duração (etapas 1 e 2).';
        pcSetStep(pcDraft.nome ? 2 : 1);
        return;
    }
    if (pcDraft.duracao_tipo === 'dias_fixos' && !pcDraft.duracao_dias) {
        if (status) status.textContent = 'Informe a quantidade de dias (etapa 2).';
        pcSetStep(2);
        return;
    }

    const payload = {
        nome: pcDraft.nome, categoria: pcDraft.categoria, duracao_tipo: pcDraft.duracao_tipo,
        duracao_dias: pcDraft.duracao_dias ? Number(pcDraft.duracao_dias) : null,
        tempo_aviso_dias: Number(pcDraft.tempo_aviso_dias) || 3,
        inicio_vigencia: pcDraft.inicio_vigencia || null, fim_vigencia: pcDraft.fim_vigencia || null,
        id_publico_oferta: pcDraft.id_publico_oferta || null
    };

    let campanhaId = pcCampanhaId;
    if (campanhaId) {
        const { error } = await dbAuth.schema('comercial').from('plano_campanhas').update(payload).eq('id', campanhaId);
        if (error) { if (status) status.textContent = 'Erro: ' + error.message; return; }
    } else {
        const { data, error } = await dbAuth.schema('comercial').from('plano_campanhas').insert(payload).select().single();
        if (error) { if (status) status.textContent = 'Erro: ' + error.message; return; }
        campanhaId = data.id;
    }

    // Plano vinculado: aponta o plano escolhido pra esta campanha, e
    // desvincula qualquer outro plano que apontasse pra ela antes (evita
    // duas linhas de public.planos com o mesmo id_campanha).
    if (pcDraft.plano_codigo) {
        await dbAuth.from('planos').update({ id_campanha: null }).eq('id_campanha', campanhaId).neq('codigo', pcDraft.plano_codigo);
        const { error: errPlano } = await dbAuth.from('planos').update({ id_campanha: campanhaId }).eq('codigo', pcDraft.plano_codigo);
        if (errPlano) { if (status) status.textContent = 'Campanha salva, mas erro ao vincular plano: ' + errPlano.message; return; }
    }

    // Substitui o conjunto de pagamentos por completo (mesmo padrão v0.7.0).
    const { error: errDel } = await dbAuth.schema('comercial').from('plano_campanhas_pagamentos').delete().eq('id_campanha', campanhaId);
    if (errDel) { if (status) status.textContent = 'Campanha salva, mas erro ao atualizar pagamentos: ' + errDel.message; return; }
    if (pcDraft.pagamentos.length > 0) {
        const linhas = pcDraft.pagamentos.map(idPgto => ({ id_campanha: campanhaId, id_plano_pagamento: idPgto }));
        const { error: errIns } = await dbAuth.schema('comercial').from('plano_campanhas_pagamentos').insert(linhas);
        if (errIns) { if (status) status.textContent = 'Campanha salva, mas erro ao vincular pagamentos: ' + errIns.message; return; }
    }

    // Landing (upsert por campanha_id — UNIQUE na tabela).
    if (pcDraft.landing.titulo || pcDraft.landing.codigo_publico) {
        if (!pcDraft.landing.codigo_publico || !pcDraft.landing.titulo) {
            if (status) status.textContent = 'Campanha salva. Pra salvar a landing, preencha código público E título (etapa 4).';
        } else {
            const landingPayload = { campanha_id: campanhaId, ...pcDraft.landing };
            const existente = pmCampanhaLanding.find(l => l.campanha_id === campanhaId);
            const { error: errLanding } = existente
                ? await dbAuth.schema('comercial').from('campanha_landing').update(landingPayload).eq('campanha_id', campanhaId)
                : await dbAuth.schema('comercial').from('campanha_landing').insert(landingPayload);
            if (errLanding) {
                const msg = errLanding.code === '23505' ? 'código público já usado por outra campanha — escolha outro.' : errLanding.message;
                if (status) status.textContent = 'Campanha salva, mas erro ao salvar landing: ' + msg;
                return;
            }
        }
    }

    pcCampanhaId = campanhaId;
    await pmCarregarTudo();
    pcRenderLista();
    const cp = pmCampanhas.find(x => x.id === campanhaId);
    if (cp) pcDraft.status = cp.status;
    if (status) status.textContent = 'Salvo.';
    document.querySelectorAll('.raiz-indicador-inline').forEach(p => { if (p.id === 'pc-status') setTimeout(() => { p.textContent = ''; }, 2500); });
}

async function pcPublicar(publicar) {
    if (!pcCampanhaId) { alert('Salve a campanha antes de publicar.'); return; }
    const { error } = await dbAuth.schema('gestao').rpc('fn_publicar_campanha', { p_campanha_id: pcCampanhaId, p_publicar: publicar });
    if (error) { alert((publicar ? 'Não foi possível publicar: ' : 'Não foi possível pausar: ') + error.message); return; }
    await pmCarregarTudo();
    pcRenderLista();
    const cp = pmCampanhas.find(x => x.id === pcCampanhaId);
    if (cp) pcDraft.status = cp.status;
    pcRenderWizard();
}

// ----------------------------------------------------------------------------
// Desempenho — atalho pra Comercial (a análise mora lá, não duplicamos aqui)
// ----------------------------------------------------------------------------
function pcAbrirDesempenho() {
    if (!pcCampanhaId) return;
    gestaoAbrirTela('comercial');
    setTimeout(() => { if (typeof comercialAbrirDesempenhoCampanha === 'function') comercialAbrirDesempenhoCampanha(pcCampanhaId); }, 150);
}
