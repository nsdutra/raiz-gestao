// ============================================================================
// js/telas/parametros-master.js — Raiz Gestão
//
// Tela "Parâmetros Master": catálogo de módulos, funcionalidades, planos,
// pagamento, campanhas e categorias de licença. Segue o padrão liga/desliga
// do design system e a borda escura de bloco.
//
// v0.5.0: edição em todas as sub-abas (não só criação), débito como forma
// de pagamento, ajuste de pagamento sem depender de digitar "-" (bug de
// teclado numérico no Android), campo Módulo saiu do form de Planos e
// entrou no de Funcionalidades (agrupamento agora é por módulo, não por
// texto livre de área), campanha com N formas de pagamento, lista de
// vínculo plano×funcionalidade reformatada pra não estourar a tela, nova
// sub-aba Categorias.
// ============================================================================

let pmModulos = [];
let pmFuncionalidades = [];
let pmPlanos = [];
let pmFormasPagamento = [];
let pmPlanoPagamentos = [];
let pmCampanhas = [];
let pmCampanhaPagamentos = [];   // linhas da tabela de junção comercial.plano_campanhas_pagamentos
let pmCategorias = [];

// Estado de edição (null = criando um novo; preenchido = editando o
// registro com essa chave). Um por sub-aba, pra formulários independentes.
let pmModuloEditCodigo = null;
let pmFuncEditCodigo = null;
let pmPlanoEditCodigo = null;
let pmFormaEditId = null;
let pmPlanoPgtoEditId = null;
let pmCampEditId = null;
let pmCategoriaEditId = null;

const PM_FORMAS_PGTO = { pix: 'Pix', cc: 'Cartão de crédito', debito: 'Cartão de débito', boleto: 'Boleto' };

