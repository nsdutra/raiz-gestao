// ============================================================================
// js/nav.js — Raiz Gestão
//
// v0.9.0 — Comercial volta ao menu principal (era item de uso diário,
// não deveria estar escondido atrás de "Configurações" — reverte a
// decisão de UX da v0.8.4). "Parâmetros" muda de RÓTULO pra
// "Configurações" (id técnico continua 'parametros' — nenhum link
// existente quebra).
//
// Mobile deixou de rolar 6-7 itens na horizontal: bottom-nav mostra só 4
// (Cockpit/Empresas/Comercial/Financeiro) + "Mais", que abre um
// bottom-sheet com Saúde/Suporte/Configurações. Sidebar do desktop
// continua mostrando todos os itens direto (não tem o problema de
// espaço que o mobile tem).
// ============================================================================

const GESTAO_TELAS = [
    { id: 'cockpit', label: 'Cockpit', icone: '📊', mobilePrimario: true, init: () => telaCockpitInit() },
    { id: 'empresas', label: 'Empresas', icone: '🏢', mobilePrimario: true, init: () => telaEmpresasInit() },
    { id: 'comercial', label: 'Comercial', icone: '🤝', mobilePrimario: true, init: () => telaComercialInit() },
    { id: 'financeiro', label: 'Financeiro', icone: '💰', mobilePrimario: true, init: () => telaFinanceiroInit() },
    { id: 'saude', label: 'Saúde', icone: '⚡', mobilePrimario: false, init: () => telaSaudeInit() },
    { id: 'bot-uso', label: 'Bot · Uso', icone: '🤖', mobilePrimario: false, init: () => telaBotUsoInit() },
    { id: 'suporte', label: 'Suporte', icone: '🎧', mobilePrimario: false, init: () => telaEmConstrucaoInit('Suporte', 'Existe feedback (nota + comentário) real no banco — usado hoje na ficha da empresa e no Cockpit (alerta de nota baixa) — mas ainda não existe um sistema de tickets com prioridade/SLA. Fica para a fase seguinte.') },
    { id: 'parametros', label: 'Configurações', icone: '⚙️', mobilePrimario: false, init: () => telaParametrosMasterInit() }
];

let gestaoTelaAtual = null;

function gestaoNavInit() {
    const itemHtml = t => `
        <button onclick="gestaoAbrirTela('${t.id}')" data-tela="${t.id}"
            class="gestao-nav-item">
            <span class="gestao-nav-icone">${t.icone}</span>
            <span class="gestao-nav-label">${t.label}</span>
        </button>
    `;

    // Sidebar (desktop) mostra todos os itens — não tem o problema de
    // espaço que o mobile tem, não precisa de "Mais".
    document.getElementById('gestao-sidebar-nav').innerHTML = GESTAO_TELAS.map(itemHtml).join('');

    // Bottom-nav (mobile) mostra só os 4 mobilePrimario + "Mais" (nunca
    // mais que 5 itens, nunca rola na horizontal).
    const primarios = GESTAO_TELAS.filter(t => t.mobilePrimario);
    const secundarios = GESTAO_TELAS.filter(t => !t.mobilePrimario);
    document.getElementById('gestao-mobile-nav').innerHTML =
        primarios.map(itemHtml).join('') +
        `<button onclick="gestaoAbrirMais()" id="gestao-nav-mais" class="gestao-nav-item">
            <span class="gestao-nav-icone">•••</span>
            <span class="gestao-nav-label">Mais</span>
        </button>`;

    // Bottom-sheet com os itens secundários (Saúde/Suporte/Configurações).
    document.getElementById('gestao-mais-sheet-itens').innerHTML = secundarios.map(t => `
        <button onclick="gestaoFecharMais();gestaoAbrirTela('${t.id}')" data-tela="${t.id}"
            class="gestao-mais-item">
            <span class="gestao-nav-icone">${t.icone}</span>
            <span>${t.label}</span>
        </button>
    `).join('');

    gestaoAbrirTela('cockpit');
}

function gestaoAbrirMais() {
    document.getElementById('gestao-mais-sheet').classList.remove('hidden');
}

function gestaoFecharMais() {
    document.getElementById('gestao-mais-sheet').classList.add('hidden');
}

