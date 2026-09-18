// ============================================================================
// js/telas/comunicacoes.js — Raiz Gestão
//
// v0.4.0 (bc9df144, itens 5/6, 17/09/2026) — NOVO 3º modo "Pessoas"
// (cmModo='pessoas', botão "👤 Pessoas" ao lado de Uso/Configuração): migra
// do App (app-dev) o disparo manual de e-mail, a config de envio
// automático (dia01/dia15/ativo) e as preferências de comunicação
// proativa por pessoa. Não confundir com os "planos"/"mensagens" das
// outras 2 abas — são sistemas de comunicação diferentes (aquele é a
// central de marketing/produto; este é config operacional por
// empresa/pessoa). Precisou de 4 RPCs novas (migration
// gestao_comunicacoes_pessoas_v1) porque a RLS de clientes/pessoas/
// pessoa_preferencias_comunicacao não libera leitura/escrita cross-empresa
// pro login de equipe do Gestão (ver comentário completo antes de
// cmPessoasEmpresas, mais abaixo). Disparo manual em si não usa RPC —
// fetch direto pro Apps Script (GOOGLE_API_URL_EMAIL), igual o App já fazia.
//
// v0.3.0 (30/08/2026) — pedido explícito do Nicola: testando a v0.2.0, uma
// mensagem (onboarding_adocao_contrato_v1) não apareceu pra ele numa
// empresa de teste — investigando, a causa era a regra de perfil
// (tipo_regra='perfil', valor ['admin','operador']) não incluir 'master'
// (o perfil dele mesmo, testando). "Queria poder editar o perfil que
// aparecem as msg no app gestão, nas configurações" — em vez de pedir
// migration toda vez que quiser ajustar isso.
//
// Nova seção "Quem vê esta mensagem" (cmSecaoQuemVe), por COMUNICAÇÃO
// (regra é da comunicação inteira, não de 1 canal — ficou visível de
// novo aqui; a reescrita v0.2.0 tinha derrubado a visibilidade de
// `regras` sem querer, ao trocar o "Ver JSON" único por conteúdo
// avançado por canal). Perfil vira checkboxes editáveis (o pedido em si,
// usa cmPerfis carregado de `perfis` no init) + botão "Salvar perfis"
// (fn_comunicacao_regra_perfis_definir, nova). As outras 14 condições
// possíveis (sem_imoveis, dias_sem_uso etc.) ficam como texto legível
// só-leitura — editor próprio pra cada uma é bem mais trabalho do que
// foi pedido agora, registrado como pendência, não escondido.
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
let cmModo = 'uso'; // 'uso' | 'config' | 'pessoas'
let cmCanalEditandoId = null; // id do canal com o form de edição aberto (null = nenhum)
let cmPerfis = []; // NOVO v0.3.0 — {codigo, descricao}, pra montar os checkboxes de "quem vê"

