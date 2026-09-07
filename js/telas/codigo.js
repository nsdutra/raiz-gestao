// ============================================================================
// js/telas/codigo.js — Raiz Gestão
//
// v1.0.0 (07/09/2026) — NOVA tela "Código" (pedido do Nicola: "coloque a parte
// do que está no ar num novo botão 'Código'; inclua tamanho em linhas,
// quantidade de componentes, versão de todas as Edge Functions, todos os
// arquivos do index, da landing e também da Gestão").
//
// Fontes, sem inventar nada:
//   · App — versoes.json publicado em app.raizpatrimonio.com.br (gerado pelo
//     gerar_versoes.py v1.7, que agora grava `detalhes` com linhas e funções
//     por arquivo). Lido sem cache.
//   · Gestão — os próprios arquivos (mesma origem): versão do header, linhas
//     e funções contadas aqui, ao vivo.
//   · Landing — index.html de raizpatrimonio.com.br (header VERSÃO/LINHAS).
//   · Bot — edge_function_versoes (versão + último boot) pra quem registra;
//     as demais functions aparecem como "não registra" (pendência do bot).
// "Componentes" = funções declaradas (function x / export function x) no JS;
// no HTML = seções <section> + módulos importados.
// ============================================================================

const CD_APP_VERSOES = 'https://app.raizpatrimonio.com.br/versoes.json';
const CD_LANDING = 'https://raizpatrimonio.com.br/index.html';
const CD_GESTAO_ARQUIVOS = ['index.html', 'js/nav.js', 'js/supabase-client.js', 'css/tokens.css', 'sw.js',
    'js/telas/cockpit.js', 'js/telas/empresas.js', 'js/telas/comercial.js', 'js/telas/financeiro.js', 'js/telas/saude.js',
    'js/telas/bot-uso.js', 'js/telas/comunicacoes.js', 'js/telas/codigo.js', 'js/telas/parametros-master.js',
    'js/telas/parametros-campanhas.js', 'js/telas/parametros-perfis.js', 'js/telas/parametros-planos.js'];
// Functions do repo raiz-edge-functions (manifesto do Deploy_Raiz.ps1). Quem
// não registra em edge_function_versoes aparece como pendência.
const CD_EDGE_CONHECIDAS = ['whatsapp-webhook', 'cofre-extrair-documento', 'minuta-detectar-placeholders', 'extrato-extrair-transacoes', 'diario-eventos', '_shared_core', '_shared_cofre', '_shared_extrato'];

