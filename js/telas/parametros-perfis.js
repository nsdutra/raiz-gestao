// ============================================================================
// js/telas/parametros-perfis.js — Raiz Gestão
//
// v0.13.0 (07/09/2026) — pedidos do Nicola: (1) mobile agrupado por área
// (recolhível), com faixa e divergência por linha, igual ao desktop;
// (2) os 3 códigos "sem regra" ganharam faixa: autenticar.* → Ver,
// *.alerta_alterar e solicitar.* → Operar; (3) master e master_plataforma
// passaram a ter todas as capacidades da empresa no banco (migration
// gestao_v0_17_master_tudo_cotas_ficha_oferta_v1) — as 2 proativas
// faltavam; plataforma.* segue só do master_plataforma.
//
// v0.12.0 (07/09/2026) — E.2 (revisão pós-fatia 8): a matriz virou a tela
// da REGRA DE PRODUTO. Linhas agrupadas por área (recolhíveis), cada uma
// com o nome comercial e a faixa pela regra de sufixo (Ver / Operar /
// Administrar / Zona vermelha / Plataforma / Proativa — PERFIS_E_ACESSOS
// v1.0 §3, pfFaixaDe). Célula que diverge da regra fica âmbar com tooltip
// do que a regra sugere; cabeçalho da área conta as divergências e tem
// "Aplicar regra" (só as divergências, com confirmação e lista do que
// muda; master e master_plataforma nunca são tocados — agora os DOIS são
// protegidos na célula, antes só master). A caixa "Regra de autorização
// proposta" virou a legenda das faixas. Mobile mostra faixa e área.
//
// v0.11.0 — Editar/excluir perfil (só existia criar, desde v0.10.0). Ícone
// de editar/excluir por perfil: desktop no cabeçalho da matriz, mobile numa
// linha abaixo das abas (mesmo padrão usado em Planos & Limites nesta
// mesma rodada). Requer gestao_fase6_editar_excluir_perfil_v1.sql
// (fn_editar_perfil/fn_excluir_perfil, SECURITY DEFINER + guarda master).
//
// Perfis protegidos (PF_PERFIS_PROTEGIDOS) nunca mostram ícone de editar/
// excluir — 'master' já era protegido pra toggle de funcionalidade desde
// v0.8.1; 'master_plataforma' (acesso cross-empresa, usado pelo próprio
// Raiz Gestão) entra na mesma lista agora. A trava de verdade é no banco
// (fn_editar_perfil/fn_excluir_perfil recusam os dois códigos mesmo que
// alguém chame a RPC direto) — esconder o botão na UI é só a primeira
// camada, não é a proteção real.
//
// v0.8.4: deixou de ser área própria de Parâmetros e virou sub-aba de
// Catálogo & Acessos (só mudou onde renderiza — #pm-conteudo-subaba em
// vez de #pm-conteudo-area — nenhuma lógica de matriz mudou).
//
// v0.8.1 (novo arquivo) — "Perfis & Acessos": matriz perfil × funcionalidade
// sobre public.perfis / public.perfil_funcionalidade. Não existia UI
// nenhuma pra isso até aqui (só cadastro manual via SQL).
//
// Master é protegido — a UI não permite desmarcar/remover funcionalidade
// do perfil "master" (mesmo satisfazendo a regra de não permitir remoção
// destrutiva do perfil master, conforme pedido). O banco não tem uma
// restrição técnica pra isso hoje — é só a UI que bloqueia; se um dia
// quiser reforçar no banco também, dá pra adicionar um trigger.
//
// Regra conceitual (texto explicativo fixo, não é enforcement real — a
// segurança de verdade continua no banco/RPC/RLS, isso aqui só ajuda a
// pessoa a entender o modelo):
//   plano_funcionalidade define o que a EMPRESA tem (entitlement).
//   perfil_funcionalidade define o que a PESSOA pode fazer (autorização).
// ============================================================================

const PF_PERFIS_PROTEGIDOS = ['master', 'master_plataforma'];


