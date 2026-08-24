// ============================================================================
// js/telas/bot-uso.js — Raiz Gestão
//
// v0.10.0 (NOVO) — painel de uso do bot do WhatsApp, pedido em 23/08/2026:
// usuários por empresa, funções mais usadas, uso por dia/semana/mês/geral,
// filtro por menu/voz/pró-ativo, e detalhe (quem recebeu, quando, qual
// empresa). Usa gestao_fase5_correcoes_bot_uso_v1.sql:
//   fn_bot_uso_resumo / fn_bot_uso_funcionalidades / fn_bot_uso_serie / fn_bot_uso_detalhe
//
// PENDÊNCIA CONHECIDA (documentada, não escondida): o filtro de
// menu/voz/livre/proativo só tem dado a partir do primeiro deploy do bot
// que gravar ia_eventos_log.tipo_interacao — o código do bot ainda não foi
// ajustado pra isso (fora do escopo desta rodada, que foi só Gestão). Até
// lá "Todos os tipos" mostra tudo normalmente, mas os outros filtros vêm
// vazios. A tela avisa isso em vez de fingir que funciona.
// ============================================================================

const BU_TIPOS = [
    { id: '', label: 'Todos os tipos' },
    { id: 'menu', label: 'Menu' },
    { id: 'voz', label: 'Voz' },
    { id: 'livre', label: 'Texto livre' },
    { id: 'proativo', label: 'Pró-ativo' }
];
const BU_GRANULARIDADES = [
    { id: 'dia', label: 'Por dia' },
    { id: 'semana', label: 'Por semana' },
    { id: 'mes', label: 'Por mês' }
];

let buDias = 30;
let buTipoInteracao = '';
let buClienteId = '';
let buGranularidade = 'dia';
let buEmpresas = []; // {id, nome_empresa} — carregado uma vez por sessão da tela

