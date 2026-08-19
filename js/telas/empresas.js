// ============================================================================
// js/telas/empresas.js — Raiz Gestão
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

async function telaEmpresasInit() {
    const { data, error } = await dbAuth.schema('gestao').rpc('fn_lista_empresas');
    if (error) { gestaoErro(error.message); return; }
    empresasCache = data || [];

    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <input type="text" id="empresas-busca" placeholder="Buscar empresa, cidade..."
            oninput="empresasRenderLista()"
            class="w-full p-3 border-2 rounded-xl text-sm mb-4" style="border-color:var(--line)">
        <div id="empresas-lista" class="space-y-2"></div>
        <div id="empresas-modal" class="hidden"></div>
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
                    <p class="text-xs truncate" style="color:var(--sage)">${e.cidade || '—'}${e.uf ? '/' + e.uf : ''} · plano ${e.plano_codigo || '—'} · último acesso: ${ultimoAcesso}</p>
                </div>
                <div class="flex items-center gap-2 flex-none">
                    <span class="text-[10px] font-bold px-2 py-1 rounded-full" style="background:${statusBg};color:${statusCor}">${e.licenca_status || 'sem licença'}</span>
                    <span class="text-xs" style="color:var(--sage)">${e.uso_30d} ações/30d</span>
                </div>
            </button>
        `;
    }).join('') || `<p class="text-sm text-center py-8" style="color:var(--sage)">Nenhuma empresa encontrada.</p>`;
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
