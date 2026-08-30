// ============================================================================
// js/telas/saude.js — Raiz Gestão
//
// v0.11.5 — NOVA seção "IA — real (registro imediato) × log de negócio",
// pedido explícito do Nicola depois da investigação que achou um gap
// entre o Console da Anthropic e ia_eventos_log (ver HANDOFF_TOKENS_IA_
// 2026-08-30.md). Chama gestao.fn_saude_custo_ia_real() (nova, lê
// ia_chamadas_tentativas — gravada IMEDIATAMENTE após a resposta da
// Anthropic/Google voltar, antes de qualquer lógica de negócio) e mescla
// com fn_saude_custo_ia (já existente, ia_eventos_log) numa tabela só,
// por produto+modelo, com coluna de diferença — mostra o gap de relance,
// sem precisar rodar SQL. Card "Diferença" fica verde quando bate (< meio
// centavo de diferença) e âmbar quando não bate. Falha graciosamente se
// a migration/RPC nova ainda não existir no ambiente (mostra aviso, não
// quebra o resto da tela). Filtro de Pessoa não se aplica a esta seção
// (ia_chamadas_tentativas não guarda pessoa_id, só cliente_id) — avisado
// no ícone de info. Requer ia_chamadas_tentativas.sql (migration
// migrations_ia_chamadas_tentativas_2026-08-30.sql — já aplicada neste
// banco via MCP do Supabase, não precisa rodar de novo).
//
// v0.11.4 — custo de IA detalhado por PRODUTO (Claude/Gemini) e MODELO,
// com volume de chamadas por linha + total geral (gestao.fn_saude_custo_ia,
// nova — substitui os 4 campos agregados que fn_saude_resumo tinha desde
// v0.11.1). Produto vem de gestao.ia_precos_modelo.produto, com fallback
// pelo prefixo do nome do modelo pra não sumir um modelo novo sem preço
// cadastrado ainda. Total geral é somado no front-end a partir das linhas
// (uma soma só, sem duplicar em 2 RPCs).
//
// v0.11.1 — "Bytes processados por IA" trocado por uma aproximação real de
// custo (USD): soma tokens_entrada/tokens_saida de ia_eventos_log × preço
// por modelo (gestao.ia_precos_modelo, tabela editável — atualizar preço
// não requer deploy de código).
//
// v0.11.0 — filtro de empresa/pessoa/período (data início/fim, padrão
// últimos 7 dias) atuando em TODA a tela — troca as janelas fixas antigas
// (24h de IA, 7d de acessos) por gestao.fn_saude_resumo(p_data_inicio,
// p_data_fim, p_cliente_id, p_pessoa_id). "Licenças vencendo" continua
// olhando os PRÓXIMOS 7 dias fixos (é janela pra frente, não teria sentido
// reaproveitar o período histórico selecionado), mas passa a respeitar o
// filtro de empresa.
//
// NOVO desde v0.11.0 — o aviso de "Storage/IA não disponível" ficou
// desatualizado desde que o Cofre de Documentos entrou em produção:
//   - Storage: bytes + arquivos de public.cofre_documentos, no período.
//   - Mensagens de WhatsApp: ia_eventos_log canal='whatsapp', contando
//     mensagem (whatsapp_message_id distinto) + eventos sem id (ex.:
//     pró-ativas do bot).
// Edge Functions/uptime do Supabase/GitHub Pages continuam SEM fonte de
// dado nenhuma no banco — aviso mantido, não inventamos número.
//
// Requer gestao_fase6_filtro_periodo_saude_v1.sql,
// gestao_fase6_empresas_pessoas_adocao_v1.sql (fn_lista_pessoas, usada
// aqui pro seletor de pessoa), gestao_fase6_fix_tipos_e_rls_v1.sql e
// gestao_fase6_custo_ia_por_modelo_v1.sql.
// ============================================================================

let sdEmpresas = [];
let sdPessoas = [];