async function telaBotUsoInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando Bot · Uso...</p>`;

    if (buEmpresas.length === 0) {
        const { data, error } = await dbAuth.from('clientes').select('id, nome_empresa').order('nome_empresa');
        if (error) { gestaoErro(error.message); return; }
        buEmpresas = data || [];
    }

    area.innerHTML = `
        <div class="mb-4">
            <h1 class="text-lg font-extrabold flex items-center" style="color:var(--ink)">
                Bot · Uso
                ${gestaoInfoIcone('Fonte: public.ia_eventos_log — todo evento de IA (menu, voz, texto livre ou mensagem pró-ativa) do bot do WhatsApp grava uma linha aqui.')}
            </h1>
            <p class="text-xs mt-0.5" style="color:var(--sage)">Uso por empresa, funcionalidades mais acionadas e volume ao longo do tempo.</p>
        </div>

        <div id="bu-aviso-tipo" class="hidden mb-4 p-3 rounded-xl border-2 text-xs" style="border-color:var(--warning);background:var(--warning-bg,#fff7ed);color:var(--warning)"></div>

        <div class="flex flex-wrap gap-2 mb-5">
            <select id="bu-filtro-dias" onchange="buMudarFiltro()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line)">
                <option value="7">Últimos 7 dias</option>
                <option value="30" selected>Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="365">Últimos 12 meses</option>
            </select>
            <select id="bu-filtro-tipo" onchange="buMudarFiltro()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line)">
                ${BU_TIPOS.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
            </select>
            <select id="bu-filtro-empresa" onchange="buMudarFiltro()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line)">
                <option value="">Todas as empresas</option>
                ${buEmpresas.map(e => `<option value="${e.id}">${pmEsc(e.nome_empresa)}</option>`).join('')}
            </select>
            <select id="bu-filtro-granularidade" onchange="buMudarFiltro()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line)">
                ${BU_GRANULARIDADES.map(g => `<option value="${g.id}">${g.label}</option>`).join('')}
            </select>
        </div>

        <div id="bu-cards" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"></div>

        <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Volume ao longo do tempo</h2>
        <div id="bu-serie" class="space-y-2 mb-6"></div>

        <div class="grid md:grid-cols-2 gap-6">
            <div>
                <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Por empresa</h2>
                <div id="bu-empresas" class="space-y-2"></div>
            </div>
            <div>
                <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Funcionalidades mais usadas</h2>
                <div id="bu-funcionalidades" class="space-y-2"></div>
            </div>
        </div>

        <div id="bu-detalhe-wrap" class="mt-6 hidden">
            <div class="flex items-center justify-between mb-3">
                <h2 class="text-sm font-extrabold" style="color:var(--ink)">Mensagens — <span id="bu-detalhe-titulo"></span></h2>
                <button onclick="buFecharDetalhe()" class="text-xs font-bold" style="color:var(--pine)">Fechar ✕</button>
            </div>
            <div id="bu-detalhe-lista" class="space-y-1.5"></div>
        </div>
    `;

    buCarregar();
}

function buMudarFiltro() {
    buDias = Number(document.getElementById('bu-filtro-dias').value);
    buTipoInteracao = document.getElementById('bu-filtro-tipo').value;
    buClienteId = document.getElementById('bu-filtro-empresa').value;
    buGranularidade = document.getElementById('bu-filtro-granularidade').value;
    buCarregar();
}

async function buCarregar() {
    const pTipo = buTipoInteracao || null;
    const pCliente = buClienteId || null;

    const [
        { data: resumo, error: e1 },
        { data: funcs, error: e2 },
        { data: serie, error: e3 }
    ] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_bot_uso_resumo', { p_dias: buDias, p_cliente_id: pCliente, p_tipo_interacao: pTipo }),
        dbAuth.schema('gestao').rpc('fn_bot_uso_funcionalidades', { p_dias: buDias, p_cliente_id: pCliente, p_tipo_interacao: pTipo }),
        dbAuth.schema('gestao').rpc('fn_bot_uso_serie', { p_dias: buDias, p_granularidade: buGranularidade, p_cliente_id: pCliente, p_tipo_interacao: pTipo })
    ]);
    if (e1 || e2 || e3) { gestaoErro((e1 || e2 || e3).message); return; }

    // Aviso honesto: filtro de tipo ativo mas sem NENHUM dado classificado
    // ainda (coluna tipo_interacao existe mas o bot não grava nela até o
    // bot ser atualizado — ver cabeçalho do arquivo).
    const avisoEl = document.getElementById('bu-aviso-tipo');
    const totalGeral = (resumo || []).reduce((s, r) => s + Number(r.total_mensagens || 0), 0);
    if (buTipoInteracao && totalGeral === 0) {
        avisoEl.classList.remove('hidden');
        avisoEl.textContent = 'Sem dados para este tipo de interação ainda — o bot precisa ser atualizado para gravar "menu/voz/livre/proativo" em cada evento (pendência registrada no changelog v0.10.0, ainda não implementada no código do bot).';
    } else {
        avisoEl.classList.add('hidden');
    }

    const totalMsgs = (resumo || []).reduce((s, r) => s + Number(r.total_mensagens || 0), 0);
    const totalUsuarios = (resumo || []).reduce((s, r) => s + Number(r.usuarios_ativos || 0), 0);
    const totalErros = (resumo || []).reduce((s, r) => s + Number(r.erros || 0), 0);
    const taxaErroGeral = totalMsgs > 0 ? Math.round((totalErros / totalMsgs) * 1000) / 10 : 0;

    document.getElementById('bu-cards').innerHTML =
        gestaoCardMetrica('Mensagens', totalMsgs) +
        gestaoCardMetrica('Usuários ativos', totalUsuarios) +
        gestaoCardMetrica('Empresas com uso', (resumo || []).length) +
        gestaoCardMetrica('Taxa de erro', taxaErroGeral + '%', taxaErroGeral >= 10 ? 'red' : taxaErroGeral > 0 ? 'amber' : 'green');

    const maiorSerie = Math.max(1, ...(serie || []).map(s => Number(s.total)));
    document.getElementById('bu-serie').innerHTML =
        (serie || []).map(s => gestaoBarra(buFormatarPeriodo(s.periodo, buGranularidade), s.total, maiorSerie)).join('')
        || `<p class="text-sm" style="color:var(--sage)">Sem eventos no período selecionado.</p>`;

    const maiorEmpresa = Math.max(1, ...(resumo || []).map(r => Number(r.total_mensagens)));
    document.getElementById('bu-empresas').innerHTML =
        (resumo || []).map(r => `
            <button onclick="buAbrirDetalhe('${r.cliente_id}','${pmEsc(r.empresa)}')" class="w-full text-left">
                ${gestaoBarra(`${r.empresa} (${r.usuarios_ativos} usuário${r.usuarios_ativos == 1 ? '' : 's'})`, r.total_mensagens, maiorEmpresa)}
            </button>
        `).join('') || `<p class="text-sm" style="color:var(--sage)">Sem uso registrado no período.</p>`;

    const maiorFunc = Math.max(1, ...(funcs || []).map(f => Number(f.total)));
    document.getElementById('bu-funcionalidades').innerHTML =
        (funcs || []).map(f => gestaoBarra(f.funcionalidade, f.total, maiorFunc)).join('')
        || `<p class="text-sm" style="color:var(--sage)">Sem eventos no período.</p>`;
}

function buFormatarPeriodo(dataISO, granularidade) {
    const d = new Date(dataISO + 'T00:00:00');
    if (granularidade === 'mes') return d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
    if (granularidade === 'semana') return 'sem. ' + d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

// --------------------------------------------------------------------------
// Drill-down: mensagens de uma empresa específica — quem, quando, o quê.
// --------------------------------------------------------------------------
async function buAbrirDetalhe(clienteId, nomeEmpresa) {
    const wrap = document.getElementById('bu-detalhe-wrap');
    wrap.classList.remove('hidden');
    document.getElementById('bu-detalhe-titulo').textContent = nomeEmpresa;
    document.getElementById('bu-detalhe-lista').innerHTML = `<p class="text-xs" style="color:var(--sage)">Carregando...</p>`;
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const { data, error } = await dbAuth.schema('gestao').rpc('fn_bot_uso_detalhe', {
        p_cliente_id: clienteId, p_dias: buDias,
        p_tipo_interacao: buTipoInteracao || null, p_limite: 200
    });
    if (error) {
        document.getElementById('bu-detalhe-lista').innerHTML =
            `<p class="text-xs" style="color:var(--danger)">Erro ao carregar: ${error.message}</p>`;
        return;
    }

    document.getElementById('bu-detalhe-lista').innerHTML = (data || []).map(m => `
        <div class="flex items-center justify-between gap-3 p-2.5 rounded-lg border text-xs" style="border-color:var(--line)">
            <div class="min-w-0">
                <b style="color:var(--ink)">${pmEsc(m.pessoa_nome || 'Não identificado')}</b>
                <span style="color:var(--sage)"> · ${pmEsc(m.pessoa_whatsapp || '—')}</span>
                <div style="color:var(--sage)">${pmEsc(m.funcionalidade || '(sem funcionalidade)')} ${m.tipo_interacao ? '· ' + pmEsc(m.tipo_interacao) : ''}</div>
            </div>
            <div class="text-right flex-none">
                <div style="color:var(--ink)">${new Date(m.criado_em).toLocaleString('pt-BR')}</div>
                <div style="color:${m.resultado === 'erro' ? 'var(--danger)' : 'var(--sage)'}">${pmEsc(m.resultado)}</div>
            </div>
        </div>
    `).join('') || `<p class="text-xs" style="color:var(--sage)">Sem mensagens desta empresa no período/filtro selecionado.</p>`;
}

function buFecharDetalhe() {
    document.getElementById('bu-detalhe-wrap').classList.add('hidden');
}