// ----------------------------------------------------------------------------
// Entrada da tela
// ----------------------------------------------------------------------------
async function telaParametrosMasterInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="flex gap-2 mb-5 border-b overflow-x-auto" style="border-color:var(--line)">
            <button onclick="pmMudarSubaba('modulos')" id="pm-tab-modulos" class="pm-subaba px-4 py-2.5 text-sm font-bold whitespace-nowrap">Módulos</button>
            <button onclick="pmMudarSubaba('funcionalidades')" id="pm-tab-funcionalidades" class="pm-subaba px-4 py-2.5 text-sm font-bold whitespace-nowrap">Funcionalidades</button>
            <button onclick="pmMudarSubaba('planos')" id="pm-tab-planos" class="pm-subaba px-4 py-2.5 text-sm font-bold whitespace-nowrap">Planos</button>
            <button onclick="pmMudarSubaba('pagamento')" id="pm-tab-pagamento" class="pm-subaba px-4 py-2.5 text-sm font-bold whitespace-nowrap">Pagamento</button>
            <button onclick="pmMudarSubaba('campanhas')" id="pm-tab-campanhas" class="pm-subaba px-4 py-2.5 text-sm font-bold whitespace-nowrap">Campanhas</button>
            <button onclick="pmMudarSubaba('categorias')" id="pm-tab-categorias" class="pm-subaba px-4 py-2.5 text-sm font-bold whitespace-nowrap">Categorias</button>
        </div>
        <div id="pm-conteudo-subaba"></div>
    `;
    const ok = await pmCarregarTudo();
    if (ok) pmMudarSubaba('modulos');
}

async function pmCarregarTudo() {
    const [
        { data: modulos, error: e1 }, { data: func, error: e2 }, { data: planos, error: e3 },
        { data: formasPgto, error: e4 }, { data: planoPgtos, error: e5 }, { data: campanhas, error: e6 },
        { data: campPgtos, error: e7 }, { data: categorias, error: e8 }
    ] = await Promise.all([
        dbAuth.schema('comercial').from('tipo_modulos').select('*').order('nome'),
        dbAuth.from('funcionalidades').select('*').order('area').order('codigo'),
        dbAuth.from('planos').select('*').order('modulo').order('codigo'),
        dbAuth.schema('comercial').from('forma_pagamento').select('*'),
        dbAuth.schema('comercial').from('plano_pagamentos').select('*').order('nome'),
        dbAuth.schema('comercial').from('plano_campanhas').select('*').order('nome'),
        dbAuth.schema('comercial').from('plano_campanhas_pagamentos').select('*'),
        dbAuth.schema('comercial').from('categoria_licenca').select('*').order('nome')
    ]);

    const erros = { 'Módulos': e1, 'Funcionalidades': e2, 'Planos': e3, 'Formas de pagamento': e4, 'Pagamentos de plano': e5, 'Campanhas': e6, 'Vínculo campanha×pagamento': e7, 'Categorias': e8 };
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
    return true;
}

function pmErro(msg) {
    document.getElementById('area-conteudo').innerHTML =
        `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)">
            <strong>Não foi possível carregar:</strong> ${msg}
            <br><span class="text-xs">Confira se comercial_fase1_grants_v1.sql e public_catalogo_grants_v1.sql já foram rodados.</span>
        </div>`;
}

function pmMudarSubaba(nome) {
    document.querySelectorAll('.pm-subaba').forEach(b => {
        b.style.color = 'var(--sage)';
        b.style.borderBottom = 'none';
    });
    const ativa = document.getElementById('pm-tab-' + nome);
    ativa.style.color = 'var(--pine)';
    ativa.style.borderBottom = '3px solid var(--brass)';

    if (nome === 'modulos') pmRenderModulos();
    if (nome === 'funcionalidades') pmRenderFuncionalidades();
    if (nome === 'planos') pmRenderPlanos();
    if (nome === 'pagamento') pmRenderPagamento();
    if (nome === 'campanhas') pmRenderCampanhas();
    if (nome === 'categorias') pmRenderCategorias();
}

// ============================================================================
// SUB-ABA: MÓDULOS
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
                    ${pmIconeEditar()}
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
// SUB-ABA: FUNCIONALIDADES
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
// SUB-ABA: PLANOS  (sem campo de módulo — grava com o default do banco)
// ============================================================================

function pmRenderPlanos() {
    const c = document.getElementById('pm-conteudo-subaba');
    pmPlanoEditCodigo = null;
    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Planos concretos (Standard, Plus, Plus+IA...) e seus limites por funcionalidade</p>
            ${pmBotaoToggle('plano-form', "pmAbrirNovoPlano()")}
        </div>
        <div id="form-plano-form-wrapper" class="hidden mb-4">${pmFormPlano()}</div>
        <div class="space-y-2">
            ${pmPlanos.map(p => `
                <div class="bg-slate-50 rounded-xl border-2 border-slate-300 overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2.5">
                        <div class="min-w-0 flex-1 cursor-pointer" onclick="pmAlternarDetalhePlano('${p.codigo}')">
                            <p class="text-sm font-bold truncate" style="color:var(--ink)">${p.descricao}</p>
                            <p class="text-xs" style="color:var(--sage)">${p.codigo}</p>
                        </div>
                        <div class="flex items-center gap-2 flex-none">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${p.ativo ? 'var(--success-bg)' : 'var(--danger-bg)'};color:${p.ativo ? 'var(--success)' : 'var(--danger)'}">${p.ativo ? 'ativo' : 'inativo'}</span>
                            <button onclick="event.stopPropagation();pmAbrirEdicaoPlano('${p.codigo}')">${pmIconeEditar()}</button>
                        </div>
                    </div>
                    <div id="pm-detalhe-plano-${p.codigo}" class="hidden border-t px-3 py-3" style="border-color:var(--line)"></div>
                </div>
            `).join('') || pmVazio('Nenhum plano cadastrado ainda.')}
        </div>
    `;
}

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
    pmRenderPlanos();
}

// --- Detalhe do plano: funcionalidades vinculadas + limite/limite_aviso ---
// Layout empilhado (2 linhas por item) pra não estourar a largura da tela.