// ----------------------------------------------------------------------------
// v0.4.0 (bc9df144, itens 5/6, 17/09/2026) — 3º modo "Pessoas": comunicações
// por PESSOA de uma empresa (não confundir com os planos/mensagens acima,
// que são a central de marketing/produto). MIGROU do App (app-dev):
// disparo manual de e-mail (dev_dispararEmailManual), envio automático de
// e-mail (dev_verificarStatusEnvioAutomatico/dev_salvarDiasEmail/
// dev_toggleEnvioAutomatico) e as preferências de comunicação proativa por
// pessoa (a mesma seção "Comunicações (avisos automáticos)" que já existe
// em App > Conta > Pessoas via js/comum-pessoas.js).
//
// Achado técnico (verificado direto no banco antes de escrever isto): o
// login do Gestão usa a chave anon normal, e a RLS de clientes/pessoas/
// pessoa_preferencias_comunicacao só libera linhas via meus_clientes()
// (pessoas.user_id = auth.uid()) — a equipe Raiz não tem esse vínculo em
// nenhuma empresa cliente. Por isso as 2 pontas que precisam ler/gravar
// essas tabelas cross-empresa passam por RPC nova (gestao.fn_config_email_
// automatico_obter/_definir, gestao.fn_pessoa_comunicacoes_obter/_definir —
// migration gestao_comunicacoes_pessoas_v1, SECURITY DEFINER, gate
// fn_sou_master(), log em gestao.log_acoes — mesmo padrão de
// fn_pessoas_empresa/fn_gestao_licenca_ajustar). O disparo manual em si
// não precisa de RPC: é um fetch direto pro mesmo Apps Script que o App já
// usava (GOOGLE_API_URL_EMAIL), só trocando quem chama.
//
// Lista de empresas desta seção usa gestao.fn_lista_empresas() (mesma RPC
// que empresas.js já usa) em vez do `cmEmpresas` do modo Uso acima — aquele
// é populado por um SELECT direto em `clientes`, que sofre do MESMO
// problema de RLS descrito acima (só volta algo se a RLS deixar); não
// dependo dele pra não herdar um bug pré-existente que não é desta
// demanda.
let cmPessoasEmpresas = []; // {cliente_id, nome_empresa, ...} — cache próprio, carregado 1x
let cmPessoasClienteId = '';
let cmPessoasLista = []; // pessoas da empresa escolhida (gestao.fn_pessoas_empresa)
let cmPessoaSelecionadaId = '';
let cmEmailCfgAtual = { dia01: 1, dia15: 15, ativo: false }; // snapshot do último render, pra "Salvar dias" não perder o ativo/inativo atual
const GOOGLE_API_URL_EMAIL = "https://script.google.com/macros/s/AKfycbyIcM2uVKmaQqghY6ur-34dfXYCF_9Q7PNeMH9jly8Le_5K-VtxJpj8NivpNBtc1_Kt/exec"; // mesma URL já pública em index.html do App

async function telaComunicacoesInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando Comunicações...</p>`;

    const [{ data: planos, error: e1 }, empresasResp, perfisResp] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_comunicacoes_planos'),
        cmEmpresas.length === 0 ? dbAuth.from('clientes').select('id, nome_empresa').order('nome_empresa') : Promise.resolve({ data: cmEmpresas }),
        cmPerfis.length === 0 ? dbAuth.from('perfis').select('codigo, descricao').order('codigo') : Promise.resolve({ data: cmPerfis })
    ]);
    if (e1) { gestaoErro(e1.message); return; }
    cmPlanos = planos || [];
    if (empresasResp?.data) cmEmpresas = empresasResp.data;
    if (perfisResp?.data) cmPerfis = perfisResp.data;
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
            <button onclick="cmTrocarModo('pessoas')" id="cm-modo-pessoas"
                class="text-xs font-bold px-3 py-1.5 rounded-lg" style="color:var(--sage)">
                👤 Pessoas
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

        <!-- v0.4.0 (bc9df144, itens 5/6) — "Pessoas": por empresa, config de
             e-mail (automático + disparo manual) e avisos proativos por
             pessoa. Ver changelog completo no topo do arquivo. -->
        <div id="cm-area-pessoas" class="hidden">
            <div class="flex flex-col gap-1 mb-4 w-fit">
                <span class="text-[10px] font-bold uppercase" style="color:var(--sage)">Empresa</span>
                <select id="cm-pessoas-empresa" onchange="cmPessoasMudarEmpresa()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line);min-width:240px">
                    <option value="">Carregando empresas...</option>
                </select>
            </div>
            <div id="cm-pessoas-conteudo"></div>
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

// v0.4.0 — generalizado de 2 pra 3 modos (uso/config/pessoas), mesma
// mecânica de sempre (1 área visível, botão ativo em destaque).
function cmAplicarModoNaTela() {
    ['uso', 'config', 'pessoas'].forEach(modo => {
        const ativo = cmModo === modo;
        document.getElementById('cm-area-' + modo).classList.toggle('hidden', !ativo);
        const btn = document.getElementById('cm-modo-' + modo);
        btn.style.background = ativo ? '#fff' : 'transparent';
        btn.style.color = ativo ? 'var(--pine)' : 'var(--sage)';
    });
}

// CORRIGIDO (v0.2.0) — antes buscava as 5 RPCs sempre, mesmo mostrando só
// uma fração dos dados por vez depois do toggle de modo (que nem existia
// ainda). Agora só busca o que o modo ATUAL vai realmente desenhar —
// menos chamada, menos espera, sem trazer dado de configuração toda vez
// que alguém só quer olhar o funil, e vice-versa.
async function cmCarregar() {
    // v0.4.0 — "Pessoas" não depende de plano nenhum (não é sobre a central
    // de marketing/produto) — sai antes de mexer em cm-plano-objetivo.
    if (cmModo === 'pessoas') { cmPessoasCarregar(); return; }

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
                ${cmSecaoQuemVe(m)}
                ${canais.map(c => cmCardCanal(m, c)).join('') || `<p class="text-xs p-3" style="color:var(--sage)">Nenhum canal configurado pra esta mensagem.</p>`}
            </div>
        </div>
    `;
}

