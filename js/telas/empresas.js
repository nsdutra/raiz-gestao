// ============================================================================
// js/telas/empresas.js — Raiz Gestão
//
// v0.11.0:
//   - Lista de empresas passou a mostrar quantidade de pessoas cadastradas
//     (gestao.fn_lista_empresas() ganhou qtd_pessoas — requer
//     gestao_fase6_empresas_pessoas_adocao_v1.sql).
//   - NOVA 2ª sub-aba "Adoção": em quantos dias (dentro do período) cada
//     pessoa entrou pelo menos 1 vez — gestao.fn_empresas_adocao(), padrão
//     de período = últimos 30 dias. Filtra por período/empresa/pessoa,
//     mesmo padrão de filtro de nav.js (gestaoFiltroPeriodoHtml/
//     gestaoLerFiltroPeriodo) usado em Comercial/Saúde.
//
// v0.7.0: ficha ganhou seção "Uso & Consumo" (gestao.fn_uso_empresa_resumo/
// _top_app/_top_bot) — consumo real de imóveis/contratos vs. limite, ações
// mais usadas no app e no bot, com ícone de informação explicando que só
// imóveis/contratos têm contador de uso implementado hoje.
//
// v0.6.0: lista de empresas (gestao.fn_lista_empresas()) com busca
// client-side e ficha executiva (gestao.fn_ficha_empresa()) num modal
// simples. "Entrar nesta empresa" fica marcado como pendente — depende de
// decisão ainda em aberto na arquitetura (mecanismo de troca de empresa
// do master, seção 8 do MODULO_GESTAO_ESTRATEGIA_ARQUITETURA.md) e não é
// implementado nesta rodada pra não inventar contrato de navegação novo
// sem essa decisão fechada.
// ============================================================================

let empresasCache = [];
let edPessoasCache = [];

const ED_ABAS = [
    { id: 'lista', label: 'Empresas', init: () => edMudarSubAba('lista') },
    { id: 'adocao', label: 'Adoção', init: () => edMudarSubAba('adocao') }
];

