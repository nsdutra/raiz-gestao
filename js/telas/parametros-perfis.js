// ============================================================================
// js/telas/parametros-perfis.js — Raiz Gestão
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
            <div class="flex items-start gap-3">
                <div class="w-9 h-9 rounded-lg flex items-center justify-center flex-none" style="background:var(--info-bg);color:var(--info)">🛡️</div>
                <div>
                    <b class="text-sm" style="color:var(--ink)">Regra de autorização proposta</b>
                    <p class="text-xs mt-1" style="color:var(--sage)">A UI deve liberar a ação somente se <b>plano contém a funcionalidade</b> E <b>perfil contém a funcionalidade</b>. Segurança real continua no banco/RPC/RLS; esconder botão não é controle de segurança.</p>
                    <p class="text-xs mt-2" style="color:var(--warning)"><b>Observação (mantida desde a rodada anterior):</b> a função pública tem_acesso() hoje confere só o lado do perfil (perfil_funcionalidade) — não confere se o plano da empresa também tem a funcionalidade. Não alteramos essa função (é usada pelo app de Imóveis, fora do escopo do Gestão); fica registrado aqui pra decisão futura.</p>
                </div>
            </div>
        </div>
    `;

    pfRenderizar();
    pfRenderMobile();
}

// ----------------------------------------------------------------------------
// Novo perfil — v0.10.0. Não existia UI nenhuma pra isso até aqui (só
// cadastro manual via SQL). Usa gestao.fn_criar_perfil() — public.perfis
// só tem SELECT liberado pra authenticated, escrita direta nunca funcionou.
// ----------------------------------------------------------------------------
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
    const wrapper = document.getElementById('form-perfil-form-wrapper');
    wrapper.classList.remove('hidden');
    document.getElementById('pf-perfil-codigo').value = '';
    document.getElementById('pf-perfil-descricao').value = '';
    document.getElementById('pf-perfil-status').textContent = '';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function pfSalvarNovoPerfil() {
    const codigo = document.getElementById('pf-perfil-codigo').value.trim();
    const descricao = document.getElementById('pf-perfil-descricao').value.trim();
    const status = document.getElementById('pf-perfil-status');
    if (!codigo || !descricao) { status.textContent = 'Preencha código e descrição.'; return; }

    status.textContent = 'Salvando...';
    const { error } = await dbAuth.schema('gestao').rpc('fn_criar_perfil', { p_codigo: codigo, p_descricao: descricao });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    document.getElementById('form-perfil-form-wrapper').classList.add('hidden');
    await pmCarregarTudo();       // recarrega pmPerfis com o novo registro
    parametrosPerfisInit();       // re-renderiza a tela inteira (matriz + mobile)
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

    const lista = document.getElementById('pf-mobile-lista');
    if (!lista) return;
    if (!pfPerfilMobileAtivo) { lista.innerHTML = `<p class="text-xs text-center py-4" style="color:var(--sage)">Nenhum perfil cadastrado ainda.</p>`; return; }

    const protegido = pfPerfilMobileAtivo === 'master';
    lista.innerHTML = pmFuncionalidades.map(f => {
        const v = !!pfVinculo(pfPerfilMobileAtivo, f.codigo);
        return `
        <div class="p-3 rounded-xl border flex items-center justify-between gap-2" style="border-color:var(--line)">
            <div class="min-w-0">
                <b class="text-xs" style="color:var(--ink)">${f.codigo}</b>
                <div class="text-[10px] truncate" style="color:var(--sage)">${f.nome_comercial || f.descricao}</div>
            </div>
            <input type="checkbox" ${v ? 'checked' : ''} class="flex-none" ${protegido ? 'disabled title="Perfil master é protegido"' : ''}
                onchange="pfToggleMobile('${pfPerfilMobileAtivo}','${f.codigo}', this.checked)">
        </div>`;
    }).join('');
}

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
                    ${perfis.map(p => `<th class="p-2 border-b text-left" style="border-color:var(--line);min-width:100px" title="${pmEsc(p.descricao)}">${p.codigo}${p.codigo === 'master' ? ' 🔒' : ''}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${pmFuncionalidades.map(f => `
                    <tr>
                        <td class="sticky left-0 bg-white p-2 border-b" style="border-color:var(--line)">
                            <b style="color:var(--ink)">${f.codigo}</b>
                            <div class="text-[9px]" style="color:var(--sage)">${f.nome_comercial || f.descricao}</div>
                        </td>
                        ${perfis.map(p => pfCelula(p.codigo, f.codigo)).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function pfCelula(perfilCodigo, funcCodigo) {
    const v = !!pfVinculo(perfilCodigo, funcCodigo);
    const protegido = perfilCodigo === 'master';
    return `
        <td class="p-2 border-b text-center" style="border-color:var(--line)">
            <input type="checkbox" ${v ? 'checked' : ''} ${protegido ? 'disabled title="Perfil master é protegido — não editável pela UI"' : ''}
                onchange="pfToggle('${perfilCodigo}','${funcCodigo}', this.checked)">
        </td>
    `;
}

async function pfToggle(perfilCodigo, funcCodigo, marcado) {
    if (perfilCodigo === 'master') return; // proteção extra, além do disabled no input

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