const CM_TIPO_REGRA_ROTULO = {
    sem_imoveis: 'Sem imóveis cadastrados', tem_contrato_ou_item_controle: 'Já tem contrato ou item de controle',
    tem_imovel_ou_ativo: 'Tem imóvel ou ativo cadastrado', tem_recebimento_ou_ocorrencia_tratada: 'Tem recebimento/ocorrência tratada',
    dias_desde_cadastro: 'Dias desde o cadastro', dias_sem_uso: 'Dias sem uso', dias_para_expirar_licenca: 'Dias pra expirar a licença',
    contador_login: 'Quantidade de logins', interacoes_desde_nps: 'Interações desde o último NPS',
    nunca_usou_bot: 'Nunca usou o bot', aceita_comunicacao_comercial: 'Aceita comunicação comercial',
    dependencia_mensagem: 'Depende de outra mensagem',
};
const CM_OPERADOR_ROTULO = { eq: '=', gte: '≥', lte: '≤', in: 'em' };

// NOVO v0.3.0 — pedido explícito do Nicola (depois de descobrir, testando,
// que uma mensagem não apareceu pra ele por causa da regra de perfil):
// "queria poder editar o perfil que aparecem as msg". Antes, `regras`
// (as condições de gatilho) tinham sumido de vista na reescrita v0.2.0 —
// só ficaram visíveis por canal (conteúdo avançado), a condição de perfil
// em si não aparecia em lugar nenhum. Esta seção mostra "Quem vê esta
// mensagem" por comunicação (regra é da comunicação inteira, não de 1
// canal): perfil vira checkbox editável (o pedido); as outras condições
// (sem_imoveis, dias_sem_uso etc.) ficam como texto legível só-leitura —
// dar um editor próprio pra cada uma das 14 outras regras é bem mais
// trabalho do que foi pedido agora, então ficou de fora desta rodada.
function cmSecaoQuemVe(m) {
    const regras = m.regras || [];
    const regraPerfil = regras.find(r => r.tipo_regra === 'perfil');
    const perfisAtuais = Array.isArray(regraPerfil?.valor) ? regraPerfil.valor : [];
    const outrasRegras = regras.filter(r => r.tipo_regra !== 'perfil');

    return `
        <div class="p-3" style="background:#fbfaf7">
            <p class="text-[10px] font-bold uppercase mb-1.5" style="color:var(--sage)">Quem vê esta mensagem</p>

            <div class="flex flex-wrap gap-x-3 gap-y-1.5 mb-2" id="cm-perfis-${m.id}">
                ${cmPerfis.map(p => `
                    <label class="flex items-center gap-1.5 text-xs" style="color:var(--ink)" title="${cmEscAttr(p.descricao || '')}">
                        <input type="checkbox" value="${p.codigo}" ${perfisAtuais.includes(p.codigo) ? 'checked' : ''}>
                        ${cmEscTexto(p.codigo)}
                    </label>
                `).join('')}
            </div>
            <div class="flex items-center gap-2 mb-2">
                <button onclick="cmSalvarPerfis('${m.id}')" class="text-[11px] font-bold px-2 py-1 rounded-lg" style="background:var(--pine);color:#fff">Salvar perfis</button>
                <span id="cm-perfis-status-${m.id}" class="text-[11px] font-bold"></span>
            </div>
            ${perfisAtuais.length === 0 ? `<p class="text-[11px] mb-2" style="color:var(--warning)">⚠️ Nenhum perfil marcado ainda — sem isso a mensagem não aparece pra ninguém.</p>` : ''}

            ${outrasRegras.length > 0 ? `
                <p class="text-[10px] font-bold uppercase mt-2 mb-1" style="color:var(--sage)">Outras condições (só leitura por aqui ainda)</p>
                <ul class="text-[11px] space-y-0.5" style="color:var(--ink)">
                    ${outrasRegras.map(r => `<li>${cmEscTexto(CM_TIPO_REGRA_ROTULO[r.tipo_regra] || r.tipo_regra)} ${cmEscTexto(CM_OPERADOR_ROTULO[r.operador] || r.operador)} ${cmEscTexto(JSON.stringify(r.valor))}</li>`).join('')}
                </ul>
            ` : ''}
        </div>
    `;
}

