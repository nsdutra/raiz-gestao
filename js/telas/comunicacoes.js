// ============================================================================
// js/telas/comunicacoes.js — Raiz Gestão
//
// v0.1.0 (NOVO, 29/08/2026) — pedido explícito do Nicola: tela pra
// acompanhar os Planos de Comunicação (Onboarding/Adoção/Upsell/Novos
// Releases) — quais mensagens existem em cada plano, o funil de
// exibição→conclusão de cada uma, quem recebeu o quê e quando, por
// empresa. Prioridade combinada com ele: "acompanhar" primeiro, edição
// de conteúdo/gatilho fica pra uma rodada seguinte — por ora dá pra
// pausar/reativar uma mensagem (fn_comunicacao_definir_status) e ver o
// JSON de canais/regras de cada uma (só leitura).
//
// Mesmo padrão estrutural de bot-uso.js: filtros no topo, cards de
// resumo, funil (barras), quebra por empresa com drill-down, log
// detalhado. Fonte: comercial.comunicacoes/comunicacao_canais/
// comunicacao_regras/comunicacao_interacoes, via RPCs gestao.fn_
// comunicacoes_* (gestao_comunicacoes_rpcs.sql).
//
// PENDÊNCIA CONHECIDA (documentada, não escondida): app e Cofre já
// chamam fn_comunicacao_proxima_app/_servico (ver diario-eventos e
// comunicacoes-app.js). O bot do WhatsApp ainda não foi ligado — até lá,
// os dados desta tela refletem só o canal 'app'.
// ============================================================================

let cmPlanos = [];
let cmPlanoAtualId = null;
let cmEmpresas = [];
let cmClienteId = '';
let cmMensagensDoPlano = []; // cache pra abrir o JSON sem nova consulta