function gestaoAbrirTela(nome) {
    gestaoTelaAtual = nome;
    document.querySelectorAll('.gestao-nav-item, .gestao-mais-item').forEach(b => {
        b.classList.toggle('ativo', b.dataset.tela === nome);
    });
    // "Mais" fica destacado no bottom-nav se a tela ativa for uma das
    // secundárias (Saúde/Suporte/Configurações), pra dar feedback de
    // onde a pessoa está mesmo com o item real escondido na sheet.
    const ehSecundaria = GESTAO_TELAS.find(t => t.id === nome && !t.mobilePrimario);
    const btnMais = document.getElementById('gestao-nav-mais');
    if (btnMais) btnMais.classList.toggle('ativo', !!ehSecundaria);

    const tela = GESTAO_TELAS.find(t => t.id === nome);
    if (!tela) return;
    document.getElementById('area-conteudo').innerHTML =
        `<p class="text-sm" style="color:var(--sage)">Carregando ${tela.label}...</p>`;
    gestaoFecharTodosInfos();
    gestaoFecharMais();
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
//
// v0.11.0 — label ganhou "truncate min-w-0" + título (tooltip com o texto
// completo): rótulo longo (ex. nome de página da landing, referrer) sem
// isso empurrava o número pra fora da área visível quando a barra fica
// numa coluna estreita — o número (que é o dado que a pessoa quer ver)
// sumia. Truncar com "..." garante que o número (flex-none) nunca é
// empurrado, e o título dá acesso ao texto completo no hover/toque longo.
function gestaoBarra(label, valor, maximo, formatador) {
    const pct = maximo > 0 ? Math.min(100, (Number(valor) / maximo) * 100) : 0;
    const texto = formatador ? formatador(valor) : valor;
    return `
        <div class="min-w-0">
            <div class="flex justify-between gap-2 text-xs mb-1">
                <span class="truncate min-w-0" style="color:var(--ink)" title="${String(label).replace(/"/g, '&quot;')}">${label}</span>
                <b class="flex-none">${texto}</b>
            </div>
            <div class="h-2 rounded-full" style="background:var(--line)">
                <div class="h-2 rounded-full" style="width:${pct}%;background:var(--pine)"></div>
            </div>
        </div>
    `;
}

// v0.11.0 (NOVO) — formata bytes em unidade legível (B/KB/MB/GB/TB), usado
// pelas novas métricas de Storage/IA em Saúde. Mesma ideia de
// gestaoFormatarMoedaBR(): 1 função central, ninguém reimplementa o cálculo
// de unidade espalhado pela tela.
function gestaoFormatarBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n <= 0) return '0 B';
    const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.min(unidades.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
    const valor = n / Math.pow(1024, i);
    return (i === 0 ? String(n) : valor.toFixed(valor >= 10 ? 0 : 1)) + ' ' + unidades[i];
}

// v0.11.0 (NOVO) — par de <input type="date"> reaproveitado em Comercial/
// Saúde/Empresas: mesmo rótulo, mesmo id-pattern ({prefixo}-data-inicio/
// {prefixo}-data-fim), mesmo default (últimos N dias). Cada tela lê os
// valores no seu próprio "mudarFiltro()" — este helper só desenha o HTML.
function gestaoFiltroPeriodoHtml(prefixo, diasPadrao) {
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - (diasPadrao - 1));
    const fmt = (d) => d.toISOString().slice(0, 10);
    return `
        <label class="flex items-center gap-1.5 text-xs font-bold" style="color:var(--ink)">
            De
            <input type="date" id="${prefixo}-data-inicio" value="${fmt(inicio)}"
                class="p-2 rounded-lg border-2 text-xs font-bold" style="border-color:var(--line)">
        </label>
        <label class="flex items-center gap-1.5 text-xs font-bold" style="color:var(--ink)">
            Até
            <input type="date" id="${prefixo}-data-fim" value="${fmt(hoje)}"
                class="p-2 rounded-lg border-2 text-xs font-bold" style="border-color:var(--line)">
        </label>
    `;
}

// Lê o par de datas desenhado por gestaoFiltroPeriodoHtml(), com fallback
// pro padrão de N dias caso os campos ainda não existam no DOM (proteção
// defensiva, não deveria acontecer no fluxo normal).
function gestaoLerFiltroPeriodo(prefixo, diasPadrao) {
    const elIni = document.getElementById(`${prefixo}-data-inicio`);
    const elFim = document.getElementById(`${prefixo}-data-fim`);
    if (elIni && elFim && elIni.value && elFim.value) {
        return { inicio: elIni.value, fim: elFim.value };
    }
    const hoje = new Date();
    const inicio = new Date(hoje);
    inicio.setDate(inicio.getDate() - (diasPadrao - 1));
    const fmt = (d) => d.toISOString().slice(0, 10);
    return { inicio: fmt(inicio), fim: fmt(hoje) };
}