async function cmSalvarPerfis(comunicacaoId) {
    const statusEl = document.getElementById(`cm-perfis-status-${comunicacaoId}`);
    const checkboxes = document.querySelectorAll(`#cm-perfis-${comunicacaoId} input[type="checkbox"]`);
    const perfisEscolhidos = Array.from(checkboxes).filter(c => c.checked).map(c => c.value);

    statusEl.textContent = 'Salvando...';
    statusEl.style.color = 'var(--sage)';

    const { error } = await dbAuth.schema('gestao').rpc('fn_comunicacao_regra_perfis_definir', {
        p_comunicacao_id: comunicacaoId, p_perfis: perfisEscolhidos
    });
    if (error) { statusEl.textContent = 'Erro: ' + error.message; statusEl.style.color = 'var(--danger)'; return; }

    // Atualiza o cache local (regra de perfil pode não ter existido antes
    // — cria ali mesmo, sem esperar recarregar tudo de novo).
    const msg = cmMensagensDoPlano.find(m => m.id === comunicacaoId);
    if (msg) {
        if (!msg.regras) msg.regras = [];
        const regraPerfil = msg.regras.find(r => r.tipo_regra === 'perfil');
        if (regraPerfil) regraPerfil.valor = perfisEscolhidos;
        else msg.regras.push({ tipo_regra: 'perfil', operador: 'in', valor: perfisEscolhidos, grupo_regra: 1 });
    }
    statusEl.textContent = '✓ Salvo';
    statusEl.style.color = 'var(--success)';
    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2500);
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

// ============================================================================
// MODO "PESSOAS" (v0.4.0, bc9df144, itens 5/6, 17/09/2026) — ver changelog
// completo no topo do arquivo (RPCs novas + porquê).
// ============================================================================

// Lazy: só busca a lista de empresas na 1ª vez que a pessoa entra neste
// modo (não no boot da tela toda) — mesmo espírito de cmCarregar() de só
// buscar o que o modo atual precisa.
async function cmPessoasCarregar() {
    const sel = document.getElementById('cm-pessoas-empresa');
    if (!sel) return;
    if (cmPessoasEmpresas.length === 0) {
        const { data, error } = await dbAuth.schema('gestao').rpc('fn_lista_empresas');
        if (error) { sel.innerHTML = '<option value="">Erro ao carregar</option>'; document.getElementById('cm-pessoas-conteudo').innerHTML = `<p class="text-sm" style="color:var(--danger)">Erro ao listar empresas: ${pmEsc(error.message)}</p>`; return; }
        cmPessoasEmpresas = (data || []).slice().sort((a, b) => (a.nome_empresa || '').localeCompare(b.nome_empresa || ''));
    }
    sel.innerHTML = '<option value="">Escolha uma empresa</option>' +
        cmPessoasEmpresas.map(e => `<option value="${e.cliente_id}" ${e.cliente_id === cmPessoasClienteId ? 'selected' : ''}>${pmEsc(e.nome_empresa)}</option>`).join('');
    if (cmPessoasClienteId) cmPessoasRenderConteudo();
}

async function cmPessoasMudarEmpresa() {
    cmPessoasClienteId = document.getElementById('cm-pessoas-empresa').value;
    cmPessoaSelecionadaId = '';
    cmPessoasLista = [];
    await cmPessoasRenderConteudo();
}