// ----------------------------------------------------------------------------
// v0.12.0 (E.2) — REGRA POR SUFIXO (PERFIS_E_ACESSOS_RAIZ v1.0 §3). A faixa
// de cada código é consequência do verbo, não um campo. A matriz mostra a
// faixa de cada linha, pinta a célula que DIVERGE da regra e oferece
// "Aplicar regra" por área — é onde o Nicola faz o ajuste fino.
// ----------------------------------------------------------------------------
const PF_FAIXAS = {
    ver:        { rotulo: 'Ver',           cor: 'var(--info)',    perfis: ['consulta', 'operador', 'admin', 'master', 'master_plataforma'] },
    operar:     { rotulo: 'Operar',        cor: 'var(--success)', perfis: ['operador', 'admin', 'master', 'master_plataforma'] },
    administrar:{ rotulo: 'Administrar',   cor: 'var(--warning)', perfis: ['admin', 'master', 'master_plataforma'] },
    vermelha:   { rotulo: 'Zona vermelha', cor: 'var(--danger)',  perfis: ['master', 'master_plataforma'] },
    plataforma: { rotulo: 'Plataforma',    cor: 'var(--ink)',     perfis: ['master_plataforma'] },
    proativa:   { rotulo: 'Proativa',      cor: 'var(--sage)',    perfis: [] },
    cota:       { rotulo: 'Cota técnica',  cor: 'var(--sage)',    perfis: ['consulta', 'operador', 'admin', 'master', 'master_plataforma'] },
};
function pfFaixaDe(codigo) {
    const c = codigo || '';
    if (/^(plataforma|gestao)\./.test(c)) return 'plataforma';
    if (/^alertar\./.test(c)) return 'proativa';
    if (c === 'storage.usar') return 'cota';
    if (/^(dev\.|dados\.(limpar|apagar)|licenca\.editar)/.test(c)) return 'vermelha';
    if (/\.excluir$/.test(c) || /^pessoas\./.test(c) || /^parametros\./.test(c) || /^(cofre\.(categorias|auditoria|ver_restrito|controles\.desativar)|imoveis\.divisao|repasses\.excluir)$/.test(c)) return 'administrar';
    if (/^autenticar\./.test(c)) return 'ver';           // v0.13 — acesso pelo WhatsApp: todo mundo
    if (/\.alerta_alterar$/.test(c) || /^solicitar\./.test(c)) return 'operar'; // v0.13 — reagendar alerta / bot pedindo apólice
    if (/\.ver$/.test(c) || /^relatorios\./.test(c) || /^(alertas\.consultar|cofre\.download|cofre\.baixar|cofre\.alertas\.ver|cofre\.controles\.ver)$/.test(c)) return 'ver';
    if (/\.(criar|editar|registrar|baixar|estornar|gerar|upload|tratar|reagendar|resolver|importar|enviar|compartilhar|estender|reajustar|usar|analisar_ia)$/.test(c) || /^(cobrar|vitrine|minutas|saidas)\./.test(c)) return 'operar';
    return null; // fora do padrão — mostra "?" e não sugere nada
}
function pfBadgeFaixa(codigo) {
    const k = pfFaixaDe(codigo); const f = k ? PF_FAIXAS[k] : null;
    return f ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full" style="border:1px solid ${f.cor};color:${f.cor}" title="Faixa pela regra de sufixo">${f.rotulo}</span>`
             : `<span class="text-[9px] px-1.5 py-0.5 rounded-full" style="border:1px dashed var(--sage);color:var(--sage)" title="Código fora do padrão de sufixo — sem regra">?</span>`;
}
/** true/false/null (null = sem regra) */
function pfRegraDiz(perfilCodigo, funcCodigo) {
    const k = pfFaixaDe(funcCodigo); if (!k) return null;
    return PF_FAIXAS[k].perfis.includes(perfilCodigo);
}
let pfAreasFechadas = new Set();
function pfAlternarArea(area) { if (pfAreasFechadas.has(area)) pfAreasFechadas.delete(area); else pfAreasFechadas.add(area); pfRenderizar(); }
async function pfAplicarRegraArea(area) {
    const funcs = pmFuncionalidades.filter(f => (f.area || '(sem área)') === area);
    const mudancas = [];
    for (const f of funcs) for (const p of pmPerfis) {
        if (PF_PERFIS_PROTEGIDOS.includes(p.codigo)) continue;
        const regra = pfRegraDiz(p.codigo, f.codigo); if (regra === null) continue;
        if (regra !== !!pfVinculo(p.codigo, f.codigo)) mudancas.push({ perfil: p.codigo, func: f.codigo, ativo: regra });
    }
    if (!mudancas.length) { alert('Área "' + area + '" já está igual à regra.'); return; }
    const resumo = mudancas.map(m => `${m.ativo ? '+' : '−'} ${m.perfil} · ${m.func}`).join('\n');
    if (!confirm(`Aplicar a regra de sufixo em "${area}"?\n\n${mudancas.length} mudança(s):\n${resumo}\n\nmaster e master_plataforma não são tocados.`)) return;
    for (const m of mudancas) {
        const { error } = await dbAuth.schema('gestao').rpc('fn_definir_perfil_funcionalidade', { p_perfil_codigo: m.perfil, p_funcionalidade_codigo: m.func, p_ativo: m.ativo });
        if (error) { alert(`Parou em ${m.perfil} · ${m.func}: ${error.message}`); break; }
        if (m.ativo) pmPerfilFuncionalidade.push({ perfil_codigo: m.perfil, funcionalidade_codigo: m.func });
        else { const i = pmPerfilFuncionalidade.findIndex(x => x.perfil_codigo === m.perfil && x.funcionalidade_codigo === m.func); if (i >= 0) pmPerfilFuncionalidade.splice(i, 1); }
    }
    pfRenderizar(); pfRenderMobile();
}

