// ============================================================================
// js/telas/comunicacoes.js — Raiz Gestão
//
// v0.2.0 (30/08/2026) — pedido explícito do Nicola, 2 partes:
//   1) "separar as configurações da visualização do uso" — a tela virou 2
//      MODOS (cmModo: 'uso' | 'config'), alternados por um toggle no
//      topo, abaixo das abas de plano (que continuam valendo pros dois
//      modos — plano é o "que", modo é o "o que eu quero ver sobre ele").
//      "Uso" = exatamente o que já existia (filtros de período/empresa,
//      cards, funil, por empresa, log). "Configuração" = a lista de
//      mensagens do plano, que SAIU do modo Uso — antes ficava tudo
//      junto na mesma tela/scroll, misturando "resultado" com "cadastro".
//      cmCarregar() ficou mode-aware: só chama as RPCs de análise (resumo/
//      funil/por_empresa/detalhe) no modo Uso, e só chama
//      fn_comunicacoes_mensagens no modo Configuração — não busca dado
//      que o modo atual não vai mostrar.
//   2) "na configuração das msg queria tb ver uma opção mais amigável da
//      msg, e pode editar direto ali" + "incluir uma opção de ver/simular
//      a msg como ela aparece ou vai aparecer antes de salvar":
//      - cmLinhaMensagem() foi reescrita: cada comunicação mostra 1 CARD
//        POR CANAL (uma comunicação pode ter até 3 — app/whatsapp/email,
//        UNIQUE(comunicacao_id,canal) — cada um com seu próprio título/
//        mensagem/conteúdo). Título+mensagem aparecem como texto legível
//        (era só "Ver JSON" antes). O JSON continua existindo — virou
//        "Ver conteúdo avançado (JSON)", pra quem precisa mexer na
//        estrutura completa (botões, passos de onboarding) — mas não é
//        mais o único jeito de ver o que a mensagem diz.
//      - "Editar" abre um formulário inline (cmAbrirEdicaoCanal) pra
//        título/mensagem direto, com o conteúdo avançado num textarea
//        JSON colapsável (edição de botões/passos continua existindo,
//        só não é mais forçada pra quem só quer arrumar o texto).
//      - "Simular" (cmAbrirPreview) — MESMA função é chamada de dois
//        lugares: do card (mostra a versão já salva) e de DENTRO do
//        formulário de edição (mostra o que está digitado NA HORA, antes
//        de salvar — por isso lê os campos do formulário, não o cache).
//        cmRenderizarPreview() reconhece canal+formato e desenha 1 de 3
//        maquetes: bolha de WhatsApp (mensagem + opções numeradas),
//        modal de app (título + mensagem + botões), ou passo-a-passo
//        (onboarding com `conteudo.passos`) — formato desconhecido cai
//        num preview genérico (só o texto), nunca quebra.
//
// Requer migration comunicacoes_editar_canal (aplicada via MCP em
// 30/08/2026): fn_comunicacoes_mensagens ganhou `id` de cada canal no
// jsonb (faltava — sem isso não dava pra saber qual linha atualizar) +
// fn_comunicacao_canal_atualizar (nova, master-only, atualiza título/
// mensagem/conteúdo de 1 canal).
//
// v0.1.0 (29/08/2026) — versão original. Ver changelog completo no
// histórico do arquivo/index.html.
// ============================================================================