async function cmPessoasRenderConteudo() {
    const el = document.getElementById('cm-pessoas-conteudo');
    if (!el) return;
    if (!cmPessoasClienteId) { el.innerHTML = ''; return; }
    el.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;

    const [{ data: pessoas, error: eP }, { data: emailCfg, error: eE }] = await Promise.all([
        dbAuth.schema('gestao').rpc('fn_pessoas_empresa', { p_cliente_id: cmPessoasClienteId }),
        dbAuth.schema('gestao').rpc('fn_config_email_automatico_obter', { p_cliente_id: cmPessoasClienteId }),
    ]);
    if (eP) { el.innerHTML = `<p class="text-sm" style="color:var(--danger)">Erro ao listar pessoas: ${pmEsc(eP.message)}</p>`; return; }
    cmPessoasLista = pessoas || [];
    cmEmailCfgAtual = (emailCfg && emailCfg[0]) || { dia01: 1, dia15: 15, ativo: false };
    if (eE) console.warn('[comunicacoes] Config de e-mail automático indisponível:', eE.message);

    el.innerHTML = `
        <div class="rounded-2xl border-2 p-3 mb-4" style="border-color:var(--line);background:#fff">
            <h4 class="text-sm font-extrabold mb-2" style="color:var(--ink)">Envio automático de e-mails (extrato)</h4>
            <p class="text-[11px] mb-2" style="color:var(--sage)">⚠️ Só guarda a preferência — o disparo de verdade no dia certo depende de um agendador rodando no servidor, que ainda não existe (mesmo aviso que já existia no App).</p>
            <div class="flex flex-wrap gap-2 items-end mb-2">
                <label class="flex flex-col gap-1"><span class="text-[10px] font-bold uppercase" style="color:var(--sage)">Dia 1</span>
                    <input type="number" min="1" max="28" id="cm-email-dia01" value="${cmEmailCfgAtual.dia01 ?? 1}" class="p-2 border-2 rounded-lg text-xs w-20" style="border-color:var(--line)"></label>
                <label class="flex flex-col gap-1"><span class="text-[10px] font-bold uppercase" style="color:var(--sage)">Dia 2</span>
                    <input type="number" min="1" max="28" id="cm-email-dia15" value="${cmEmailCfgAtual.dia15 ?? 15}" class="p-2 border-2 rounded-lg text-xs w-20" style="border-color:var(--line)"></label>
                <button onclick="cmSalvarConfigEmail()" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Salvar dias</button>
                <button onclick="cmToggleEmailAutomatico()" class="text-xs font-bold px-3 py-2 rounded-lg" style="background:${cmEmailCfgAtual.ativo ? '#fee2e2' : '#dcfce7'};color:${cmEmailCfgAtual.ativo ? 'var(--danger)' : 'var(--success)'}">${cmEmailCfgAtual.ativo ? '🔴 Desativar' : '🟢 Ativar'}</button>
            </div>
            <p id="cm-email-status" class="text-[11px] font-bold"></p>
        </div>

        <div class="flex flex-col gap-1 mb-4 w-fit">
            <span class="text-[10px] font-bold uppercase" style="color:var(--sage)">Pessoa</span>
            <select id="cm-pessoa-select" onchange="cmPessoaMudarSelecionada()" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line);min-width:220px">
                <option value="">Escolha uma pessoa</option>
                ${cmPessoasLista.map(p => `<option value="${p.pessoa_id}">${pmEsc(p.nome)}</option>`).join('')}
            </select>
            ${cmPessoasLista.length === 0 ? `<span class="text-[11px]" style="color:var(--sage)">Esta empresa não tem pessoa cadastrada ainda.</span>` : ''}
        </div>

        <div id="cm-pessoa-bloco" class="hidden">
            <div class="rounded-2xl border-2 p-3 mb-4" style="border-color:var(--line);background:#fff">
                <h4 class="text-sm font-extrabold mb-1" style="color:var(--ink)">Disparo manual de e-mail</h4>
                <p id="cm-email-disparo-nome" class="text-[11px] mb-2" style="color:var(--sage)"></p>
                <div class="flex flex-wrap gap-2 items-end">
                    <label class="flex flex-col gap-1"><span class="text-[10px] font-bold uppercase" style="color:var(--sage)">Tipo</span>
                        <select id="cm-email-tipo" class="text-xs font-bold p-2 rounded-lg border-2" style="border-color:var(--line)">
                            <option value="extrato_mensal">Extrato mensal</option>
                            <option value="boas_vindas">Boas-vindas</option>
                        </select>
                    </label>
                    <button onclick="cmDispararEmailManual()" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Disparar</button>
                </div>
                <p id="cm-email-disparo-status" class="text-[11px] font-bold mt-2"></p>
                <p class="text-[10px] mt-1" style="color:var(--sage)">Lista de tipos provisória — confirme os códigos de rota aceitos pelo Apps Script antes de usar em produção pra valer.</p>
            </div>

            <div class="rounded-2xl border-2 p-3" style="border-color:var(--line);background:#fff">
                <h4 class="text-sm font-extrabold mb-2" style="color:var(--ink)">Avisos automáticos (avisos proativos)</h4>
                <div id="cm-pessoa-comunicacoes-lista"></div>
            </div>
        </div>
    `;
}

