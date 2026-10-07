// ============================================================================
// js/telas/suporte-backlog.js — Raiz Gestão
// Versão: 0.5.0 · 07/10/2026
//
// v0.5.0 (07/10/2026, dem 6f4df8cc, sessão 20261007-1844-chamado-documento; ficha F1–F5 aprovada pelo
// Nicola 07/10 19:59) — chamado que veio de uma leitura do motor mostra o DOCUMENTO na ficha: empresa,
// nome do arquivo, o que a IA leu (tipo, confiança, resumo), canal e data, com "Ver arquivo" (link de
// 5 min) e "Resolver no Motor", que abre Motor Documental › Leituras já nessa leitura (antes caía na
// aba Assertividade, só com números). O texto da ficha deixa de prometer reprocessamento que não havia.
// Versão anterior: 0.4.0 · 04/10/2026
//
// v0.4.0 (04/10/2026, frente D · fatia D1, demandas 00b919b6 e 860233ca, sessão
// 20261004-1800-indicadores; "De acordo com D1" e "SLA de 11.09" do Nicola às 22:06) — visão de
// SUPORTE com SLA, quando só o chip Suporte está marcado:
//   — Painel de todas as empresas (fn_suporte_painel, nova, só master): abertos, SLA estourado,
//     sem 1ª resposta, tempo médio de 1ª resposta e de resolução, % dentro do SLA contra a meta
//     de 90%, quantidade no período; chamados por semana com o % no SLA; por origem, empresa e
//     severidade; tabela de chamados com empresa, severidade, prazo, 1ª resposta e responsável;
//     a política de SLA (crítica 4 h · alta 24 h · sugestão 72 h, decisão de 11/09).
//   — Ficha de chamado de suporte ganha o bloco SLA: severidade (trocar recalcula o prazo —
//     fn_demanda_atualizar p_severidade), prazo e estado, "Responder" (fn_demanda_responder,
//     nova, marca a 1ª resposta) e, quando o chamado veio de uma leitura do motor, "Abrir no
//     Motor Documental" (a mesma tela de hoje — o chamado só guarda vínculo, SLA e registro).
//   — Produto e Serviço seguem exatamente como estavam.
// Versão anterior: 0.3.0 · 27/09/2026
//
// v0.3.0 (demanda 7af2de58) — estágio "em testes" chega na TELA (já existia
// no banco desde a v1.4.0 do manifesto — fn_demanda_entregar/fn_demanda_
// teste_tratar, situacao em_testes, fn_demanda_encerrar recusando com teste
// aberto). 4 pontos, todos aditivos:
//   1) Chip "🧪 Em testes" na lista (supMudarSituacao('em_testes'), já
//      aceito por fn_demandas_listar) com contador de contagens.em_testes;
//   2) Ficha ganha seção "Testes" (d.testes, já devolvido por fn_demanda_
//      detalhe) — cada linha com Aprovar/Reprovar/Cancelar chamando
//      fn_demanda_teste_tratar quando aberto, e mostra que já entrou em
//      "sem_alteracao" quando fechado;
//   3) rotuloSit (lista) e o badge da ficha reconhecem em_testes — antes
//      caíam no rótulo cru (a própria string "em_testes");
//   4) supEncerrar(): a resposta ok=false acao='em_testes' (fn_demanda_
//      encerrar recusando) já trazia dados=[{id,teste}] prontos — agora
//      mostra a lista de testes pendentes em vez do texto genérico que
//      citava o nome da função (fn_demanda_teste_tratar), sem sentido pra
//      quem está na tela.
// A demanda original também pedia isso no app ("Solicitações"), mas o app
// (index.html) não tem — e nunca teve — nenhuma tela de demandas/backlog
// (fn_demandas_listar não existe lá); a única tela viva é esta, do Gestão.
// Registrado no ENTREGA desta rodada; não escondido.
//
// v0.2.0 — pedido do Nicola: "tem algum filtro... previsão de entrada...
// sem criar campo novo?". A previsão já existia no banco (a data do
// acompanhamento — fn_demanda_acompanhamento_criar) — só a tela nunca
// deixava escolher, sempre mandava hoje. Agora "Agendar acompanhamento"
// tem campo de data (vira a previsão real — o item passa a aparecer como
// vencendo/atrasado sozinho). Nova seção "Acompanhamentos" na ficha,
// com Concluir/Cancelar/Reagendar por item (fn_demanda_acompanhamento_
// tratar/reagendar, já existentes, só não usadas ainda). Chips de
// situação ganham "Atrasadas" e "Sem previsão" (= sem_prazo, situação já
// calculada pelo banco). Sem categoria própria — dica de usar prefixo no
// título + busca, já que não dá pra criar campo novo.
//
// v0.1.1 — CORREÇÃO (achada ao ler PLANO_TECNICO_SISTEMA_DEMANDAS_RAIZ
// v2.0.0 na íntegra, que eu não tinha lido antes de construir v0.1.0):
//   1) Nome do arquivo estava errado (suporte.js) — o manifesto real
//      (§11 do plano) espera suporte-backlog.js. Renomeado.
//   2) Empresa padrão era resolvida por ILIKE em nome_empresa — o "Guia
//      do Claude" (§13) proíbe isso explicitamente ("nunca por nome ou
//      ID fixo"). Agora usa gestao.fn_demandas_contexto() (nova, M7 —
//      resolve pela licença módulo='gestao' ativa). O valor que saía
//      antes (Matriz) já estava certo — só o MÉTODO era errado.
// Pendente, não corrigido nesta versão (registrado como pendência, não
// escondido): indicadores deveriam ser "abertos · atrasados · sem
// acompanhamento · encerrados no período" (§7.2) — hoje mostra abertas/
// atrasadas/vencendo; falta o filtro de período; prefixo de função é
// `sup` em vez do `sb` que o plano pede (renomear é mudança grande o
// bastante pra preferir fazer numa entrega própria, não misturada aqui).
//
// v0.1.0 — SISTEMA DE DEMANDAS, Fase 1 (Backlog de Produto): primeira tela
// real desta aba — antes era o placeholder telaEmConstrucaoInit("Suporte",
// "..."). Usa fn_demandas_*/fn_demanda_* (banco), já prontas e testadas —
// esta tela só monta interface em cima delas, nenhuma regra de negócio
// nova aqui (idempotência, duplicata semântica, auditoria e permissão já
// vêm do banco). Abre em Matriz + Produto + Em aberto por padrão.
//
// Canal enviado ao banco: sempre null (não 'gestao' explícito) — pessoa_id
// e canal ficam null em toda chamada porque fn_demandas_ator() resolve os
// dois sozinha via auth.uid() quando a sessão é autenticada (branch
// v_uid is not null da função), o mesmo padrão que app/gestao sempre
// usam. Só chamadas via service_role (bot/automação/claude) precisam
// passar os dois explícitos.
// ============================================================================

