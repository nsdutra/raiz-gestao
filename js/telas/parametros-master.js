// ============================================================================
// js/telas/parametros-master.js — Raiz Gestão
//
// v0.8.1 — ROUTER. Deixou de ser um conjunto de 6 sub-abas soltas e virou
// o roteador de 4 áreas (pacote de parametrização do prompt v0.8.1):
//   Campanhas & Landing → js/telas/parametros-campanhas.js (wizard)
//   Planos & Limites     → js/telas/parametros-planos.js (matriz)
//   Perfis & Acessos     → js/telas/parametros-perfis.js (matriz)
//   Catálogos Base       → aqui mesmo (Módulos/Funcionalidades/Pagamento/
//                           Categorias/Público de oferta — CRUDs simples,
//                           lógica idêntica à v0.7.0, só reorganizados sob
//                           uma segunda barra de abas)
//
// Estado (pmModulos, pmFuncionalidades, ...) e os helpers compartilhados
// (pmExcluir*, pmIconeEditar, pmEsc...) continuam TODOS aqui — os 3
// arquivos novos leem essas variáveis globais e chamam esses helpers, sem
// duplicar nada. pmCarregarTudo() cresceu pra também trazer perfis,
// perfil_funcionalidade, publico_oferta e campanha_landing.
//
// O QUE SAIU DAQUI (não foi apagado, foi PARA os arquivos novos):
//   - Planos deixou de ser lista com "abrir detalhe" — virou matriz em
//     parametros-planos.js. pmToggleVinculo/pmAtualizarLimite (v0.7.0)
//     foram adaptados pra lá (mesma lógica de insert/update/delete em
//     plano_funcionalidade, agora acionada por célula da matriz).
//   - Campanhas deixou de ser CRUD isolado — virou wizard de 5 etapas em
//     parametros-campanhas.js. pmSalvarCampanha (v0.7.0) foi adaptado
//     pra lá (mesmo padrão de upsert + substituir N pagamentos por
//     completo), com as etapas novas (público, landing, publicar).
//
// O QUE FICOU/ENTROU em Catálogos Base:
//   Módulos, Funcionalidades, Pagamento, Categorias — sem NENHUMA mudança
//   de lógica (copiados 1:1 da v0.7.0). Público de oferta é NOVO (não
//   existia CRUD nenhum pra comercial.publico_oferta até aqui).
// ============================================================================

let pmModulos = [];
let pmFuncionalidades = [];
let pmPlanos = [];
let pmFormasPagamento = [];
let pmPlanoPagamentos = [];
let pmCampanhas = [];
let pmCampanhaPagamentos = [];   // linhas da tabela de junção comercial.plano_campanhas_pagamentos
let pmCategorias = [];
let pmPublicoOferta = [];        // NOVO v0.8.1 — comercial.publico_oferta
let pmPerfis = [];                // NOVO v0.8.1 — public.perfis
let pmPerfilFuncionalidade = []; // NOVO v0.8.1 — public.perfil_funcionalidade
let pmCampanhaLanding = [];      // NOVO v0.8.1 — comercial.campanha_landing
let pmPlanoFuncionalidade = [];  // NOVO v0.8.1 — public.plano_funcionalidade (linha completa, pra matriz)

// Estado de edição (null = criando um novo; preenchido = editando o
// registro com essa chave). Um por sub-aba, pra formulários independentes.
let pmModuloEditCodigo = null;
let pmFuncEditCodigo = null;
let pmPlanoEditCodigo = null;
let pmFormaEditId = null;
let pmPlanoPgtoEditId = null;
let pmCategoriaEditId = null;
let pmPublicoEditId = null; // NOVO v0.8.1

const PM_FORMAS_PGTO = { pix: 'Pix', cc: 'Cartão de crédito', debito: 'Cartão de débito', boleto: 'Boleto' };

// Valores de tipo_cliente sugeridos pro select de Público. Regra desta
// fase (definida em 19/08/2026): só existe "prospect" (empresa ainda não
// é cliente) — é o único caso possível hoje porque a base ainda não tem
// clientes pagantes. Campanhas voltadas a cliente existente (upsell,
// expansão) ficam pra quando existir identificação de cliente no fluxo —
// por isso os outros valores ficam só como sugestão futura, não como
// padrão.
const PM_TIPO_CLIENTE_SUGERIDOS = ['prospect', 'cliente_existente', 'todos'];

// ----------------------------------------------------------------------------
// Entrada da tela — router das 4 áreas
// ----------------------------------------------------------------------------
const PM_AREAS = [
    { id: 'comercial', label: 'Comercial', init: () => parametrosComercialInit() },
    { id: 'planos', label: 'Planos & Limites', init: () => parametrosPlanosInit() },
    { id: 'catalogos', label: 'Catálogo & Acessos', init: () => pmRenderCatalogos() }
];

