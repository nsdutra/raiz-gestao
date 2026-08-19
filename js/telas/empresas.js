// ============================================================================
// js/telas/empresas.js — Raiz Gestão
//
// v0.6.0 (novo): lista de empresas (gestao.fn_lista_empresas()) com busca
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
    const { data, error } = await dbAuth.schema('gestao').rpc('fn_ficha_empresa', { p_cliente_id: clienteId });
    if (error) { alert('Erro ao carregar ficha: ' + error.message); return; }
    const f = (data && data[0]);
    if (!f) { alert('Empresa não encontrada.'); return; }

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