let supEmpresas = [];
let supClienteId = null; // null até o primeiro load — cai na empresa da plataforma por padrão
let supSubtipos = ['produto'];
let supSituacao = 'abertas';
let supBusca = '';
let supDemandaAtual = null; // id da demanda aberta na ficha, ou null = lista

function supEsc(s) {
    return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function telaSuporteInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando Suporte & Backlog...</p>`;

    if (supEmpresas.length === 0) {
        const { data, error } = await dbAuth.from('clientes').select('id, nome_empresa').order('nome_empresa');
        if (error) { gestaoErro(error.message); return; }
        supEmpresas = data || [];
    }
    if (!supClienteId) {
        const { data: ctx, error: eCtx } = await dbAuth.schema('gestao').rpc('fn_demandas_contexto');
        if (eCtx) { gestaoErro(eCtx.message); return; }
        supClienteId = (ctx && ctx[0] && ctx[0].cliente_id) || (supEmpresas[0]?.id || null);
    }

    if (supDemandaAtual) await supRenderFicha();
    else await supRenderLista();
}

// ----------------------------------------------------------------------------
// LISTA
// ----------------------------------------------------------------------------
async function supRenderLista() {
    // v0.4.0 (D1) — só Suporte marcado → painel com SLA, de todas as empresas
    if (supSubtipos.length === 1 && supSubtipos[0] === 'suporte') { await supRenderPainelSuporte(); return; }
    const area = document.getElementById('area-conteudo');
    const { data, error } = await dbAuth.rpc('fn_demandas_listar', {
        p_cliente_id: supClienteId, p_subtipos: supSubtipos, p_situacao: supSituacao,
        p_busca: supBusca || null, p_limite: 100, p_offset: 0, p_pessoa_id: null, p_canal: null,
    });
    if (error) { gestaoErro(error.message); return; }
    if (!data.ok) { gestaoErro(data.mensagem || 'Falha ao listar demandas.'); return; }

    const empresaSel = supEmpresas.find(e => e.id === supClienteId);
    const chipSubtipo = (v, label) => `<button onclick="supAlternarSubtipo('${v}')"
        class="text-xs font-bold px-3 py-1.5 rounded-lg border-2"
        style="border-color:${supSubtipos.includes(v) ? 'var(--brass)' : 'var(--line)'};background:#fff;color:var(--ink)">${label}</button>`;
    const chipSituacao = (v, label) => `<button onclick="supMudarSituacao('${v}')"
        class="text-xs font-bold px-3 py-1.5 rounded-lg border-2"
        style="border-color:${supSituacao === v ? 'var(--brass)' : 'var(--line)'};background:#fff;color:var(--ink)">${label}</button>`;

    const c = data.contagens || {};
    area.innerHTML = `
        <div class="mb-4">
            <h1 class="text-lg font-extrabold flex items-center" style="color:var(--ink)">
                Suporte & Backlog
                ${gestaoInfoIcone('Sistema de Demandas — suporte ao cliente, serviços contratados e backlog de Produto, modelados como extensão do motor de Controles (cofre_itens_controle tipo=sistema). Nenhuma tabela nova de tickets/backlog.')}
            </h1>
            <p class="text-xs mt-0.5" style="color:var(--sage)">Chamados de suporte, serviços contratados e backlog do produto — tudo num lugar só.</p>
        </div>

        <div class="grid grid-cols-4 gap-2 mb-3">
            ${gestaoCardMetrica('Abertas', c.abertas ?? 0, 'ink')}
            ${gestaoCardMetrica('Atrasadas', c.atrasadas ?? 0, (c.atrasadas > 0 ? 'red' : 'ink'))}
            ${gestaoCardMetrica('Sem prev.', c.sem_prazo ?? 0, 'ink', 'Demandas sem nenhum acompanhamento/previsão marcada ainda')}
            ${gestaoCardMetrica('Encerradas', c.encerradas ?? 0, 'ink')}
        </div>

        <p class="text-[11px] mb-2" style="color:var(--sage)">💡 Sem campo de categoria próprio — pra agrupar por assunto, use um prefixo no título (ex.: <code>[Fiscal]</code>, <code>[Bot]</code>) e depois busque por ele.</p>

        <div class="flex flex-wrap gap-1.5 mb-2">
            <select id="sup-select-empresa" onchange="supMudarEmpresa(this.value)"
                class="text-xs font-bold px-2 py-1.5 rounded-lg border-2" style="border-color:var(--line);color:var(--ink)">
                ${supEmpresas.map(e => `<option value="${e.id}" ${e.id === supClienteId ? 'selected' : ''}>${supEsc(e.nome_empresa)}</option>`).join('')}
            </select>
        </div>
        <div class="flex flex-wrap gap-1.5 mb-2">
            ${chipSubtipo('produto', '📦 Produto')}
            ${chipSubtipo('suporte', '🎧 Suporte')}
            ${chipSubtipo('servico', '🛠️ Serviço')}
        </div>
        <div class="flex flex-wrap gap-1.5 mb-3">
            ${chipSituacao('abertas', 'Em aberto')}
            ${chipSituacao('atrasadas', 'Atrasadas')}
            ${chipSituacao('sem_prazo', 'Sem previsão')}
            ${chipSituacao('em_testes', `🧪 Em testes${c.em_testes ? ' (' + c.em_testes + ')' : ''}`)}
            ${chipSituacao('todas', 'Todas')}
            ${chipSituacao('encerradas', 'Encerradas')}
        </div>
        ${c.testes_pendentes > 0 ? `<p class="text-[11px] mb-2" style="color:var(--sage)">🧪 ${c.testes_pendentes} teste(s) aguardando validação no total (pode passar de 1 por demanda).</p>` : ''}

        <div class="flex gap-1.5 mb-3">
            <input id="sup-busca" type="text" placeholder="Buscar por título..." value="${supEsc(supBusca)}"
                onkeydown="if(event.key==='Enter')supBuscar()"
                class="flex-1 min-w-0 text-xs p-2 rounded-lg border-2" style="border-color:var(--line)">
            <button onclick="supBuscar()" class="text-xs font-bold px-3 rounded-lg border-2" style="border-color:var(--line)">Buscar</button>
            <button onclick="supAbrirNova()" class="text-xs font-bold px-3 rounded-lg text-white" style="background:var(--pine)">+ Nova</button>
        </div>

        <div id="sup-lista" class="space-y-2"></div>
    `;

    const lista = document.getElementById('sup-lista');
    const itens = data.dados || [];
    if (itens.length === 0) {
        lista.innerHTML = `<p class="text-xs p-4 text-center" style="color:var(--sage)">Nenhuma demanda ${supSituacao === 'abertas' ? 'em aberto' : ''} pra ${supEsc(empresaSel?.nome_empresa || '')}.</p>`;
        return;
    }
    lista.innerHTML = itens.map(d => {
        const corSit = d.situacao === 'atrasada' ? 'var(--danger)' : d.situacao === 'vencendo' ? 'var(--warning)' : d.situacao === 'em_testes' ? 'var(--brass)' : 'var(--sage)';
        const rotuloSit = { atrasada: 'Atrasada', vencendo: 'Vencendo', sem_prazo: 'Sem prazo', aberta: 'Aberta', encerrada: 'Encerrada', em_testes: '🧪 Em testes' }[d.situacao] || d.situacao;
        const rodape = `${supEsc(d.subtipo_nome)} · ${d.qtd_abertas} acompanhamento(s) em aberto` +
            (d.dias !== null ? ' · ' + (d.dias < 0 ? `venceu há ${Math.abs(d.dias)}d` : `${d.dias}d`) : '');
        return `<button onclick="supAbrirFicha('${d.id}')" class="w-full text-left p-3 rounded-xl border-2" style="border-color:var(--line);background:#fff">
            <div class="flex items-start justify-between gap-2">
                <p class="text-sm font-bold flex-1 min-w-0" style="color:var(--ink)">${supEsc(d.titulo)}</p>
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded flex-none" style="background:${corSit}1a;color:${corSit}">${rotuloSit}</span>
            </div>
            <p class="text-[11px] mt-1" style="color:var(--sage)">${rodape}</p>
        </button>`;
    }).join('');
}

function supAlternarSubtipo(v) {
    if (supSubtipos.includes(v)) {
        if (supSubtipos.length === 1) return; // sempre pelo menos 1 marcado
        supSubtipos = supSubtipos.filter(x => x !== v);
    } else {
        supSubtipos = [...supSubtipos, v];
    }
    supRenderLista();
}
function supMudarSituacao(v) { supSituacao = v; supRenderLista(); }
function supMudarEmpresa(id) { supClienteId = id; supRenderLista(); }
function supBuscar() { supBusca = document.getElementById('sup-busca').value.trim(); supRenderLista(); }

// ----------------------------------------------------------------------------
// FICHA (detalhe + linha do tempo + ações)
// ----------------------------------------------------------------------------
async function supAbrirFicha(id) {
    supDemandaAtual = id;
    await supRenderFicha();
}

function supVoltarLista() {
    supDemandaAtual = null;
    supRenderLista();
}

async function supRenderFicha() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    const { data, error } = await dbAuth.rpc('fn_demanda_detalhe', { p_item_id: supDemandaAtual, p_pessoa_id: null, p_canal: null });
    if (error) { gestaoErro(error.message); return; }
    if (!data.ok) { gestaoErro(data.mensagem || 'Falha ao abrir demanda.'); return; }
    const d = data.dados;

    area.innerHTML = `
        <button onclick="supVoltarLista()" class="text-xs font-bold mb-3" style="color:var(--sage)">← Voltar para a lista</button>

        <div class="p-4 rounded-2xl border-2 mb-3" style="border-color:var(--line);background:#fff">
            <div class="flex items-start justify-between gap-2">
                <h2 class="text-base font-extrabold flex-1 min-w-0" style="color:var(--ink)">${supEsc(d.titulo)}</h2>
                ${d.ativo && d.situacao === 'em_testes'
                    ? `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded flex-none" style="background:var(--brass)1a;color:var(--brass)">🧪 Em testes</span>`
                    : `<span class="text-[10px] font-bold px-1.5 py-0.5 rounded flex-none" style="background:${d.ativo ? 'var(--success-bg)' : '#eee'};color:${d.ativo ? 'var(--success)' : 'var(--sage)'}">${d.ativo ? 'Aberta' : 'Encerrada'}</span>`}
            </div>
            <p class="text-xs mt-1" style="color:var(--sage)">${supEsc(d.subtipo_nome)} · ${supEsc(d.cliente_nome)} · criada em ${new Date(d.criado_em).toLocaleDateString('pt-BR')}</p>
            ${d.descricao ? `<p class="text-sm mt-2" style="color:var(--ink)">${supEsc(d.descricao)}</p>` : ''}
            <div class="flex gap-1.5 mt-3">
                ${d.ativo
                    ? `<button onclick="supEncerrar()" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2" style="border-color:var(--danger);color:var(--danger)">Encerrar</button>`
                    : `<button onclick="supReabrir()" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2" style="border-color:var(--line);color:var(--ink)">Reabrir</button>`}
            </div>
        </div>

        ${d.subtipo === 'suporte' ? '<div id="sup-sla-bloco"></div>' : ''}

        ${d.ativo ? `
        <div class="p-3 rounded-xl border-2 mb-3" style="border-color:var(--line);background:#fff">
            <p class="text-xs font-bold mb-1.5" style="color:var(--ink)">Agendar acompanhamento</p>
            <p class="text-[11px] mb-1.5" style="color:var(--sage)">A data vira a previsão desta demanda — é o que faz ela aparecer como "vencendo"/"atrasada".</p>
            <div class="flex gap-1.5 mb-1.5">
                <input id="sup-novo-acomp-data" type="date" value="${new Date().toISOString().slice(0, 10)}"
                    class="text-xs p-2 rounded-lg border-2" style="border-color:var(--line)">
                <textarea id="sup-novo-acomp" rows="2" placeholder="O que precisa acontecer até essa data..."
                    class="flex-1 min-w-0 text-xs p-2 rounded-lg border-2" style="border-color:var(--line)"></textarea>
            </div>
            <button onclick="supRegistrarAcompanhamento()" class="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style="background:var(--pine)">Agendar</button>
        </div>` : ''}

        ${(d.testes || []).length > 0 ? `
        <p class="text-xs font-bold mb-1.5" style="color:var(--ink)">Testes</p>
        <div class="space-y-2 mb-3">
            ${d.testes.map(t => {
                const corSt = t.status === 'aberto' ? 'var(--brass)' : t.status === 'aprovado' ? 'var(--success)' : 'var(--sage)';
                const rotSt = { aberto: 'aguardando validação', aprovado: 'aprovado', cancelado: 'cancelado' }[t.status] || t.status;
                return `<div class="p-2.5 rounded-lg border-2 text-xs" style="border-color:var(--line);background:#fff">
                    <div class="flex justify-between gap-2">
                        <p class="flex-1 min-w-0" style="color:var(--ink)">${supEsc(t.teste)}</p>
                        <span class="font-bold flex-none" style="color:${corSt}">${rotSt}</span>
                    </div>
                    ${t.resultado ? `<p class="mt-0.5" style="color:var(--sage)">${supEsc(t.resultado)}</p>` : ''}
                    ${t.status !== 'aberto' && t.tratado_por_nome ? `<p class="mt-0.5" style="color:var(--sage)">${supEsc(t.tratado_por_nome)}${t.tratado_em ? ' · ' + new Date(t.tratado_em).toLocaleDateString('pt-BR') : ''}</p>` : ''}
                    ${t.status === 'aberto' && d.ativo ? `<div class="flex gap-1.5 mt-1.5">
                        <button onclick="supTratarTeste('${t.id}','aprovar')" class="text-[11px] font-bold px-2 py-1 rounded-lg border-2" style="border-color:var(--success);color:var(--success)">Aprovar</button>
                        <button onclick="supTratarTeste('${t.id}','reprovar')" class="text-[11px] font-bold px-2 py-1 rounded-lg border-2" style="border-color:var(--warning);color:var(--warning)">Reprovar</button>
                        <button onclick="supTratarTeste('${t.id}','cancelar')" class="text-[11px] font-bold px-2 py-1 rounded-lg border-2" style="border-color:var(--danger);color:var(--danger)">Cancelar</button>
                    </div>` : ''}
                </div>`;
            }).join('')}
        </div>` : ''}

        ${(d.ocorrencias || []).length > 0 ? `
        <p class="text-xs font-bold mb-1.5" style="color:var(--ink)">Acompanhamentos</p>
        <div class="space-y-2 mb-3">
            ${d.ocorrencias.map(o => {
                const corSt = o.status === 'aberto' ? (o.dias !== null && o.dias < 0 ? 'var(--danger)' : 'var(--warning)') : 'var(--sage)';
                const rotSt = o.status === 'aberto' ? (o.dias !== null && o.dias < 0 ? `atrasado ${Math.abs(o.dias)}d` : `em ${o.dias}d`) : (o.status === 'concluido' ? 'concluído' : 'cancelado');
                return `<div class="p-2.5 rounded-lg border-2 text-xs" style="border-color:var(--line);background:#fff">
                    <div class="flex justify-between gap-2">
                        <span style="color:var(--ink)">${new Date(o.data + 'T00:00:00').toLocaleDateString('pt-BR')}</span>
                        <span class="font-bold" style="color:${corSt}">${rotSt}</span>
                    </div>
                    <p class="mt-0.5" style="color:var(--ink)">${supEsc(o.descricao)}</p>
                    ${o.resultado ? `<p class="mt-0.5" style="color:var(--sage)">${supEsc(o.resultado)}</p>` : ''}
                    ${o.status === 'aberto' && d.ativo ? `<div class="flex gap-1.5 mt-1.5">
                        <button onclick="supTratarAcompanhamento('${o.id}','concluir')" class="text-[11px] font-bold px-2 py-1 rounded-lg border-2" style="border-color:var(--success);color:var(--success)">Concluir</button>
                        <button onclick="supTratarAcompanhamento('${o.id}','cancelar')" class="text-[11px] font-bold px-2 py-1 rounded-lg border-2" style="border-color:var(--danger);color:var(--danger)">Cancelar</button>
                        <button onclick="supReagendar('${o.id}')" class="text-[11px] font-bold px-2 py-1 rounded-lg border-2" style="border-color:var(--line);color:var(--ink)">Reagendar</button>
                    </div>` : ''}
                </div>`;
            }).join('')}
        </div>` : ''}

        <p class="text-xs font-bold mb-1.5" style="color:var(--ink)">Linha do tempo</p>
        <div class="space-y-2">
            ${(d.linha_do_tempo || []).slice().reverse().map(ev => `
                <div class="p-2.5 rounded-lg border-2 text-xs" style="border-color:var(--line);background:#fff">
                    <div class="flex justify-between gap-2">
                        <b style="color:var(--ink)">${supRotuloAcao(ev.acao)}</b>
                        <span style="color:var(--sage)">${new Date(ev.quando).toLocaleString('pt-BR')}</span>
                    </div>
                    <p style="color:var(--sage)">${supEsc(ev.pessoa || ev.origem)} · via ${supEsc(ev.origem)}${ev.motivo ? ' · ' + supEsc(ev.motivo) : ''}</p>
                    ${ev.depois && ev.depois.descricao ? `<p class="mt-1" style="color:var(--ink)">${supEsc(ev.depois.descricao)}</p>` : ''}
                </div>
            `).join('') || '<p class="text-xs" style="color:var(--sage)">Nenhum evento ainda.</p>'}
        </div>
    `;
    if (d.subtipo === 'suporte') supCarregarBlocoSla(d); // v0.4.0 (D1)
}

function supRotuloAcao(acao) {
    return {
        criar: 'Criada', encerrar: 'Encerrada', reabrir: 'Reaberta', concluir: 'Acompanhamento concluído',
        cancelar: 'Acompanhamento cancelado', atualizar: 'Atualizada', acompanhamento: 'Acompanhamento',
    }[acao] || acao;
}

async function supRegistrarAcompanhamento() {
    const campo = document.getElementById('sup-novo-acomp');
    const campoData = document.getElementById('sup-novo-acomp-data');
    const texto = campo.value.trim();
    const dataEscolhida = campoData.value;
    if (!texto) return;
    if (!dataEscolhida) { alert('Escolha uma data.'); return; }
    const { data, error } = await dbAuth.rpc('fn_demanda_acompanhamento_criar', {
        p_item_id: supDemandaAtual, p_data: dataEscolhida, p_descricao: texto,
        p_alerta: true, p_chave_idempotencia: null, p_pessoa_id: null, p_canal: null,
    });
    if (error) { alert('Erro: ' + error.message); return; }
    if (!data.ok) { alert(data.mensagem || 'Não foi possível registrar.'); return; }
    await supRenderFicha();
}

// acao: 'concluir' | 'cancelar' — cancelar pede motivo (exigido pela RPC).
async function supTratarAcompanhamento(ocorrenciaId, acao) {
    let texto = null;
    if (acao === 'cancelar') {
        texto = prompt('Motivo do cancelamento:');
        if (!texto || !texto.trim()) return;
    }
    const { data, error } = await dbAuth.rpc('fn_demanda_acompanhamento_tratar', {
        p_ocorrencia_id: ocorrenciaId, p_acao: acao, p_texto: texto, p_pessoa_id: null, p_canal: null,
    });
    if (error) { alert('Erro: ' + error.message); return; }
    if (!data.ok) { alert(data.mensagem || 'Não foi possível.'); return; }
    await supRenderFicha();
}

// resultado: 'aprovar' (sem texto obrigatório) | 'reprovar' | 'cancelar'
// (os 2 últimos exigem texto — mesma regra de fn_demanda_teste_tratar).
async function supTratarTeste(testeId, resultado) {
    let texto = null;
    if (resultado !== 'aprovar') {
        texto = prompt(resultado === 'reprovar' ? 'O que não passou nesse teste?' : 'Por que este teste sai da lista?');
        if (!texto || !texto.trim()) return;
    }
    const { data, error } = await dbAuth.rpc('fn_demanda_teste_tratar', {
        p_item_id: supDemandaAtual, p_teste_id: testeId, p_resultado: resultado, p_texto: texto, p_pessoa_id: null, p_canal: null,
    });
    if (error) { alert('Erro: ' + error.message); return; }
    if (!data.ok) { alert(data.mensagem || 'Não foi possível tratar o teste.'); return; }
    await supRenderFicha();
}

async function supReagendar(ocorrenciaId) {
    const novaData = prompt('Nova data (AAAA-MM-DD):', new Date().toISOString().slice(0, 10));
    if (!novaData) return;
    const { data, error } = await dbAuth.rpc('fn_demanda_acompanhamento_reagendar', {
        p_ocorrencia_id: ocorrenciaId, p_nova_data: novaData, p_motivo: null, p_pessoa_id: null, p_canal: null,
    });
    if (error) { alert('Erro: ' + error.message); return; }
    if (!data.ok) { alert(data.mensagem || 'Não foi possível reagendar.'); return; }
    await supRenderFicha();
}

// decisao: null (1ª tentativa) | 'concluir' | 'cancelar' — o banco responde
// "decisao_necessaria" quando há acompanhamento aberto; aí perguntamos e
// chamamos de novo já com a decisão.
async function supEncerrar(decisao) {
    const { data, error } = await dbAuth.rpc('fn_demanda_encerrar', {
        p_item_id: supDemandaAtual, p_decisao_abertas: decisao || null, p_motivo: null, p_pessoa_id: null, p_canal: null,
    });
    if (error) { alert('Erro: ' + error.message); return; }
    if (data.acao === 'decisao_necessaria') {
        const concluirTodos = confirm(data.mensagem + '\n\nOK = concluir os abertos junto · Cancelar (botão) = cancelá-los junto');
        await supEncerrar(concluirTodos ? 'concluir' : 'cancelar');
        return;
    }
    // v0.3.0 (demanda 7af2de58, item 4) — antes caía no alert genérico
    // "Não foi possível encerrar" citando fn_demanda_teste_tratar (nome de
    // função, sem sentido pra quem está na tela); agora mostra a lista de
    // testes pendentes (data.dados já vem pronto do banco) e volta pra
    // ficha, onde a seção "Testes" (acima) já tem Aprovar/Reprovar/Cancelar.
    if (data.acao === 'em_testes') {
        const lista = (data.dados || []).map(t => `• ${t.teste}`).join('\n');
        alert(`Esta demanda tem teste(s) aguardando validação — trate cada um antes de encerrar:\n\n${lista}`);
        await supRenderFicha();
        return;
    }
    if (!data.ok) { alert(data.mensagem || 'Não foi possível encerrar.'); return; }
    await supRenderFicha();
}

async function supReabrir() {
    const { data, error } = await dbAuth.rpc('fn_demanda_reabrir', { p_item_id: supDemandaAtual, p_motivo: null, p_pessoa_id: null, p_canal: null });
    if (error) { alert('Erro: ' + error.message); return; }
    if (!data.ok) { alert(data.mensagem || 'Não foi possível reabrir.'); return; }
    await supRenderFicha();
}

// ----------------------------------------------------------------------------
// NOVA DEMANDA
// ----------------------------------------------------------------------------
function supAbrirNova() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <button onclick="supRenderLista()" class="text-xs font-bold mb-3" style="color:var(--sage)">← Cancelar</button>
        <div class="p-4 rounded-2xl border-2" style="border-color:var(--line);background:#fff">
            <h2 class="text-base font-extrabold mb-3" style="color:var(--ink)">Nova demanda</h2>
            <label class="block text-xs font-bold mb-1" style="color:var(--ink)">Empresa</label>
            <select id="sup-nova-empresa" class="w-full text-xs p-2 rounded-lg border-2 mb-2" style="border-color:var(--line)">
                ${supEmpresas.map(e => `<option value="${e.id}" ${e.id === supClienteId ? 'selected' : ''}>${supEsc(e.nome_empresa)}</option>`).join('')}
            </select>
            <label class="block text-xs font-bold mb-1" style="color:var(--ink)">Natureza</label>
            <select id="sup-nova-subtipo" class="w-full text-xs p-2 rounded-lg border-2 mb-2" style="border-color:var(--line)">
                <option value="produto">📦 Produto (backlog interno)</option>
                <option value="suporte">🎧 Suporte</option>
                <option value="servico">🛠️ Serviço</option>
            </select>
            <label class="block text-xs font-bold mb-1" style="color:var(--ink)">Título</label>
            <input id="sup-nova-titulo" type="text" maxlength="200" class="w-full text-xs p-2 rounded-lg border-2 mb-2" style="border-color:var(--line)">
            <label class="block text-xs font-bold mb-1" style="color:var(--ink)">Descrição</label>
            <textarea id="sup-nova-descricao" rows="3" class="w-full text-xs p-2 rounded-lg border-2 mb-3" style="border-color:var(--line)"></textarea>
            <div id="sup-nova-semelhantes"></div>
            <button onclick="supCriarDemanda(false)" class="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style="background:var(--pine)">Criar</button>
        </div>
    `;
}

