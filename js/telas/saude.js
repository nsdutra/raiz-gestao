// ============================================================================
// js/telas/saude.js — Raiz Gestão
//
// v0.7.0: seção "Funções mais usadas" (app + bot, todas as empresas) via
// gestao.fn_funcoes_mais_usadas_app()/_bot() — frequência de log real,
// não consumo-vs-limite (isso fica na ficha de cada empresa, ver
// empresas.js). Ícones de informação explicando cada métrica.
//
// v0.6.0: gestao.fn_saude_resumo() só devolve o que tem fonte real hoje —
// taxa de erro de IA (ia_eventos_log) e volume de acesso (log_acessos).
// Storage/Edge Functions/uptime do Supabase NÃO têm tabela de
// monitoramento no schema — mostrados como "não disponível" em vez de
// inventados, conforme regra explícita do Prompt 03.
// ============================================================================

async function telaSaudeInit() {
    const [{ data, error }, { data: topApp, error: e2 }, { data: topBot, error: e3 }] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_saude_resumo'),
        dbAuth.schema('gestao').rpc('fn_funcoes_mais_usadas_app'),
        dbAuth.schema('gestao').rpc('fn_funcoes_mais_usadas_bot')
    ]);
    if (error) { gestaoErro(error.message); return; }
    const s = (data && data[0]) || {};
    if (e2 || e3) console.warn('Funções mais usadas indisponível:', (e2 || e3).message);

    const taxaErro = Number(s.ia_taxa_erro_24h) || 0;
    const toneErro = taxaErro >= 10 ? 'red' : taxaErro > 0 ? 'amber' : 'green';
    const maiorApp = Math.max(1, ...(topApp || []).map(a => Number(a.qtd)));
    const maiorBot = Math.max(1, ...(topBot || []).map(b => Number(b.qtd)));

    document.getElementById('area-conteudo').innerHTML = `
        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            IA — últimas 24h
            ${gestaoInfoIcone('Vem de ia_eventos_log: todo evento de IA (passiva, proativa ou conversacional) do bot grava um "resultado". Taxa de erro = eventos com resultado=erro / total, nas últimas 24h.')}
        </h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            ${gestaoCardMetrica('Eventos de IA', s.ia_eventos_24h ?? 0)}
            ${gestaoCardMetrica('Erros de IA', s.ia_erros_24h ?? 0, Number(s.ia_erros_24h) > 0 ? 'red' : 'green')}
            ${gestaoCardMetrica('Taxa de erro', taxaErro + '%', toneErro)}
        </div>

        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            Uso e licenciamento
            ${gestaoInfoIcone('Acessos = linhas em log_acessos nos últimos 7 dias, todas as empresas. Licenças vencendo = status ativo com data_expiracao nos próximos 7 dias.')}
        </h2>
        <div class="grid grid-cols-2 gap-3 mb-6">
            ${gestaoCardMetrica('Acessos (7 dias)', s.acessos_7d ?? 0)}
            ${gestaoCardMetrica('Licenças vencendo (7 dias)', s.licencas_vencendo_7d ?? 0, Number(s.licencas_vencendo_7d) > 0 ? 'amber' : 'green')}
        </div>

        <h2 class="text-sm font-extrabold mb-3 flex items-center" style="color:var(--ink)">
            Funções mais usadas (todas as empresas, 30d)
            ${gestaoInfoIcone('Frequência de log — quantas vezes cada ação apareceu, não consumo-vs-limite. Pra ver o detalhe de uma empresa específica, abra a ficha dela em Empresas.')}
        </h2>
        <div class="grid md:grid-cols-2 gap-6 mb-6">
            <div>
                <p class="text-[10px] font-bold uppercase mb-2" style="color:var(--sage)">App (log_acessos)</p>
                <div class="space-y-2">
                    ${(topApp || []).map(a => gestaoBarra(a.acao, a.qtd, maiorApp)).join('') || `<p class="text-sm" style="color:var(--sage)">Sem ações registradas nos últimos 30 dias.</p>`}
                </div>
            </div>
            <div>
                <p class="text-[10px] font-bold uppercase mb-2" style="color:var(--sage)">Bot (ia_eventos_log)</p>
                <div class="space-y-2">
                    ${(topBot || []).map(b => gestaoBarra(b.funcionalidade, b.qtd, maiorBot)).join('') || `<p class="text-sm" style="color:var(--sage)">Sem eventos registrados nos últimos 30 dias.</p>`}
                </div>
            </div>
        </div>

        <div class="p-4 rounded-xl border-2" style="border-color:var(--line);background:var(--paper)">
            <p class="text-xs font-bold mb-1" style="color:var(--ink)">Infraestrutura — não disponível</p>
            <p class="text-xs" style="color:var(--sage)">Uso de Storage, erros de Edge Functions e status de serviços (Supabase, WhatsApp Cloud API, GitHub Pages) ainda não têm fonte de dado no banco. Precisaria de integração com a Management API do Supabase ou de uma tabela de status manual — nenhuma das duas existe hoje, então nada é mostrado aqui em vez de um número inventado.</p>
        </div>
    `;
}