async function telaParametrosMasterInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="flex gap-2 mb-5 border-b overflow-x-auto" style="border-color:var(--line)">
            ${PM_AREAS.map(a => `<button onclick="pmAbrirArea('${a.id}')" id="pm-area-${a.id}" class="pm-subaba px-4 py-2.5 text-sm font-bold whitespace-nowrap">${a.label}</button>`).join('')}
        </div>
        <div id="pm-conteudo-area"></div>
    `;
    const ok = await pmCarregarTudo();
    if (ok) pmAbrirArea('comercial');
}

function pmAbrirArea(nome) {
    document.querySelectorAll('.pm-subaba').forEach(b => {
        b.style.color = 'var(--sage)';
        b.style.borderBottom = 'none';
    });
    const ativa = document.getElementById('pm-area-' + nome);
    ativa.style.color = 'var(--pine)';
    ativa.style.borderBottom = '3px solid var(--brass)';

    const area = PM_AREAS.find(a => a.id === nome);
    if (area) area.init();
}

async function pmCarregarTudo() {
    const [
        { data: modulos, error: e1 }, { data: func, error: e2 }, { data: planos, error: e3 },
        { data: formasPgto, error: e4 }, { data: planoPgtos, error: e5 }, { data: campanhas, error: e6 },
        { data: campPgtos, error: e7 }, { data: categorias, error: e8 },
        { data: publico, error: e9 }, { data: perfis, error: e10 }, { data: perfilFunc, error: e11 },
        { data: campLanding, error: e12 }, { data: planoFunc, error: e13 }
    ] = await Promise.all([
        dbAuth.schema('comercial').from('tipo_modulos').select('*').order('nome'),
        dbAuth.from('funcionalidades').select('*').order('area').order('codigo'),
        dbAuth.from('planos').select('*').order('modulo').order('codigo'),
        dbAuth.schema('comercial').from('forma_pagamento').select('*'),
        dbAuth.schema('comercial').from('plano_pagamentos').select('*').order('nome'),
        dbAuth.schema('comercial').from('plano_campanhas').select('*').order('nome'),
        dbAuth.schema('comercial').from('plano_campanhas_pagamentos').select('*'),
        dbAuth.schema('comercial').from('categoria_licenca').select('*').order('nome'),
        dbAuth.schema('comercial').from('publico_oferta').select('*'),
        dbAuth.from('perfis').select('*').order('codigo'),
        dbAuth.from('perfil_funcionalidade').select('*'),
        dbAuth.schema('comercial').from('campanha_landing').select('*'),
        dbAuth.from('plano_funcionalidade').select('*')
    ]);

    const erros = {
        'Módulos': e1, 'Funcionalidades': e2, 'Planos': e3, 'Formas de pagamento': e4,
        'Pagamentos de plano': e5, 'Campanhas': e6, 'Vínculo campanha×pagamento': e7, 'Categorias': e8,
        'Público de oferta': e9, 'Perfis': e10, 'Perfil×funcionalidade': e11, 'Landing de campanha': e12,
        'Plano×funcionalidade': e13
    };
    for (const [nome, err] of Object.entries(erros)) {
        if (err) { pmErro(nome + ': ' + err.message); return false; }
    }

    pmModulos = modulos || [];
    pmFuncionalidades = func || [];
    pmPlanos = planos || [];
    pmFormasPagamento = formasPgto || [];
    pmPlanoPagamentos = planoPgtos || [];
    pmCampanhas = campanhas || [];
    pmCampanhaPagamentos = campPgtos || [];
    pmCategorias = categorias || [];
    pmPublicoOferta = publico || [];
    pmPerfis = perfis || [];
    pmPerfilFuncionalidade = perfilFunc || [];
    pmCampanhaLanding = campLanding || [];
    pmPlanoFuncionalidade = planoFunc || [];
    return true;
}

function pmErro(msg) {
    document.getElementById('area-conteudo').innerHTML =
        `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)">
            <strong>Não foi possível carregar:</strong> ${msg}
            <br><span class="text-xs">Confira se gestao_fase3_campanhas_landing_v1.sql já foi rodado (schema/tabela/colunas novas) e se "gestao"/"comercial" estão em Settings → API → Exposed schemas.</span>
        </div>`;
}

// ============================================================================
// CATÁLOGOS BASE — segunda barra de abas dentro da área.
// Módulos/Funcionalidades/Pagamento/Categorias: lógica idêntica à v0.7.0.
// Público de oferta: NOVO.
// ============================================================================

const PM_CATALOGOS = [
    { id: 'modulos', label: 'Módulos', init: () => pmRenderModulos() },
    { id: 'funcionalidades', label: 'Funcionalidades', init: () => pmRenderFuncionalidades() },
    { id: 'pagamento', label: 'Pagamento', init: () => pmRenderPagamento() },
    { id: 'categorias', label: 'Categorias', init: () => pmRenderCategorias() },
    { id: 'publico', label: 'Público de oferta', init: () => pmRenderPublico() },
    { id: 'perfis', label: 'Perfis & Acessos', init: () => parametrosPerfisInit() }
];

function pmRenderCatalogos() {
    const c = document.getElementById('pm-conteudo-area');
    c.innerHTML = `
        <p class="text-xs mb-3" style="color:var(--sage)">Cadastros técnicos que alimentam campanhas, planos e acessos.</p>
        <div class="flex gap-2 mb-4 border-b overflow-x-auto" style="border-color:var(--line)">
            ${PM_CATALOGOS.map(cat => `<button onclick="pmMudarCatalogo('${cat.id}')" id="pm-cat-tab-${cat.id}" class="pm-subaba px-3.5 py-2 text-xs font-bold whitespace-nowrap">${cat.label}</button>`).join('')}
        </div>
        <div id="pm-conteudo-subaba"></div>
    `;
    pmMudarCatalogo('modulos');
}

function pmMudarCatalogo(nome) {
    document.querySelectorAll('[id^="pm-cat-tab-"]').forEach(b => {
        b.style.color = 'var(--sage)';
        b.style.borderBottom = 'none';
    });
    const ativa = document.getElementById('pm-cat-tab-' + nome);
    ativa.style.color = 'var(--pine)';
    ativa.style.borderBottom = '3px solid var(--brass)';
    const cat = PM_CATALOGOS.find(x => x.id === nome);
    if (cat) cat.init();
}

// ============================================================================
// CATÁLOGO: MÓDULOS (idêntico à v0.7.0)
// ============================================================================

function pmRenderModulos() {
    const c = document.getElementById('pm-conteudo-subaba');
    pmModuloEditCodigo = null;
    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Catálogo de módulos do sistema (Imóveis, Contratos, Gestão...)</p>
            ${pmBotaoToggle('modulo-form', "pmAbrirNovoModulo()")}
        </div>
        <div id="form-modulo-form-wrapper" class="hidden mb-4">${pmFormModulo()}</div>
        <div class="space-y-2">
            ${pmModulos.map(m => `
                <div class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border-2 border-slate-300 cursor-pointer" onclick="pmAbrirEdicaoModulo('${m.codigo}')">
                    <div>
                        <p class="text-sm font-bold" style="color:var(--ink)">${m.nome}</p>
                        <p class="text-xs" style="color:var(--sage)">código: ${m.codigo}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${pmIconeEditar()}
                        <button onclick="event.stopPropagation();pmExcluirModulo('${m.codigo}','${pmEsc(m.nome)}')" title="Excluir">${pmIconeExcluir()}</button>
                    </div>
                </div>
            `).join('') || pmVazio('Nenhum módulo cadastrado ainda.')}
        </div>
    `;
}

