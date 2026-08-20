// ============================================================================
// js/nav.js — Raiz Gestão
//
// v0.8.4 — Comercial saiu do menu principal e virou aba dentro de
// Parâmetros (junto com Campanhas, que passou a incluir o Desempenho
// embutido — sem mais pular de tela pra ver o desempenho de uma
// campanha). Menu principal: 6 itens em vez de 7. Nenhuma outra mudança
// neste arquivo.
//
// v0.7.0: layout mais fiel ao protótipo aprovado
// (RAIZ_GESTAO_COCKPIT_PROTOTIPO_UI_v0_6_0.html) — sidebar vertical no
// desktop (≥900px) e barra inferior no mobile, em vez da barra de abas
// horizontal única da v0.6.0. Mesma lista de telas (GESTAO_TELAS),
// renderizada duas vezes (sidebar + bottom nav), sincronizadas pelo mesmo
// gestaoAbrirTela(). Nenhuma tela (*Init()) precisou mudar por causa
// disso — continuam donas de #area-conteudo.
//
// v0.7.0 também adiciona gestaoInfoIcone(texto): ícone "ⓘ" clicável
// (funciona em toque, não só hover) usado nas telas Saúde/Financeiro/
// Empresas pra explicar o que cada métrica significa e de onde vem.
//
// v0.6.0: shell de navegação original (barra de abas única) — descontinuado.
// ============================================================================

const GESTAO_TELAS = [
    { id: 'cockpit', label: 'Cockpit', icone: '📊', init: () => telaCockpitInit() },
    { id: 'empresas', label: 'Empresas', icone: '🏢', init: () => telaEmpresasInit() },
    { id: 'financeiro', label: 'Financeiro', icone: '💰', init: () => telaFinanceiroInit() },
    { id: 'saude', label: 'Saúde', icone: '⚡', init: () => telaSaudeInit() },
    { id: 'suporte', label: 'Suporte', icone: '🎧', init: () => telaEmConstrucaoInit('Suporte', 'Existe feedback (nota + comentário) real no banco — usado hoje na ficha da empresa e no Cockpit (alerta de nota baixa) — mas ainda não existe um sistema de tickets com prioridade/SLA. Fica para a fase seguinte.') },
    { id: 'parametros', label: 'Parâmetros', icone: '⚙️', init: () => telaParametrosMasterInit() }
];

let gestaoTelaAtual = null;

function gestaoNavInit() {
    const itens = GESTAO_TELAS.map(t => `
        <button onclick="gestaoAbrirTela('${t.id}')" data-tela="${t.id}"
            class="gestao-nav-item">
            <span class="gestao-nav-icone">${t.icone}</span>
            <span class="gestao-nav-label">${t.label}</span>
        </button>
    `).join('');

    document.getElementById('gestao-sidebar-nav').innerHTML = itens;
    document.getElementById('gestao-mobile-nav').innerHTML = itens;

    gestaoAbrirTela('cockpit');
}

function gestaoAbrirTela(nome) {
    gestaoTelaAtual = nome;
    document.querySelectorAll('.gestao-nav-item').forEach(b => {
        b.classList.toggle('ativo', b.dataset.tela === nome);
    });

    const tela = GESTAO_TELAS.find(t => t.id === nome);
    if (!tela) return;
    document.getElementById('area-conteudo').innerHTML =
        `<p class="text-sm" style="color:var(--sage)">Carregando ${tela.label}...</p>`;
    gestaoFecharTodosInfos();
    tela.init();
}

// Placeholder honesto — nunca preencher com número fictício.
function telaEmConstrucaoInit(titulo, motivo) {
    document.getElementById('area-conteudo').innerHTML = `
        <div class="p-5 rounded-2xl border-2" style="border-color:var(--line);background:#fff">
            <h2 class="text-base font-extrabold mb-2" style="color:var(--ink)">${titulo} — ainda não disponível</h2>
            <p class="text-sm" style="color:var(--sage)">${motivo}</p>
        </div>
    `;
}

// ----------------------------------------------------------------------------
// Helpers compartilhados entre as telas do Cockpit
// ----------------------------------------------------------------------------
function gestaoCardMetrica(label, valor, tone, infoTexto) {
    const cor = tone === 'red' ? 'var(--danger)' : tone === 'amber' ? 'var(--warning)' : tone === 'green' ? 'var(--success)' : 'var(--ink)';
    return `
        <div class="p-4 rounded-xl border-2" style="border-color:var(--line);background:#fff">
            <p class="text-[10px] font-bold uppercase tracking-wide flex items-center" style="color:var(--sage)">${label}${infoTexto ? gestaoInfoIcone(infoTexto) : ''}</p>
            <p class="text-2xl font-extrabold mt-1" style="color:${cor}">${valor}</p>
        </div>
    `;
}

let gestaoInfoSeq = 0;
function gestaoInfoIcone(texto) {
    gestaoInfoSeq++;
    const id = 'gestao-info-' + gestaoInfoSeq;
    const escapado = String(texto).replace(/"/g, '&quot;');
    return `<span class="relative inline-block ml-1">
        <button type="button" onclick="event.stopPropagation();gestaoToggleInfo('${id}')"
            class="gestao-info-icone" title="${escapado}">ⓘ</button>
        <span id="${id}" class="gestao-info-popover hidden">${texto}</span>
    </span>`;
}

function gestaoToggleInfo(id) {
    const alvo = document.getElementById(id);
    const jaAberto = !alvo.classList.contains('hidden');
    gestaoFecharTodosInfos();
    if (!jaAberto) alvo.classList.remove('hidden');
}

function gestaoFecharTodosInfos() {
    document.querySelectorAll('.gestao-info-popover').forEach(p => p.classList.add('hidden'));
}

// Fecha popover de info ao clicar fora dele.
document.addEventListener('click', function (ev) {
    if (!ev.target.closest('.gestao-info-icone') && !ev.target.closest('.gestao-info-popover')) {
        gestaoFecharTodosInfos();
    }
});

function gestaoFormatarMoedaBR(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function gestaoErro(msg) {
    document.getElementById('area-conteudo').innerHTML =
        `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)">
            <strong>Não foi possível carregar:</strong> ${msg}
            <br><span class="text-xs">Confira se as migrations gestao_fase1_cockpit_v1.sql e gestao_fase2_uso_comercial_v1.sql já foram rodadas e se "gestao" está em Settings → API → Exposed schemas.</span>
        </div>`;
}

// Barra de progresso simples (reaproveitada em Financeiro/Saúde/Comercial).
function gestaoBarra(label, valor, maximo, formatador) {
    const pct = maximo > 0 ? Math.min(100, (Number(valor) / maximo) * 100) : 0;
    const texto = formatador ? formatador(valor) : valor;
    return `
        <div>
            <div class="flex justify-between text-xs mb-1"><span style="color:var(--ink)">${label}</span><b>${texto}</b></div>
            <div class="h-2 rounded-full" style="background:var(--line)">
                <div class="h-2 rounded-full" style="width:${pct}%;background:var(--pine)"></div>
            </div>
        </div>
    `;
}
