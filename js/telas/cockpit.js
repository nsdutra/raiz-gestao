// ============================================================================
// js/telas/cockpit.js — Raiz Gestão
// Versão: 1.3.0 · 18/09/2026 (rodada 10)
//
// v1.3.0 — Nicola: "para os indicadores globais, crie 4 seletores: total,
// 1 dia, 7 dias, 30 dias. estes seletores, alteram automaticamnete o valor
// destes indicadores globais". Toggle igual ao já usado na Fila (Urgência/
// Área), acima da seção "Métricas globais" (as 5 cartas: Storage, IA,
// Acessos, WhatsApp, Landing — "Demandas abertas" fica de fora, é o card
// de grade "Suporte & Backlog", que continua backlog ATUAL, sem período).
// Troca de período NÃO recarrega o Cockpit inteiro — só refaz a 1 RPC
// (gestao.fn_cockpit_metricas_globais, que ganhou p_dias) e re-renderiza
// essas 5 cartas (cockpitCarregarMetricasGlobais/cockpitMudarPeriodoMetricas,
// novas). Interpretação pras métricas de ESTADO (storage) no modo período:
// viram "adicionado na janela" em vez de "total armazenado hoje" — ver
// changelog da migration da função no banco pra decisão completa.
//
// v1.2.0 — pedido do Nicola, tudo numa mensagem só:
//   "na tela de cockpit e da empresa, sinalize que tem empresas em algum
//   limite de uso de licenca" → NOVO card de grade "Uso de licença" + itens
//   na Fila de atenção (crítico = já atingiu, atenção = perto/avisar) —
//   fonte: gestao.fn_empresas_em_limite() (nova, varre TODAS as empresas
//   reaproveitando fn_funcionalidades_liberadas, mesma função que já
//   alimenta a ficha individual). "inclua tb a qtde de storage total do
//   banco (megas e arquivos), inclua o valor de IA total e volume de
//   acessos, o msm para msg de whatsapp. inclua tb a qtde de demandas
//   abertas do backlog. e tb a qtde de acessos da landing" → NOVA seção
//   "Métricas globais" (cards informativos, sem clique) abaixo da grade de
//   áreas, fonte: gestao.fn_cockpit_metricas_globais() (nova, 1 RPC só,
//   todos os totais cross-tenant sem filtro de período). Decisões de
//   interpretação (não há valor monetário de IA armazenado em lugar
//   nenhum — uso eventos+tokens reais; "acessos" = log_acessos total;
//   "whatsapp" = ia_eventos_log canal='whatsapp'; "demandas abertas" =
//   cofre_itens_controle tipo='sistema' ativo=true; "acessos da landing" =
//   comercial.eventos_landing evento='page_view') documentadas na migration
//   da função — nenhuma é estimativa, todas batem com contagem direta
//   conferida antes de subir.
//   De quebra, o card "Suporte & Backlog" (até aqui 'vazio' — a fonte do
//   backlog estava em aberto, ver nota da v1.0.0 abaixo) ganhou métrica
//   real: demandas_abertas, a mesma fonte que a Gestão já usa pra abrir/
//   encerrar demanda (fn_demanda_criar/fn_demanda_encerrar).
//
// v1.1.0 — achado real do Nicola, tela Cockpit: "o contador de
// aplicabilidade não está desconsiderando quando subtipo se aplica a
// empresa. Precisa ajustar o alerta" — o card "Catálogo — Aplicabilidade"
// (Fila de atenção + grade) contava TODO subtipo global sem vínculo em
// cofre_subtipo_aplicabilidade, mesmo os cujo titular não inclui "ativo"
// (ex.: "Contrato social", "Documento da empresa" — só empresa).
// Aplicabilidade é inteiramente sobre o eixo ativo; esses subtipos nunca
// vão, nem devem, ter vínculo ali — não é pendência de cadastro. Mesmo
// ajuste já feito em catalogo-patrimonio.js v1.4.0
// (cpRelevantePraAplicabilidade) — só não tinha sido replicado aqui, onde
// o Cockpit faz a própria contagem direto (o comentário original deste
// arquivo já dizia "mesma conta que catalogo-patrimonio.js já faz", mas
// isso ficou desatualizado quando aquele arquivo ganhou o filtro e este
// não). select() do subtipos passou a trazer titular_escopo; contagem
// (Fila + card da grade) filtrada por subtiposRelevantesAplicabilidade
// antes de comparar com os vínculos.
//
// v1.0.0 — COCKPIT REAL, leiaute aprovado pelo Nicola no protótipo HTML
// (cockpit-prototipo.html, rodada 2b — "Painel unificado de sinais"): Fila
// de atenção (sinais priorizados por severidade, com toggle Urgência/Área)
// + grade de cards por área, clicável (abre a tela de origem do sinal).
//
// Fontes por área — todas REAIS, nenhum número inventado (REGRAS §5):
//   Empresas & licenças  → fn_cockpit_atencao() + fn_lista_empresas() (já
//                           existiam desde v0.6.0).
//   Financeiro            → fn_financeiro_resumo() (já existia) + itens
//                           'inadimplencia' de fn_cockpit_atencao().
//   Saúde do cliente      → NOVO nesta rodada: itens 'feedback_baixo' de
//                           fn_cockpit_atencao() já existiam na função mas
//                           nunca tinham virado card/sinal aqui — o
//                           protótipo listava esta área como "sem
//                           indicador"; achei que já tinha fonte real ao
//                           reler fn_cockpit_atencao() com calma.
//   Catálogo —
//     Aplicabilidade       → NOVO: contagem direta cofre_controle_subtipos
//                           (globais, tipo≠'sistema') vs.
//                           cofre_subtipo_aplicabilidade — mesma conta que
//                           catalogo-patrimonio.js já faz na aba Subtipos.
//     Tipos & campos       → NOVO: contagem de ativo_tipos_campos ativos —
//                           informativo (chip info), não é alerta (sem
//                           "número perigoso" conhecido pra campo).
//   Conciliação            → NOVO: fn_gestao_conciliacao_visao() (existia,
//                           nenhuma tela chamava até a conciliacao-
//                           catalogo.js desta Onda 2), somando quantidade
//                           onde regra_codigo = '—' (sem regra). Sem
//                           filtro de data = histórico completo; rotulado
//                           assim na tela pra não sugerir "no mês".
//   Calendário & partes    → NOVO: contagem de cofre_partes_padrao —
//                           informativo.
//
// Ficam "sem indicador ainda" (igual o protótipo já sinalizava, com a
// pergunta em aberto pro Nicola registrada lá — não decidi isso agora):
// Motor Documental (métrica de pendência ainda não definida), Suporte &
// Backlog (não está claro se o backlog vale por cofre_itens_controle ou
// outra fonte — há inclusive 2 arquivos telaSuporteInit no repo,
// suporte.js e suporte-backlog.js, achado que registrei à parte, fora do
// escopo desta entrega) e Comercial (substituto do card "Oferta &
// campanhas" removido do PM_HUB — RPC ainda não confirmada). Os 3 cards
// continuam clicáveis (abrem a tela de origem), só a MÉTRICA fica vazia.
// ============================================================================