function cmPessoaMudarSelecionada() {
    cmPessoaSelecionadaId = document.getElementById('cm-pessoa-select').value;
    const bloco = document.getElementById('cm-pessoa-bloco');
    if (!cmPessoaSelecionadaId) { bloco.classList.add('hidden'); return; }
    bloco.classList.remove('hidden');
    const p = cmPessoasLista.find(x => x.pessoa_id === cmPessoaSelecionadaId);
    document.getElementById('cm-email-disparo-nome').textContent = p
        ? (p.email ? `Enviando para: ${p.email}` : '⚠️ Esta pessoa não tem e-mail cadastrado.')
        : '';
    document.getElementById('cm-email-disparo-status').textContent = '';
    cmCarregarComunicacoesPessoa();
}

async function cmCarregarComunicacoesPessoa() {
    const el = document.getElementById('cm-pessoa-comunicacoes-lista');
    if (!el) return;
    el.innerHTML = '<p class="text-xs" style="color:var(--sage)">Carregando...</p>';
    const { data, error } = await dbAuth.schema('gestao').rpc('fn_pessoa_comunicacoes_obter', { p_pessoa_id: cmPessoaSelecionadaId });
    if (error) { el.innerHTML = `<p class="text-xs" style="color:var(--danger)">${pmEsc(error.message)}</p>`; return; }
    const proativas = data || [];
    if (proativas.length === 0) {
        el.innerHTML = `<p class="text-xs" style="color:var(--sage)">Esta empresa não tem nenhum aviso automático liberado na licença.</p>`;
        return;
    }
    const opcoesFreq = ['diario', 'semanal', 'quinzenal', 'mensal', 'trimestral'];
    el.innerHTML = proativas.map(f => `
        <div class="flex items-start justify-between gap-2 py-1.5 border-t" style="border-color:var(--line)">
            <label class="flex items-start gap-1.5 text-xs flex-1 min-w-0" style="color:var(--ink)">
                <input type="checkbox" class="cm-pref-habilitado mt-0.5" data-codigo="${f.funcionalidade_codigo}" ${f.habilitado ? 'checked' : ''}>
                <span>${cmEscTexto(f.descricao)}</span>
            </label>
            <select class="cm-pref-frequencia text-[11px] border-2 rounded px-1 py-1 flex-none" style="border-color:var(--line)" data-codigo="${f.funcionalidade_codigo}">
                ${opcoesFreq.map(v => `<option value="${v}" ${f.frequencia === v ? 'selected' : ''}>${v}</option>`).join('')}
            </select>
        </div>`).join('') +
        `<button onclick="cmSalvarComunicacoesPessoa()" class="mt-2 text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Salvar avisos</button>
         <span id="cm-pref-status" class="text-[11px] font-bold ml-2"></span>`;
}

