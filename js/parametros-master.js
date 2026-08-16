// ============================================================================
// js/telas/parametros-master.js — Raiz Gestão
//
// Tela "Parâmetros Master": catálogo de módulos, funcionalidades e planos.
// 3 sub-abas dentro de #area-conteudo. Segue o padrão liga/desliga do
// design system (botão +/X, nunca um X vermelho separado) e a borda escura
// de bloco (rounded-xl border-2 border-slate-300).
//
// Escopo desta versão: tipo_modulos, funcionalidades, planos e o vínculo
// plano×funcionalidade (limite/limite_aviso). Campanhas e formas de
// pagamento ficam pra próxima fase do Parâmetros Master.
// ============================================================================

let pmModulos = [];
let pmFuncionalidades = [];
let pmPlanos = [];
let pmFormasPagamento = [];
let pmPlanoPagamentos = [];
let pmCampanhas = [];

// ----------------------------------------------------------------------------
// Entrada da tela (chamada por entrarNaGestao() em supabase-client.js)
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
        </div>
        <div id="pm-conteudo-subaba"></div>
    `;
    await pmCarregarTudo();
    pmMudarSubaba('modulos');
}

async function pmCarregarTudo() {
    const [
        { data: modulos, error: e1 }, { data: func, error: e2 }, { data: planos, error: e3 },
        { data: formasPgto, error: e4 }, { data: planoPgtos, error: e5 }, { data: campanhas, error: e6 }
    ] = await Promise.all([
        dbAuth.schema('comercial').from('tipo_modulos').select('*').order('nome'),
        dbAuth.from('funcionalidades').select('*').order('area').order('codigo'),
        dbAuth.from('planos').select('*').order('modulo').order('codigo'),
        dbAuth.schema('comercial').from('forma_pagamento').select('*'),
        dbAuth.schema('comercial').from('plano_pagamentos').select('*').order('nome'),
        dbAuth.schema('comercial').from('plano_campanhas').select('*').order('nome')
    ]);

    if (e1) { pmErro('Módulos: ' + e1.message); return; }
    if (e2) { pmErro('Funcionalidades: ' + e2.message); return; }
    if (e3) { pmErro('Planos: ' + e3.message); return; }
    if (e4) { pmErro('Formas de pagamento: ' + e4.message); return; }
    if (e5) { pmErro('Pagamentos de plano: ' + e5.message); return; }
    if (e6) { pmErro('Campanhas: ' + e6.message); return; }

    pmModulos = modulos || [];
    pmFuncionalidades = func || [];
    pmPlanos = planos || [];
    pmFormasPagamento = formasPgto || [];
    pmPlanoPagamentos = planoPgtos || [];
    pmCampanhas = campanhas || [];
}

function pmErro(msg) {
    document.getElementById('area-conteudo').innerHTML =
        `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)">
            <strong>Não foi possível carregar:</strong> ${msg}
            <br><span class="text-xs">Confira se o schema 'comercial' está exposto (Settings → API) e se comercial_fase1_rls_v1.sql já foi rodado.</span>
        </div>`;
}

// ----------------------------------------------------------------------------
// Troca de sub-aba
// ----------------------------------------------------------------------------
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
}

// ============================================================================
// SUB-ABA: MÓDULOS (comercial.tipo_modulos)
// ============================================================================

function pmRenderModulos() {
    const c = document.getElementById('pm-conteudo-subaba');
    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Catálogo de módulos do sistema (Imóveis, Contratos, Gestão...)</p>
            ${pmBotaoToggle('modulo-novo', 'pmAlternarFormNovoModulo()')}
        </div>
        <div id="form-modulo-novo-wrapper" class="hidden mb-4">
            ${pmFormModulo()}
        </div>
        <div class="space-y-2">
            ${pmModulos.map(m => `
                <div class="flex items-center justify-between bg-slate-50 p-3 rounded-xl border-2 border-slate-300">
                    <div>
                        <p class="text-sm font-bold" style="color:var(--ink)">${m.nome}</p>
                        <p class="text-xs" style="color:var(--sage)">código: ${m.codigo}</p>
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
            <button onclick="pmSalvarModulo()" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar módulo</button>
            <p id="pm-modulo-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAlternarFormNovoModulo() {
    pmAlternarPainel('form-modulo-novo-wrapper', 'btn-toggle-modulo-novo');
}