// forcar: false (1ª tentativa) | true (depois de confirmar mesmo havendo
// semelhante) — o banco já faz a busca semântica de duplicata sozinho.
async function supCriarDemanda(forcar) {
    const titulo = document.getElementById('sup-nova-titulo').value.trim();
    if (titulo.length < 3) { alert('Título precisa ter pelo menos 3 caracteres.'); return; }
    const { data, error } = await dbAuth.rpc('fn_demanda_criar', {
        p_cliente_id: document.getElementById('sup-nova-empresa').value,
        p_subtipo: document.getElementById('sup-nova-subtipo').value,
        p_titulo: titulo,
        p_descricao: document.getElementById('sup-nova-descricao').value.trim() || null,
        p_chave_idempotencia: null, p_forcar: forcar, p_pessoa_id: null, p_canal: null,
    });
    if (error) { alert('Erro: ' + error.message); return; }
    if (data.acao === 'semelhantes_encontrados') {
        const box = document.getElementById('sup-nova-semelhantes');
        box.innerHTML = `<div class="p-2.5 rounded-lg mb-2 text-xs" style="background:var(--warning-bg);color:var(--warning)">
            ${supEsc(data.mensagem)}
            <ul class="mt-1 ml-3 list-disc">${data.dados.map(s => `<li>${supEsc(s.titulo)}</li>`).join('')}</ul>
        </div>
        <button onclick="supCriarDemanda(true)" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2 mb-2" style="border-color:var(--line)">Criar mesmo assim</button>`;
        return;
    }
    if (!data.ok) { alert(data.mensagem || 'Não foi possível criar.'); return; }
    supClienteId = document.getElementById('sup-nova-empresa').value;
    supDemandaAtual = data.id;
    await supRenderFicha();
}