async function cmSalvarComunicacoesPessoa() {
    const status = document.getElementById('cm-pref-status');
    const container = document.getElementById('cm-pessoa-comunicacoes-lista');
    const preferencias = Array.from(container.querySelectorAll('.cm-pref-habilitado')).map(chk => {
        const codigo = chk.dataset.codigo;
        const freqEl = container.querySelector(`.cm-pref-frequencia[data-codigo="${codigo}"]`);
        return { codigo, habilitado: chk.checked, frequencia: freqEl ? freqEl.value : 'semanal' };
    });
    status.textContent = 'Salvando...'; status.style.color = 'var(--sage)';
    const { error } = await dbAuth.schema('gestao').rpc('fn_pessoa_comunicacoes_definir', {
        p_pessoa_id: cmPessoaSelecionadaId, p_preferencias: preferencias
    });
    if (error) { status.textContent = 'Erro: ' + error.message; status.style.color = 'var(--danger)'; return; }
    status.textContent = '✓ Salvo'; status.style.color = 'var(--success)';
    setTimeout(() => { if (status) status.textContent = ''; }, 2500);
}

async function cmSalvarConfigEmail() {
    const status = document.getElementById('cm-email-status');
    const dia01 = parseInt(document.getElementById('cm-email-dia01').value, 10);
    const dia15 = parseInt(document.getElementById('cm-email-dia15').value, 10);
    status.textContent = 'Salvando...'; status.style.color = 'var(--sage)';
    const { error } = await dbAuth.schema('gestao').rpc('fn_config_email_automatico_definir', {
        p_cliente_id: cmPessoasClienteId, p_dia01: dia01, p_dia15: dia15, p_ativo: cmEmailCfgAtual.ativo
    });
    if (error) { status.textContent = 'Erro: ' + error.message; status.style.color = 'var(--danger)'; return; }
    cmEmailCfgAtual.dia01 = dia01;
    cmEmailCfgAtual.dia15 = dia15;
    status.textContent = '✓ Dias salvos.'; status.style.color = 'var(--success)';
}

async function cmToggleEmailAutomatico() {
    const dia01 = parseInt(document.getElementById('cm-email-dia01').value, 10) || cmEmailCfgAtual.dia01 || 1;
    const dia15 = parseInt(document.getElementById('cm-email-dia15').value, 10) || cmEmailCfgAtual.dia15 || 15;
    const novoValor = !cmEmailCfgAtual.ativo;
    const { error } = await dbAuth.schema('gestao').rpc('fn_config_email_automatico_definir', {
        p_cliente_id: cmPessoasClienteId, p_dia01: dia01, p_dia15: dia15, p_ativo: novoValor
    });
    if (error) { alert('Erro: ' + error.message); return; }
    cmPessoasRenderConteudo();
}

// v0.4.0 — mesmo fetch direto que dev_dispararEmailManual() já fazia no
// App (Apps Script legado, fora do Supabase) — só troca quem chama.
async function cmDispararEmailManual() {
    const status = document.getElementById('cm-email-disparo-status');
    const p = cmPessoasLista.find(x => x.pessoa_id === cmPessoaSelecionadaId);
    const tipo = document.getElementById('cm-email-tipo').value;
    if (!p) { status.textContent = 'Escolha uma pessoa.'; status.style.color = 'var(--danger)'; return; }
    if (!p.email || !p.email.includes('@')) { status.textContent = 'Esta pessoa não tem e-mail válido cadastrado.'; status.style.color = 'var(--danger)'; return; }
    status.textContent = 'Disparando...'; status.style.color = 'var(--sage)';
    try {
        const resp = await fetch(GOOGLE_API_URL_EMAIL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ rota: 'dev_email_manual', tipo, destino: p.email, nomeSimulado: p.nome || 'Pessoa' })
        });
        const corpo = await resp.json();
        if (corpo && corpo.status === 'sucesso') {
            status.textContent = '✅ E-mail disparado para ' + p.email;
            status.style.color = 'var(--success)';
        } else {
            status.textContent = '⚠️ Erro ao disparar: ' + (corpo?.mensagem || 'desconhecido');
            status.style.color = 'var(--danger)';
        }
    } catch (err) {
        status.textContent = '❌ Falha de conexão.';
        status.style.color = 'var(--danger)';
    }
}
