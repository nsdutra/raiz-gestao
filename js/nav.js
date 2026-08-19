// ============================================================================
// js/nav.js — Raiz Gestão
//
// v0.6.0: shell de navegação entre telas do módulo. Existia só uma tela
// (Parâmetros Master) carregada direto no login; agora existem várias, e
// a home passa a ser o Cockpit (decisão de produto do Prompt 03).
//
// Cada botão de aba chama gestaoAbrirTela(nome), que troca o destaque
// visual e delega pra função *Init() daquela tela — cada tela continua
// dona de #area-conteudo, exatamente como telaParametrosMasterInit() já
// fazia (nenhuma tela precisou mudar sua própria lógica interna por causa
// deste arquivo).
// ============================================================================

const GESTAO_TELAS = [
    { id: 'cockpit', label: 'Cockpit', init: () => telaCockpitInit() },
    { id: 'empresas', label: 'Empresas', init: () => telaEmpresasInit() },
    { id: 'financeiro', label: 'Financeiro', init: () => telaFinanceiroInit() },
    { id: 'saude', label: 'Saúde', init: () => telaSaudeInit() },
    { id: 'comercial', label: 'Comercial', init: () => telaEmConstrucaoInit('Comercial', 'Pipeline de leads/trials/propostas depende de uma etapa de dados que ainda não existe no schema (não há tabela de oportunidade/funil hoje). Fica para a fase seguinte, conforme MODULO_GESTAO_ESTRATEGIA_ARQUITETURA.md.') },
    { id: 'suporte', label: 'Suporte', init: () => telaEmConstrucaoInit('Suporte', 'Existe feedback (nota + comentário) real no banco, mas ainda não existe um sistema de tickets com prioridade/SLA. Fica para a fase seguinte.') },
    { id: 'parametros', label: 'Parâmetros', init: () => telaParametrosMasterInit() }
];

let gestaoTelaAtual = null;

function gestaoNavInit() {
    const nav = document.getElementById('gestao-nav');
    nav.innerHTML = GESTAO_TELAS.map(t => `
        <button onclick="gestaoAbrirTela('${t.id}')" id="gestao-nav-${t.id}"
            class="gestao-nav-item px-3.5 py-2.5 text-sm font-bold whitespace-nowrap flex-none">
            ${t.label}
        </button>
    `).join('');
    gestaoAbrirTela('cockpit');
}

function gestaoAbrirTela(nome) {
    gestaoTelaAtual = nome;
    document.querySelectorAll('.gestao-nav-item').forEach(b => b.classList.remove('ativo'));
    const btn = document.getElementById('gestao-nav-' + nome);
    if (btn) btn.classList.add('ativo');

    const tela = GESTAO_TELAS.find(t => t.id === nome);
    if (!tela) return;
    document.getElementById('area-conteudo').innerHTML =
        `<p class="text-sm" style="color:var(--sage)">Carregando ${tela.label}...</p>`;
    tela.init();
}

// Placeholder honesto — usado por Comercial/Suporte enquanto não há fonte
// de dado real. Nunca preencher com número fictício (regra do Prompt 03).
function telaEmConstrucaoInit(titulo, motivo) {
    document.getElementById('area-conteudo').innerHTML = `
        <div class="p-5 rounded-2xl border-2" style="border-color:var(--line);background:#fff">
            <h2 class="text-base font-extrabold mb-2" style="color:var(--ink)">${titulo} — ainda não disponível</h2>
            <p class="text-sm" style="color:var(--sage)">${motivo}</p>
        </div>
    `;
}

// Helper compartilhado entre as telas novas — cartão de métrica simples.
function gestaoCardMetrica(label, valor, tone) {
    const cor = tone === 'red' ? 'var(--danger)' : tone === 'amber' ? 'var(--warning)' : tone === 'green' ? 'var(--success)' : 'var(--ink)';
    return `
        <div class="p-4 rounded-xl border-2" style="border-color:var(--line);background:#fff">
            <p class="text-[10px] font-bold uppercase tracking-wide" style="color:var(--sage)">${label}</p>
            <p class="text-2xl font-extrabold mt-1" style="color:${cor}">${valor}</p>
        </div>
    `;
}

function gestaoFormatarMoedaBR(v) {
    return (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function gestaoErro(msg) {
    document.getElementById('area-conteudo').innerHTML =
        `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)">
            <strong>Não foi possível carregar:</strong> ${msg}
            <br><span class="text-xs">Confira se gestao_fase1_cockpit_v1.sql já foi rodado e se "gestao" está em Settings → API → Exposed schemas.</span>
        </div>`;
}