async function pmAlternarDetalhePlano(planoCodigo) {
    const el = document.getElementById('pm-detalhe-plano-' + planoCodigo);
    const abrindo = el.classList.contains('hidden');
    el.classList.toggle('hidden');
    if (!abrindo) return;

    el.innerHTML = `<p class="text-xs" style="color:var(--sage)">Carregando vínculos...</p>`;

    const { data: vinculos, error } = await dbAuth
        .from('plano_funcionalidade')
        .select('funcionalidade_codigo, limite, limite_aviso')
        .eq('plano_codigo', planoCodigo);

    if (error) { el.innerHTML = `<p class="text-xs" style="color:var(--danger)">Erro: ${error.message}</p>`; return; }

    el.innerHTML = `
        <div class="divide-y" style="border-color:var(--line)">
            ${pmFuncionalidades.map(f => {
                const v = (vinculos || []).find(x => x.funcionalidade_codigo === f.codigo);
                return `
                <div class="py-2.5">
                    <label class="flex items-start gap-2">
                        <input type="checkbox" class="mt-0.5" id="pm-vinc-${planoCodigo}-${f.codigo}" ${v ? 'checked' : ''}
                            onchange="pmToggleVinculo('${planoCodigo}','${f.codigo}', this.checked)">
                        <span class="text-xs leading-snug" style="color:var(--ink)">${f.codigo}</span>
                    </label>
                    <div class="flex gap-2 mt-1.5 pl-6">
                        <input type="number" placeholder="limite" value="${v?.limite ?? ''}"
                            id="pm-limite-${planoCodigo}-${f.codigo}"
                            onchange="pmAtualizarLimite('${planoCodigo}','${f.codigo}')"
                            class="flex-1 min-w-0 p-1.5 border rounded text-xs" ${v ? '' : 'disabled'}>
                        <input type="number" placeholder="aviso a partir de" value="${v?.limite_aviso ?? ''}"
                            id="pm-limiteaviso-${planoCodigo}-${f.codigo}"
                            onchange="pmAtualizarLimite('${planoCodigo}','${f.codigo}')"
                            class="flex-1 min-w-0 p-1.5 border rounded text-xs" ${v ? '' : 'disabled'}>
                    </div>
                </div>`;
            }).join('')}
        </div>
        <p class="text-[10px] mt-2" style="color:var(--sage)">Marque pra liberar a funcionalidade neste plano. Em branco = sem limite.</p>
    `;
}

async function pmToggleVinculo(planoCodigo, funcCodigo, marcado) {
    if (marcado) {
        const { error } = await dbAuth.from('plano_funcionalidade').insert({ plano_codigo: planoCodigo, funcionalidade_codigo: funcCodigo });
        if (error) { alert('Erro ao vincular: ' + error.message); return; }
    } else {
        const { error } = await dbAuth.from('plano_funcionalidade').delete()
            .eq('plano_codigo', planoCodigo).eq('funcionalidade_codigo', funcCodigo);
        if (error) { alert('Erro ao desvincular: ' + error.message); return; }
    }
    pmAlternarDetalhePlano(planoCodigo);
    pmAlternarDetalhePlano(planoCodigo);
}

async function pmAtualizarLimite(planoCodigo, funcCodigo) {
    const limite = document.getElementById(`pm-limite-${planoCodigo}-${funcCodigo}`).value;
    const limiteAviso = document.getElementById(`pm-limiteaviso-${planoCodigo}-${funcCodigo}`).value;
    const { error } = await dbAuth.from('plano_funcionalidade')
        .update({ limite: limite === '' ? null : Number(limite), limite_aviso: limiteAviso === '' ? null : Number(limiteAviso) })
        .eq('plano_codigo', planoCodigo).eq('funcionalidade_codigo', funcCodigo);
    if (error) alert('Erro ao salvar limite: ' + error.message);
}

// ============================================================================
// SUB-ABA: PAGAMENTO
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
                    ${pmIconeEditar()}
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
// SUB-ABA: CAMPANHAS (agora com N formas de pagamento por campanha)
// ============================================================================