// ============================================================================
// v0.4.0 (D1) — SUPORTE COM SLA
// ============================================================================
const SUP_SEV_ROTULO = { critica: 'Crítica', alta: 'Alta', sugestao: 'Sugestão' };
const SUP_SEV_HORAS = { critica: '4 h', alta: '24 h', sugestao: '72 h' };
let supPainelDias = 30;

function supFmtDuracao(min) {
    if (min == null) return '—';
    const m = Math.round(Number(min));
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 48) return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
    return `${Math.round(h / 24 * 10) / 10} d`.replace('.', ',');
}
function supFmtPrazo(iso, ativo, estourado) {
    if (!iso) return { txt: 'sem SLA', cor: 'var(--sage)', bg: '#eef0f1' };
    if (!ativo) return { txt: 'encerrado', cor: 'var(--sage)', bg: '#eef0f1' };
    const diffMin = (new Date(iso) - Date.now()) / 60000;
    if (estourado || diffMin < 0) return { txt: `estourou há ${supFmtDuracao(-diffMin)}`, cor: '#fff', bg: 'var(--danger)' };
    if (diffMin < 240) return { txt: `faltam ${supFmtDuracao(diffMin)}`, cor: 'var(--warning)', bg: 'var(--warning-bg)' };
    return { txt: `faltam ${supFmtDuracao(diffMin)}`, cor: 'var(--success)', bg: 'var(--success-bg)' };
}
function supChipPeriodo(d) {
    return `<button onclick="supPainelDias=${d};supRenderPainelSuporte()" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2"
        style="border-color:${supPainelDias === d ? 'var(--brass)' : 'var(--line)'};background:#fff;color:var(--ink)">${d} dias</button>`;
}