async function telaSaudeInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando Saúde...</p>`;

    if (sdEmpresas.length === 0 || sdPessoas.length === 0) {
        const [{ data: empresas, error: eEmp }, { data: pessoas, error: ePes }] = await Promise.all([
            dbAuth.schema('gestao').rpc('fn_lista_empresas'),
            dbAuth.schema('gestao').rpc('fn_lista_pessoas')
        ]);
        if (eEmp || ePes) { gestaoErro((eEmp || ePes).message); return; }
        sdEmpresas = empresas || [];
        sdPessoas = pessoas || [];
    }

    area.innerHTML = `
        <div class="mb-4">
            <h1 class="text-lg font-extrabold" style="color:var(--ink)">Saúde</h1>
            <p class="text-xs mt-0.5" style="color:var(--sage)">Filtro de empresa/pessoa/período abaixo afeta todas as informações desta tela.</p>
        </div>

        <div class="flex flex-wrap gap-2 mb-5 items-end">
            <label class="flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase" style="color:var(--sage)">Empresa</span>
                <select id="sd-filtro-empresa" onchange="sdMudarEmpresa()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line)">
                    <option value="">Todas as empresas</option>
                    ${sdEmpresas.map(e => `<option value="${e.cliente_id}">${pmEsc(e.nome_empresa)}</option>`).join('')}
                </select>
            </label>
            <label class="flex flex-col gap-1">
                <span class="text-[10px] font-bold uppercase" style="color:var(--sage)">Pessoa</span>
                <select id="sd-filtro-pessoa" onchange="sdCarregar()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line);min-width:160px">
                    <option value="">Todas as pessoas</option>
                    ${sdPessoas.map(p => `<option value="${p.pessoa_id}" data-cliente="${p.cliente_id}">${pmEsc(p.nome)} · ${pmEsc(p.nome_empresa)}</option>`).join('')}
                </select>
            </label>
            ${gestaoFiltroPeriodoHtml('sd', 7)}
            <button onclick="sdCarregar()" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Aplicar</button>
        </div>

        <div id="sd-conteudo"></div>
    `;

    sdCarregar();
}

// Ao trocar a empresa, restringe o <select> de pessoa às pessoas daquela
// empresa (a lista completa já está em memória — filtro é só de exibição
// de <option>, não recarrega nada do banco).
function sdMudarEmpresa() {
    const clienteId = document.getElementById('sd-filtro-empresa').value;
    const selPessoa = document.getElementById('sd-filtro-pessoa');
    const atual = selPessoa.value;
    const opcoes = sdPessoas.filter(p => !clienteId || p.cliente_id === clienteId);
    selPessoa.innerHTML = `<option value="">Todas as pessoas</option>` +
        opcoes.map(p => `<option value="${p.pessoa_id}" data-cliente="${p.cliente_id}">${pmEsc(p.nome)} · ${pmEsc(p.nome_empresa)}</option>`).join('');
    // Mantém a pessoa selecionada se ela ainda pertence à empresa escolhida.
    if (opcoes.some(p => p.pessoa_id === atual)) selPessoa.value = atual;
    sdCarregar();
}

async function sdCarregar() {
    const el = document.getElementById('sd-conteudo');
    el.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    const { inicio, fim } = gestaoLerFiltroPeriodo('sd');
    const clienteId = document.getElementById('sd-filtro-empresa').value || null;
    const pessoaId = document.getElementById('sd-filtro-pessoa').value || null;

    const [{ data, error }, { data: topApp, error: e2 }, { data: topBot, error: e3 }, { data: custoIa, error: e4 }, { data: custoIaReal, error: e5 }] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_saude_resumo', { p_data_inicio: inicio, p_data_fim: fim, p_cliente_id: clienteId, p_pessoa_id: pessoaId }),
        dbAuth.schema('gestao').rpc('fn_funcoes_mais_usadas_app', { p_data_inicio: inicio, p_data_fim: fim, p_cliente_id: clienteId, p_pessoa_id: pessoaId }),
        dbAuth.schema('gestao').rpc('fn_funcoes_mais_usadas_bot', { p_data_inicio: inicio, p_data_fim: fim, p_cliente_id: clienteId, p_pessoa_id: pessoaId }),
        dbAuth.schema('gestao').rpc('fn_saude_custo_ia', { p_data_inicio: inicio, p_data_fim: fim, p_cliente_id: clienteId, p_pessoa_id: pessoaId }),
        dbAuth.schema('gestao').rpc('fn_saude_custo_ia_real', { p_data_inicio: inicio, p_data_fim: fim, p_cliente_id: clienteId })
    ]);
    if (error) { el.innerHTML = `<p class="text-sm" style="color:var(--danger)">Erro: ${error.message}</p>`; return; }
    const s = (data && data[0]) || {};
    if (e2 || e3) console.warn('Funções mais usadas indisponível:', (e2 || e3).message);
    if (e4) { el.innerHTML = `<p class="text-sm" style="color:var(--danger)">Erro ao carregar custo de IA: ${e4.message}</p>`; return; }
    // NOVO (30/08/2026) — fn_saude_custo_ia_real não bloqueia a tela se
    // falhar (migration nova, pode não existir ainda em algum ambiente) —
    // só avisa no console e a seção de comparação mostra "indisponível".
    if (e5) console.warn('Custo real (ia_chamadas_tentativas) indisponível:', e5.message);

    const taxaErro = Number(s.ia_taxa_erro_periodo) || 0;
    const toneErro = taxaErro >= 10 ? 'red' : taxaErro > 0 ? 'amber' : 'green';
    const maiorApp = Math.max(1, ...(topApp || []).map(a => Number(a.qtd)));
    const maiorBot = Math.max(1, ...(topBot || []).map(b => Number(b.qtd)));

    // Total geral somado aqui a partir das linhas de fn_saude_custo_ia —
    // uma soma só, em vez de duplicar em mais uma RPC.
    const linhasIa = custoIa || [];
    const totalChamadas = linhasIa.reduce((s, l) => s + Number(l.chamadas || 0), 0);
    const totalTokIn = linhasIa.reduce((s, l) => s + Number(l.tokens_entrada || 0), 0);
    const totalTokOut = linhasIa.reduce((s, l) => s + Number(l.tokens_saida || 0), 0);
    const totalCusto = linhasIa.reduce((s, l) => s + Number(l.custo_estimado_usd || 0), 0);
    const fmtUsd = (v) => 'US$ ' + Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    const fmtNum = (v) => Number(v).toLocaleString('pt-BR');

    // NOVO (30/08/2026) — comparação com ia_chamadas_tentativas (log
    // imediato, gravado antes de qualquer lógica de negócio — ver
    // HANDOFF_TOKENS_IA_2026-08-30.md). Mescla as 2 fontes por
    // produto+modelo pra mostrar lado a lado numa tabela só; qualquer
    // diferença aparece na hora, sem precisar rodar SQL. Filtro de
    // Pessoa não se aplica à fonte "real" (a tabela não guarda
    // pessoa_id) — avisado no ícone de info.
    const linhasReal = custoIaReal || [];
    const totalCustoReal = linhasReal.reduce((s, l) => s + Number(l.custo_estimado_usd || 0), 0);
    const diferencaTotal = totalCustoReal - totalCusto;
    const chaveDe = (l) => `${l.produto}|${l.modelo}`;
    const porChaveLog = new Map(linhasIa.map(l => [chaveDe(l), l]));
    const porChaveReal = new Map(linhasReal.map(l => [chaveDe(l), l]));
    const todasAsChaves = [...new Set([...porChaveLog.keys(), ...porChaveReal.keys()])].sort();
    const comparativoDisponivel = !e5;

    el.innerHTML = `
        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            IA — período selecionado
            ${gestaoInfoIcone('Vem de ia_eventos_log: todo evento de IA (passiva, proativa ou conversacional) do bot grava um "resultado". Taxa de erro = eventos com resultado=erro / total, no período.')}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            ${gestaoCardMetrica('Eventos de IA', s.ia_eventos_periodo ?? 0)}
            ${gestaoCardMetrica('Erros de IA', s.ia_erros_periodo ?? 0, Number(s.ia_erros_periodo) > 0 ? 'red' : 'green')}
            ${gestaoCardMetrica('Taxa de erro', taxaErro + '%', toneErro)}
        </div>

        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            Uso, licenciamento e canais
            ${gestaoInfoIcone('Acessos e mensagens de WhatsApp usam o período selecionado. Licenças vencendo olha sempre os PRÓXIMOS 7 dias (janela pra frente, independente do período histórico escolhido acima).')}
        </h2>
        <div class="grid grid-cols-3 gap-3 mb-6">
            ${gestaoCardMetrica('Acessos (período)', s.acessos_periodo ?? 0)}
            ${gestaoCardMetrica('Mensagens WhatsApp (período)', s.whatsapp_mensagens_periodo ?? 0)}
            ${gestaoCardMetrica('Licenças vencendo (próx. 7d)', s.licencas_vencendo_7d ?? 0, Number(s.licencas_vencendo_7d) > 0 ? 'amber' : 'green')}
        </div>

        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            IA — custo estimado por produto e modelo (período selecionado)
            ${gestaoInfoIcone('Custo = tokens de entrada/saída (ia_eventos_log) × preço por modelo (gestao.ia_precos_modelo, tabela editável — atualizar quando o provedor mudar preço). Em USD, moeda de cobrança da Anthropic/Google. Uma linha com chamadas > 0 e tokens = 0 significa que aquele modelo ainda não grava tokens (hoje é o caso do Gemini/voz) — o custo real fica acima do total mostrado enquanto isso não for corrigido no bot.')}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            ${gestaoCardMetrica('Chamadas de IA', fmtNum(totalChamadas))}
            ${gestaoCardMetrica('Tokens de entrada', fmtNum(totalTokIn))}
            ${gestaoCardMetrica('Tokens de saída', fmtNum(totalTokOut))}
            ${gestaoCardMetrica('Custo total estimado', fmtUsd(totalCusto))}
        </div>
        <div class="overflow-x-auto mb-6 rounded-xl border-2" style="border-color:var(--line)">
            <table class="w-full text-xs" style="border-collapse:separate;border-spacing:0">
                <thead>
                    <tr style="background:var(--paper)">
                        <th class="p-2 text-left" style="color:var(--sage)">Produto</th>
                        <th class="p-2 text-left" style="color:var(--sage)">Modelo</th>
                        <th class="p-2 text-right" style="color:var(--sage)">Chamadas</th>
                        <th class="p-2 text-right" style="color:var(--sage)">Tokens entrada</th>
                        <th class="p-2 text-right" style="color:var(--sage)">Tokens saída</th>
                        <th class="p-2 text-right" style="color:var(--sage)">Custo (USD)</th>
                    </tr>
                </thead>
                <tbody>
                    ${linhasIa.map(l => `
                        <tr class="border-t" style="border-color:var(--line)">
                            <td class="p-2" style="color:var(--ink)">${l.produto}</td>
                            <td class="p-2" style="color:var(--sage)">${l.modelo}</td>
                            <td class="p-2 text-right" style="color:var(--ink)">${fmtNum(l.chamadas)}</td>
                            <td class="p-2 text-right" style="color:var(--ink)">${fmtNum(l.tokens_entrada)}</td>
                            <td class="p-2 text-right" style="color:var(--ink)">${fmtNum(l.tokens_saida)}</td>
                            <td class="p-2 text-right font-bold" style="color:var(--ink)">${fmtUsd(l.custo_estimado_usd)}</td>
                        </tr>
                    `).join('') || `<tr><td colspan="6" class="p-4 text-center" style="color:var(--sage)">Sem chamadas de IA no período/filtro selecionado.</td></tr>`}
                </tbody>
                ${linhasIa.length > 0 ? `
                    <tfoot>
                        <tr class="border-t-2" style="border-color:var(--line);background:var(--paper)">
                            <td class="p-2 font-bold" style="color:var(--ink)" colspan="2">Total</td>
                            <td class="p-2 text-right font-bold" style="color:var(--ink)">${fmtNum(totalChamadas)}</td>
                            <td class="p-2 text-right font-bold" style="color:var(--ink)">${fmtNum(totalTokIn)}</td>
                            <td class="p-2 text-right font-bold" style="color:var(--ink)">${fmtNum(totalTokOut)}</td>
                            <td class="p-2 text-right font-bold" style="color:var(--ink)">${fmtUsd(totalCusto)}</td>
                        </tr>
                    </tfoot>
                ` : ''}
            </table>
        </div>

        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            IA — real (registro imediato) × log de negócio
            ${gestaoInfoIcone('ia_chamadas_tentativas é gravada IMEDIATAMENTE após a resposta da Anthropic/Google voltar, antes de qualquer lógica de negócio — não depende do resto do fluxo terminar bem (ver HANDOFF_TOKENS_IA_2026-08-30.md). É a fonte mais confiável pra reconciliar com o Console da Anthropic. ia_eventos_log (tabela acima) é o log de negócio — contexto, funcionalidade, canal — e pode ficar pra trás se algo interromper o fluxo depois da chamada. "Diferença" = real menos log; positivo significa gasto real que o log de negócio ainda não capturou. Filtro de Pessoa não se aplica aqui (a tabela não guarda pessoa_id, só empresa).')}
        </h2>
        ${!comparativoDisponivel ? `
            <div class="p-4 rounded-xl border-2 mb-6" style="border-color:var(--line);background:var(--paper)">
                <p class="text-xs" style="color:var(--sage)">Não disponível — a migration ia_chamadas_tentativas ainda não foi aplicada neste ambiente, ou a função gestao.fn_saude_custo_ia_real() não existe.</p>
            </div>
        ` : `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                ${gestaoCardMetrica('Custo real (imediato)', fmtUsd(totalCustoReal))}
                ${gestaoCardMetrica('Custo no log de negócio', fmtUsd(totalCusto))}
                ${gestaoCardMetrica('Diferença', (diferencaTotal >= 0 ? '+' : '') + fmtUsd(diferencaTotal), Math.abs(diferencaTotal) < 0.005 ? 'green' : 'amber')}
            </div>
            <div class="overflow-x-auto mb-6 rounded-xl border-2" style="border-color:var(--line)">
                <table class="w-full text-xs" style="border-collapse:separate;border-spacing:0">
                    <thead>
                        <tr style="background:var(--paper)">
                            <th class="p-2 text-left" style="color:var(--sage)">Produto</th>
                            <th class="p-2 text-left" style="color:var(--sage)">Modelo</th>
                            <th class="p-2 text-right" style="color:var(--sage)">Chamadas (real)</th>
                            <th class="p-2 text-right" style="color:var(--sage)">Custo real</th>
                            <th class="p-2 text-right" style="color:var(--sage)">Custo no log</th>
                            <th class="p-2 text-right" style="color:var(--sage)">Diferença</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${todasAsChaves.map(chave => {
                            const real = porChaveReal.get(chave);
                            const log = porChaveLog.get(chave);
                            const [produto, modelo] = chave.split('|');
                            const custoRealLinha = Number(real?.custo_estimado_usd || 0);
                            const custoLogLinha = Number(log?.custo_estimado_usd || 0);
                            const diffLinha = custoRealLinha - custoLogLinha;
                            const corDiff = Math.abs(diffLinha) < 0.005 ? 'var(--success)' : 'var(--warning)';
                            return `
                                <tr class="border-t" style="border-color:var(--line)">
                                    <td class="p-2" style="color:var(--ink)">${produto}</td>
                                    <td class="p-2" style="color:var(--sage)">${modelo}</td>
                                    <td class="p-2 text-right" style="color:var(--ink)">${real ? fmtNum(real.chamadas) : '—'}</td>
                                    <td class="p-2 text-right" style="color:var(--ink)">${real ? fmtUsd(custoRealLinha) : '—'}</td>
                                    <td class="p-2 text-right" style="color:var(--ink)">${log ? fmtUsd(custoLogLinha) : '—'}</td>
                                    <td class="p-2 text-right font-bold" style="color:${corDiff}">${(diffLinha >= 0 ? '+' : '') + fmtUsd(diffLinha)}</td>
                                </tr>
                            `;
                        }).join('') || `<tr><td colspan="6" class="p-4 text-center" style="color:var(--sage)">Sem chamadas registradas em nenhuma das 2 fontes, no período/filtro selecionado.</td></tr>`}
                    </tbody>
                </table>
            </div>
        `}
            ${gestaoInfoIcone('Bytes/arquivos de documentos ativos no Cofre criados no período (public.cofre_documentos).')}
        </h2>
        <div class="grid grid-cols-2 gap-3 mb-6">
            ${gestaoCardMetrica('Arquivos no Storage', s.storage_arquivos ?? 0)}
            ${gestaoCardMetrica('Bytes no Storage', gestaoFormatarBytes(s.storage_bytes))}
        </div>

        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            Funções mais usadas (período selecionado)
            ${gestaoInfoIcone('Frequência de log — quantas vezes cada ação apareceu, não consumo-vs-limite. Pra ver o detalhe de uma empresa específica, abra a ficha dela em Empresas.')}
        </h2>
        <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div>
                <p class="text-[10px] font-bold uppercase mb-2" style="color:var(--sage)">App (log_acessos)</p>
                <div class="space-y-2">
                    ${(topApp || []).map(a => gestaoBarra(a.acao, a.qtd, maiorApp)).join('') || `<p class="text-sm" style="color:var(--sage)">Sem ações registradas no período.</p>`}
                </div>
            </div>
            <div>
                <p class="text-[10px] font-bold uppercase mb-2" style="color:var(--sage)">Bot (ia_eventos_log)</p>
                <div class="space-y-2">
                    ${(topBot || []).map(b => gestaoBarra(b.funcionalidade, b.qtd, maiorBot)).join('') || `<p class="text-sm" style="color:var(--sage)">Sem eventos registrados no período.</p>`}
                </div>
            </div>
        </div>

        <div class="p-4 rounded-xl border-2" style="border-color:var(--line);background:var(--paper)">
            <p class="text-xs font-bold mb-1" style="color:var(--ink)">Infraestrutura — não disponível</p>
            <p class="text-xs" style="color:var(--sage)">Erros de Edge Functions e status de serviços (Supabase, WhatsApp Cloud API, GitHub Pages) ainda não têm fonte de dado no banco. Precisaria de integração com a Management API do Supabase ou de uma tabela de status manual — nenhuma das duas existe hoje, então nada é mostrado aqui em vez de um número inventado.</p>
        </div>
    `;
}