function pmRenderCampanhas() {
    const c = document.getElementById('pm-conteudo-subaba');
    pmCampEditId = null;

    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Ofertas com vigência própria (trial, cortesia, promoção sazonal...)</p>
            ${pmBotaoToggle('campanha-form', "pmAbrirNovaCampanha()")}
        </div>
        <div id="form-campanha-form-wrapper" class="hidden mb-4">${pmFormCampanha()}</div>
        <div class="space-y-2">
            ${pmCampanhas.map(cp => {
                const pgtoIds = pmCampanhaPagamentos.filter(cpp => cpp.id_campanha === cp.id).map(cpp => cpp.id_plano_pagamento);
                const pgtoNomes = pgtoIds.map(id => pmPlanoPagamentos.find(p => p.id === id)?.nome).filter(Boolean);
                return `
                <div class="bg-slate-50 p-3 rounded-xl border-2 border-slate-300 cursor-pointer" onclick="pmAbrirEdicaoCampanha('${cp.id}')">
                    <div class="flex items-center justify-between">
                        <p class="text-sm font-bold" style="color:var(--ink)">${cp.nome}</p>
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:var(--brass-light);color:var(--brass-deep)">${cp.categoria}</span>
                            ${pmIconeEditar()}
                        </div>
                    </div>
                    <p class="text-xs mt-1" style="color:var(--sage)">
                        ${pmLabelDuracao(cp)} · aviso ${cp.tempo_aviso_dias}d antes
                        ${cp.inicio_vigencia || cp.fim_vigencia ? ` · vigência ${cp.inicio_vigencia || '?'} a ${cp.fim_vigencia || '?'}` : ' · sempre disponível'}
                    </p>
                    ${pgtoNomes.length ? `<p class="text-xs mt-1" style="color:var(--pine)">💳 ${pgtoNomes.join(' · ')}</p>` : `<p class="text-xs mt-1" style="color:var(--sage)">sem opção de pagamento (ex.: trial gratuito)</p>`}
                </div>
            `}).join('') || pmVazio('Nenhuma campanha cadastrada ainda.')}
        </div>
    `;
}

function pmFormCampanha() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Nome <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-camp-nome" required placeholder="ex.: Trial 14 dias" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Categoria <span style="color:var(--danger)">*</span></label>
                <select id="pm-camp-categoria" required class="w-full p-2 border rounded mt-1 text-sm">
                    <option value="trial">Trial</option>
                    <option value="cortesia">Cortesia</option>
                    <option value="item">Item avulso</option>
                    <option value="padrao">Padrão (venda normal)</option>
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Opções de pagamento aceitas</label>
                <div class="space-y-1 mt-1 max-h-40 overflow-y-auto border rounded p-2">
                    ${pmPlanoPagamentos.map(p => `
                        <label class="flex items-center gap-2 text-xs">
                            <input type="checkbox" class="pm-camp-pgto-check" value="${p.id}">
                            <span style="color:var(--ink)">${p.nome} (R$ ${Number(p.preco).toFixed(2)})</span>
                        </label>
                    `).join('') || `<p class="text-xs" style="color:var(--sage)">Nenhuma opção de pagamento cadastrada ainda — cadastre na aba Pagamento primeiro.</p>`}
                </div>
                <p class="text-[10px] mt-1" style="color:var(--sage)">Deixe tudo desmarcado pra campanhas gratuitas (trial/cortesia).</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Duração <span style="color:var(--danger)">*</span></label>
                    <select id="pm-camp-duracao-tipo" required class="w-full p-2 border rounded mt-1 text-sm">
                        <option value="dias_fixos">Dias fixos</option>
                        <option value="fim_do_mes">Até o fim do mês</option>
                        <option value="fim_do_ano">Até o fim do ano</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Qtd. dias (se "dias fixos")</label>
                    <input type="number" min="0" id="pm-camp-duracao-dias" placeholder="ex.: 14" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Avisar quantos dias antes de vencer</label>
                <input type="number" min="0" id="pm-camp-aviso-dias" value="3" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Início de vigência</label>
                    <input type="date" id="pm-camp-inicio" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Fim de vigência</label>
                    <input type="date" id="pm-camp-fim" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
            </div>
            <p class="text-[10px]" style="color:var(--sage)">Início/fim de vigência é opcional — em branco = campanha sempre disponível.</p>
            <button onclick="pmSalvarCampanha()" id="pm-camp-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar campanha</button>
            <p id="pm-camp-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmLabelDuracao(cp) {
    if (cp.duracao_tipo === 'dias_fixos') return `${cp.duracao_dias || '?'} dias`;
    if (cp.duracao_tipo === 'fim_do_mes') return 'até o fim do mês';
    if (cp.duracao_tipo === 'fim_do_ano') return 'até o fim do ano';
    return cp.duracao_tipo;
}

function pmAbrirNovaCampanha() {
    pmCampEditId = null;
    document.getElementById('form-campanha-form-wrapper').classList.remove('hidden');
    document.getElementById('pm-camp-nome').value = '';
    document.getElementById('pm-camp-categoria').value = 'trial';
    document.querySelectorAll('.pm-camp-pgto-check').forEach(chk => chk.checked = false);
    document.getElementById('pm-camp-duracao-tipo').value = 'dias_fixos';
    document.getElementById('pm-camp-duracao-dias').value = '';
    document.getElementById('pm-camp-aviso-dias').value = 3;
    document.getElementById('pm-camp-inicio').value = '';
    document.getElementById('pm-camp-fim').value = '';
    document.getElementById('pm-camp-btn-salvar').textContent = 'Salvar campanha';
}

function pmAbrirEdicaoCampanha(id) {
    const cp = pmCampanhas.find(x => x.id === id);
    if (!cp) return;
    pmCampEditId = id;
    const wrapper = document.getElementById('form-campanha-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pm-camp-nome').value = cp.nome;
    document.getElementById('pm-camp-categoria').value = cp.categoria;
    const pgtoIds = new Set(pmCampanhaPagamentos.filter(cpp => cpp.id_campanha === id).map(cpp => cpp.id_plano_pagamento));
    document.querySelectorAll('.pm-camp-pgto-check').forEach(chk => chk.checked = pgtoIds.has(chk.value));
    document.getElementById('pm-camp-duracao-tipo').value = cp.duracao_tipo;
    document.getElementById('pm-camp-duracao-dias').value = cp.duracao_dias ?? '';
    document.getElementById('pm-camp-aviso-dias').value = cp.tempo_aviso_dias;
    document.getElementById('pm-camp-inicio').value = cp.inicio_vigencia || '';
    document.getElementById('pm-camp-fim').value = cp.fim_vigencia || '';
    document.getElementById('pm-camp-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pmSalvarCampanha() {
    const nome = document.getElementById('pm-camp-nome').value.trim();
    const categoria = document.getElementById('pm-camp-categoria').value;
    const duracao_tipo = document.getElementById('pm-camp-duracao-tipo').value;
    const duracao_dias = document.getElementById('pm-camp-duracao-dias').value || null;
    const tempo_aviso_dias = document.getElementById('pm-camp-aviso-dias').value || 3;
    const inicio_vigencia = document.getElementById('pm-camp-inicio').value || null;
    const fim_vigencia = document.getElementById('pm-camp-fim').value || null;
    const pgtoSelecionados = Array.from(document.querySelectorAll('.pm-camp-pgto-check:checked')).map(chk => chk.value);
    const status = document.getElementById('pm-camp-status');

    if (!nome || !categoria || !duracao_tipo) { status.textContent = 'Preencha nome, categoria e duração.'; return; }
    if (duracao_tipo === 'dias_fixos' && !duracao_dias) { status.textContent = 'Informe a quantidade de dias.'; return; }

    const payload = {
        nome, categoria, duracao_tipo,
        duracao_dias: duracao_dias ? Number(duracao_dias) : null,
        tempo_aviso_dias: Number(tempo_aviso_dias),
        inicio_vigencia, fim_vigencia
    };

    let campanhaId = pmCampEditId;
    if (pmCampEditId) {
        const { error } = await dbAuth.schema('comercial').from('plano_campanhas').update(payload).eq('id', pmCampEditId);
        if (error) { status.textContent = 'Erro: ' + error.message; return; }
    } else {
        const { data, error } = await dbAuth.schema('comercial').from('plano_campanhas').insert(payload).select().single();
        if (error) { status.textContent = 'Erro: ' + error.message; return; }
        campanhaId = data.id;
    }

    // Substitui o conjunto de formas de pagamento vinculadas por completo
    // (mais simples e seguro do que tentar calcular o diff).
    const { error: errDel } = await dbAuth.schema('comercial').from('plano_campanhas_pagamentos').delete().eq('id_campanha', campanhaId);
    if (errDel) { status.textContent = 'Campanha salva, mas erro ao atualizar pagamentos: ' + errDel.message; return; }

    if (pgtoSelecionados.length > 0) {
        const linhas = pgtoSelecionados.map(idPgto => ({ id_campanha: campanhaId, id_plano_pagamento: idPgto }));
        const { error: errIns } = await dbAuth.schema('comercial').from('plano_campanhas_pagamentos').insert(linhas);
        if (errIns) { status.textContent = 'Campanha salva, mas erro ao vincular pagamentos: ' + errIns.message; return; }
    }

    await pmCarregarTudo();
    pmRenderCampanhas();
}

// ============================================================================
// SUB-ABA: CATEGORIAS (comercial.categoria_licenca)
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
                    ${pmIconeEditar()}
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
// Helpers compartilhados
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