async function telaComunicacoesInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando Comunicações...</p>`;

    const [{ data: planos, error: e1 }, empresasResp] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_comunicacoes_planos'),
        cmEmpresas.length === 0 ? dbAuth.from('clientes').select('id, nome_empresa').order('nome_empresa') : Promise.resolve({ data: cmEmpresas })
    ]);
    if (e1) { gestaoErro(e1.message); return; }
    cmPlanos = planos || [];
    if (empresasResp?.data) cmEmpresas = empresasResp.data;
    if (!cmPlanoAtualId && cmPlanos.length) cmPlanoAtualId = cmPlanos.find(p => p.codigo === 'onboarding')?.id || cmPlanos[0].id;

    area.innerHTML = `
        <div class="mb-4">
            <h1 class="text-lg font-extrabold flex items-center" style="color:var(--ink)">
                Comunicações
                ${gestaoInfoIcone('Fonte: comercial.comunicacoes — mensagens pró-ativas do app/Cofre/bot organizadas em planos (Onboarding, Adoção, Upsell, Novos Releases). Cada plano tem uma sequência de mensagens com gatilhos por estado real da empresa/pessoa.')}
            </h1>
            <p class="text-xs mt-0.5" style="color:var(--sage)">Funil por mensagem, quem recebeu o quê e quando, por plano.</p>
        </div>

        <div id="cm-aviso-bot" class="mb-4 p-3 rounded-xl border-2 text-xs" style="border-color:var(--warning);background:var(--warning-bg,#fff7ed);color:var(--warning)">
            O bot do WhatsApp ainda não está ligado à Central de Comunicações — os dados abaixo refletem só o canal do app/Cofre por enquanto.
        </div>

        <div class="flex gap-1.5 mb-4 flex-wrap" id="cm-abas-plano">
            ${cmPlanos.map(p => `
                <button onclick="cmTrocarPlano('${p.id}')" id="cm-aba-${p.id}"
                    class="text-xs font-bold px-3 py-2 rounded-lg border-2"
                    style="border-color:${p.id === cmPlanoAtualId ? 'var(--brass)' : 'var(--line)'};background:#fff;color:var(--ink)">
                    ${pmEsc(p.nome)} <span style="color:var(--sage)">(${p.qtd_mensagens})</span>
                </button>
            `).join('')}
        </div>

        <p id="cm-plano-objetivo" class="text-xs mb-4" style="color:var(--sage)"></p>

        <div class="flex flex-wrap gap-2 mb-5 items-center">
            ${gestaoFiltroPeriodoHtml('cm', 30)}
            <select id="cm-filtro-empresa" onchange="cmCarregar()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line)">
                <option value="">Todas as empresas</option>
                ${cmEmpresas.map(e => `<option value="${e.id}">${pmEsc(e.nome_empresa)}</option>`).join('')}
            </select>
            <button onclick="cmCarregar()" class="text-xs font-bold px-3 py-2 rounded-lg" style="background:var(--pine);color:#fff">Filtrar</button>
        </div>

        <div id="cm-cards" class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6"></div>

        <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Funil por mensagem <span style="color:var(--sage);font-weight:600">(exibiu → concluiu)</span></h2>
        <div id="cm-funil" class="space-y-3 mb-6"></div>

        <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Mensagens do plano</h2>
        <div id="cm-mensagens" class="space-y-2 mb-6"></div>

        <div class="grid md:grid-cols-2 gap-6">
            <div>
                <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Por empresa</h2>
                <div id="cm-empresas" class="space-y-2"></div>
            </div>
            <div>
                <div class="flex items-center justify-between mb-3">
                    <h2 class="text-sm font-extrabold" style="color:var(--ink)">Log recente</h2>
                </div>
                <div id="cm-log" class="space-y-1.5"></div>
            </div>
        </div>
    `;

    cmCarregar();
}

function cmTrocarPlano(planoId) {
    cmPlanoAtualId = planoId;
    document.querySelectorAll('[id^="cm-aba-"]').forEach(b => b.style.borderColor = 'var(--line)');
    document.getElementById('cm-aba-' + planoId).style.borderColor = 'var(--brass)';
    cmCarregar();
}

async function cmCarregar() {
    if (!cmPlanoAtualId) return;
    const plano = cmPlanos.find(p => p.id === cmPlanoAtualId);
    document.getElementById('cm-plano-objetivo').textContent = plano?.objetivo || '';

    cmClienteId = document.getElementById('cm-filtro-empresa').value;
    const periodo = gestaoLerFiltroPeriodo('cm');
    const pCliente = cmClienteId || null;

    const [
        { data: resumo, error: e1 },
        { data: funil, error: e2 },
        { data: mensagens, error: e3 },
        { data: porEmpresa, error: e4 },
        { data: log, error: e5 }
    ] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_comunicacoes_resumo', { p_plano_id: cmPlanoAtualId, p_data_inicio: periodo.inicio, p_data_fim: periodo.fim, p_cliente_id: pCliente }),
        dbAuth.schema('gestao').rpc('fn_comunicacoes_funil', { p_plano_id: cmPlanoAtualId, p_data_inicio: periodo.inicio, p_data_fim: periodo.fim, p_cliente_id: pCliente }),
        dbAuth.schema('gestao').rpc('fn_comunicacoes_mensagens', { p_plano_id: cmPlanoAtualId }),
        dbAuth.schema('gestao').rpc('fn_comunicacoes_por_empresa', { p_plano_id: cmPlanoAtualId, p_data_inicio: periodo.inicio, p_data_fim: periodo.fim }),
        dbAuth.schema('gestao').rpc('fn_comunicacoes_detalhe', { p_plano_id: cmPlanoAtualId, p_cliente_id: pCliente, p_data_inicio: periodo.inicio, p_data_fim: periodo.fim, p_limite: 100 })
    ]);
    const erro = e1 || e2 || e3 || e4 || e5;
    if (erro) { gestaoErro(erro.message); return; }

    cmMensagensDoPlano = mensagens || [];

    const r = (resumo && resumo[0]) || { total_exibicoes: 0, pessoas_alcancadas: 0, empresas_alcancadas: 0, taxa_conclusao: 0 };
    document.getElementById('cm-cards').innerHTML =
        gestaoCardMetrica('Exibições', r.total_exibicoes) +
        gestaoCardMetrica('Pessoas alcançadas', r.pessoas_alcancadas) +
        gestaoCardMetrica('Empresas', r.empresas_alcancadas) +
        gestaoCardMetrica('Taxa de conclusão', r.taxa_conclusao + '%', r.taxa_conclusao >= 50 ? 'green' : r.taxa_conclusao > 0 ? 'amber' : undefined);

    document.getElementById('cm-funil').innerHTML = (funil || []).map(f => {
        const maior = Math.max(1, Number(f.pessoas_exibiu));
        return `
            <div class="p-3 rounded-xl border-2" style="border-color:var(--line);background:#fff">
                <p class="text-xs font-bold mb-2" style="color:var(--ink)">${pmEsc(f.titulo)} <span style="color:var(--sage);font-weight:600">(${pmEsc(f.codigo)})</span></p>
                ${gestaoBarra('Exibiu', f.pessoas_exibiu, maior)}
                <div class="mt-1.5">${gestaoBarra('Concluiu', f.pessoas_concluiu, maior)}</div>
            </div>
        `;
    }).join('') || `<p class="text-sm" style="color:var(--sage)">Nenhuma mensagem cadastrada neste plano ainda.</p>`;

    document.getElementById('cm-mensagens').innerHTML = cmMensagensDoPlano.map(m => cmLinhaMensagem(m)).join('')
        || `<p class="text-sm" style="color:var(--sage)">Nenhuma mensagem cadastrada neste plano ainda.</p>`;

    const maiorEmpresa = Math.max(1, ...(porEmpresa || []).map(e => Number(e.total_exibicoes)));
    document.getElementById('cm-empresas').innerHTML = (porEmpresa || []).map(e => `
        <button onclick="cmFiltrarPorEmpresa('${e.cliente_id}')" class="w-full text-left">
            ${gestaoBarra(`${e.empresa} (${e.pessoas_alcancadas} pessoa${e.pessoas_alcancadas == 1 ? '' : 's'})`, e.total_exibicoes, maiorEmpresa)}
        </button>
    `).join('') || `<p class="text-sm" style="color:var(--sage)">Sem envios no período selecionado.</p>`;

    document.getElementById('cm-log').innerHTML = (log || []).map(l => `
        <div class="flex items-center justify-between gap-3 p-2.5 rounded-lg border text-xs" style="border-color:var(--line)">
            <div class="min-w-0">
                <b style="color:var(--ink)">${pmEsc(l.pessoa_nome)}</b>
                <span style="color:var(--sage)"> · ${pmEsc(l.empresa)}</span>
                <div style="color:var(--sage)">${pmEsc(l.comunicacao_codigo)} · ${pmEsc(l.canal)}</div>
            </div>
            <div class="text-right flex-none">
                <div style="color:var(--ink)">${new Date(l.criado_em).toLocaleString('pt-BR')}</div>
                <div style="color:${l.evento === 'concluiu' || l.evento === 'respondeu' ? 'var(--success)' : l.evento === 'erro' ? 'var(--danger)' : 'var(--sage)'}">${pmEsc(l.evento)}</div>
            </div>
        </div>
    `).join('') || `<p class="text-xs" style="color:var(--sage)">Sem interações no período/filtro selecionado.</p>`;
}

function cmFiltrarPorEmpresa(clienteId) {
    document.getElementById('cm-filtro-empresa').value = clienteId;
    cmCarregar();
    document.getElementById('cm-log').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const CM_STATUS_ROTULO = { rascunho: 'Rascunho', ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' };
const CM_STATUS_COR = { rascunho: 'var(--sage)', ativa: 'var(--success)', pausada: 'var(--warning)', encerrada: 'var(--danger)' };

function cmLinhaMensagem(m) {
    const canaisResumo = (m.canais || []).map(c => c.canal).join(', ') || '—';
    return `
        <div class="p-3 rounded-xl border-2" style="border-color:var(--line);background:#fff">
            <div class="flex items-center justify-between gap-2 flex-wrap">
                <div class="min-w-0">
                    <span class="text-xs font-bold" style="color:var(--ink)">${pmEsc(m.codigo)}</span>
                    <span class="text-[11px] ml-2" style="color:var(--sage)">canais: ${pmEsc(canaisResumo)} · prioridade ${m.prioridade}</span>
                </div>
                <div class="flex items-center gap-2 flex-none">
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full" style="background:var(--paper);color:${CM_STATUS_COR[m.status] || 'var(--ink)'}">${CM_STATUS_ROTULO[m.status] || m.status}</span>
                    ${m.status === 'ativa'
                        ? `<button onclick="cmDefinirStatus('${m.id}','pausada')" class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:var(--paper);color:var(--ink)">Pausar</button>`
                        : `<button onclick="cmDefinirStatus('${m.id}','ativa')" class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:var(--pine);color:#fff">Ativar</button>`
                    }
                    <button onclick="cmAlternarJson('${m.id}')" class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:var(--paper);color:var(--ink)">Ver JSON</button>
                </div>
            </div>
            <div id="cm-json-${m.id}" class="hidden mt-2 pt-2 border-t" style="border-color:var(--line)">
                <p class="text-[10px] font-bold uppercase mb-1" style="color:var(--sage)">Canais</p>
                <pre class="text-[10px] p-2 rounded-lg overflow-x-auto mb-2" style="background:var(--paper);color:var(--ink)">${pmEsc(JSON.stringify(m.canais, null, 2))}</pre>
                <p class="text-[10px] font-bold uppercase mb-1" style="color:var(--sage)">Regras</p>
                <pre class="text-[10px] p-2 rounded-lg overflow-x-auto" style="background:var(--paper);color:var(--ink)">${pmEsc(JSON.stringify(m.regras, null, 2))}</pre>
                <p class="text-[10px] mt-2" style="color:var(--sage)">Edição de conteúdo/gatilho por aqui ainda não existe — pendência conhecida, registrada no cabeçalho do arquivo. Por ora, mudanças de regra/texto passam por migration.</p>
            </div>
        </div>
    `;
}

function cmAlternarJson(comunicacaoId) {
    document.getElementById('cm-json-' + comunicacaoId)?.classList.toggle('hidden');
}

async function cmDefinirStatus(comunicacaoId, status) {
    const { error } = await dbAuth.schema('gestao').rpc('fn_comunicacao_definir_status', { p_comunicacao_id: comunicacaoId, p_status: status });
    if (error) { alert('Erro: ' + error.message); return; }
    const msg = cmMensagensDoPlano.find(m => m.id === comunicacaoId);
    if (msg) msg.status = status;
    const idx = cmMensagensDoPlano.findIndex(m => m.id === comunicacaoId);
    if (idx >= 0) document.getElementById('cm-mensagens').children[idx].outerHTML = cmLinhaMensagem(cmMensagensDoPlano[idx]);
}