async function telaEmpresasInit() {
    const { data, error } = await dbAuth.schema('gestao').rpc('fn_lista_empresas');
    if (error) { gestaoErro(error.message); return; }
    empresasCache = data || [];

    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="flex gap-2 mb-4 border-b overflow-x-auto" style="border-color:var(--line)">
            ${ED_ABAS.map(a => `<button onclick="edMudarSubAba('${a.id}')" id="ed-tab-${a.id}" class="pm-subaba px-3.5 py-2 text-xs font-bold whitespace-nowrap">${a.label}</button>`).join('')}
        </div>
        <div id="ed-conteudo" class="min-w-0"></div>
        <div id="empresas-modal" class="hidden"></div>
    `;
    edMudarSubAba('lista');
}

function edMudarSubAba(nome) {
    document.querySelectorAll('[id^="ed-tab-"]').forEach(b => {
        b.style.color = 'var(--sage)';
        b.style.borderBottom = 'none';
    });
    const ativa = document.getElementById('ed-tab-' + nome);
    if (ativa) { ativa.style.color = 'var(--pine)'; ativa.style.borderBottom = '3px solid var(--brass)'; }

    if (nome === 'lista') edRenderListaEmpresas();
    else if (nome === 'adocao') edRenderAdocao();
}

// ----------------------------------------------------------------------------
// Sub-aba "Empresas" — lista com busca (lógica de busca sem mudança).
// ----------------------------------------------------------------------------
function edRenderListaEmpresas() {
    const el = document.getElementById('ed-conteudo');
    el.innerHTML = `
        <input type="text" id="empresas-busca" placeholder="Buscar empresa, cidade..."
            oninput="empresasRenderLista()"
            class="w-full p-3 border-2 rounded-xl text-sm mb-4" style="border-color:var(--line)">
        <div id="empresas-lista" class="space-y-2"></div>
    `;
    empresasRenderLista();
}

function empresasRenderLista() {
    const termo = (document.getElementById('empresas-busca').value || '').toLowerCase();
    const lista = empresasCache.filter(e =>
        !termo || (e.nome_empresa || '').toLowerCase().includes(termo) || (e.cidade || '').toLowerCase().includes(termo));

    document.getElementById('empresas-lista').innerHTML = lista.map(e => {
        const statusCor = e.licenca_status === 'ativo' ? 'var(--success)' : 'var(--danger)';
        const statusBg = e.licenca_status === 'ativo' ? 'var(--success-bg)' : 'var(--danger-bg)';
        const ultimoAcesso = e.ultimo_acesso ? new Date(e.ultimo_acesso).toLocaleDateString('pt-BR') : 'Nunca acessou';
        return `
            <button onclick="empresasAbrirFicha('${e.cliente_id}')"
                class="w-full flex items-center justify-between p-3 rounded-xl border-2 text-left" style="border-color:var(--line);background:#fff">
                <div class="min-w-0 flex-1 pr-3">
                    <p class="text-sm font-bold truncate" style="color:var(--ink)">${e.nome_empresa}</p>
                    <p class="text-xs truncate" style="color:var(--sage)">${e.cidade || '—'}${e.uf ? '/' + e.uf : ''} · plano ${e.plano_codigo || '—'} · ${e.qtd_pessoas ?? 0} pessoa${e.qtd_pessoas == 1 ? '' : 's'} · último acesso: ${ultimoAcesso}</p>
                </div>
                <div class="flex items-center gap-2 flex-none">
                    <span class="text-[10px] font-bold px-2 py-1 rounded-full" style="background:${statusBg};color:${statusCor}">${e.licenca_status || 'sem licença'}</span>
                    <span class="text-xs" style="color:var(--sage)">${e.uso_30d} ações/30d</span>
                </div>
            </button>
        `;
    }).join('') || `<p class="text-sm text-center py-8" style="color:var(--sage)">Nenhuma empresa encontrada.</p>`;
}

// ----------------------------------------------------------------------------
// Sub-aba "Adoção" (NOVA v0.11.0) — em quantos dias do período cada pessoa
// entrou pelo menos 1 vez. Barra reaproveita gestaoBarra() com
// máximo=dias_periodo, então o preenchimento da barra já é a taxa de
// adoção (dias ativos / dias do período), sem precisar de mais um cálculo
// na tela.
// ----------------------------------------------------------------------------
async function edRenderAdocao() {
    const el = document.getElementById('ed-conteudo');
    el.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    if (edPessoasCache.length === 0) {
        const { data, error } = await dbAuth.schema('gestao').rpc('fn_lista_pessoas');
        if (error) { el.innerHTML = `<p class="text-sm" style="color:var(--danger)">Erro: ${error.message}</p>`; return; }
        edPessoasCache = data || [];
    }

    el.innerHTML = `
        <div class="flex flex-wrap gap-2 mb-5 items-end">
            <label class="flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase" style="color:var(--sage)">Empresa</span>
                <select id="ed-ad-filtro-empresa" onchange="edAdMudarEmpresa()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line)">
                    <option value="">Todas as empresas</option>
                    ${empresasCache.map(e => `<option value="${e.cliente_id}">${pmEsc(e.nome_empresa)}</option>`).join('')}
                </select>
            </label>
            <label class="flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase" style="color:var(--sage)">Pessoa</span>
                <select id="ed-ad-filtro-pessoa" onchange="edCarregarAdocao()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line);min-width:160px">
                    <option value="">Todas as pessoas</option>
                    ${edPessoasCache.map(p => `<option value="${p.pessoa_id}" data-cliente="${p.cliente_id}">${pmEsc(p.nome)} · ${pmEsc(p.nome_empresa)}</option>`).join('')}
                </select>
            </label>
            ${gestaoFiltroPeriodoHtml('ed-ad', 30)}
            <button onclick="edCarregarAdocao()" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Aplicar</button>
        </div>
        <p class="text-[11px] mb-3" style="color:var(--sage)">Barra = dias ativos (pelo menos 1 login) dividido pelos dias do período. Fonte: log_acessos, acao='login'.</p>
        <div id="ed-ad-lista" class="space-y-2"></div>
    `;

    edCarregarAdocao();
}

function edAdMudarEmpresa() {
    const clienteId = document.getElementById('ed-ad-filtro-empresa').value;
    const selPessoa = document.getElementById('ed-ad-filtro-pessoa');
    const atual = selPessoa.value;
    const opcoes = edPessoasCache.filter(p => !clienteId || p.cliente_id === clienteId);
    selPessoa.innerHTML = `<option value="">Todas as pessoas</option>` +
        opcoes.map(p => `<option value="${p.pessoa_id}" data-cliente="${p.cliente_id}">${pmEsc(p.nome)} · ${pmEsc(p.nome_empresa)}</option>`).join('');
    if (opcoes.some(p => p.pessoa_id === atual)) selPessoa.value = atual;
    edCarregarAdocao();
}

async function edCarregarAdocao() {
    const el = document.getElementById('ed-ad-lista');
    if (!el) return;
    el.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    const { inicio, fim } = gestaoLerFiltroPeriodo('ed-ad', 30);
    const clienteId = document.getElementById('ed-ad-filtro-empresa').value || null;
    const pessoaId = document.getElementById('ed-ad-filtro-pessoa').value || null;

    const { data, error } = await dbAuth.schema('gestao').rpc('fn_empresas_adocao', {
        p_data_inicio: inicio, p_data_fim: fim, p_cliente_id: clienteId, p_pessoa_id: pessoaId
    });
    if (error) { el.innerHTML = `<p class="text-sm" style="color:var(--danger)">Erro: ${error.message}</p>`; return; }

    const linhas = data || [];
    el.innerHTML = linhas.map(p => {
        const dias = p.dias_periodo || 1;
        const ultimo = p.ultimo_login ? new Date(p.ultimo_login).toLocaleDateString('pt-BR') : 'nunca';
        return gestaoBarra(`${p.pessoa_nome} · ${p.nome_empresa}`, p.dias_ativos, dias,
            (v) => `${v}/${dias} dia(s) · último: ${ultimo}`);
    }).join('') || `<p class="text-sm text-center py-8" style="color:var(--sage)">Nenhuma pessoa encontrada pro filtro selecionado.</p>`;
}

async function empresasAbrirFicha(clienteId) {
    const [{ data: fichaData, error }, { data: uso, error: eUso }, { data: topApp }, { data: topBot }] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_ficha_empresa', { p_cliente_id: clienteId }),
        dbAuth.schema('gestao').rpc('fn_uso_empresa_resumo', { p_cliente_id: clienteId }),
        dbAuth.schema('gestao').rpc('fn_uso_empresa_top_app', { p_cliente_id: clienteId }),
        dbAuth.schema('gestao').rpc('fn_uso_empresa_top_bot', { p_cliente_id: clienteId })
    ]);
    if (error) { alert('Erro ao carregar ficha: ' + error.message); return; }
    const f = (fichaData && fichaData[0]);
    if (!f) { alert('Empresa não encontrada.'); return; }
    const u = (uso && uso[0]) || {};
    if (eUso) console.warn('Uso & Consumo indisponível:', eUso.message);

    const modal = document.getElementById('empresas-modal');
    modal.classList.remove('hidden');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-end md:items-center justify-center p-3" style="background:rgba(15,23,42,.48)" onclick="if(event.target===this) empresasFecharFicha()">
            <div class="w-full max-w-lg max-h-[90vh] overflow-auto rounded-2xl p-6" style="background:#fff">
                <div class="flex items-start justify-between mb-4">
                    <div>
                        <h3 class="text-lg font-extrabold" style="color:var(--ink)">${f.nome_empresa}</h3>
                        <p class="text-xs" style="color:var(--sage)">${f.cidade || '—'}${f.uf ? '/' + f.uf : ''} · ${f.cnpj || 'sem CNPJ cadastrado'}</p>
                    </div>
                    <button onclick="empresasFecharFicha()" class="text-2xl leading-none" style="color:var(--sage)">&times;</button>
                </div>
                <div class="grid grid-cols-2 gap-3 mb-4">
                    <div class="p-3 rounded-xl" style="background:var(--paper)"><p class="text-[10px]" style="color:var(--sage)">Plano</p><p class="text-sm font-bold">${f.plano_codigo || '—'}</p></div>
                    <div class="p-3 rounded-xl" style="background:var(--paper)"><p class="text-[10px]" style="color:var(--sage)">Status licença</p><p class="text-sm font-bold">${f.licenca_status || '—'}</p></div>
                    <div class="p-3 rounded-xl" style="background:var(--paper)"><p class="text-[10px]" style="color:var(--sage)">Uso 30d</p><p class="text-sm font-bold">${f.uso_30d} ações</p></div>
                    <div class="p-3 rounded-xl" style="background:var(--paper)"><p class="text-[10px]" style="color:var(--sage)">Nota média feedback (180d)</p><p class="text-sm font-bold">${f.nota_media_feedback ?? 'sem feedback'}</p></div>
                </div>
                <p class="text-xs" style="color:var(--sage)">Cliente desde ${f.cliente_desde ? new Date(f.cliente_desde).toLocaleDateString('pt-BR') : '—'} · licença expira em ${f.data_expiracao ? new Date(f.data_expiracao).toLocaleDateString('pt-BR') : 'sem data'}</p>

                <div class="mt-5 pt-4 border-t" style="border-color:var(--line)">
                    <h4 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
                        Uso &amp; Consumo
                        ${gestaoInfoIcone('Consumo vs. limite só existe de verdade hoje para Imóveis e Contratos (é o que o sistema já checa antes de deixar criar um novo). As demais funcionalidades têm limite definido no plano, mas ainda sem contador de uso implementado.')}
                    </h4>
                    <div class="space-y-2 mb-3">
                        ${gestaoBarra('Imóveis', u.imoveis_usado ?? 0, u.imoveis_limite || Math.max(1, u.imoveis_usado || 1), (v) => `${v} / ${u.imoveis_limite ?? '∞'}`)}
                        ${gestaoBarra('Contratos', u.contratos_usado ?? 0, u.contratos_limite || Math.max(1, u.contratos_usado || 1), (v) => `${v} / ${u.contratos_limite ?? '∞'}`)}
                    </div>
                    <div class="grid grid-cols-2 gap-3 mb-3">
                        <div class="p-2.5 rounded-xl" style="background:var(--paper)"><p class="text-[10px]" style="color:var(--sage)">Ações no app (30d)</p><p class="text-sm font-bold">${u.total_acoes_app_30d ?? 0}</p></div>
                        <div class="p-2.5 rounded-xl" style="background:var(--paper)"><p class="text-[10px]" style="color:var(--sage)">Eventos no bot (30d)</p><p class="text-sm font-bold">${u.total_eventos_bot_30d ?? 0}</p></div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <p class="text-[10px] font-bold uppercase mb-1" style="color:var(--sage)">Mais usado — app</p>
                            <div class="space-y-1">
                                ${(topApp || []).slice(0, 5).map(a => `<div class="flex justify-between text-xs"><span class="truncate pr-2" style="color:var(--ink)">${a.acao}</span><b>${a.qtd}</b></div>`).join('') || `<p class="text-xs" style="color:var(--sage)">Sem ações no período.</p>`}
                            </div>
                        </div>
                        <div>
                            <p class="text-[10px] font-bold uppercase mb-1" style="color:var(--sage)">Mais usado — bot</p>
                            <div class="space-y-1">
                                ${(topBot || []).slice(0, 5).map(b => `<div class="flex justify-between text-xs"><span class="truncate pr-2" style="color:var(--ink)">${b.funcionalidade}</span><b>${b.qtd}</b></div>`).join('') || `<p class="text-xs" style="color:var(--sage)">Sem eventos no período.</p>`}
                            </div>
                        </div>
                    </div>
                </div>

                <p class="text-[11px] mt-4 p-3 rounded-xl" style="background:var(--info-bg);color:var(--info)">
                    "Entrar nesta empresa" e "gerenciar licença" ficam pendentes de decisão de arquitetura (mecanismo de troca de empresa do master) — ver MODULO_GESTAO_ESTRATEGIA_ARQUITETURA.md, seção 8.
                </p>
            </div>
        </div>
    `;
}

function empresasFecharFicha() {
    document.getElementById('empresas-modal').classList.add('hidden');
    document.getElementById('empresas-modal').innerHTML = '';
}