let cmPlanos = [];
let cmPlanoAtualId = null;
let cmEmpresas = [];
let cmClienteId = '';
let cmMensagensDoPlano = []; // cache pra abrir o JSON/editar sem nova consulta
let cmModo = 'uso'; // 'uso' | 'config'
let cmCanalEditandoId = null; // id do canal com o form de edição aberto (null = nenhum)

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

        <div class="flex gap-1.5 mb-3 flex-wrap" id="cm-abas-plano">
            ${cmPlanos.map(p => `
                <button onclick="cmTrocarPlano('${p.id}')" id="cm-aba-${p.id}"
                    class="text-xs font-bold px-3 py-2 rounded-lg border-2"
                    style="border-color:${p.id === cmPlanoAtualId ? 'var(--brass)' : 'var(--line)'};background:#fff;color:var(--ink)">
                    ${pmEsc(p.nome)} <span style="color:var(--sage)">(${p.qtd_mensagens})</span>
                </button>
            `).join('')}
        </div>

        <p id="cm-plano-objetivo" class="text-xs mb-3" style="color:var(--sage)"></p>

        <!-- NOVO v0.2.0 — toggle de modo. Fica separado das abas de plano
             de propósito: plano = "sobre o quê", modo = "o que eu quero
             ver sobre ele" — são 2 eixos diferentes, não deveriam disputar
             a mesma barra. -->
        <div class="flex gap-1.5 mb-5 p-1 rounded-xl w-fit" style="background:var(--paper)" id="cm-modo-toggle">
            <button onclick="cmTrocarModo('uso')" id="cm-modo-uso"
                class="text-xs font-bold px-3 py-1.5 rounded-lg" style="background:#fff;color:var(--pine)">
                📊 Uso
            </button>
            <button onclick="cmTrocarModo('config')" id="cm-modo-config"
                class="text-xs font-bold px-3 py-1.5 rounded-lg" style="color:var(--sage)">
                ⚙️ Configuração
            </button>
        </div>

        <div id="cm-area-uso">
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
        </div>

        <div id="cm-area-config" class="hidden">
            <h2 class="text-sm font-extrabold mb-3" style="color:var(--ink)">Mensagens do plano</h2>
            <div id="cm-mensagens" class="space-y-3 mb-6"></div>
        </div>
    `;

    cmAplicarModoNaTela();
    cmCarregar();
}

function cmTrocarPlano(planoId) {
    cmPlanoAtualId = planoId;
    cmCanalEditandoId = null;
    document.querySelectorAll('[id^="cm-aba-"]').forEach(b => b.style.borderColor = 'var(--line)');
    document.getElementById('cm-aba-' + planoId).style.borderColor = 'var(--brass)';
    cmCarregar();
}

// NOVO v0.2.0 — troca de modo não recarrega do zero: só busca a RPC que o
// modo novo precisa e ainda não tem (cmCarregar já é esperto o bastante
// pra isso — ver comentário lá). Fecha qualquer edição aberta ao trocar,
// pra nunca deixar um formulário órfão escondido atrás do modo Uso.
function cmTrocarModo(modo) {
    cmModo = modo;
    cmCanalEditandoId = null;
    cmAplicarModoNaTela();
    cmCarregar();
}

function cmAplicarModoNaTela() {
    const ehUso = cmModo === 'uso';
    document.getElementById('cm-area-uso').classList.toggle('hidden', !ehUso);
    document.getElementById('cm-area-config').classList.toggle('hidden', ehUso);
    document.getElementById('cm-modo-uso').style.background = ehUso ? '#fff' : 'transparent';
    document.getElementById('cm-modo-uso').style.color = ehUso ? 'var(--pine)' : 'var(--sage)';
    document.getElementById('cm-modo-config').style.background = ehUso ? 'transparent' : '#fff';
    document.getElementById('cm-modo-config').style.color = ehUso ? 'var(--sage)' : 'var(--pine)';
}

// CORRIGIDO (v0.2.0) — antes buscava as 5 RPCs sempre, mesmo mostrando só
// uma fração dos dados por vez depois do toggle de modo (que nem existia
// ainda). Agora só busca o que o modo ATUAL vai realmente desenhar —
// menos chamada, menos espera, sem trazer dado de configuração toda vez
// que alguém só quer olhar o funil, e vice-versa.
async function cmCarregar() {
    if (!cmPlanoAtualId) return;
    const plano = cmPlanos.find(p => p.id === cmPlanoAtualId);
    document.getElementById('cm-plano-objetivo').textContent = plano?.objetivo || '';

    if (cmModo === 'config') {
        const { data: mensagens, error } = await dbAuth.schema('gestao').rpc('fn_comunicacoes_mensagens', { p_plano_id: cmPlanoAtualId });
        if (error) { gestaoErro(error.message); return; }
        cmMensagensDoPlano = mensagens || [];
        document.getElementById('cm-mensagens').innerHTML = cmMensagensDoPlano.map(m => cmLinhaMensagem(m)).join('')
            || `<p class="text-sm" style="color:var(--sage)">Nenhuma mensagem cadastrada neste plano ainda.</p>`;
        return;
    }

    // modo 'uso' — mesmas 4 RPCs de análise de sempre.
    cmClienteId = document.getElementById('cm-filtro-empresa').value;
    const periodo = gestaoLerFiltroPeriodo('cm');
    const pCliente = cmClienteId || null;

    const [
        { data: resumo, error: e1 },
        { data: funil, error: e2 },
        { data: porEmpresa, error: e4 },
        { data: log, error: e5 }
    ] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_comunicacoes_resumo', { p_plano_id: cmPlanoAtualId, p_data_inicio: periodo.inicio, p_data_fim: periodo.fim, p_cliente_id: pCliente }),
        dbAuth.schema('gestao').rpc('fn_comunicacoes_funil', { p_plano_id: cmPlanoAtualId, p_data_inicio: periodo.inicio, p_data_fim: periodo.fim, p_cliente_id: pCliente }),
        dbAuth.schema('gestao').rpc('fn_comunicacoes_por_empresa', { p_plano_id: cmPlanoAtualId, p_data_inicio: periodo.inicio, p_data_fim: periodo.fim }),
        dbAuth.schema('gestao').rpc('fn_comunicacoes_detalhe', { p_plano_id: cmPlanoAtualId, p_cliente_id: pCliente, p_data_inicio: periodo.inicio, p_data_fim: periodo.fim, p_limite: 100 })
    ]);
    const erro = e1 || e2 || e4 || e5;
    if (erro) { gestaoErro(erro.message); return; }

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
    cmModo = 'uso';
    cmAplicarModoNaTela();
    document.getElementById('cm-filtro-empresa').value = clienteId;
    cmCarregar();
    document.getElementById('cm-log').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

const CM_STATUS_ROTULO = { rascunho: 'Rascunho', ativa: 'Ativa', pausada: 'Pausada', encerrada: 'Encerrada' };
const CM_STATUS_COR = { rascunho: 'var(--sage)', ativa: 'var(--success)', pausada: 'var(--warning)', encerrada: 'var(--danger)' };
const CM_CANAL_ROTULO = { app: 'App', whatsapp: 'WhatsApp', email: 'E-mail' };

// NOVO v0.2.0 — pmEsc() (já existente no arquivo) escapa aspas com barra
// invertida (\') pensando em contexto de onclick="...('nome')" — dentro
// de texto normal (parágrafo, textarea) isso faria QUALQUER apóstrofo de
// português ("não", "é", "você") aparecer com uma barra invertida visível
// na tela. Esta função é só pra CONTEÚDO de texto (nunca atributo/onclick):
// escapa &/</> (evita quebrar a tag ou confundir com um Ver JSON de
// verdade), nunca mexe em aspas — apóstrofo continua aparecendo normal.
function cmEscTexto(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Idem, mas pra dentro de um atributo value="..." (precisa escapar " além
// de &/</>, ordem importa: & primeiro, senão escapa a própria entidade).
function cmEscAttr(s) {
    return cmEscTexto(s).replace(/"/g, '&quot;');
}

// REESCRITO v0.2.0 — antes era 1 linha por COMUNICAÇÃO com "Ver JSON".
// Agora é 1 cabeçalho de comunicação (código/prioridade/status/pausar) +
// 1 card POR CANAL dentro dela, cada um já mostrando título/mensagem
// como texto legível (não precisa mais abrir JSON só pra ler o que a
// mensagem diz).
function cmLinhaMensagem(m) {
    const canais = m.canais || [];
    return `
        <div class="rounded-xl border-2 overflow-hidden" style="border-color:var(--line);background:#fff">
            <div class="flex items-center justify-between gap-2 flex-wrap p-3" style="background:var(--paper)">
                <div class="min-w-0">
                    <span class="text-xs font-bold" style="color:var(--ink)">${pmEsc(m.codigo)}</span>
                    <span class="text-[11px] ml-2" style="color:var(--sage)">prioridade ${m.prioridade}</span>
                </div>
                <div class="flex items-center gap-2 flex-none">
                    <span class="text-[11px] font-bold px-2 py-0.5 rounded-full" style="background:#fff;color:${CM_STATUS_COR[m.status] || 'var(--ink)'}">${CM_STATUS_ROTULO[m.status] || m.status}</span>
                    ${m.status === 'ativa'
                        ? `<button onclick="cmDefinirStatus('${m.id}','pausada')" class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:#fff;color:var(--ink);border:1px solid var(--line)">Pausar</button>`
                        : `<button onclick="cmDefinirStatus('${m.id}','ativa')" class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:var(--pine);color:#fff">Ativar</button>`
                    }
                </div>
            </div>
            <div class="divide-y" style="border-color:var(--line)">
                ${canais.map(c => cmCardCanal(m, c)).join('') || `<p class="text-xs p-3" style="color:var(--sage)">Nenhum canal configurado pra esta mensagem.</p>`}
            </div>
        </div>
    `;
}

// NOVO v0.2.0 — 1 canal (app/whatsapp/email) de 1 comunicação. Modo
// leitura por padrão; "Editar" troca pro formulário (cmFormularioEdicaoCanal).
function cmCardCanal(m, c) {
    const idEditando = cmCanalEditandoId === c.id;
    if (idEditando) return cmFormularioEdicaoCanal(m, c);

    return `
        <div class="p-3" id="cm-canal-${c.id}">
            <div class="flex items-start justify-between gap-2 mb-1.5">
                <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full flex-none" style="background:var(--info-bg);color:var(--info)">${CM_CANAL_ROTULO[c.canal] || c.canal}</span>
                <div class="flex items-center gap-1.5 flex-none">
                    <button onclick="cmAbrirPreview(${cmJsAttr(c)})" class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:var(--paper);color:var(--ink)">👁 Simular</button>
                    <button onclick="cmAbrirEdicaoCanal('${c.id}')" class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:var(--paper);color:var(--ink)">✏️ Editar</button>
                </div>
            </div>
            ${c.titulo ? `<p class="text-xs font-extrabold mb-0.5" style="color:var(--ink)">${cmEscTexto(c.titulo)}</p>` : ''}
            <p class="text-xs whitespace-pre-wrap" style="color:var(--ink)">${cmEscTexto(c.mensagem) || '<span style="color:var(--sage)">(sem texto de mensagem cadastrado)</span>'}</p>
            <button onclick="cmAlternarJson('${c.id}')" class="text-[10px] font-bold mt-2" style="color:var(--sage);text-decoration:underline">Ver conteúdo avançado (JSON)</button>
            <div id="cm-json-${c.id}" class="hidden mt-2 pt-2 border-t" style="border-color:var(--line)">
                <pre class="text-[10px] p-2 rounded-lg overflow-x-auto" style="background:var(--paper);color:var(--ink)">${cmEscTexto(JSON.stringify(c.conteudo, null, 2))}</pre>
            </div>
        </div>
    `;
}

// NOVO v0.2.0 — formulário de edição inline. "Simular" aqui dentro lê os
// campos AO VIVO (não o cache `c`) — é o pedido explícito do Nicola de
// poder ver como fica ANTES de salvar.
function cmFormularioEdicaoCanal(m, c) {
    const conteudoTexto = JSON.stringify(c.conteudo ?? {}, null, 2);
    return `
        <div class="p-3" id="cm-canal-${c.id}" style="background:var(--paper)">
            <div class="flex items-center justify-between gap-2 mb-2">
                <span class="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style="background:var(--info-bg);color:var(--info)">${CM_CANAL_ROTULO[c.canal] || c.canal} · editando</span>
                <button onclick="cmCancelarEdicaoCanal('${m.id}')" class="text-[11px] font-bold" style="color:var(--sage)">Cancelar</button>
            </div>

            ${c.titulo !== null ? `
                <label class="block text-[10px] font-bold uppercase mb-1" style="color:var(--sage)">Título</label>
                <input type="text" id="cm-edit-titulo-${c.id}" value="${cmEscAttr(c.titulo ?? '')}"
                    class="w-full p-2 rounded-lg border-2 text-xs mb-2" style="border-color:var(--line)">
            ` : ''}

            <label class="block text-[10px] font-bold uppercase mb-1" style="color:var(--sage)">Mensagem</label>
            <textarea id="cm-edit-mensagem-${c.id}" rows="4"
                class="w-full p-2 rounded-lg border-2 text-xs mb-2" style="border-color:var(--line)">${cmEscTexto(c.mensagem ?? '')}</textarea>

            <button type="button" onclick="cmAlternarJson('${c.id}')" class="text-[10px] font-bold mb-1" style="color:var(--sage);text-decoration:underline">Conteúdo avançado (JSON — botões, passos etc.)</button>
            <div id="cm-json-${c.id}" class="hidden mb-2">
                <textarea id="cm-edit-conteudo-${c.id}" rows="6"
                    class="w-full p-2 rounded-lg border-2 text-[11px] font-mono" style="border-color:var(--line)">${cmEscTexto(conteudoTexto)}</textarea>
                <p class="text-[10px] mt-1" style="color:var(--sage)">Precisa continuar sendo um JSON válido — se não for, o salvar avisa e não deixa passar.</p>
            </div>

            <p id="cm-edit-erro-${c.id}" class="text-[11px] font-bold mb-2" style="color:var(--danger)"></p>

            <div class="flex gap-2">
                <button type="button" onclick="cmAbrirPreview({id:'${c.id}',canal:'${c.canal}',formato:'${c.formato}'}, true)"
                    class="text-xs font-bold px-3 py-2 rounded-lg" style="background:#fff;color:var(--ink);border:2px solid var(--line)">👁 Simular</button>
                <button type="button" onclick="cmSalvarEdicaoCanal('${m.id}','${c.id}')"
                    class="text-xs font-bold px-3 py-2 rounded-lg flex-1" style="background:var(--pine);color:#fff">Salvar</button>
            </div>
        </div>
    `;
}

function cmAbrirEdicaoCanal(canalId) {
    cmCanalEditandoId = canalId;
    cmRerenderizarMensagens();
}

function cmCancelarEdicaoCanal() {
    cmCanalEditandoId = null;
    cmRerenderizarMensagens();
}

function cmRerenderizarMensagens() {
    document.getElementById('cm-mensagens').innerHTML = cmMensagensDoPlano.map(m => cmLinhaMensagem(m)).join('')
        || `<p class="text-sm" style="color:var(--sage)">Nenhuma mensagem cadastrada neste plano ainda.</p>`;
}

async function cmSalvarEdicaoCanal(comunicacaoId, canalId) {
    const elErro = document.getElementById(`cm-edit-erro-${canalId}`);
    elErro.textContent = '';

    const tituloEl = document.getElementById(`cm-edit-titulo-${canalId}`);
    const titulo = tituloEl ? tituloEl.value.trim() : null;
    const mensagem = document.getElementById(`cm-edit-mensagem-${canalId}`).value;

    let conteudo = null;
    const conteudoEl = document.getElementById(`cm-edit-conteudo-${canalId}`);
    if (conteudoEl) {
        try {
            conteudo = JSON.parse(conteudoEl.value);
        } catch (e) {
            elErro.textContent = 'O conteúdo avançado não é um JSON válido — corrige antes de salvar (ou fecha essa seção sem mexer, se não precisava editar isso).';
            return;
        }
    }

    const { error } = await dbAuth.schema('gestao').rpc('fn_comunicacao_canal_atualizar', {
        p_canal_id: canalId, p_titulo: titulo, p_mensagem: mensagem, p_conteudo: conteudo
    });
    if (error) { elErro.textContent = 'Erro ao salvar: ' + error.message; return; }

    // Atualiza o cache local em vez de recarregar tudo da RPC de novo —
    // resposta imediata, sem esperar round-trip extra.
    const msg = cmMensagensDoPlano.find(m => m.id === comunicacaoId);
    const canal = msg?.canais?.find(c => c.id === canalId);
    if (canal) {
        if (titulo !== null) canal.titulo = titulo;
        canal.mensagem = mensagem;
        if (conteudo !== null) canal.conteudo = conteudo;
    }
    cmCanalEditandoId = null;
    cmRerenderizarMensagens();
}

function cmAlternarJson(id) {
    document.getElementById('cm-json-' + id)?.classList.toggle('hidden');
}

async function cmDefinirStatus(comunicacaoId, status) {
    const { error } = await dbAuth.schema('gestao').rpc('fn_comunicacao_definir_status', { p_comunicacao_id: comunicacaoId, p_status: status });
    if (error) { alert('Erro: ' + error.message); return; }
    const msg = cmMensagensDoPlano.find(m => m.id === comunicacaoId);
    if (msg) msg.status = status;
    cmRerenderizarMensagens();
}

// ============================================================================
// PREVIEW / SIMULAÇÃO — NOVO v0.2.0, pedido explícito: "incluir uma opção
// de ver/simular a msg como ela aparece ou vai aparecer antes de salvar".
//
// cmAbrirPreview() é chamada de 2 lugares (card salvo OU formulário de
// edição, ainda não salvo) — quando `lerDoFormulario` é true, lê os
// valores AO VIVO dos campos em edição em vez do cache, pra refletir o
// que a pessoa está digitando NA HORA.
//
// cmRenderizarPreview() escolhe a maquete pelo par canal+formato —
// reconhece os 3 formatos que já existem em produção hoje (conferido
// direto nos dados reais antes de desenhar, não é chute):
//   - canal=whatsapp, formato=conversa_guiada → bolha de WhatsApp
//   - canal=app, formato=modal (sem conteudo.passos) → modal de app
//   - formato com conteudo.passos → onboarding passo-a-passo
// Formato desconhecido nunca quebra — cai num preview genérico (só o
// texto), com aviso de que é genérico.
// ============================================================================

function cmJsAttr(c) {
    // Serializa só o necessário pro preview em modo leitura (não o objeto
    // inteiro) — evita problema de aspas dentro de onclick="...".
    return `{id:'${c.id}',canal:'${c.canal}',formato:'${c.formato}'}`;
}

function cmAbrirPreview(canalRef, lerDoFormulario) {
    let titulo, mensagem, conteudo, canal = canalRef.canal, formato = canalRef.formato;

    if (lerDoFormulario) {
        const tituloEl = document.getElementById(`cm-edit-titulo-${canalRef.id}`);
        titulo = tituloEl ? tituloEl.value : null;
        mensagem = document.getElementById(`cm-edit-mensagem-${canalRef.id}`).value;
        const conteudoEl = document.getElementById(`cm-edit-conteudo-${canalRef.id}`);
        try {
            conteudo = conteudoEl ? JSON.parse(conteudoEl.value) : {};
        } catch (e) {
            alert('O conteúdo avançado (JSON) tem um erro de sintaxe agora — corrige antes de simular, ou a simulação usa só título/mensagem.');
            conteudo = {};
        }
    } else {
        let canalObj = null;
        for (const m of cmMensagensDoPlano) {
            canalObj = (m.canais || []).find(c => c.id === canalRef.id);
            if (canalObj) break;
        }
        if (!canalObj) return;
        titulo = canalObj.titulo; mensagem = canalObj.mensagem; conteudo = canalObj.conteudo; canal = canalObj.canal; formato = canalObj.formato;
    }

    const overlay = document.createElement('div');
    overlay.id = 'cm-preview-overlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:60;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px';
    overlay.onclick = (ev) => { if (ev.target === overlay) cmFecharPreview(); };
    overlay.innerHTML = `
        <div style="background:#fff;border-radius:20px;max-width:380px;width:100%;max-height:85vh;overflow-y:auto">
            <div class="flex items-center justify-between p-3 border-b" style="border-color:var(--line)">
                <span class="text-xs font-extrabold" style="color:var(--ink)">Como vai aparecer</span>
                <button onclick="cmFecharPreview()" class="text-lg leading-none" style="color:var(--sage)">&times;</button>
            </div>
            <div class="p-4">${cmRenderizarPreview(canal, formato, titulo, mensagem, conteudo)}</div>
        </div>
    `;
    document.body.appendChild(overlay);
}

function cmFecharPreview() {
    document.getElementById('cm-preview-overlay')?.remove();
}

function cmRenderizarPreview(canal, formato, titulo, mensagem, conteudo) {
    conteudo = conteudo || {};

    // Onboarding passo-a-passo (ex.: onboarding_adocao_contrato_v1) —
    // checado ANTES do modal genérico, porque também é canal=app/formato=modal.
    if (Array.isArray(conteudo.passos) && conteudo.passos.length > 0) {
        return `
            <div style="border:2px solid var(--line);border-radius:16px;padding:16px">
                ${titulo ? `<p class="text-sm font-extrabold mb-2" style="color:var(--ink)">${cmEscTexto(titulo)}</p>` : ''}
                ${mensagem ? `<p class="text-xs mb-3" style="color:var(--sage)">${cmEscTexto(mensagem)}</p>` : ''}
                <div class="space-y-3">
                    ${conteudo.passos.map((p, i) => `
                        <div class="flex gap-2.5 items-start">
                            <span class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-none" style="background:var(--pine);color:#fff">${i + 1}</span>
                            <div class="min-w-0">
                                <p class="text-xs font-extrabold" style="color:var(--ink)">${cmEscTexto(p.titulo || '')}</p>
                                <p class="text-xs" style="color:var(--sage)">${cmEscTexto(p.texto || '')}</p>
                            </div>
                        </div>
                    `).join('')}
                </div>
                ${conteudo.acao_final ? `<p class="text-[10px] mt-3" style="color:var(--sage)">Ação final: ${cmEscTexto(conteudo.acao_final)}</p>` : ''}
            </div>
        `;
    }

    // Modal do app (avisos de onboarding/adoção/upsell) — título + mensagem
    // + botões (conteudo.opcoes[].rotulo).
    if (canal === 'app') {
        const opcoes = Array.isArray(conteudo.opcoes) ? conteudo.opcoes : [];
        return `
            <div style="background:var(--paper);border-radius:16px;padding:20px">
                <div style="background:#fff;border-radius:14px;padding:16px;box-shadow:0 4px 16px rgba(0,0,0,.08)">
                    ${titulo ? `<p class="text-sm font-extrabold mb-1.5" style="color:var(--ink)">${cmEscTexto(titulo)}</p>` : ''}
                    <p class="text-xs mb-3" style="color:var(--ink)">${cmEscTexto(mensagem)}</p>
                    ${conteudo.resumo_condicoes ? `<p class="text-[11px] mb-3 p-2 rounded-lg" style="background:var(--warning-bg);color:var(--warning)">${cmEscTexto(conteudo.resumo_condicoes)}</p>` : ''}
                    <div class="space-y-1.5">
                        ${opcoes.length > 0 ? opcoes.map((o, i) => `
                            <div class="text-xs font-bold text-center py-2 rounded-lg" style="background:${i === 0 ? 'var(--pine)' : 'var(--paper)'};color:${i === 0 ? '#fff' : 'var(--ink)'}">${cmEscTexto(o.rotulo || o)}</div>
                        `).join('') : `<div class="text-xs font-bold text-center py-2 rounded-lg" style="background:var(--pine);color:#fff">OK</div>`}
                    </div>
                </div>
            </div>
        `;
    }

    // WhatsApp (conversa_guiada) — bolha verde + opções como lista
    // numerada, igual o bot manda de verdade.
    if (canal === 'whatsapp') {
        const opcoes = Array.isArray(conteudo.opcoes) ? conteudo.opcoes : [];
        const listaOpcoes = opcoes.map((o, i) => `${i + 1}. ${typeof o === 'string' ? o : (o.rotulo || '')}`).join('\n');
        return `
            <div style="background:#e5ddd5;border-radius:16px;padding:16px">
                <div style="background:#dcf8c6;border-radius:10px;border-top-right-radius:2px;padding:10px 12px;max-width:88%;margin-left:auto;box-shadow:0 1px 2px rgba(0,0,0,.1)">
                    <p class="text-xs whitespace-pre-wrap" style="color:#1a1a1a">${cmEscTexto(mensagem)}${listaOpcoes ? '\n\n' + cmEscTexto(listaOpcoes) : ''}</p>
                </div>
            </div>
        `;
    }

    // Formato não reconhecido — nunca quebra, mostra o texto puro com aviso.
    return `
        <p class="text-[10px] font-bold uppercase mb-2" style="color:var(--warning)">Formato "${cmEscTexto(formato)}" não tem maquete própria ainda — prévia genérica:</p>
        <div style="border:2px solid var(--line);border-radius:12px;padding:12px">
            ${titulo ? `<p class="text-xs font-extrabold mb-1" style="color:var(--ink)">${cmEscTexto(titulo)}</p>` : ''}
            <p class="text-xs whitespace-pre-wrap" style="color:var(--ink)">${cmEscTexto(mensagem)}</p>
        </div>
    `;
}