const COCKPIT_ICONE_TIPO = {
    licenca_vencendo: '⏳', licenca_vencida: '⛔', baixo_acesso: '📉',
    inadimplencia: '💸', feedback_baixo: '⚠️'
};

const COCKPIT_SEV_ORDEM = { critico: 0, atencao: 1, info: 2 };
const COCKPIT_SEV_COR = { critico: 'var(--danger)', atencao: 'var(--warning)', info: 'var(--info)' };
const COCKPIT_SEV_PONTO = { critico: 'var(--danger)', atencao: 'var(--warning)', info: 'var(--info)' };
const COCKPIT_CHIP_ESTILO = {
    ok: 'background:var(--success-bg);color:var(--success)',
    atencao: 'background:var(--warning-bg);color:var(--warning)',
    critico: 'background:var(--danger-bg);color:var(--danger)',
    info: 'background:var(--info-bg);color:var(--info)',
    vazio: 'background:#f1f5f9;color:var(--sage)',
};
const COCKPIT_CHIP_ROTULO = { ok: 'Sem pendência', atencao: 'Atenção', critico: 'Crítico', info: 'Informativo', vazio: 'Sem indicador' };

let cockpitFila = [];
let cockpitGrid = [];
let cockpitOrdemFila = 'severidade';

async function telaCockpitInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando…</p>`;

    const [
        { data: atencao, error: e1 },
        { data: fin, error: e2 },
        { data: empresas, error: e3 },
        { data: subtiposGlobais, error: e4 },
        { data: aplicVinculos, error: e5 },
        { data: camposAtivos, error: e6 },
        { data: partesPadrao, error: e7 },
        { data: conciliacao, error: e8 },
        { data: empresasLimite, error: e9 },
        { data: metricasGlobaisLinhas, error: e10 },
    ] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_cockpit_atencao'),
        dbAuth.schema('gestao').rpc('fn_financeiro_resumo'),
        dbAuth.schema('gestao').rpc('fn_lista_empresas'),
        dbAuth.from('cofre_controle_subtipos').select('id, titular_escopo').is('cliente_id', null).neq('tipo', 'sistema'),
        dbAuth.from('cofre_subtipo_aplicabilidade').select('subtipo_id'),
        dbAuth.from('ativo_tipos_campos').select('id').eq('ativo', true),
        dbAuth.from('cofre_partes_padrao').select('id'),
        dbAuth.rpc('fn_gestao_conciliacao_visao'),
        dbAuth.schema('gestao').rpc('fn_empresas_em_limite'), // v1.2.0
        dbAuth.schema('gestao').rpc('fn_cockpit_metricas_globais', { p_dias: null }), // v1.2.0 · p_dias desde v1.3.0 (Total no load inicial)
    ]);

    const erros = [e1, e2, e3, e4, e5, e6, e7, e8, e9, e10].filter(Boolean);
    if (erros.length) { gestaoErro(erros.map(e => e.message).join(' | ')); return; }

    // ---- Empresas & licenças ------------------------------------------------
    const finResumo = (fin && fin[0]) || { recebido_mes_atual: 0, a_receber_futuro: 0, inadimplente: 0 };
    const totalEmpresas = (empresas || []).length;
    const empresasAtivas = (empresas || []).filter(e => e.licenca_status === 'ativo').length;
    const porTipo = t => (atencao || []).filter(a => a.tipo === t);
    const nVencidas = porTipo('licenca_vencida').length;
    const nVencendo = porTipo('licenca_vencendo').length;
    const nBaixoAcesso = porTipo('baixo_acesso').length;
    const nInadimplencia = porTipo('inadimplencia').length;
    const nFeedbackBaixo = porTipo('feedback_baixo').length;

    // ---- Catálogo — Aplicabilidade ------------------------------------------
    // FIX 18/09/2026 (achado real, Nicola: "o contador de aplicabilidade não
    // está desconsiderando quando subtipo se aplica a empresa") — mesmo
    // ajuste já feito em catalogo-patrimonio.js v1.4.0
    // (cpRelevantePraAplicabilidade), replicado aqui porque o Cockpit faz a
    // própria conta direto (comentário do topo do arquivo já avisava "mesma
    // conta que catalogo-patrimonio.js já faz" — só não tinha sido
    // atualizado junto). Aplicabilidade é inteiramente sobre o eixo ATIVO —
    // um subtipo cujo titular não inclui "ativo" (ex.: "Contrato social",
    // só empresa) nunca vai, nem deve, ter vínculo ali; não é pendência de
    // cadastro. Subtipo sem titular_escopo definido ainda conta (pra não
    // esconder um cadastro incompleto de verdade).
    const subtiposRelevantesAplicabilidade = (subtiposGlobais || []).filter(s => !s.titular_escopo?.length || s.titular_escopo.includes('ativo'));
    const idsComVinculo = new Set((aplicVinculos || []).map(a => a.subtipo_id));
    const totalSubtipos = subtiposRelevantesAplicabilidade.length;
    const semAplicabilidade = subtiposRelevantesAplicabilidade.filter(s => !idsComVinculo.has(s.id)).length;

    // ---- Catálogo — Tipos & campos -------------------------------------------
    const totalCampos = (camposAtivos || []).length;

    // ---- Calendário & partes --------------------------------------------------
    const totalPartes = (partesPadrao || []).length;

    // ---- Conciliação (histórico completo — sem filtro de data) --------------
    const linhasConc = conciliacao || [];
    const totalLancamentos = linhasConc.reduce((s, r) => s + (r.quantidade || 0), 0);
    const semRegra = linhasConc.filter(r => r.regra_codigo === '—').reduce((s, r) => s + (r.quantidade || 0), 0);

    // ---- Empresas & licenças — limite de uso (NOVO v1.2.0) ------------------
    // fn_empresas_em_limite() já só traz linha com avisar=true (perto ou no
    // limite); agrupo por empresa pra não repetir a mesma empresa em 2
    // cotas diferentes na Fila.
    const porEmpresaLimite = {};
    (empresasLimite || []).forEach(r => {
        const e = porEmpresaLimite[r.cliente_id] || (porEmpresaLimite[r.cliente_id] = { nome: r.nome_empresa, atingiu: false, avisou: false });
        if (r.situacao === 'limite_atingido') e.atingiu = true; else e.avisou = true;
    });
    const empresasNoLimite = Object.values(porEmpresaLimite).filter(e => e.atingiu);
    const empresasPertoLimite = Object.values(porEmpresaLimite).filter(e => !e.atingiu && e.avisou);

    // ---- Métricas globais (NOVO v1.2.0) — 1 RPC só, cross-tenant, sem filtro
    const mg = (metricasGlobaisLinhas && metricasGlobaisLinhas[0]) || {
        storage_mb: 0, storage_arquivos: 0, ia_eventos: 0, ia_tokens: 0,
        acessos_total: 0, whatsapp_mensagens: 0, demandas_abertas: 0, landing_acessos: 0,
    };

    // ============================================================ FILA
    cockpitFila = [];
    if (nVencidas) cockpitFila.push({ sev: 'critico', area: 'Empresas & licenças', title: `${nVencidas} licença(s) vencida(s), ainda ativa(s)`, detail: 'Inconsistência a resolver — a licença venceu mas o status continua "ativo".', num: String(nVencidas), abrir: () => gestaoAbrirTela('empresas') });
    if (nVencendo) cockpitFila.push({ sev: 'atencao', area: 'Empresas & licenças', title: `${nVencendo} licença(s) vencendo nos próximos 7 dias`, detail: 'Vale contato do comercial antes do vencimento virar bloqueio.', num: String(nVencendo), abrir: () => gestaoAbrirTela('empresas') });
    if (nBaixoAcesso) cockpitFila.push({ sev: 'atencao', area: 'Empresas & licenças', title: `${nBaixoAcesso} empresa(s) sem acesso há 14+ dias`, detail: 'Adoção em risco — nunca acessou ou parou de acessar.', num: String(nBaixoAcesso), abrir: () => gestaoAbrirTela('empresas') });
    if (empresasNoLimite.length) cockpitFila.push({ sev: 'critico', area: 'Empresas & licenças', title: `${empresasNoLimite.length} empresa(s) no limite de uso de alguma licença`, detail: empresasNoLimite.map(e => e.nome).join(', '), num: String(empresasNoLimite.length), abrir: () => gestaoAbrirTela('empresas') });
    if (empresasPertoLimite.length) cockpitFila.push({ sev: 'atencao', area: 'Empresas & licenças', title: `${empresasPertoLimite.length} empresa(s) perto do limite de alguma licença`, detail: empresasPertoLimite.map(e => e.nome).join(', '), num: String(empresasPertoLimite.length), abrir: () => gestaoAbrirTela('empresas') });
    if (nInadimplencia) cockpitFila.push({ sev: 'critico', area: 'Financeiro', title: `${nInadimplencia} parcela(s) vencida(s) e pendente(s)`, detail: 'Inadimplência real (parcela já vencida), não estimada.', num: String(nInadimplencia), abrir: () => gestaoAbrirTela('financeiro') });
    if (finResumo.recebido_mes_atual === 0 && finResumo.a_receber_futuro === 0 && finResumo.inadimplente === 0) cockpitFila.push({ sev: 'info', area: 'Financeiro', title: 'Sem movimento financeiro no mês corrente', detail: 'Recebido, a receber e inadimplente todos em R$ 0,00 — vale confirmar se é ausência real ou lacuna de integração.', num: 'R$0', abrir: () => gestaoAbrirTela('financeiro') });
    if (nFeedbackBaixo) cockpitFila.push({ sev: 'critico', area: 'Saúde do cliente', title: `${nFeedbackBaixo} feedback(s) com nota baixa nos últimos 30 dias`, detail: 'Nota ≤ 2 — risco de churn.', num: String(nFeedbackBaixo), abrir: () => gestaoAbrirTela('saude') });
    if (semRegra) cockpitFila.push({ sev: 'critico', area: 'Conciliação', title: `${semRegra} lançamento(s) sem regra (histórico completo)`, detail: `${totalLancamentos ? Math.round((semRegra / totalLancamentos) * 100) : 0}% do volume total caiu sem fingerprint de nenhuma regra ativa.`, num: String(semRegra), abrir: () => cockpitAbrirHub('conciliacao') });
    if (semAplicabilidade) cockpitFila.push({ sev: 'atencao', area: 'Catálogo — Aplicabilidade', title: `${semAplicabilidade} subtipo(s) sem nenhuma aplicabilidade cadastrada`, detail: 'Ficam invisíveis pro cliente até alguém vincular a uma categoria macro.', num: String(semAplicabilidade), abrir: () => cockpitAbrirCatalogo('aplicabilidade') });

    // ============================================================ GRID (10 áreas)
    cockpitGrid = [
        {
            area: 'Empresas & licenças', chip: (nVencidas ? 'critico' : nVencendo || nBaixoAcesso ? 'atencao' : 'ok'),
            metric: `${empresasAtivas}`, unit: `/ ${totalEmpresas} ativas`,
            detail: (nVencidas || nVencendo) ? `${nVencidas + nVencendo} fora de vigência ou vencendo.` : 'Todas em dia.',
            abrir: () => gestaoAbrirTela('empresas'),
        },
        {
            area: 'Financeiro', chip: (nInadimplencia ? 'critico' : (finResumo.recebido_mes_atual === 0 && finResumo.a_receber_futuro === 0 && finResumo.inadimplente === 0) ? 'info' : 'ok'),
            metric: gestaoFormatarMoedaBR(finResumo.recebido_mes_atual), unit: 'recebido no mês',
            detail: `A receber ${gestaoFormatarMoedaBR(finResumo.a_receber_futuro)} · inadimplente ${gestaoFormatarMoedaBR(finResumo.inadimplente)}.`,
            abrir: () => gestaoAbrirTela('financeiro'),
        },
        {
            area: 'Catálogo — Aplicabilidade', chip: semAplicabilidade ? 'atencao' : 'ok',
            metric: String(semAplicabilidade), unit: 'sem vínculo',
            detail: `De ${totalSubtipos} subtipo(s) global(is) com titular ativo cadastrado(s).`,
            abrir: () => cockpitAbrirCatalogo('aplicabilidade'),
        },
        {
            area: 'Catálogo — Tipos & campos', chip: 'info',
            metric: String(totalCampos), unit: 'campo(s) cadastrado(s)',
            detail: 'Contagem informativa — sem alerta conhecido para este número.',
            abrir: () => cockpitAbrirCatalogo('campos-tipo'),
        },
        {
            area: 'Conciliação', chip: semRegra ? 'critico' : 'ok',
            metric: String(semRegra), unit: 'sem regra',
            detail: `De ${totalLancamentos} lançamento(s) no histórico completo (sem filtro de período).`,
            abrir: () => cockpitAbrirHub('conciliacao'),
        },
        {
            area: 'Motor Documental', chip: 'vazio',
            metric: '—', unit: '',
            detail: 'Sem RPC de resumo/pendência ligada a este painel ainda.',
            abrir: () => cockpitAbrirHub('documental'),
        },
        {
            area: 'Suporte & Backlog', chip: 'info',
            metric: String(mg.demandas_abertas), unit: 'demanda(s) aberta(s)',
            detail: 'cofre_itens_controle (tipo=sistema, ativo=true), todas as empresas — resolve a lacuna que este card tinha desde a v1.0.0.',
            abrir: () => gestaoAbrirTela('suporte'),
        },
        {
            area: 'Uso de licença', chip: empresasNoLimite.length ? 'critico' : empresasPertoLimite.length ? 'atencao' : 'ok',
            metric: String(empresasNoLimite.length + empresasPertoLimite.length), unit: 'empresa(s) em algum limite',
            detail: (empresasNoLimite.length || empresasPertoLimite.length) ? `${empresasNoLimite.length} no limite, ${empresasPertoLimite.length} perto de alguma cota do plano.` : 'Nenhuma empresa perto do teto de nenhuma cota do plano.',
            abrir: () => gestaoAbrirTela('empresas'),
        },
        {
            area: 'Saúde do cliente', chip: nFeedbackBaixo ? 'critico' : 'ok',
            metric: String(nFeedbackBaixo), unit: 'feedback(s) nota baixa',
            detail: nFeedbackBaixo ? 'Nota ≤ 2 nos últimos 30 dias — risco de churn.' : 'Nenhum feedback com nota baixa nos últimos 30 dias.',
            abrir: () => gestaoAbrirTela('saude'),
        },
        {
            area: 'Comercial', chip: 'vazio',
            metric: '—', unit: '',
            detail: 'Substituto do card "Oferta & campanhas" (saiu do menu) — RPC ainda não confirmada.',
            abrir: () => gestaoAbrirTela('comercial'),
        },
        {
            area: 'Calendário & partes', chip: 'info',
            metric: String(totalPartes), unit: 'parte(s) padrão cadastrada(s)',
            detail: 'Contagem informativa — sem alerta conhecido para este número.',
            abrir: () => cockpitAbrirCatalogo('calendario'),
        },
    ];

    area.innerHTML = `
        <div class="flex items-center justify-between gap-2 mb-2">
            <h2 class="text-sm font-extrabold flex items-center" style="color:var(--ink)">
                Fila de atenção
                ${gestaoInfoIcone('Só sinais com fonte real (RPC ou contagem direta). Nada aqui é estimado.')}
            </h2>
            <div class="inline-flex rounded-lg border p-0.5" style="border-color:var(--line);background:#f8fafc">
                <button type="button" onclick="cockpitOrdenarFila('severidade')" id="cockpit-ord-severidade" class="text-[11px] font-bold px-2.5 py-1 rounded-md">Urgência</button>
                <button type="button" onclick="cockpitOrdenarFila('area')" id="cockpit-ord-area" class="text-[11px] font-bold px-2.5 py-1 rounded-md">Área</button>
            </div>
        </div>
        <div id="cockpit-fila" class="space-y-1.5 mb-6"></div>

        <div class="flex items-center justify-between gap-2 mb-2">
            <h2 class="text-sm font-extrabold" style="color:var(--ink)">Sinais por área</h2>
            <span class="text-xs" style="color:var(--sage)">${cockpitGrid.length} áreas · clique num card pra abrir a tela</span>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6" id="cockpit-grid"></div>

        <div class="flex items-center justify-between gap-2 mb-2 flex-wrap">
            <h2 class="text-sm font-extrabold flex items-center" style="color:var(--ink)">
                Métricas globais
                ${gestaoInfoIcone('Totais do banco inteiro, todas as empresas. "Total" = sem filtro de período (estoque/histórico completo); os outros 3 filtram por quando aconteceu (criado_em). Fonte de cada número no changelog do arquivo (cabeçalho, v1.2.0/v1.3.0).')}
            </h2>
            <div class="inline-flex rounded-lg border p-0.5" style="border-color:var(--line);background:#f8fafc">
                <button type="button" onclick="cockpitMudarPeriodoMetricas(null)" id="cockpit-mg-total" class="text-[11px] font-bold px-2.5 py-1 rounded-md">Total</button>
                <button type="button" onclick="cockpitMudarPeriodoMetricas(1)" id="cockpit-mg-1" class="text-[11px] font-bold px-2.5 py-1 rounded-md">1 dia</button>
                <button type="button" onclick="cockpitMudarPeriodoMetricas(7)" id="cockpit-mg-7" class="text-[11px] font-bold px-2.5 py-1 rounded-md">7 dias</button>
                <button type="button" onclick="cockpitMudarPeriodoMetricas(30)" id="cockpit-mg-30" class="text-[11px] font-bold px-2.5 py-1 rounded-md">30 dias</button>
            </div>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-2" id="cockpit-metricas-globais"></div>
    `;

    cockpitRenderFila();
    cockpitRenderGrid();
    cockpitPeriodoMetricas = null;
    cockpitRenderMetricasGlobais(mg, null);
    cockpitRenderPeriodoMetricasBotoes();
}

// v1.3.0 — estado do seletor de período das "Métricas globais". null =
// Total (mesmo comportamento da v1.2.0); 1/7/30 = janela em dias.
let cockpitPeriodoMetricas = null;

async function cockpitCarregarMetricasGlobais(dias) {
    cockpitPeriodoMetricas = dias;
    cockpitRenderPeriodoMetricasBotoes();
    const el = document.getElementById('cockpit-metricas-globais');
    if (el) el.innerHTML = `<p class="text-xs col-span-2 md:col-span-3" style="color:var(--sage)">Carregando…</p>`;
    const { data, error } = await dbAuth.schema('gestao').rpc('fn_cockpit_metricas_globais', { p_dias: dias });
    if (error) {
        if (el) el.innerHTML = `<p class="text-xs col-span-2 md:col-span-3" style="color:var(--danger)">Erro: ${error.message}</p>`;
        return;
    }
    const mg = (data && data[0]) || { storage_mb: 0, storage_arquivos: 0, ia_eventos: 0, ia_tokens: 0, acessos_total: 0, whatsapp_mensagens: 0, demandas_abertas: 0, landing_acessos: 0 };
    cockpitRenderMetricasGlobais(mg, dias);
}
function cockpitMudarPeriodoMetricas(dias) { cockpitCarregarMetricasGlobais(dias); }

function cockpitRenderPeriodoMetricasBotoes() {
    const mapa = { total: null, '1': 1, '7': 7, '30': 30 };
    Object.keys(mapa).forEach(k => {
        const b = document.getElementById('cockpit-mg-' + k);
        if (!b) return;
        const ativo = cockpitPeriodoMetricas === mapa[k];
        b.style.background = ativo ? '#fff' : 'transparent';
        b.style.color = ativo ? 'var(--pine)' : 'var(--sage)';
    });
}

function cockpitRenderMetricasGlobais(mg, dias) {
    // "Demandas abertas" (mg.demandas_abertas) fica de fora daqui de
    // propósito — é o card de grade "Suporte & Backlog", sempre backlog
    // ATUAL (ativo=true agora), não muda com este seletor.
    const rotuloPeriodo = dias === 1 ? 'nas últimas 24h' : dias === 7 ? 'nos últimos 7 dias' : dias === 30 ? 'nos últimos 30 dias' : 'histórico completo, todas as empresas';
    const itens = [
        { rotulo: 'Storage (Cofre)', valor: `${mg.storage_mb} MB`, detail: `${mg.storage_arquivos} arquivo(s) ${dias ? 'enviado(s) ' + rotuloPeriodo : '— ' + rotuloPeriodo}` },
        { rotulo: 'IA — eventos', valor: String(mg.ia_eventos), detail: `${Number(mg.ia_tokens || 0).toLocaleString('pt-BR')} token(s) (entrada + saída) · ${rotuloPeriodo}` },
        { rotulo: 'Acessos (App)', valor: String(mg.acessos_total), detail: `log_acessos · ${rotuloPeriodo}` },
        { rotulo: 'Mensagens WhatsApp', valor: String(mg.whatsapp_mensagens), detail: `canal = whatsapp · ${rotuloPeriodo}` },
        { rotulo: 'Acessos da landing', valor: String(mg.landing_acessos), detail: `evento = page_view · ${rotuloPeriodo}` },
    ];
    const el = document.getElementById('cockpit-metricas-globais');
    if (!el) return;
    el.innerHTML = itens.map(it => `
        <div class="p-3.5 rounded-xl border flex flex-col gap-1.5" style="border-color:var(--line);background:#fff">
            <span class="text-[10px] font-bold uppercase tracking-wide" style="color:var(--sage)">${it.rotulo}</span>
            <div><span class="text-xl font-extrabold" style="color:var(--pine)">${it.valor}</span></div>
            <p class="text-[11px]" style="color:var(--sage)">${it.detail}</p>
        </div>`).join('');
}

function cockpitRenderFila() {
    document.querySelectorAll('#cockpit-ord-severidade, #cockpit-ord-area').forEach(b => { b.style.background = 'transparent'; b.style.color = 'var(--sage)'; });
    const ativo = document.getElementById('cockpit-ord-' + cockpitOrdemFila);
    if (ativo) { ativo.style.background = '#fff'; ativo.style.color = 'var(--pine)'; }

    const itens = cockpitFila.slice();
    if (cockpitOrdemFila === 'area') itens.sort((a, b) => a.area.localeCompare(b.area, 'pt-BR'));
    else itens.sort((a, b) => COCKPIT_SEV_ORDEM[a.sev] - COCKPIT_SEV_ORDEM[b.sev]);

    const el = document.getElementById('cockpit-fila');
    if (!itens.length) { el.innerHTML = `<p class="text-sm text-center py-8" style="color:var(--sage)">Nada pedindo atenção agora. 🎉</p>`; return; }
    el.innerHTML = itens.map((it, i) => `
        <button type="button" onclick="cockpitFilaClicar(${i})" data-sev="${it.sev}"
            class="w-full flex items-start gap-3 p-3 rounded-xl border text-left"
            style="border-color:var(--line);border-left:3px solid ${COCKPIT_SEV_COR[it.sev]};background:#fff">
            <span class="w-2 h-2 rounded-full flex-none mt-1.5" style="background:${COCKPIT_SEV_PONTO[it.sev]}"></span>
            <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-baseline gap-2">
                    <span class="text-[10px] font-bold uppercase tracking-wide" style="color:var(--sage)">${it.area}</span>
                    <span class="text-xs font-bold" style="color:var(--ink)">${it.num}</span>
                </div>
                <p class="text-sm font-semibold" style="color:var(--ink)">${it.title}</p>
                <p class="text-xs mt-0.5" style="color:var(--sage)">${it.detail}</p>
            </div>
        </button>`).join('');
    // guarda a ordem renderizada pra cockpitFilaClicar() saber a que item o índice se refere
    cockpitFilaRenderizada = itens;
}
let cockpitFilaRenderizada = [];
function cockpitFilaClicar(i) { const it = cockpitFilaRenderizada[i]; if (it && it.abrir) it.abrir(); }

function cockpitOrdenarFila(criterio) { cockpitOrdemFila = criterio; cockpitRenderFila(); }

function cockpitRenderGrid() {
    const el = document.getElementById('cockpit-grid');
    el.innerHTML = cockpitGrid.map((c, i) => `
        <button type="button" onclick="cockpitGridClicar(${i})"
            class="text-left p-3.5 rounded-xl border flex flex-col gap-1.5" style="border-color:var(--line);background:#fff">
            <div class="flex items-start justify-between gap-2">
                <span class="text-[10px] font-bold uppercase tracking-wide" style="color:var(--sage)">${c.area}</span>
                <span class="text-[10px] font-bold px-2 py-0.5 rounded-full flex-none" style="${COCKPIT_CHIP_ESTILO[c.chip]}">${COCKPIT_CHIP_ROTULO[c.chip]}</span>
            </div>
            <div><span class="text-xl font-extrabold" style="color:var(--pine)">${c.metric}</span>${c.unit ? `<span class="text-xs font-semibold ml-1" style="color:var(--sage)">${c.unit}</span>` : ''}</div>
            <p class="text-[11px]" style="color:var(--sage)">${c.detail}</p>
        </button>`).join('');
}
function cockpitGridClicar(i) { const c = cockpitGrid[i]; if (c && c.abrir) c.abrir(); }

// Rotas pra dentro do hub de Configurações (Catálogo do patrimônio e
// Conciliação vivem lá, não são GESTAO_TELAS de topo — ver PM_HUB em
// parametros-master.js). gestaoAbrirTela/pmAbrirHub re-renderizam
// #area-conteudo de forma assíncrona; o setTimeout replica o mesmo padrão
// já usado no cockpit antigo (v0.x) pra "abrir e depois focar".
function cockpitAbrirHub(idHub) {
    gestaoAbrirTela('parametros');
    setTimeout(() => { if (typeof pmAbrirHub === 'function') pmAbrirHub(idHub); }, 150);
}
function cockpitAbrirCatalogo(aba) {
    gestaoAbrirTela('parametros');
    setTimeout(() => {
        if (typeof pmAbrirHub === 'function') pmAbrirHub('catalogo-patrimonio');
        setTimeout(() => { if (typeof cpTrocarAba === 'function') cpTrocarAba(aba); }, 150);
    }, 150);
}