async function supRenderPainelSuporte() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando suporte…</p>`;
    const de = new Date(Date.now() - supPainelDias * 864e5).toISOString().slice(0, 10);
    const { data: p, error } = await dbAuth.rpc('fn_suporte_painel', { p_de: de, p_ate: null, p_cliente_id: null });
    if (error) { gestaoErro(error.message); return; }
    const k = p.kpis || {}, meta = p.meta_pct || 90;
    const chipSub = (v, label) => `<button onclick="supAlternarSubtipo('${v}')" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2"
        style="border-color:${supSubtipos.includes(v) ? 'var(--brass)' : 'var(--line)'};background:#fff;color:var(--ink)">${label}</button>`;
    const sem = p.semanas || [];
    const maxSem = Math.max(1, ...sem.map(w => w.abertos || 0));
    const barras = (lista, campo, rotulo) => {
        const max = Math.max(1, ...lista.map(x => x.n || 0));
        return lista.length ? lista.map(x => gestaoBarra(rotulo(x[campo]), x.n, max)).join('') : `<p class="text-[11px]" style="color:var(--sage)">Sem chamados no período.</p>`;
    };
    const rotOrigem = { motor: 'Leitura fraca (motor, automático)', documento: 'Reprocessar documento (cliente pediu)', demais: 'Demais chamados' };
    const linhas = (p.tickets || []).map(t => {
        const pr = supFmtPrazo(t.sla_resolucao_ate, t.ativo, t.estourado);
        const resp = t.primeira_resposta_em ? supFmtDuracao((new Date(t.primeira_resposta_em) - new Date(t.criado_em)) / 60000) : (t.ativo ? 'aguardando' : '—');
        return `<tr onclick="supAbrirFicha('${t.id}')" style="cursor:pointer;${t.estourado ? 'box-shadow:inset 3px 0 0 var(--danger)' : ''}">
            <td class="p-2 align-top"><b class="block">${new Date(t.criado_em).toLocaleDateString('pt-BR')}</b><span style="color:var(--sage)">${new Date(t.criado_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></td>
            <td class="p-2 align-top font-bold">${supEsc(t.empresa)}</td>
            <td class="p-2 align-top">${supEsc(t.titulo)}${t.extracao_id ? ` <span class="text-[10px] font-bold px-1.5 rounded" style="background:var(--brass-bg, #fbeee6);color:var(--brass-deep)">${t.origem === 'automacao' ? 'motor' : 'documento'}</span>` : ''}</td>
            <td class="p-2 align-top">${t.severidade ? SUP_SEV_ROTULO[t.severidade] + ' · ' + SUP_SEV_HORAS[t.severidade] : '<span style="color:var(--sage)">sem severidade</span>'}</td>
            <td class="p-2 align-top"><span class="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style="background:${pr.bg};color:${pr.cor}">${pr.txt}</span></td>
            <td class="p-2 align-top whitespace-nowrap">${resp}</td>
            <td class="p-2 align-top">${supEsc(t.responsavel || '—')}</td>
            <td class="p-2 align-top">${t.ativo ? 'Aberto' : (t.no_sla ? 'Resolvido · no SLA' : 'Resolvido')}</td>
        </tr>`;
    }).join('');

    area.innerHTML = `
        <div class="mb-4">
            <h1 class="text-lg font-extrabold flex items-center" style="color:var(--ink)">Suporte & Backlog
                ${gestaoInfoIcone('Visão de suporte: chamados de todas as empresas, com SLA por severidade (crítica 4 h, alta 24 h, sugestão 72 h — decisão de 11/09/2026). Fonte: fn_suporte_painel.')}</h1>
            <p class="text-xs mt-0.5" style="color:var(--sage)">Chamados de suporte de todas as empresas, com SLA, tempos e responsável.</p>
        </div>
        <div class="flex flex-wrap gap-1.5 mb-2">${chipSub('produto', '📦 Produto')}${chipSub('suporte', '🎧 Suporte')}${chipSub('servico', '🛠️ Serviço')}</div>
        <div class="flex flex-wrap gap-1.5 mb-3">${supChipPeriodo(7)}${supChipPeriodo(30)}${supChipPeriodo(90)}</div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 mb-3">
            ${gestaoCardMetrica('Abertos', k.abertos ?? 0, 'ink', 'Chamados de suporte ainda abertos, de todas as empresas.')}
            ${gestaoCardMetrica('SLA estourado', k.estourados ?? 0, k.estourados ? 'red' : 'ink', 'Abertos com o prazo da severidade já vencido. Tratar primeiro.')}
            ${gestaoCardMetrica('Sem 1ª resposta', k.sem_resposta ?? 0, k.sem_resposta ? 'amber' : 'ink')}
            ${gestaoCardMetrica('1ª resposta · média', supFmtDuracao(k.resposta_media_min), 'ink', 'Da abertura à primeira resposta da equipe Raiz, nos chamados abertos no período. Medida, sem meta própria.')}
            ${gestaoCardMetrica('Resolução · média', supFmtDuracao(k.resolucao_media_min), 'ink', 'Da abertura ao encerramento, nos chamados resolvidos no período.')}
            ${gestaoCardMetrica('Dentro do SLA', k.no_sla_pct == null ? '—' : k.no_sla_pct + '%', k.no_sla_pct == null ? 'ink' : (k.no_sla_pct >= meta ? 'green' : 'amber'), `Resolvidos dentro do prazo da severidade ÷ resolvidos com SLA, no período. Meta ${meta}%.`)}
        </div>
        <p class="text-[11px] mb-3" style="color:var(--sage)">${k.no_periodo ?? 0} chamado(s) aberto(s) e ${k.resolvidos_periodo ?? 0} resolvido(s) nos últimos ${supPainelDias} dias · meta ${meta}% dentro do SLA.</p>

        <div class="rounded-xl border-2 mb-3 overflow-x-auto" style="border-color:var(--line);background:#fff">
            <table class="w-full text-xs" style="min-width:820px">
                <thead><tr style="color:var(--sage);text-align:left">
                    <th class="p-2">Aberto</th><th class="p-2">Empresa</th><th class="p-2">Chamado</th><th class="p-2">Severidade</th>
                    <th class="p-2">SLA</th><th class="p-2">1ª resposta</th><th class="p-2">Responsável</th><th class="p-2">Situação</th></tr></thead>
                <tbody>${linhas || `<tr><td colspan="8" class="p-4 text-center" style="color:var(--sage)">Nenhum chamado no período.</td></tr>`}</tbody>
            </table>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div class="p-3 rounded-xl border-2" style="border-color:var(--line);background:#fff">
                <p class="text-xs font-bold mb-2">Chamados por semana e % no SLA</p>
                <div class="flex items-end gap-3" style="height:120px">${sem.map(w => `
                    <div class="flex-1 flex flex-col items-center justify-end h-full gap-1">
                        <span class="text-[11px] font-bold" style="color:${w.no_sla_pct == null ? 'var(--sage)' : (w.no_sla_pct >= meta ? 'var(--success)' : 'var(--danger)')}">${w.no_sla_pct == null ? '—' : w.no_sla_pct + '%'}</span>
                        <div style="width:60%;max-width:34px;height:${Math.max(4, (w.abertos / maxSem) * 80)}px;background:var(--pine-light);border-radius:4px 4px 0 0"></div>
                        <span class="text-[11px]" style="color:var(--sage)">${w.abertos} · ${w.semana.slice(8, 10)}/${w.semana.slice(5, 7)}</span>
                    </div>`).join('') || `<p class="text-[11px]" style="color:var(--sage)">Sem chamados nas últimas 8 semanas.</p>`}</div>
                <p class="text-[11px] mt-2" style="color:var(--sage)">Barra = chamados abertos na semana (início na segunda) · número = % resolvido dentro do SLA.</p>
            </div>
            <div class="p-3 rounded-xl border-2" style="border-color:var(--line);background:#fff">
                <p class="text-xs font-bold mb-2">Por origem</p>${barras(p.por_origem || [], 'origem', v => rotOrigem[v] || v)}
                <p class="text-xs font-bold mb-2 mt-3">Por empresa</p>${barras(p.por_empresa || [], 'empresa', v => supEsc(v))}
                <p class="text-xs font-bold mb-2 mt-3">Por severidade</p>${barras(p.por_severidade || [], 'severidade', v => SUP_SEV_ROTULO[v] || 'Sem severidade (anterior à política)')}
            </div>
        </div>

        <div class="p-3 rounded-xl border-2" style="border-color:var(--line);background:#fff">
            <p class="text-xs font-bold mb-2">Política de SLA</p>
            <table class="w-full text-xs"><tbody>
                <tr><td class="p-1.5 font-bold">Crítica</td><td class="p-1.5">4 h</td><td class="p-1.5" style="color:var(--sage)">Erro que impede o cliente de usar o sistema</td></tr>
                <tr><td class="p-1.5 font-bold">Alta</td><td class="p-1.5">24 h</td><td class="p-1.5" style="color:var(--sage)">Erro com contorno · reprocessar documento (padrão do motor e de chamado novo)</td></tr>
                <tr><td class="p-1.5 font-bold">Sugestão</td><td class="p-1.5">72 h</td><td class="p-1.5" style="color:var(--sage)">Dúvida, sugestão, pesquisa</td></tr>
            </tbody></table>
            <p class="text-[11px] mt-2" style="color:var(--sage)">Igual para todos os planos. O prazo fica congelado na abertura e só muda se a severidade mudar. Chamados abertos antes da política ficam sem SLA.</p>
        </div>`;
}

// Bloco SLA da ficha de um chamado de suporte (carrega depois da ficha)
async function supCarregarBlocoSla(d) {
    const el = document.getElementById('sup-sla-bloco');
    if (!el) return;
    const [{ data: it }, { data: oc }] = await Promise.all([
        dbAuth.from('cofre_itens_controle').select('severidade, sla_resolucao_ate, criado_em, ativo').eq('id', d.id).maybeSingle(),
        dbAuth.from('cofre_ocorrencias_controle').select('origem_id, documento_id').eq('item_controle_id', d.id).eq('origem', 'cofre_extracao').limit(1),
    ]);
    if (!it) { el.innerHTML = ''; return; }
    const pr = supFmtPrazo(it.sla_resolucao_ate, it.ativo, false);
    const veioDoMotor = (oc || []).length > 0;
    const extracaoId = veioDoMotor ? oc[0].origem_id : null;
    const opSev = ['critica', 'alta', 'sugestao'].map(v => `<option value="${v}" ${it.severidade === v ? 'selected' : ''}>${SUP_SEV_ROTULO[v]} · ${SUP_SEV_HORAS[v]}</option>`).join('');
    el.innerHTML = `
        <div class="p-3 rounded-xl border-2 mb-3" style="border-color:${pr.bg === 'var(--danger)' ? 'var(--danger)' : 'var(--line)'};background:#fff">
            <div class="flex flex-wrap items-center gap-2 mb-2">
                <p class="text-xs font-bold flex-1" style="color:var(--ink)">SLA do chamado</p>
                <span class="text-[11px] font-bold px-2 py-0.5 rounded-full" style="background:${pr.bg};color:${pr.cor}">${pr.txt}</span>
            </div>
            <p class="text-[11px] mb-2" style="color:var(--sage)">${it.sla_resolucao_ate ? 'Prazo: ' + new Date(it.sla_resolucao_ate).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Chamado anterior à política de SLA.'}</p>
            ${it.ativo ? `
            <div class="flex flex-wrap gap-1.5 mb-2">
                <select id="sup-sev" class="text-xs p-2 rounded-lg border-2" style="border-color:var(--line)">${it.severidade ? '' : '<option value="">Sem severidade</option>'}${opSev}</select>
                <button onclick="supMudarSeveridade()" class="text-xs font-bold px-3 rounded-lg border-2" style="border-color:var(--line)">Mudar severidade</button>
            </div>
            <textarea id="sup-resposta" rows="2" placeholder="Resposta da equipe Raiz (fica no registro do chamado)…" class="w-full text-xs p-2 rounded-lg border-2 mb-1.5" style="border-color:var(--line)"></textarea>
            <button onclick="supResponder()" class="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style="background:var(--pine)">Responder</button>
            <p id="sup-sla-msg" class="text-[11px] mt-1.5" style="color:var(--sage)"></p>` : ''}
        </div>
        ${veioDoMotor ? `<div id="sup-doc-bloco" class="p-3 rounded-xl border-2 mb-3" style="border-color:var(--brass);background:#fff"><p class="text-xs" style="color:var(--sage)">Carregando o documento…</p></div>` : ''}`;
    if (veioDoMotor) supCarregarDocumento(extracaoId);
}

// Documento do chamado de leitura fraca: a equipe vê e resolve sem devolver nada ao cliente.
async function supCarregarDocumento(extracaoId) {
    const el = document.getElementById('sup-doc-bloco');
    if (!el) return;
    const { data, error } = await dbAuth.rpc('fn_gestao_leitura_detalhe', { p_extracao_id: extracaoId });
    if (error || !data) { el.innerHTML = `<p class="text-xs" style="color:var(--danger)">Não consegui abrir a leitura: ${supEscDoc(error?.message || 'não encontrada')}</p>`; return; }
    const l = data.leitura || {}, d = data.documento, emp = data.empresa || {};
    const canal = { app: 'App', bot: 'WhatsApp', whatsapp: 'WhatsApp', gestao: 'Gestão' }[l.canal] || l.canal || '';
    const pct = l.confianca == null ? '' : ' · ' + Math.round(Number(l.confianca) * 100) + '%';
    const quando = l.criado_em ? new Date(l.criado_em).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '';
    el.innerHTML = `
        <p class="text-xs font-bold mb-2" style="color:var(--ink)">Documento do chamado</p>
        <table class="w-full text-[11px] mb-2"><tbody>
            <tr><td class="py-0.5 pr-2" style="color:var(--sage)">Empresa</td><td class="py-0.5 font-bold">${supEscDoc(emp.nome || '—')}</td></tr>
            <tr><td class="py-0.5 pr-2" style="color:var(--sage)">Arquivo</td><td class="py-0.5" style="word-break:break-all">${supEscDoc(d?.nome || 'sem documento no Cofre')}</td></tr>
            <tr><td class="py-0.5 pr-2" style="color:var(--sage)">A IA leu</td><td class="py-0.5">${supEscDoc(l.tipo_nome || l.subtipo_codigo || 'Sem tipo')}${pct} · ${supEscDoc(canal)} · ${supEscDoc(quando)}</td></tr>
            ${l.dados?.resumo ? `<tr><td class="py-0.5 pr-2" style="color:var(--sage)">Resumo</td><td class="py-0.5">${supEscDoc(l.dados.resumo)}</td></tr>` : ''}
        </tbody></table>
        <div class="flex flex-wrap gap-1.5">
            <button onclick="supAbrirMotor('${extracaoId}')" class="text-xs font-bold px-3 py-1.5 rounded-lg text-white" style="background:var(--pine)">Resolver no Motor</button>
            ${d?.tem_arquivo && d.status !== 'excluido' && typeof pdVerArquivo === 'function' ? `<button onclick="pdVerArquivo('${d.id}', this)" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2" style="border-color:var(--brass);color:var(--brass-deep)">Ver arquivo</button>` : ''}
        </div>
        <p class="text-[11px] mt-1.5" style="color:var(--sage)">Resolver aplica tipo, nome, ativo e vencimento no documento e conclui este chamado. Nada é enviado ao cliente; se precisar falar com ele, o contato está na leitura.</p>`;
}
function supEscDoc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
async function supMudarSeveridade() {
    const v = document.getElementById('sup-sev').value, msg = document.getElementById('sup-sla-msg');
    if (!v) { msg.textContent = 'Escolha uma severidade.'; return; }
    const { data, error } = await dbAuth.rpc('fn_demanda_atualizar', { p_item_id: supDemandaAtual, p_severidade: v });
    if (error || !data?.ok) { msg.textContent = error?.message || data?.mensagem || 'Não foi possível mudar.'; msg.style.color = 'var(--danger)'; return; }
    await supRenderFicha();
}
async function supResponder() {
    const t = document.getElementById('sup-resposta').value.trim(), msg = document.getElementById('sup-sla-msg');
    if (t.length < 3) { msg.textContent = 'Escreva a resposta.'; return; }
    const { data, error } = await dbAuth.rpc('fn_demanda_responder', { p_item_id: supDemandaAtual, p_texto: t });
    if (error || !data?.ok) { msg.textContent = error?.message || data?.mensagem || 'Não foi possível registrar.'; msg.style.color = 'var(--danger)'; return; }
    await supRenderFicha();
}
function supAbrirMotor(extracaoId) {
    // as variáveis da tela do Motor são globais (script clássico); a tela lê pdAba ao montar
    try { if (typeof pdAba !== 'undefined') pdAba = 'leituras'; if (typeof pdLeituraAberta !== 'undefined') pdLeituraAberta = extracaoId || null; } catch (e) { /* tela ainda não carregada */ }
    gestaoAbrirTela('parametros');
    setTimeout(() => { if (typeof pmAbrirHub === 'function') pmAbrirHub('documental'); }, 150);
}