async function telaCodigoInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="mb-4 flex items-center justify-between">
            <div>
                <h1 class="text-lg font-extrabold" style="color:var(--ink)">Código</h1>
                <p class="text-xs mt-0.5" style="color:var(--sage)">O que está no ar, arquivo por arquivo: versão, linhas e componentes.</p>
            </div>
            <button onclick="telaCodigoInit()" class="text-[11px] font-bold" style="color:var(--pine)">Atualizar</button>
        </div>
        <div id="cd-resumo" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5"></div>
        <div id="cd-bot" class="mb-5"></div>
        <div id="cd-app" class="mb-5"></div>
        <div id="cd-gestao" class="mb-5"></div>
        <div id="cd-landing" class="mb-5"></div>
    `;
    await Promise.all([cdRenderBot(), cdRenderApp(), cdRenderGestao(), cdRenderLanding()]);
    cdRenderResumo();
}

const cdEstado = { app: null, gestao: null, landing: null, bot: null };
const cdFmt = (n) => (n == null ? '—' : Number(n).toLocaleString('pt-BR'));
function cdCard(titulo, corpo) {
    return `<div class="rounded-2xl border-2 overflow-hidden" style="border-color:var(--line);background:#fff"><div class="p-3 border-b flex items-center justify-between" style="border-color:var(--line)"><b class="text-sm" style="color:var(--ink)">${titulo}</b></div><div class="p-3">${corpo}</div></div>`;
}
function cdTabela(linhas) {
    return `<table class="w-full text-[11px]"><thead><tr style="color:var(--sage)"><th class="text-left font-bold py-1">Arquivo</th><th class="text-right font-bold py-1">Versão</th><th class="text-right font-bold py-1">Linhas</th><th class="text-right font-bold py-1">Componentes</th></tr></thead><tbody>
        ${linhas.map(l => `<tr class="border-t" style="border-color:var(--line)"><td class="py-1 font-mono" style="color:var(--ink)">${pmEsc(l.arquivo)}</td><td class="py-1 text-right font-bold" style="color:var(--pine)">${pmEsc(l.versao || '—')}</td><td class="py-1 text-right">${cdFmt(l.linhas)}</td><td class="py-1 text-right">${cdFmt(l.componentes)}</td></tr>`).join('')}
        <tr class="border-t font-bold" style="border-color:var(--line);color:var(--ink)"><td class="py-1">Total · ${linhas.length} arquivo(s)</td><td></td><td class="py-1 text-right">${cdFmt(linhas.reduce((s, l) => s + (l.linhas || 0), 0))}</td><td class="py-1 text-right">${cdFmt(linhas.reduce((s, l) => s + (l.componentes || 0), 0))}</td></tr>
    </tbody></table>`;
}
// Conta linhas e "componentes" de um texto-fonte. JS: funções declaradas;
// HTML: seções + módulos importados; CSS: regras.
function cdMedir(texto, arquivo) {
    const linhas = texto.split('\n').length;
    let componentes;
    if (/\.js$/.test(arquivo)) componentes = (texto.match(/^\s*(?:export\s+)?(?:async\s+)?function\s+[\w$]+\s*\(/gm) || []).length;
    else if (/\.html$/.test(arquivo)) componentes = (texto.match(/<section\b/g) || []).length + (texto.match(/import\(['"]\.\/js\//g) || []).length;
    else if (/\.css$/.test(arquivo)) componentes = (texto.match(/\{/g) || []).length;
    else componentes = null;
    const mv = texto.match(/VERS[ÃA]O:\s*(?:Beta\s+)?v?([0-9][\w.\-]*)/i) || texto.match(/\/\/\s*Versão:\s*v?([0-9][\w.]*)/) || texto.match(/^\/\/\s*v(\d+\.\d+(?:\.\d+)?)\b/m) || texto.match(/APP_VERSAO\s*=\s*['"]v?([^'"]+)['"]/);
    return { linhas, componentes, versao: mv ? mv[1] : null };
}

async function cdRenderBot() {
    const el = document.getElementById('cd-bot');
    const { data, error } = await dbAuth.from('edge_function_versoes').select('funcao, versao, data_versao, ultimo_boot').order('funcao');
    const reg = new Map((data || []).map(b => [b.funcao, b]));
    const fmtDt = (iso) => iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
    const linhas = CD_EDGE_CONHECIDAS.map(f => {
        const b = reg.get(f);
        return `<tr class="border-t" style="border-color:var(--line)"><td class="py-1 font-mono" style="color:var(--ink)">${pmEsc(f)}</td><td class="py-1 text-right font-bold" style="color:${b ? 'var(--pine)' : 'var(--sage)'}">${b ? 'v' + pmEsc(b.versao) : 'não registra'}</td><td class="py-1 text-right" style="color:var(--sage)">${b ? fmtDt(b.ultimo_boot) : '—'}</td></tr>`;
    });
    cdEstado.bot = { registradas: reg.size, conhecidas: CD_EDGE_CONHECIDAS.length };
    el.innerHTML = cdCard('🤖 Bot · Edge Functions', error ? `<p class="text-xs" style="color:var(--danger)">${pmEsc(error.message)}</p>` : `
        <table class="w-full text-[11px]"><thead><tr style="color:var(--sage)"><th class="text-left font-bold py-1">Function</th><th class="text-right font-bold py-1">Versão</th><th class="text-right font-bold py-1">Último boot</th></tr></thead><tbody>${linhas.join('')}</tbody></table>
        <p class="text-[10px] mt-2" style="color:var(--sage)">Só quem grava em edge_function_versoes no boot aparece com versão (hoje: whatsapp-webhook). Fazer as outras registrarem — com linhas — está no PENDÊNCIAS (bot).</p>`);
}

async function cdRenderApp() {
    const el = document.getElementById('cd-app');
    try {
        const r = await fetch(CD_APP_VERSOES + '?v=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const j = await r.json();
        const det = j.detalhes || {};
        const linhas = Object.entries(j.arquivos || {}).map(([arq, ver]) => ({ arquivo: arq, versao: ver, linhas: det[arq]?.linhas ?? null, componentes: det[arq]?.funcoes ?? null }));
        cdEstado.app = { arquivos: linhas.length, linhas: linhas.reduce((s, l) => s + (l.linhas || 0), 0), versao: j.arquivos?.['index.html'] };
        el.innerHTML = cdCard('📱 App · app.raizpatrimonio.com.br', cdTabela(linhas) + `<p class="text-[10px] mt-2" style="color:var(--sage)">Fonte: versoes.json gerado em ${pmEsc(j.gerado_em || '?')}${Object.keys(det).length ? '' : ' — sem `detalhes` (linhas/componentes chegam com o gerar_versoes.py v1.7 na próxima entrega do app)'}.</p>`);
    } catch (e) { el.innerHTML = cdCard('📱 App', `<p class="text-xs" style="color:var(--danger)">Não consegui ler ${CD_APP_VERSOES}: ${pmEsc(e.message)}</p>`); }
}

async function cdRenderGestao() {
    const el = document.getElementById('cd-gestao');
    const linhas = await Promise.all(CD_GESTAO_ARQUIVOS.map(async (arq) => {
        try {
            const r = await fetch('./' + arq + '?v=' + Date.now(), { cache: 'no-store' });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            const m = cdMedir(await r.text(), arq);
            return { arquivo: arq, ...m };
        } catch (e) { return { arquivo: arq, versao: 'erro', linhas: null, componentes: null }; }
    }));
    cdEstado.gestao = { arquivos: linhas.length, linhas: linhas.reduce((s, l) => s + (l.linhas || 0), 0), versao: (typeof APP_VERSAO !== 'undefined' ? APP_VERSAO : null) };
    el.innerHTML = cdCard('🧭 Gestão · gestao.raizpatrimonio.com.br · ' + (typeof APP_VERSAO !== 'undefined' ? APP_VERSAO : ''), cdTabela(linhas) + `<p class="text-[10px] mt-2" style="color:var(--sage)">Medido ao vivo nos próprios arquivos (mesma origem).</p>`);
}

async function cdRenderLanding() {
    const el = document.getElementById('cd-landing');
    try {
        const r = await fetch(CD_LANDING + '?v=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const t = await r.text();
        const m = cdMedir(t, 'index.html');
        // arquivos locais referenciados pelo index (css/js) — só listados, não medidos
        const refs = Array.from(new Set((t.match(/(?:src|href)=["'](?!https?:|\/\/|data:|#|mailto:|tel:)([^"']+\.(?:js|css))["']/g) || []).map(s => s.replace(/^(?:src|href)=["']/, '').replace(/["']$/, ''))));
        cdEstado.landing = { arquivos: 1 + refs.length, linhas: m.linhas, versao: m.versao };
        el.innerHTML = cdCard('🌐 Landing · raizpatrimonio.com.br', cdTabela([{ arquivo: 'index.html', ...m }]) + (refs.length ? `<p class="text-[10px] mt-2" style="color:var(--sage)">Também referencia: ${refs.map(pmEsc).join(', ')}.</p>` : ''));
    } catch (e) { el.innerHTML = cdCard('🌐 Landing', `<p class="text-xs" style="color:var(--danger)">Não consegui ler ${CD_LANDING}: ${pmEsc(e.message)} (se for CORS, a landing precisa liberar leitura — GitHub Pages costuma liberar).</p>`); }
}

function cdRenderResumo() {
    const el = document.getElementById('cd-resumo'); const s = cdEstado;
    const card = (t, v, sub) => `<div class="p-3 rounded-2xl border-2" style="border-color:var(--line);background:#fff"><p class="text-[10px] font-bold uppercase" style="color:var(--sage)">${t}</p><p class="text-lg font-extrabold" style="color:var(--ink)">${v}</p><p class="text-[10px]" style="color:var(--sage)">${sub}</p></div>`;
    el.innerHTML = card('App', s.app?.versao ? 'v' + s.app.versao : '—', s.app ? `${s.app.arquivos} arquivos · ${cdFmt(s.app.linhas)} linhas` : '')
        + card('Bot', s.bot ? `${s.bot.registradas}/${s.bot.conhecidas}` : '—', 'functions com versão registrada')
        + card('Gestão', s.gestao?.versao || '—', s.gestao ? `${s.gestao.arquivos} arquivos · ${cdFmt(s.gestao.linhas)} linhas` : '')
        + card('Landing', s.landing?.versao ? 'v' + s.landing.versao : '—', s.landing ? `${cdFmt(s.landing.linhas)} linhas` : '');
}