async function pmSalvarModulo() {
    const codigo = document.getElementById('pm-modulo-codigo').value.trim();
    const nome = document.getElementById('pm-modulo-nome').value.trim();
    const status = document.getElementById('pm-modulo-status');

    if (!codigo || !nome) { status.textContent = 'Preencha código e nome.'; return; }

    const { error } = await dbAuth.schema('comercial').from('tipo_modulos').insert({ codigo, nome });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    await pmCarregarTudo();
    pmRenderModulos();
}

// ============================================================================
// SUB-ABA: FUNCIONALIDADES (public.funcionalidades)
// ============================================================================

function pmRenderFuncionalidades() {
    const c = document.getElementById('pm-conteudo-subaba');
    const porArea = {};
    pmFuncionalidades.forEach(f => { (porArea[f.area] = porArea[f.area] || []).push(f); });

    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Toda ação/tela que pode ser ligada a um plano ou perfil</p>
            ${pmBotaoToggle('funcionalidade-nova', 'pmAlternarFormNovaFuncionalidade()')}
        </div>
        <div id="form-funcionalidade-nova-wrapper" class="hidden mb-4">
            ${pmFormFuncionalidade()}
        </div>
        ${Object.keys(porArea).sort().map(area => `
            <p class="text-[10px] font-bold uppercase tracking-wide mt-4 mb-1.5" style="color:var(--sage)">${area}</p>
            <div class="space-y-1.5">
                ${porArea[area].map(f => `
                    <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300">
                        <div>
                            <p class="text-sm font-medium" style="color:var(--ink)">${f.codigo}</p>
                            <p class="text-xs" style="color:var(--sage)">${f.descricao}</p>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${f.ativo ? 'var(--success-bg)' : 'var(--danger-bg)'};color:${f.ativo ? 'var(--success)' : 'var(--danger)'}">${f.ativo ? 'ativo' : 'inativo'}</span>
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
                <label class="block text-xs font-bold text-gray-600">Área <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-func-area" required placeholder="ex.: imoveis" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Descrição <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pm-func-descricao" required class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <button onclick="pmSalvarFuncionalidade()" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar funcionalidade</button>
            <p id="pm-func-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAlternarFormNovaFuncionalidade() {
    pmAlternarPainel('form-funcionalidade-nova-wrapper', 'btn-toggle-funcionalidade-nova');
}

async function pmSalvarFuncionalidade() {
    const codigo = document.getElementById('pm-func-codigo').value.trim();
    const area = document.getElementById('pm-func-area').value.trim();
    const descricao = document.getElementById('pm-func-descricao').value.trim();
    const status = document.getElementById('pm-func-status');

    if (!codigo || !area || !descricao) { status.textContent = 'Preencha código, área e descrição.'; return; }

    const { error } = await dbAuth.from('funcionalidades').insert({ codigo, area, descricao, ativo: true });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    await pmCarregarTudo();
    pmRenderFuncionalidades();
}

// ============================================================================
// SUB-ABA: PLANOS (public.planos + public.plano_funcionalidade)
// ============================================================================

function pmRenderPlanos() {
    const c = document.getElementById('pm-conteudo-subaba');
    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Planos concretos (Standard, Plus, Plus+IA...) e seus limites por funcionalidade</p>
            ${pmBotaoToggle('plano-novo', 'pmAlternarFormNovoPlano()')}
        </div>
        <div id="form-plano-novo-wrapper" class="hidden mb-4">
            ${pmFormPlano()}
        </div>
        <div class="space-y-2">
            ${pmPlanos.map(p => `
                <div class="bg-slate-50 rounded-xl border-2 border-slate-300 overflow-hidden">
                    <div class="flex items-center justify-between px-3 py-2.5 cursor-pointer" onclick="pmAlternarDetalhePlano('${p.codigo}')">
                        <div>
                            <p class="text-sm font-bold" style="color:var(--ink)">${p.descricao}</p>
                            <p class="text-xs" style="color:var(--sage)">${p.codigo} · módulo: ${p.modulo}</p>
                        </div>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:${p.ativo ? 'var(--success-bg)' : 'var(--danger-bg)'};color:${p.ativo ? 'var(--success)' : 'var(--danger)'}">${p.ativo ? 'ativo' : 'inativo'}</span>
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
            <div>
                <label class="block text-xs font-bold text-gray-600">Módulo <span style="color:var(--danger)">*</span></label>
                <select id="pm-plano-modulo" required class="w-full p-2 border rounded mt-1 text-sm">
                    ${pmModulos.map(m => `<option value="${m.codigo}">${m.nome}</option>`).join('')}
                </select>
            </div>
            <button onclick="pmSalvarPlano()" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar plano</button>
            <p id="pm-plano-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pmAlternarFormNovoPlano() {
    pmAlternarPainel('form-plano-novo-wrapper', 'btn-toggle-plano-novo');
}

async function pmSalvarPlano() {
    const codigo = document.getElementById('pm-plano-codigo').value.trim();
    const descricao = document.getElementById('pm-plano-descricao').value.trim();
    const modulo = document.getElementById('pm-plano-modulo').value;
    const status = document.getElementById('pm-plano-status');

    if (!codigo || !descricao || !modulo) { status.textContent = 'Preencha todos os campos.'; return; }

    const { error } = await dbAuth.from('planos').insert({ codigo, descricao, modulo, ativo: true });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    await pmCarregarTudo();
    pmRenderPlanos();
}

// --- Detalhe do plano: funcionalidades vinculadas + limite/limite_aviso ---

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

    const vinculadas = new Set((vinculos || []).map(v => v.funcionalidade_codigo));

    el.innerHTML = `
        <div class="space-y-1.5">
            ${pmFuncionalidades.map(f => {
                const v = (vinculos || []).find(x => x.funcionalidade_codigo === f.codigo);
                return `
                <div class="flex items-center gap-2 text-xs">
                    <input type="checkbox" id="pm-vinc-${planoCodigo}-${f.codigo}" ${v ? 'checked' : ''}
                        onchange="pmToggleVinculo('${planoCodigo}','${f.codigo}', this.checked)">
                    <span class="flex-1" style="color:var(--ink)">${f.codigo}</span>
                    <input type="number" placeholder="limite" value="${v?.limite ?? ''}"
                        id="pm-limite-${planoCodigo}-${f.codigo}"
                        onchange="pmAtualizarLimite('${planoCodigo}','${f.codigo}')"
                        class="w-20 p-1 border rounded text-xs" ${v ? '' : 'disabled'}>
                    <input type="number" placeholder="aviso" value="${v?.limite_aviso ?? ''}"
                        id="pm-limiteaviso-${planoCodigo}-${f.codigo}"
                        onchange="pmAtualizarLimite('${planoCodigo}','${f.codigo}')"
                        class="w-20 p-1 border rounded text-xs" ${v ? '' : 'disabled'}>
                </div>`;
            }).join('')}
        </div>
        <p class="text-[10px] mt-2" style="color:var(--sage)">Marque a funcionalidade pra liberá-la neste plano. "limite" = limite final; "aviso" = a partir de quanto avisar antes de bater o limite. Em branco = sem limite (uso livre).</p>
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
    pmAlternarDetalhePlano(planoCodigo); // fecha
    pmAlternarDetalhePlano(planoCodigo); // reabre já atualizado
}

async function pmAtualizarLimite(planoCodigo, funcCodigo) {
    const limite = document.getElementById(`pm-limite-${planoCodigo}-${funcCodigo}`).value;
    const limiteAviso = document.getElementById(`pm-limiteaviso-${planoCodigo}-${funcCodigo}`).value;

    const { error } = await dbAuth.from('plano_funcionalidade')
        .update({
            limite: limite === '' ? null : Number(limite),
            limite_aviso: limiteAviso === '' ? null : Number(limiteAviso)
        })
        .eq('plano_codigo', planoCodigo).eq('funcionalidade_codigo', funcCodigo);

    if (error) alert('Erro ao salvar limite: ' + error.message);
}

// ============================================================================
// SUB-ABA: PAGAMENTO (comercial.forma_pagamento + comercial.plano_pagamentos)
// ============================================================================

function pmRenderPagamento() {
    const c = document.getElementById('pm-conteudo-subaba');
    c.innerHTML = `
        <p class="text-[10px] font-bold uppercase tracking-wide mb-1.5" style="color:var(--sage)">Formas de pagamento</p>
        <div class="flex items-center justify-between mb-2">
            <p class="text-xs" style="color:var(--sage)">Pix, cartão, boleto — e o ajuste percentual de cada uma sobre o preço</p>
            ${pmBotaoToggle('forma-nova', 'pmAlternarPainel(\'form-forma-nova-wrapper\',\'btn-toggle-forma-nova\')')}
        </div>
        <div id="form-forma-nova-wrapper" class="hidden mb-4">
            <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Tipo <span style="color:var(--danger)">*</span></label>
                    <select id="pm-forma-tipo" required class="w-full p-2 border rounded mt-1 text-sm">
                        <option value="pix">Pix</option>
                        <option value="cc">Cartão de crédito</option>
                        <option value="boleto">Boleto</option>
                    </select>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Ajuste (%) sobre o preço</label>
                    <input type="number" step="0.01" id="pm-forma-ajuste" placeholder="ex.: 3.5 = +3,5%" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <button onclick="pmSalvarForma()" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar forma de pagamento</button>
                <p id="pm-forma-status" class="raiz-indicador-inline text-[11px]"></p>
            </div>
        </div>
        <div class="space-y-1.5 mb-6">
            ${pmFormasPagamento.map(f => `
                <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300">
                    <span class="text-sm font-medium" style="color:var(--ink)">${pmLabelFormaPgto(f.tipo_forma_pgto)}</span>
                    <span class="text-xs" style="color:var(--sage)">${f.ajuste ? '+' + (f.ajuste * 100).toFixed(2) + '%' : 'sem ajuste'}</span>
                </div>
            `).join('') || pmVazio('Nenhuma forma de pagamento cadastrada.')}
        </div>

        <p class="text-[10px] font-bold uppercase tracking-wide mb-1.5 mt-4" style="color:var(--sage)">Opções de pagamento (preço + parcelas)</p>
        <div class="flex items-center justify-between mb-2">
            <p class="text-xs" style="color:var(--sage)">Combinações concretas de preço, forma e parcelamento, usadas pelas campanhas</p>
            ${pmBotaoToggle('planopgto-novo', 'pmAlternarPainel(\'form-planopgto-novo-wrapper\',\'btn-toggle-planopgto-novo\')')}
        </div>
        <div id="form-planopgto-novo-wrapper" class="hidden mb-4">
            <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Nome <span style="color:var(--danger)">*</span></label>
                    <input type="text" id="pm-planopgto-nome" required placeholder="ex.: Anual à vista Pix" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div>
                        <label class="block text-xs font-bold text-gray-600">Preço (R$) <span style="color:var(--danger)">*</span></label>
                        <input type="number" step="0.01" id="pm-planopgto-preco" required class="w-full p-2 border rounded mt-1 text-sm">
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
                <button onclick="pmSalvarPlanoPagamento()" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar opção de pagamento</button>
                <p id="pm-planopgto-status" class="raiz-indicador-inline text-[11px]"></p>
            </div>
        </div>
        <div class="space-y-1.5">
            ${pmPlanoPagamentos.map(p => `
                <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300">
                    <div>
                        <p class="text-sm font-medium" style="color:var(--ink)">${p.nome}</p>
                        <p class="text-xs" style="color:var(--sage)">R$ ${Number(p.preco).toFixed(2)} · ${p.parcelas}x</p>
                    </div>
                </div>
            `).join('') || pmVazio('Nenhuma opção de pagamento cadastrada.')}
        </div>
    `;
}

function pmLabelFormaPgto(tipo) {
    return { pix: 'Pix', cc: 'Cartão de crédito', boleto: 'Boleto' }[tipo] || tipo;
}

async function pmSalvarForma() {
    const tipo_forma_pgto = document.getElementById('pm-forma-tipo').value;
    const ajusteRaw = document.getElementById('pm-forma-ajuste').value;
    const status = document.getElementById('pm-forma-status');

    const ajuste = ajusteRaw === '' ? 0 : Number(ajusteRaw) / 100;
    const { error } = await dbAuth.schema('comercial').from('forma_pagamento').insert({ tipo_forma_pgto, ajuste });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    await pmCarregarTudo();
    pmRenderPagamento();
}

async function pmSalvarPlanoPagamento() {
    const nome = document.getElementById('pm-planopgto-nome').value.trim();
    const preco = document.getElementById('pm-planopgto-preco').value;
    const parcelas = document.getElementById('pm-planopgto-parcelas').value || 1;
    const id_forma_pagamento = document.getElementById('pm-planopgto-forma').value;
    const status = document.getElementById('pm-planopgto-status');

    if (!nome || !preco || !id_forma_pagamento) { status.textContent = 'Preencha nome, preço e forma de pagamento.'; return; }

    const { error } = await dbAuth.schema('comercial').from('plano_pagamentos')
        .insert({ nome, preco: Number(preco), parcelas: Number(parcelas), id_forma_pagamento });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    await pmCarregarTudo();
    pmRenderPagamento();
}

// ============================================================================
// SUB-ABA: CAMPANHAS (comercial.plano_campanhas)
// ============================================================================

function pmRenderCampanhas() {
    const c = document.getElementById('pm-conteudo-subaba');
    c.innerHTML = `
        <div class="flex items-center justify-between mb-3">
            <p class="text-xs" style="color:var(--sage)">Ofertas com vigência própria (trial, cortesia, promoção sazonal...)</p>
            ${pmBotaoToggle('campanha-nova', 'pmAlternarPainel(\'form-campanha-nova-wrapper\',\'btn-toggle-campanha-nova\')')}
        </div>
        <div id="form-campanha-nova-wrapper" class="hidden mb-4">
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
                    <label class="block text-xs font-bold text-gray-600">Opção de pagamento</label>
                    <select id="pm-camp-pagamento" class="w-full p-2 border rounded mt-1 text-sm">
                        <option value="">— nenhuma (ex.: trial/cortesia gratuita) —</option>
                        ${pmPlanoPagamentos.map(p => `<option value="${p.id}">${p.nome} (R$ ${Number(p.preco).toFixed(2)})</option>`).join('')}
                    </select>
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
                        <input type="number" id="pm-camp-duracao-dias" placeholder="ex.: 14" class="w-full p-2 border rounded mt-1 text-sm">
                    </div>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Avisar quantos dias antes de vencer</label>
                    <input type="number" id="pm-camp-aviso-dias" value="3" class="w-full p-2 border rounded mt-1 text-sm">
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
                <p class="text-[10px]" style="color:var(--sage)">Início/fim de vigência é opcional — deixe em branco pra uma campanha sempre disponível (ex.: o trial padrão), preencha só pra promoções sazonais (ex.: Dia dos Pais).</p>
                <button onclick="pmSalvarCampanha()" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar campanha</button>
                <p id="pm-camp-status" class="raiz-indicador-inline text-[11px]"></p>
            </div>
        </div>
        <div class="space-y-2">
            ${pmCampanhas.map(cp => `
                <div class="bg-slate-50 p-3 rounded-xl border-2 border-slate-300">
                    <div class="flex items-center justify-between">
                        <p class="text-sm font-bold" style="color:var(--ink)">${cp.nome}</p>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:var(--brass-light);color:var(--brass-deep)">${cp.categoria}</span>
                    </div>
                    <p class="text-xs mt-1" style="color:var(--sage)">
                        ${pmLabelDuracao(cp)} · aviso ${cp.tempo_aviso_dias}d antes
                        ${cp.inicio_vigencia || cp.fim_vigencia ? ` · vigência ${cp.inicio_vigencia || '?'} a ${cp.fim_vigencia || '?'}` : ' · sempre disponível'}
                    </p>
                </div>
            `).join('') || pmVazio('Nenhuma campanha cadastrada ainda.')}
        </div>
    `;
}

function pmLabelDuracao(cp) {
    if (cp.duracao_tipo === 'dias_fixos') return `${cp.duracao_dias || '?'} dias`;
    if (cp.duracao_tipo === 'fim_do_mes') return 'até o fim do mês';
    if (cp.duracao_tipo === 'fim_do_ano') return 'até o fim do ano';
    return cp.duracao_tipo;
}

async function pmSalvarCampanha() {
    const nome = document.getElementById('pm-camp-nome').value.trim();
    const categoria = document.getElementById('pm-camp-categoria').value;
    const id_plano_pagamento = document.getElementById('pm-camp-pagamento').value || null;
    const duracao_tipo = document.getElementById('pm-camp-duracao-tipo').value;
    const duracao_dias = document.getElementById('pm-camp-duracao-dias').value || null;
    const tempo_aviso_dias = document.getElementById('pm-camp-aviso-dias').value || 3;
    const inicio_vigencia = document.getElementById('pm-camp-inicio').value || null;
    const fim_vigencia = document.getElementById('pm-camp-fim').value || null;
    const status = document.getElementById('pm-camp-status');

    if (!nome || !categoria || !duracao_tipo) { status.textContent = 'Preencha nome, categoria e duração.'; return; }
    if (duracao_tipo === 'dias_fixos' && !duracao_dias) { status.textContent = 'Informe a quantidade de dias.'; return; }

    const { error } = await dbAuth.schema('comercial').from('plano_campanhas').insert({
        nome, categoria, id_plano_pagamento, duracao_tipo,
        duracao_dias: duracao_dias ? Number(duracao_dias) : null,
        tempo_aviso_dias: Number(tempo_aviso_dias),
        inicio_vigencia, fim_vigencia
    });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    await pmCarregarTudo();
    pmRenderCampanhas();
}

// ============================================================================
// Helpers compartilhados (liga/desliga, vazio, etc.)
// ============================================================================

function pmBotaoToggle(id, onclick) {
    return `
        <button id="btn-toggle-${id}" onclick="${onclick}"
            class="raiz-btn-toggle w-11 h-11 flex-none flex items-center justify-center
                   bg-white border border-slate-300 rounded-full shadow active:scale-90 transition"
            style="color:var(--pine)" title="Adicionar">
            <svg class="raiz-icone-toggle w-5 h-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
        </button>
    `;
}

function pmAlternarPainel(wrapperId, btnId) {
    const wrapper = document.getElementById(wrapperId);
    const btn = document.getElementById(btnId);
    wrapper.classList.toggle('hidden');
    const aberto = !wrapper.classList.contains('hidden');
    btn.classList.toggle('ativo', aberto);
    const svg = btn.querySelector('svg.raiz-icone-toggle');
    svg.innerHTML = aberto
        ? '<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>'
        : '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>';
}

function pmVazio(msg) {
    return `<p class="text-sm text-center py-6" style="color:var(--sage)">${msg}</p>`;
}
