// ============================================================================
// js/telas/saude.js — Raiz Gestão
//
// v0.6.0 (novo): gestao.fn_saude_resumo() só devolve o que tem fonte real
// hoje — taxa de erro de IA (ia_eventos_log) e volume de acesso
// (log_acessos). Storage/Edge Functions/uptime do Supabase NÃO têm tabela
// de monitoramento no schema — mostrados como "não disponível" em vez de
// inventados, conforme regra explícita do Prompt 03.
// ============================================================================

async function telaSaudeInit() {
    const { data, error } = await dbAuth.schema('gestao').rpc('fn_saude_resumo');
    if (error) { gestaoErro(error.message); return; }
    const s = (data && data[0]) || {};

    const taxaErro = Number(s.ia_taxa_erro_24h) || 0;
    const toneErro = taxaErro >= 10 ? 'red' : taxaErro > 0 ? 'amber' : 'green';

    document.getElementById('area-conteudo').innerHTML = `
        <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">IA — últimas 24h</h2>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            ${gestaoCardMetrica('Eventos de IA', s.ia_eventos_24h ?? 0)}
            ${gestaoCardMetrica('Erros de IA', s.ia_erros_24h ?? 0, Number(s.ia_erros_24h) > 0 ? 'red' : 'green')}
            ${gestaoCardMetrica('Taxa de erro', taxaErro + '%', toneErro)}
        </div>

        <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Uso e licenciamento</h2>
        <div class="grid grid-cols-2 gap-3 mb-6">
            ${gestaoCardMetrica('Acessos (7 dias)', s.acessos_7d ?? 0)}
            ${gestaoCardMetrica('Licenças vencendo (7 dias)', s.licencas_vencendo_7d ?? 0, Number(s.licencas_vencendo_7d) > 0 ? 'amber' : 'green')}
        </div>

        <div class="p-4 rounded-xl border-2" style="border-color:var(--line);background:var(--paper)">
            <p class="text-xs font-bold mb-1" style="color:var(--ink)">Infraestrutura — não disponível</p>
            <p class="text-xs" style="color:var(--sage)">Uso de Storage, erros de Edge Functions e status de serviços (Supabase, WhatsApp Cloud API, GitHub Pages) ainda não têm fonte de dado no banco. Precisaria de integração com a Management API do Supabase ou de uma tabela de status manual — nenhuma das duas existe hoje, então nada é mostrado aqui em vez de um número inventado.</p>
        </div>
    `;
}