function pmFormModulo() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Código <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-modulo-codigo" required placeholder="ex.: raiz_agro" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Nome <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-modulo-nome" required placeholder="ex.: Raiz Agro" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <button onclick="pmSalvarModulo()" id="pm-modulo-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar módulo</button>
            <p id="pm-modulo-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAbrirNovoModulo() {
    pmModuloEditCodigo = null;
    const wrapper = document.getElementById('form-modulo-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pm-modulo-codigo').disabled = false;
    document.getElementById('pm-modulo-codigo').value = '';
    document.getElementById('pm-modulo-nome').value = '';
    document.getElementById('pm-modulo-btn-salvar').textContent = 'Salvar módulo';
}

function pmAbrirEdicaoModulo(codigo) {
    const m = pmModulos.find(x => x.codigo === codigo);
    if (!m) return;
    pmModuloEditCodigo = codigo;
    const wrapper = document.getElementById('form-modulo-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pm-modulo-codigo').value = m.codigo;
    document.getElementById('pm-modulo-codigo').disabled = true;
    document.getElementById('pm-modulo-nome').value = m.nome;
    document.getElementById('pm-modulo-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pmSalvarModulo() {
    const codigo = document.getElementById('pm-modulo-codigo').value.trim();
    const nome = document.getElementById('pm-modulo-nome').value.trim();
    const status = document.getElementById('pm-modulo-status');
    if (!codigo || !nome) { status.textContent = 'Preencha código e nome.'; return; }

    const { error } = pmModuloEditCodigo
        ? await dbAuth.schema('comercial').from('tipo_modulos').update({ nome }).eq('codigo', pmModuloEditCodigo)
        : await dbAuth.schema('comercial').from('tipo_modulos').insert({ codigo, nome });

    if (error) { status.textContent = 'Erro: ' + error.message; return; }
    await pmCarregarTudo();
    pmRenderModulos();
}


// ============================================================================
// CATÁLOGO: FUNCIONALIDADES (idêntico à v0.7.0)
// ============================================================================

function pmRenderFuncionalidades() {
    const c = document.getElementById('pm-conteudo-subaba');
    pmFuncEditCodigo = null;

    const porModulo = {};
    pmFuncionalidades.forEach(f => {
        const chave = f.tipo_modulo_id || '__sem_modulo__';
        (porModulo[chave] = porModulo[chave] || []).push(f);
    });
    const nomeModulo = (id) => id === '__sem_modulo__' ? 'Sem módulo definido' : (pmModulos.find(m => m.id === id)?.nome || '(módulo removido)');

    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Toda ação/tela que pode ser ligada a um plano ou perfil</p>
            ${pmBotaoToggle('func-form', "pmAbrirNovaFuncionalidade()")}
        </div>
        <div id="form-func-form-wrapper" class="hidden mb-4">${pmFormFuncionalidade()}</div>
        ${Object.keys(porModulo).sort((a, b) => nomeModulo(a).localeCompare(nomeModulo(b))).map(chave => `
            <p class="text-[10px] font-bold uppercase tracking-wide mt-4 mb-1.5" style="color:var(--sage)">${nomeModulo(chave)}</p>
            <div class="space-y-1.5">
                ${porModulo[chave].map(f => `
                    <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300 cursor-pointer" onclick="pmAbrirEdicaoFuncionalidade('${f.codigo}')">
                        <div class="min-w-0 flex-1 pr-2">
                            <p class="text-sm font-medium truncate" style="color:var(--ink)">${f.codigo}</p>
                            <p class="text-xs truncate" style="color:var(--sage)">${f.descricao}</p>
                        </div>
                        <div class="flex items-center gap-2 flex-none">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${f.ativo ? 'var(--success-bg)' : 'var(--danger-bg)'};color:${f.ativo ? 'var(--success)' : 'var(--danger)'}">${f.ativo ? 'ativo' : 'inativo'}</span>
                            ${pmIconeEditar()}
                            <button onclick="event.stopPropagation();pmExcluirFuncionalidade('${f.codigo}','${pmEsc(f.codigo)}')" title="Excluir">${pmIconeExcluir()}</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `).join('') || pmVazio('Nenhuma funcionalidade cadastrada ainda.')}
    `;
}

function pmFormFuncionalidade() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Código <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-func-codigo" required placeholder="ex.: imoveis.criar" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Módulo</label>
                <select id="pm-func-modulo" class="w-full p-2 border rounded mt-1 text-sm">
                    <option value="">— sem módulo definido —</option>
                    ${pmModulos.map(m => `<option value="${m.id}">${m.nome}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Área <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-func-area" required placeholder="ex.: imoveis" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Descrição <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-func-descricao" required class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" id="pm-func-ativo" checked>
                <span style="color:var(--ink)">Ativa</span>
            </label>
            <button onclick="pmSalvarFuncionalidade()" id="pm-func-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar funcionalidade</button>
            <p id="pm-func-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAbrirNovaFuncionalidade() {
    pmFuncEditCodigo = null;
    document.getElementById('form-func-form-wrapper').classList.remove('hidden');
    document.getElementById('pm-func-codigo').disabled = false;
    document.getElementById('pm-func-codigo').value = '';
    document.getElementById('pm-func-modulo').value = '';
    document.getElementById('pm-func-area').value = '';
    document.getElementById('pm-func-descricao').value = '';
    document.getElementById('pm-func-ativo').checked = true;
    document.getElementById('pm-func-btn-salvar').textContent = 'Salvar funcionalidade';
}

function pmAbrirEdicaoFuncionalidade(codigo) {
    const f = pmFuncionalidades.find(x => x.codigo === codigo);
    if (!f) return;
    pmFuncEditCodigo = codigo;
    const wrapper = document.getElementById('form-func-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pm-func-codigo').value = f.codigo;
    document.getElementById('pm-func-codigo').disabled = true;
    document.getElementById('pm-func-modulo').value = f.tipo_modulo_id || '';
    document.getElementById('pm-func-area').value = f.area || '';
    document.getElementById('pm-func-descricao').value = f.descricao || '';
    document.getElementById('pm-func-ativo').checked = !!f.ativo;
    document.getElementById('pm-func-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pmSalvarFuncionalidade() {
    const codigo = document.getElementById('pm-func-codigo').value.trim();
    const tipo_modulo_id = document.getElementById('pm-func-modulo').value || null;
    const area = document.getElementById('pm-func-area').value.trim();
    const descricao = document.getElementById('pm-func-descricao').value.trim();
    const ativo = document.getElementById('pm-func-ativo').checked;
    const status = document.getElementById('pm-func-status');
    if (!codigo || !area || !descricao) { status.textContent = 'Preencha código, área e descrição.'; return; }

    const payload = { area, descricao, ativo, tipo_modulo_id };
    const { error } = pmFuncEditCodigo
        ? await dbAuth.from('funcionalidades').update(payload).eq('codigo', pmFuncEditCodigo)
        : await dbAuth.from('funcionalidades').insert({ codigo, ...payload });

    if (error) { status.textContent = 'Erro: ' + error.message; return; }
    await pmCarregarTudo();
    pmRenderFuncionalidades();
}


// ============================================================================
// CATÁLOGO: PAGAMENTO (idêntico à v0.7.0 — formas + opções de pagamento)
// ============================================================================

function pmRenderPagamento() {
    const c = document.getElementById('pm-conteudo-subaba');
    pmFormaEditId = null;
    pmPlanoPgtoEditId = null;

    c.innerHTML = `
        <p class="text-[10px] font-bold uppercase tracking-wide mb-1.5" style="color:var(--sage)">Formas de pagamento</p>
        <div class="flex items-center justify-between mb-2">
            <p class="text-xs" style="color:var(--sage)">Pix, cartão, boleto — e o ajuste percentual de cada uma sobre o preço</p>
            ${pmBotaoToggle('forma-form', "pmAbrirNovaForma()")}
        </div>
        <div id="form-forma-form-wrapper" class="hidden mb-4">${pmFormForma()}</div>
        <div class="space-y-1.5 mb-6">
            ${pmFormasPagamento.map(f => `
                <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300 cursor-pointer" onclick="pmAbrirEdicaoForma('${f.id}')">
                    <span class="text-sm font-medium" style="color:var(--ink)">${pmLabelFormaPgto(f.tipo_forma_pgto)}</span>
                    <div class="flex items-center gap-2">
                        <span class="text-xs" style="color:var(--sage)">${pmFormatAjuste(f.ajuste)}</span>
                        ${pmIconeEditar()}
                        <button onclick="event.stopPropagation();pmExcluirForma('${f.id}','${pmEsc(pmLabelFormaPgto(f.tipo_forma_pgto))}')" title="Excluir">${pmIconeExcluir()}</button>
                    </div>
                </div>
            `).join('') || pmVazio('Nenhuma forma de pagamento cadastrada.')}
        </div>

        <p class="text-[10px] font-bold uppercase tracking-wide mb-1.5 mt-4" style="color:var(--sage)">Opções de pagamento (preço + parcelas)</p>
        <div class="flex items-center justify-between mb-2">
            <p class="text-xs" style="color:var(--sage)">Combinações concretas de preço, forma e parcelamento, usadas pelas campanhas</p>
            ${pmBotaoToggle('planopgto-form', "pmAbrirNovoPlanoPagamento()")}
        </div>
        <div id="form-planopgto-form-wrapper" class="hidden mb-4">${pmFormPlanoPagamento()}</div>
        <div class="space-y-1.5">
            ${pmPlanoPagamentos.map(p => `
                <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300 cursor-pointer" onclick="pmAbrirEdicaoPlanoPagamento('${p.id}')">
                    <div>
                        <p class="text-sm font-medium" style="color:var(--ink)">${p.nome}</p>
                        <p class="text-xs" style="color:var(--sage)">R$ ${Number(p.preco).toFixed(2)} · ${p.parcelas}x</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${pmIconeEditar()}
                        <button onclick="event.stopPropagation();pmExcluirPlanoPagamento('${p.id}','${pmEsc(p.nome)}')" title="Excluir">${pmIconeExcluir()}</button>
                    </div>
                </div>
            `).join('') || pmVazio('Nenhuma opção de pagamento cadastrada.')}
        </div>
    `;
}

function pmLabelFormaPgto(tipo) { return PM_FORMAS_PGTO[tipo] || tipo; }

function pmFormatAjuste(ajuste) {
    if (!ajuste) return 'sem ajuste';
    const pct = (ajuste * 100).toFixed(2);
    return (ajuste > 0 ? '+' : '') + pct + '%';
}

function pmFormForma() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Tipo <span style="color:var(--danger)">*</span></label>
                <select id="pm-forma-tipo" required class="w-full p-2 border rounded mt-1 text-sm">
                    ${Object.entries(PM_FORMAS_PGTO).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
                </select>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Ajuste</label>
                    <select id="pm-forma-sinal" class="w-full p-2 border rounded mt-1 text-sm">
                        <option value="1">Acréscimo (+)</option>
                        <option value="-1">Desconto (−)</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">% sobre o preço</label>
                    <input type="number" step="0.01" min="0" id="pm-forma-ajuste" placeholder="ex.: 3.5" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
            </div>
            <p class="text-[10px]" style="color:var(--sage)">Selecionar "Desconto" resolve o problema do teclado do celular não ter a tecla de menos — o sinal é escolhido aqui, você só digita o número positivo.</p>
            <button onclick="pmSalvarForma()" id="pm-forma-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar forma de pagamento</button>
            <p id="pm-forma-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAbrirNovaForma() {
    pmFormaEditId = null;
    document.getElementById('form-forma-form-wrapper').classList.remove('hidden');
    document.getElementById('pm-forma-tipo').disabled = false;
    document.getElementById('pm-forma-tipo').value = 'pix';
    document.getElementById('pm-forma-sinal').value = '1';
    document.getElementById('pm-forma-ajuste').value = '';
    document.getElementById('pm-forma-btn-salvar').textContent = 'Salvar forma de pagamento';
}

function pmAbrirEdicaoForma(id) {
    const f = pmFormasPagamento.find(x => x.id === id);
    if (!f) return;
    pmFormaEditId = id;
    const wrapper = document.getElementById('form-forma-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pm-forma-tipo').value = f.tipo_forma_pgto;
    document.getElementById('pm-forma-sinal').value = (f.ajuste || 0) < 0 ? '-1' : '1';
    document.getElementById('pm-forma-ajuste').value = f.ajuste ? Math.abs(f.ajuste * 100).toFixed(2) : '';
    document.getElementById('pm-forma-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pmSalvarForma() {
    const tipo_forma_pgto = document.getElementById('pm-forma-tipo').value;
    const sinal = Number(document.getElementById('pm-forma-sinal').value);
    const magnitude = document.getElementById('pm-forma-ajuste').value;
    const status = document.getElementById('pm-forma-status');
    const ajuste = magnitude === '' ? 0 : sinal * (Number(magnitude) / 100);

    const { error } = pmFormaEditId
        ? await dbAuth.schema('comercial').from('forma_pagamento').update({ tipo_forma_pgto, ajuste }).eq('id', pmFormaEditId)
        : await dbAuth.schema('comercial').from('forma_pagamento').insert({ tipo_forma_pgto, ajuste });

    if (error) { status.textContent = 'Erro: ' + error.message; return; }
    await pmCarregarTudo();
    pmRenderPagamento();
}

function pmFormPlanoPagamento() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Nome <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-planopgto-nome" required placeholder="ex.: Anual à vista Pix" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Preço (R$) <span style="color:var(--danger)">*</span></label>
                    <input type="number" step="0.01" min="0" id="pm-planopgto-preco" required class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Parcelas</label>
                    <input type="number" min="1" value="1" id="pm-planopgto-parcelas" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Forma de pagamento <span style="color:var(--danger)">*</span></label>
                <select id="pm-planopgto-forma" required class="w-full p-2 border rounded mt-1 text-sm">
                    ${pmFormasPagamento.map(f => `<option value="${f.id}">${pmLabelFormaPgto(f.tipo_forma_pgto)}</option>`).join('')}
                </select>
            </div>
            <button onclick="pmSalvarPlanoPagamento()" id="pm-planopgto-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar opção de pagamento</button>
            <p id="pm-planopgto-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAbrirNovoPlanoPagamento() {
    pmPlanoPgtoEditId = null;
    document.getElementById('form-planopgto-form-wrapper').classList.remove('hidden');
    document.getElementById('pm-planopgto-nome').value = '';
    document.getElementById('pm-planopgto-preco').value = '';
    document.getElementById('pm-planopgto-parcelas').value = 1;
    document.getElementById('pm-planopgto-btn-salvar').textContent = 'Salvar opção de pagamento';
}

function pmAbrirEdicaoPlanoPagamento(id) {
    const p = pmPlanoPagamentos.find(x => x.id === id);
    if (!p) return;
    pmPlanoPgtoEditId = id;
    const wrapper = document.getElementById('form-planopgto-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pm-planopgto-nome').value = p.nome;
    document.getElementById('pm-planopgto-preco').value = p.preco;
    document.getElementById('pm-planopgto-parcelas').value = p.parcelas;
    document.getElementById('pm-planopgto-forma').value = p.id_forma_pagamento;
    document.getElementById('pm-planopgto-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pmSalvarPlanoPagamento() {
    const nome = document.getElementById('pm-planopgto-nome').value.trim();
    const preco = document.getElementById('pm-planopgto-preco').value;
    const parcelas = document.getElementById('pm-planopgto-parcelas').value || 1;
    const id_forma_pagamento = document.getElementById('pm-planopgto-forma').value;
    const status = document.getElementById('pm-planopgto-status');
    if (!nome || !preco || !id_forma_pagamento) { status.textContent = 'Preencha nome, preço e forma de pagamento.'; return; }

    const payload = { nome, preco: Number(preco), parcelas: Number(parcelas), id_forma_pagamento };
    const { error } = pmPlanoPgtoEditId
        ? await dbAuth.schema('comercial').from('plano_pagamentos').update(payload).eq('id', pmPlanoPgtoEditId)
        : await dbAuth.schema('comercial').from('plano_pagamentos').insert(payload);

    if (error) { status.textContent = 'Erro: ' + error.message; return; }
    await pmCarregarTudo();
    pmRenderPagamento();
}


// ============================================================================
// CATÁLOGO: CATEGORIAS DE LICENÇA (idêntico à v0.7.0)
// ============================================================================

function pmRenderCategorias() {
    const c = document.getElementById('pm-conteudo-subaba');
    pmCategoriaEditId = null;
    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Como cada tipo de limite se comporta (o que conta, e quando reseta)</p>
            ${pmBotaoToggle('categoria-form', "pmAbrirNovaCategoria()")}
        </div>
        <div id="form-categoria-form-wrapper" class="hidden mb-4">${pmFormCategoria()}</div>
        <div class="space-y-1.5">
            ${pmCategorias.map(cat => `
                <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300 cursor-pointer" onclick="pmAbrirEdicaoCategoria('${cat.id_categoria_licenca}')">
                    <div>
                        <p class="text-sm font-medium" style="color:var(--ink)">${cat.nome}</p>
                        <p class="text-xs" style="color:var(--sage)">${cat.item} · reseta: ${cat.tipo_reset}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${pmIconeEditar()}
                        <button onclick="event.stopPropagation();pmExcluirCategoria('${cat.id_categoria_licenca}','${pmEsc(cat.nome)}')" title="Excluir">${pmIconeExcluir()}</button>
                    </div>
                </div>
            `).join('') || pmVazio('Nenhuma categoria cadastrada ainda.')}
        </div>
    `;
}

function pmFormCategoria() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Nome <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-cat-nome" required placeholder="ex.: Itens processados" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Item (código técnico) <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-cat-item" required placeholder="ex.: itens_processados" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Quando reseta <span style="color:var(--danger)">*</span></label>
                <select id="pm-cat-reset" required class="w-full p-2 border rounded mt-1 text-sm">
                    <option value="mensal">Mensal</option>
                    <option value="anual">Anual</option>
                    <option value="transacao">Por transação</option>
                    <option value="nunca">Nunca (custódia)</option>
                </select>
            </div>
            <button onclick="pmSalvarCategoria()" id="pm-cat-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar categoria</button>
            <p id="pm-cat-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAbrirNovaCategoria() {
    pmCategoriaEditId = null;
    document.getElementById('form-categoria-form-wrapper').classList.remove('hidden');
    document.getElementById('pm-cat-nome').value = '';
    document.getElementById('pm-cat-item').value = '';
    document.getElementById('pm-cat-reset').value = 'mensal';
    document.getElementById('pm-cat-btn-salvar').textContent = 'Salvar categoria';
}

function pmAbrirEdicaoCategoria(id) {
    const cat = pmCategorias.find(x => x.id_categoria_licenca === id);
    if (!cat) return;
    pmCategoriaEditId = id;
    const wrapper = document.getElementById('form-categoria-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pm-cat-nome').value = cat.nome;
    document.getElementById('pm-cat-item').value = cat.item;
    document.getElementById('pm-cat-reset').value = cat.tipo_reset;
    document.getElementById('pm-cat-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pmSalvarCategoria() {
    const nome = document.getElementById('pm-cat-nome').value.trim();
    const item = document.getElementById('pm-cat-item').value.trim();
    const tipo_reset = document.getElementById('pm-cat-reset').value;
    const status = document.getElementById('pm-cat-status');
    if (!nome || !item) { status.textContent = 'Preencha nome e item.'; return; }

    const payload = { nome, item, tipo_reset };
    const { error } = pmCategoriaEditId
        ? await dbAuth.schema('comercial').from('categoria_licenca').update(payload).eq('id_categoria_licenca', pmCategoriaEditId)
        : await dbAuth.schema('comercial').from('categoria_licenca').insert(payload);

    if (error) { status.textContent = 'Erro: ' + error.message; return; }
    await pmCarregarTudo();
    pmRenderCategorias();
}


// ============================================================================
// CATÁLOGO: PÚBLICO DE OFERTA — NOVO v0.8.1
// comercial.publico_oferta hoje é mínimo (tipo_cliente + id_campanha
// opcional). Não construímos motor de segmentação — só o cadastro do
// tipo_cliente, exatamente como o prompt pede pra esta rodada.
// ============================================================================

function pmOpcoesTipoCliente() {
    // Sugestões do prompt + qualquer valor que já exista no banco (não
    // sobrescreve dado real por uma lista fixa).
    const existentes = pmPublicoOferta.map(p => p.tipo_cliente).filter(Boolean);
    const todos = Array.from(new Set([...PM_TIPO_CLIENTE_SUGERIDOS, ...existentes]));
    return todos;
}

function pmRenderPublico() {
    const c = document.getElementById('pm-conteudo-subaba');
    pmPublicoEditId = null;
    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Quem pode ver/usar uma campanha — hoje é só tipo de cliente (regra simples, sem motor de segmentação)</p>
            ${pmBotaoToggle('publico-form', "pmAbrirNovoPublico()")}
        </div>
        <div id="form-publico-form-wrapper" class="hidden mb-4">${pmFormPublico()}</div>
        <div class="space-y-1.5">
            ${pmPublicoOferta.map(p => {
                const campanha = pmCampanhas.find(c2 => c2.id === p.id_campanha);
                return `
                <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300 cursor-pointer" onclick="pmAbrirEdicaoPublico('${p.id}')">
                    <div>
                        <p class="text-sm font-medium" style="color:var(--ink)">${p.tipo_cliente}</p>
                        <p class="text-xs" style="color:var(--sage)">${campanha ? 'usado em: ' + campanha.nome : 'não vinculado a nenhuma campanha ainda'}</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${pmIconeEditar()}
                        <button onclick="event.stopPropagation();pmExcluirPublico('${p.id}','${pmEsc(p.tipo_cliente)}')" title="Excluir">${pmIconeExcluir()}</button>
                    </div>
                </div>
            `; }).join('') || pmVazio('Nenhum público cadastrado ainda.')}
        </div>
    `;
}

function pmFormPublico() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Tipo de cliente <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-publico-tipo" required list="pm-publico-sugestoes" placeholder="ex.: novo_cliente" class="w-full p-2 border rounded mt-1 text-sm">
                <datalist id="pm-publico-sugestoes">
                    ${pmOpcoesTipoCliente().map(v => `<option value="${v}">`).join('')}
                </datalist>
                <p class="text-[10px] mt-1" style="color:var(--sage)">Nesta fase, use "prospect" — é o único público de trial (a base ainda não tem cliente pagante pra segmentar). Os outros valores da lista são só sugestão pra quando campanhas de cliente existente entrarem, mais pra frente.</p>
            </div>
            <button onclick="pmSalvarPublico()" id="pm-publico-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar público</button>
            <p id="pm-publico-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAbrirNovoPublico() {
    pmPublicoEditId = null;
    document.getElementById('form-publico-form-wrapper').classList.remove('hidden');
    document.getElementById('pm-publico-tipo').value = '';
    document.getElementById('pm-publico-btn-salvar').textContent = 'Salvar público';
}

function pmAbrirEdicaoPublico(id) {
    const p = pmPublicoOferta.find(x => x.id === id);
    if (!p) return;
    pmPublicoEditId = id;
    const wrapper = document.getElementById('form-publico-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pm-publico-tipo').value = p.tipo_cliente;
    document.getElementById('pm-publico-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pmSalvarPublico() {
    const tipo_cliente = document.getElementById('pm-publico-tipo').value.trim();
    const status = document.getElementById('pm-publico-status');
    if (!tipo_cliente) { status.textContent = 'Informe o tipo de cliente.'; return; }

    const { error } = pmPublicoEditId
        ? await dbAuth.schema('comercial').from('publico_oferta').update({ tipo_cliente }).eq('id', pmPublicoEditId)
        : await dbAuth.schema('comercial').from('publico_oferta').insert({ tipo_cliente });

    if (error) { status.textContent = 'Erro: ' + error.message; return; }
    await pmCarregarTudo();
    pmRenderPublico();
}

function pmExcluirPublico(id, nome) {
    pmExcluir({ schema: 'comercial', tabela: 'publico_oferta', coluna: 'id', valor: id, nome, onSucesso: pmRenderPublico });
}

// ============================================================================
// FORM SIMPLES DE PLANO (metadados: código/descrição/ativo) — usado pelo
// botão "+ Plano" de Planos & Limites (parametros-planos.js). A matriz de
// funcionalidades×limite NÃO fica aqui — ver parametros-planos.js.
// ============================================================================

function pmFormPlano() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Código <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-plano-codigo" required placeholder="ex.: standard" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Nome comercial <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-plano-descricao" required placeholder="ex.: Standard" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <label class="flex items-center gap-2 text-sm">
                <input type="checkbox" id="pm-plano-ativo" checked>
                <span style="color:var(--ink)">Ativo</span>
            </label>
            <button onclick="pmSalvarPlano()" id="pm-plano-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar plano</button>
            <p id="pm-plano-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAbrirNovoPlano() {
    pmPlanoEditCodigo = null;
    document.getElementById('form-plano-form-wrapper').classList.remove('hidden');
    document.getElementById('pm-plano-codigo').disabled = false;
    document.getElementById('pm-plano-codigo').value = '';
    document.getElementById('pm-plano-descricao').value = '';
    document.getElementById('pm-plano-ativo').checked = true;
    document.getElementById('pm-plano-btn-salvar').textContent = 'Salvar plano';
}

function pmAbrirEdicaoPlano(codigo) {
    const p = pmPlanos.find(x => x.codigo === codigo);
    if (!p) return;
    pmPlanoEditCodigo = codigo;
    const wrapper = document.getElementById('form-plano-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pm-plano-codigo').value = p.codigo;
    document.getElementById('pm-plano-codigo').disabled = true;
    document.getElementById('pm-plano-descricao').value = p.descricao;
    document.getElementById('pm-plano-ativo').checked = !!p.ativo;
    document.getElementById('pm-plano-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pmSalvarPlano() {
    const codigo = document.getElementById('pm-plano-codigo').value.trim();
    const descricao = document.getElementById('pm-plano-descricao').value.trim();
    const ativo = document.getElementById('pm-plano-ativo').checked;
    const status = document.getElementById('pm-plano-status');
    if (!codigo || !descricao) { status.textContent = 'Preencha código e nome comercial.'; return; }

    const { error } = pmPlanoEditCodigo
        ? await dbAuth.from('planos').update({ descricao, ativo }).eq('codigo', pmPlanoEditCodigo)
        : await dbAuth.from('planos').insert({ codigo, descricao, ativo }); // modulo usa o DEFAULT do banco

    if (error) { status.textContent = 'Erro: ' + error.message; return; }
    await pmCarregarTudo();
    if (typeof parametrosPlanosInit === 'function') parametrosPlanosInit();
}

// ============================================================================
// HELPERS COMPARTILHADOS (idêntico à v0.7.0)
// ============================================================================

function pmBotaoToggle(id, onclick) {
    return `
        <button id="btn-toggle-${id}" onclick="${onclick}"
            class="w-11 h-11 flex-none flex items-center justify-center
                   bg-white border border-slate-300 rounded-full shadow active:scale-90 transition"
            style="color:var(--pine)" title="Adicionar">
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
        </button>
    `;
}

function pmIconeEditar() {
    return `
        <svg class="w-4 h-4 flex-none" style="color:var(--sage)" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
        </svg>
    `;
}

function pmVazio(msg) {
    return `<p class="text-sm text-center py-6" style="color:var(--sage)">${msg}</p>`;
}

// Escapa aspas simples/duplas pra poder colocar o nome do registro com
// segurança dentro de um atributo onclick="...('${nome}')" inline.
function pmEsc(s) {
    return String(s == null ? '' : s).replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function pmIconeExcluir() {
    return `
        <svg class="w-4 h-4 flex-none" style="color:var(--danger)" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
        </svg>
    `;
}


// ============================================================================
// EXCLUSÃO — 1 helper genérico + 1 wrapper fino por entidade (idêntico à
// v0.7.0, + pmExcluirPublico já adicionado acima na seção do catálogo).
// ============================================================================

// ============================================================================
// Exclusão — 1 helper genérico + 1 wrapper fino por entidade.
// Operação destrutiva (regra do Prompt 03): sempre confirm() nomeando o
// registro, e violação de FK (23503) vira mensagem amigável em vez do
// erro cru do Postgres.
// ============================================================================

async function pmExcluir({ schema, tabela, coluna, valor, nome, onSucesso }) {
    if (!confirm(`Excluir "${nome}"?\n\nEssa ação não pode ser desfeita.`)) return;

    const query = schema ? dbAuth.schema(schema).from(tabela) : dbAuth.from(tabela);
    const { error } = await query.delete().eq(coluna, valor);

    if (error) {
        const msg = error.code === '23503'
            ? `Não é possível excluir "${nome}": ainda está em uso em outro cadastro (funcionalidade, plano, licença ou campanha vinculada). Remova o vínculo primeiro.`
            : `Erro ao excluir "${nome}": ${error.message}`;
        alert(msg);
        return;
    }

    await pmCarregarTudo();
    onSucesso();
}

function pmExcluirModulo(codigo, nome) {
    pmExcluir({ schema: 'comercial', tabela: 'tipo_modulos', coluna: 'codigo', valor: codigo, nome, onSucesso: pmRenderModulos });
}

function pmExcluirFuncionalidade(codigo, nome) {
    pmExcluir({ tabela: 'funcionalidades', coluna: 'codigo', valor: codigo, nome, onSucesso: pmRenderFuncionalidades });
}

function pmExcluirPlano(codigo, nome) {
    pmExcluir({ tabela: 'planos', coluna: 'codigo', valor: codigo, nome, onSucesso: () => { if (typeof parametrosPlanosInit === 'function') parametrosPlanosInit(); } });
}

function pmExcluirForma(id, nome) {
    pmExcluir({ schema: 'comercial', tabela: 'forma_pagamento', coluna: 'id', valor: id, nome, onSucesso: pmRenderPagamento });
}

function pmExcluirPlanoPagamento(id, nome) {
    pmExcluir({ schema: 'comercial', tabela: 'plano_pagamentos', coluna: 'id', valor: id, nome, onSucesso: pmRenderPagamento });
}

// Campanha é a única com exclusão em cascata própria: as linhas de
// plano_campanhas_pagamentos pertencem só a ela (mesmo raciocínio de
// pmSalvarCampanha(), que já substitui esse vínculo por completo a cada
// salvamento) — não é uma FK de "outro cadastro" que deva bloquear.
async function pmExcluirCampanha(id, nome) {
    if (!confirm(`Excluir a campanha "${nome}"?\n\nEssa ação não pode ser desfeita.`)) return;

    // plano_campanhas_pagamentos e campanha_landing pertencem só à campanha
    // (campanha_landing tem ON DELETE CASCADE — não precisa deletar manual).
    const { error: errVinculo } = await dbAuth.schema('comercial').from('plano_campanhas_pagamentos').delete().eq('id_campanha', id);
    if (errVinculo) { alert(`Erro ao excluir vínculos de pagamento da campanha: ${errVinculo.message}`); return; }

    const { error } = await dbAuth.schema('comercial').from('plano_campanhas').delete().eq('id', id);
    if (error) {
        const msg = error.code === '23503'
            ? `Não é possível excluir "${nome}": ainda está em uso (ex.: licença criada a partir desta campanha). Remova o vínculo primeiro.`
            : `Erro ao excluir "${nome}": ${error.message}`;
        alert(msg);
        return;
    }

    await pmCarregarTudo();
    if (typeof parametrosCampanhasInit === 'function') parametrosCampanhasInit();
}


function pmExcluirCategoria(id, nome) {
    pmExcluir({ schema: 'comercial', tabela: 'categoria_licenca', coluna: 'id_categoria_licenca', valor: id, nome, onSucesso: pmRenderCategorias });
}