async function parametrosPerfisInit() {
    const c = document.getElementById('pm-conteudo-area');

    c.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
                <h2 class="text-sm font-extrabold" style="color:var(--ink)">Perfis & Acessos</h2>
                <p class="text-xs mt-0.5" style="color:var(--sage)">Perfil responde "quem pode fazer"; plano responde "a empresa contratou?". As duas condições precisam ser satisfeitas.</p>
            </div>
            ${pmBotaoToggle('perfil-form', "pfAbrirNovoPerfil()")}
        </div>

        <div id="form-perfil-form-wrapper" class="hidden mb-4">${pfFormNovoPerfil()}</div>

        <!-- Mobile (<768px): perfil primeiro, lista vertical (seção 6.2 do prompt v0.9.0) -->
        <div class="md:hidden rounded-2xl border-2 overflow-hidden mb-4" style="border-color:var(--line);background:#fff">
            <div class="p-4 border-b" style="border-color:var(--line)">
                <b class="text-sm" style="color:var(--ink)">Funcionalidades por perfil</b>
                <div class="flex gap-2 overflow-x-auto mt-2 pb-1" id="pf-mobile-tabs"></div>
                <p id="pf-mobile-legenda" class="text-[11px] mt-2" style="color:var(--sage)"></p>
                <div class="flex gap-4 mt-1" id="pf-mobile-acoes"></div>
            </div>
            <div id="pf-mobile-lista" class="p-3 space-y-2"></div>
        </div>

        <!-- Desktop (≥768px): matriz comparativa -->
        <div class="hidden md:block rounded-2xl border-2 overflow-hidden mb-4" style="border-color:var(--line);background:#fff">
            <div class="p-4 border-b" style="border-color:var(--line)">
                <b class="text-sm" style="color:var(--ink)">Matriz perfil × funcionalidade</b>
                <p class="text-[11px] mt-0.5" style="color:var(--sage)">Não é licença: é autorização do usuário dentro do que a empresa já possui.</p>
            </div>
            <div class="overflow-x-auto" id="pf-matrix"></div>
        </div>

        <div class="p-4 rounded-2xl border-2" style="border-color:var(--line);background:#fff">
            <b class="text-sm" style="color:var(--ink)">Regra por sufixo (PERFIS_E_ACESSOS v1.0 §3)</b>
            <p class="text-xs mt-1" style="color:var(--sage)">A faixa vem do verbo do código: <b>Ver</b> (*.ver, relatorios.*, alertas.consultar, cofre.download) → todos · <b>Operar</b> (*.criar/editar/registrar/baixar/estornar/gerar/upload/tratar…, cobrar.*, vitrine.*, minutas.*, saidas.*, ia.usar) → operador+ · <b>Administrar</b> (*.excluir, pessoas.*, parametros.*, cofre.categorias/auditoria/ver_restrito) → admin+ · <b>Zona vermelha</b> (dev.*, dados.limpar/apagar, licenca.editar) → master · <b>Plataforma</b> (plataforma.*, gestao.*) → master_plataforma · <b>Proativa</b> (alertar.*) → sem perfil.</p>
            <p class="text-xs mt-2" style="color:var(--sage)">Célula com fundo âmbar = está diferente da regra (passe o mouse pra ver o que a regra sugere). "Aplicar regra" na área grava só as divergências, com confirmação; master e master_plataforma nunca são tocados.</p>
        </div>
    `;

    pfRenderizar();
    pfRenderMobile();
}

// ----------------------------------------------------------------------------
// Criar/editar perfil — v0.10.0 criou (fn_criar_perfil); v0.11.0 acrescentou
// edição (fn_editar_perfil), reaproveitando o mesmo formulário: código vira
// readonly quando pfPerfilEditCodigo está preenchido (mesmo padrão de
// pmFormPlano em parametros-master.js). Exclusão fica em função separada
// (pfExcluirPerfil), não usa este formulário.
// ----------------------------------------------------------------------------
let pfPerfilEditCodigo = null;

function pfFormNovoPerfil() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Código <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pf-perfil-codigo" required placeholder="ex.: gerente" class="w-full p-2 border rounded mt-1 text-sm">
                <p class="text-[10px] mt-1" style="color:var(--sage)">Minúsculo, sem espaço — normalizado automaticamente ao salvar.</p>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Descrição <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pf-perfil-descricao" required placeholder="ex.: Gerente de operações" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <button onclick="pfSalvarNovoPerfil()" id="pf-perfil-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar perfil</button>
            <p id="pf-perfil-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function pfAbrirNovoPerfil() {
    pfPerfilEditCodigo = null;
    const wrapper = document.getElementById('form-perfil-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pf-perfil-codigo').disabled = false;
    document.getElementById('pf-perfil-codigo').value = '';
    document.getElementById('pf-perfil-descricao').value = '';
    document.getElementById('pf-perfil-status').textContent = '';
    document.getElementById('pf-perfil-btn-salvar').textContent = 'Salvar perfil';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function pfAbrirEdicaoPerfil(codigo) {
    if (PF_PERFIS_PROTEGIDOS.includes(codigo)) return; // defesa extra, além de o botão não aparecer
    const p = pmPerfis.find(x => x.codigo === codigo);
    if (!p) return;
    pfPerfilEditCodigo = codigo;
    const wrapper = document.getElementById('form-perfil-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pf-perfil-codigo').value = p.codigo;
    document.getElementById('pf-perfil-codigo').disabled = true;
    document.getElementById('pf-perfil-descricao').value = p.descricao;
    document.getElementById('pf-perfil-status').textContent = '';
    document.getElementById('pf-perfil-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pfSalvarNovoPerfil() {
    const codigo = document.getElementById('pf-perfil-codigo').value.trim();
    const descricao = document.getElementById('pf-perfil-descricao').value.trim();
    const status = document.getElementById('pf-perfil-status');
    if (!codigo || !descricao) { status.textContent = 'Preencha código e descrição.'; return; }

    status.textContent = 'Salvando...';
    const { error } = pfPerfilEditCodigo
        ? await dbAuth.schema('gestao').rpc('fn_editar_perfil', { p_codigo: codigo, p_descricao: descricao })
        : await dbAuth.schema('gestao').rpc('fn_criar_perfil', { p_codigo: codigo, p_descricao: descricao });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    document.getElementById('form-perfil-form-wrapper').classList.add('hidden');
    pfPerfilEditCodigo = null;
    await pmCarregarTudo();       // recarrega pmPerfis com o registro atualizado
    parametrosPerfisInit();       // re-renderiza a tela inteira (matriz + mobile)
}

// Exclusão — confirmação obrigatória (padrão do resto do app) + mensagem
// amigável já vem pronta da RPC quando o perfil ainda está em uso (não
// depende de interpretar erro de FK aqui, a RPC já devolve texto legível).
async function pfExcluirPerfil(codigo, nome) {
    if (PF_PERFIS_PROTEGIDOS.includes(codigo)) return;
    if (!confirm(`Excluir o perfil "${nome}" (${codigo})?\n\nEssa ação não pode ser desfeita.`)) return;

    const { error } = await dbAuth.schema('gestao').rpc('fn_excluir_perfil', { p_codigo: codigo });
    if (error) { alert('Erro ao excluir: ' + error.message); return; }

    await pmCarregarTudo();
    parametrosPerfisInit();
}

let pfPerfilMobileAtivo = null;

function pfRenderMobile() {
    const perfis = pmPerfis;
    if (!pfPerfilMobileAtivo || !perfis.some(p => p.codigo === pfPerfilMobileAtivo)) {
        pfPerfilMobileAtivo = perfis[0]?.codigo || null;
    }

    const tabs = document.getElementById('pf-mobile-tabs');
    if (tabs) {
        tabs.innerHTML = perfis.map(p => `
            <button onclick="pfMudarPerfilMobile('${p.codigo}')" class="px-3 py-1.5 rounded-full text-xs font-bold flex-none"
                style="background:${p.codigo === pfPerfilMobileAtivo ? 'var(--pine)' : 'var(--paper)'};color:${p.codigo === pfPerfilMobileAtivo ? '#fff' : 'var(--ink)'}" title="${pmEsc(p.descricao)}">${p.codigo}${p.codigo === 'master' ? ' 🔒' : ''}</button>
        `).join('');
    }

    const legenda = document.getElementById('pf-mobile-legenda');
    if (legenda) {
        const ativo = perfis.find(p => p.codigo === pfPerfilMobileAtivo);
        legenda.textContent = ativo?.descricao || '';
    }

    const acoes = document.getElementById('pf-mobile-acoes');
    if (acoes) {
        const ativo = perfis.find(p => p.codigo === pfPerfilMobileAtivo);
        acoes.innerHTML = (ativo && !PF_PERFIS_PROTEGIDOS.includes(ativo.codigo)) ? `
            <button onclick="pfAbrirEdicaoPerfil('${ativo.codigo}')" class="text-[11px] font-bold flex items-center gap-1" style="color:var(--pine)">${pmIconeEditar()} Editar nome</button>
            <button onclick="pfExcluirPerfil('${ativo.codigo}','${pmEsc(ativo.descricao)}')" class="text-[11px] font-bold flex items-center gap-1" style="color:var(--danger)">${pmIconeExcluir()} Excluir</button>
        ` : (ativo ? `<span class="text-[10px]" style="color:var(--sage)">🔒 Perfil protegido — não pode ser renomeado/excluído pela UI.</span>` : '');
    }

    const lista = document.getElementById('pf-mobile-lista');
    if (!lista) return;
    if (!pfPerfilMobileAtivo) { lista.innerHTML = `<p class="text-xs text-center py-4" style="color:var(--sage)">Nenhum perfil cadastrado ainda.</p>`; return; }

    const protegido = PF_PERFIS_PROTEGIDOS.includes(pfPerfilMobileAtivo); // v0.13 — master_plataforma também
    // v0.13.0 — agrupado por ÁREA (mesma lógica da matriz do desktop), com a
    // faixa por sufixo em cada linha e contagem de divergências por área.
    const porArea = {};
    pmFuncionalidades.forEach(f => { const a = f.area || '(sem área)'; (porArea[a] = porArea[a] || []).push(f); });
    lista.innerHTML = Object.keys(porArea).sort().map(area => {
        const fechada = pfAreasFechadas.has('m:' + area);
        const diverg = protegido ? 0 : porArea[area].filter(f => pfRegraDiz(pfPerfilMobileAtivo, f.codigo) !== null && pfRegraDiz(pfPerfilMobileAtivo, f.codigo) !== !!pfVinculo(pfPerfilMobileAtivo, f.codigo)).length;
        return `
        <button type="button" onclick="pfAlternarAreaMobile('${pmEsc(area)}')" class="w-full flex items-center justify-between py-2 mt-1">
            <span class="text-[11px] font-bold uppercase tracking-wide" style="color:var(--pine)">${fechada ? '▸' : '▾'} ${pmEsc(area)} <span class="font-normal" style="color:var(--sage)">· ${porArea[area].length}</span></span>
            ${diverg ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:var(--warning-bg);color:var(--warning)">${diverg} fora da regra</span>` : ''}
        </button>
        ${fechada ? '' : porArea[area].map(f => {
            const v = !!pfVinculo(pfPerfilMobileAtivo, f.codigo);
            const regra = pfRegraDiz(pfPerfilMobileAtivo, f.codigo);
            const diverge = !protegido && regra !== null && regra !== v;
            return `
            <label class="flex items-center justify-between gap-3 p-3 rounded-xl border-2" style="border-color:${diverge ? 'var(--warning)' : 'var(--line)'};background:${diverge ? 'var(--warning-bg)' : '#fff'}" ${diverge ? `title="Regra sugere: ${regra ? 'liberar' : 'não liberar'}"` : ''}>
                <div class="min-w-0">
                    <div class="flex items-center gap-1.5"><b class="text-xs truncate" style="color:var(--ink)">${pmEsc(f.nome_comercial || f.codigo)}</b>${pfBadgeFaixa(f.codigo)}</div>
                    <div class="text-[10px] truncate font-mono" style="color:var(--sage)">${f.codigo}</div>
                </div>
                <input type="checkbox" class="w-5 h-5 flex-none" ${v ? 'checked' : ''} ${protegido ? 'disabled' : ''}
                    onchange="pfToggleMobile('${pfPerfilMobileAtivo}','${f.codigo}', this.checked)">
            </label>`;
        }).join('')}`;
    }).join('');
}
function pfAlternarAreaMobile(area) { const k = 'm:' + area; if (pfAreasFechadas.has(k)) pfAreasFechadas.delete(k); else pfAreasFechadas.add(k); pfRenderMobile(); }

async function pfToggleMobile(perfilCodigo, funcCodigo, marcado) {
    await pfToggle(perfilCodigo, funcCodigo, marcado);
    pfRenderMobile();
}

function pfMudarPerfilMobile(codigo) {
    pfPerfilMobileAtivo = codigo;
    pfRenderMobile();
}

function pfVinculo(perfilCodigo, funcCodigo) {
    return pmPerfilFuncionalidade.find(pf => pf.perfil_codigo === perfilCodigo && pf.funcionalidade_codigo === funcCodigo);
}

function pfRenderizar() {
    const el = document.getElementById('pf-matrix');
    const perfis = pmPerfis; // usa os valores REAIS do banco, não uma lista fixa

    el.innerHTML = `
        <table class="w-full text-xs" style="border-collapse:separate;border-spacing:0">
            <thead>
                <tr>
                    <th class="sticky left-0 bg-white text-left p-2 border-b" style="border-color:var(--line);min-width:200px">Funcionalidade</th>
                    ${perfis.map(p => {
                        const protegido = PF_PERFIS_PROTEGIDOS.includes(p.codigo);
                        return `
                        <th class="p-2 border-b text-left align-top" style="border-color:var(--line);min-width:130px">
                            <div class="flex items-start justify-between gap-1">
                                <span style="color:var(--ink)">${p.codigo}${protegido ? ' 🔒' : ''}</span>
                                ${protegido ? '' : `
                                    <span class="flex gap-1 flex-none">
                                        <button type="button" onclick="pfAbrirEdicaoPerfil('${p.codigo}')" title="Editar descrição de ${pmEsc(p.descricao)}">${pmIconeEditar()}</button>
                                        <button type="button" onclick="pfExcluirPerfil('${p.codigo}','${pmEsc(p.descricao)}')" title="Excluir ${pmEsc(p.descricao)}">${pmIconeExcluir()}</button>
                                    </span>`}
                            </div>
                            <div class="text-[9px] font-normal" style="color:var(--sage)">${p.descricao}</div>
                        </th>`;
                    }).join('')}
                </tr>
            </thead>
            <tbody>
                ${(() => {
                    const porArea = {};
                    pmFuncionalidades.forEach(f => { const a = f.area || '(sem área)'; (porArea[a] = porArea[a] || []).push(f); });
                    return Object.keys(porArea).sort().map(area => {
                        const fechada = pfAreasFechadas.has(area);
                        const diverg = porArea[area].reduce((n, f) => n + perfis.filter(p => !PF_PERFIS_PROTEGIDOS.includes(p.codigo) && pfRegraDiz(p.codigo, f.codigo) !== null && pfRegraDiz(p.codigo, f.codigo) !== !!pfVinculo(p.codigo, f.codigo)).length, 0);
                        return `
                        <tr style="background:var(--paper)">
                            <td colspan="${perfis.length + 1}" class="p-2 border-b" style="border-color:var(--line)">
                                <div class="flex items-center justify-between gap-2">
                                    <button type="button" onclick="pfAlternarArea('${pmEsc(area)}')" class="text-[11px] font-bold uppercase tracking-wide" style="color:var(--pine)">${fechada ? '▸' : '▾'} ${pmEsc(area)} <span class="font-normal" style="color:var(--sage)">· ${porArea[area].length}</span></button>
                                    <span class="flex items-center gap-2">
                                        ${diverg ? `<span class="text-[10px] font-bold px-2 py-0.5 rounded-full" style="background:var(--warning-bg);color:var(--warning)">${diverg} fora da regra</span>` : `<span class="text-[10px]" style="color:var(--success)">igual à regra</span>`}
                                        ${diverg ? `<button type="button" onclick="pfAplicarRegraArea('${pmEsc(area)}')" class="text-[10px] font-bold px-2 py-0.5 rounded-full text-white" style="background:var(--pine)">Aplicar regra</button>` : ''}
                                    </span>
                                </div>
                            </td>
                        </tr>
                        ${fechada ? '' : porArea[area].map(f => `
                        <tr>
                            <td class="sticky left-0 bg-white p-2 border-b" style="border-color:var(--line)">
                                <div class="flex items-center gap-2"><b style="color:var(--ink)">${pmEsc(f.nome_comercial || f.codigo)}</b>${pfBadgeFaixa(f.codigo)}</div>
                                <div class="text-[9px] font-mono" style="color:var(--sage)">${f.codigo}</div>
                            </td>
                            ${perfis.map(p => pfCelula(p.codigo, f.codigo)).join('')}
                        </tr>`).join('')}`;
                    }).join('');
                })()}
            </tbody>
        </table>
    `;
}

function pfCelula(perfilCodigo, funcCodigo) {
    const v = !!pfVinculo(perfilCodigo, funcCodigo);
    const protegido = PF_PERFIS_PROTEGIDOS.includes(perfilCodigo);
    const regra = pfRegraDiz(perfilCodigo, funcCodigo);
    const diverge = !protegido && regra !== null && regra !== v;
    return `
        <td class="p-2 border-b text-center" style="border-color:var(--line)${diverge ? ';background:var(--warning-bg)' : ''}" ${diverge ? `title="Regra sugere: ${regra ? 'liberar' : 'não liberar'}"` : ''}>
            <input type="checkbox" ${v ? 'checked' : ''} ${protegido ? 'disabled title="Perfil master é protegido — não editável pela UI"' : ''}
                onchange="pfToggle('${perfilCodigo}','${funcCodigo}', this.checked)">
        </td>
    `;
}

async function pfToggle(perfilCodigo, funcCodigo, marcado) {
    if (PF_PERFIS_PROTEGIDOS.includes(perfilCodigo)) return; // proteção extra, além do disabled no input

    // v0.10.0 — public.perfil_funcionalidade só teve policy de SELECT desde
    // sempre (nunca teve GRANT de INSERT/DELETE, nem pra authenticated nem
    // pra service_role). Escrita direta aqui nunca funcionou ("permission
    // denied", reportado em 23/08/2026) — trocado por RPC master-only.
    const { error } = await dbAuth.schema('gestao').rpc('fn_definir_perfil_funcionalidade', {
        p_perfil_codigo: perfilCodigo, p_funcionalidade_codigo: funcCodigo, p_ativo: marcado
    });
    if (error) { alert((marcado ? 'Erro ao vincular: ' : 'Erro ao desvincular: ') + error.message); return; }

    // Atualiza só o estado local (evita recarregar tudo/perder scroll numa
    // matriz que pode ter dezenas de linhas).
    if (marcado) {
        pmPerfilFuncionalidade.push({ perfil_codigo: perfilCodigo, funcionalidade_codigo: funcCodigo });
    } else {
        const idx = pmPerfilFuncionalidade.findIndex(pf => pf.perfil_codigo === perfilCodigo && pf.funcionalidade_codigo === funcCodigo);
        if (idx >= 0) pmPerfilFuncionalidade.splice(idx, 1);
    }
}
