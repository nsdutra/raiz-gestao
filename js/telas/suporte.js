// ============================================================================
// js/telas/suporte.js — Raiz Gestão
// Versão: 0.1.0 · 13/09/2026
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
let supClienteId = null; // null até o primeiro load — cai na Matriz por padrão
let supSubtipos = ['produto'];
let supSituacao = 'abertas';
let supBusca = '';
let supDemandaAtual = null; // id da demanda aberta na ficha, ou null = lista

const SUP_MATRIZ_NOME = 'RAIZ PATRIMONIO MATRIZ';

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
        const matriz = supEmpresas.find(e => e.nome_empresa === SUP_MATRIZ_NOME);
        supClienteId = matriz ? matriz.id : (supEmpresas[0]?.id || null);
    }

    if (supDemandaAtual) await supRenderFicha();
    else await supRenderLista();
}

// ----------------------------------------------------------------------------
// LISTA
// ----------------------------------------------------------------------------
async function supRenderLista() {
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

        <div class="grid grid-cols-3 gap-2 mb-3">
            ${gestaoCardMetrica('Abertas', c.abertas ?? 0, 'ink')}
            ${gestaoCardMetrica('Atrasadas', c.atrasadas ?? 0, (c.atrasadas > 0 ? 'red' : 'ink'))}
            ${gestaoCardMetrica('Vencendo', c.vencendo ?? 0, (c.vencendo > 0 ? 'amber' : 'ink'))}
        </div>

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
            ${chipSituacao('todas', 'Todas')}
            ${chipSituacao('encerradas', 'Encerradas')}
        </div>

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
        const corSit = d.situacao === 'atrasada' ? 'var(--danger)' : d.situacao === 'vencendo' ? 'var(--warning)' : 'var(--sage)';
        const rotuloSit = { atrasada: 'Atrasada', vencendo: 'Vencendo', sem_prazo: 'Sem prazo', aberta: 'Aberta', encerrada: 'Encerrada' }[d.situacao] || d.situacao;
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
                <span class="text-[10px] font-bold px-1.5 py-0.5 rounded flex-none" style="background:${d.ativo ? 'var(--success-bg)' : '#eee'};color:${d.ativo ? 'var(--success)' : 'var(--sage)'}">${d.ativo ? 'Aberta' : 'Encerrada'}</span>
            </div>
            <p class="text-xs mt-1" style="color:var(--sage)">${supEsc(d.subtipo_nome)} · ${supEsc(d.cliente_nome)} · criada em ${new Date(d.criado_em).toLocaleDateString('pt-BR')}</p>
            ${d.descricao ? `<p class="text-sm mt-2" style="color:var(--ink)">${supEsc(d.descricao)}</p>` : ''}
            <div class="flex gap-1.5 mt-3">
                ${d.ativo
                    ? `<button onclick="supEncerrar()" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2" style="border-color:var(--danger);color:var(--danger)">Encerrar</button>`
                    : `<button onclick="supReabrir()" class="text-xs font-bold px-3 py-1.5 rounded-lg border-2" style="border-color:var(--line);color:var(--ink)">Reabrir</button>`}
            </div>
        </div>

        ${d.ativo ? `
        <div class="p-3 rounded-xl border-2 mb-3" style="border-color:var(--line);background:#fff">
            <p class="text-xs font-bold mb-1.5" style="color:var(--ink)">Registrar acompanhamento</p>
            <textarea id="sup-novo-acomp" rows="2" placeholder="O que aconteceu ou o que foi feito..."
                class="w-full text-xs p-2 rounded-lg border-2" style="border-color:var(--line)"></textarea>
            <button onclick="supRegistrarAcompanhamento()" class="mt-1.5 text-xs font-bold px-3 py-1.5 rounded-lg text-white" style="background:var(--pine)">Registrar</button>
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
}

function supRotuloAcao(acao) {
    return {
        criar: 'Criada', encerrar: 'Encerrada', reabrir: 'Reaberta', concluir: 'Acompanhamento concluído',
        cancelar: 'Acompanhamento cancelado', atualizar: 'Atualizada', acompanhamento: 'Acompanhamento',
    }[acao] || acao;
}

async function supRegistrarAcompanhamento() {
    const campo = document.getElementById('sup-novo-acomp');
    const texto = campo.value.trim();
    if (!texto) return;
    const { data, error } = await dbAuth.rpc('fn_demanda_acompanhamento_criar', {
        p_item_id: supDemandaAtual, p_data: new Date().toISOString().slice(0, 10), p_descricao: texto,
        p_alerta: true, p_chave_idempotencia: null, p_pessoa_id: null, p_canal: null,
    });
    if (error) { alert('Erro: ' + error.message); return; }
    if (!data.ok) { alert(data.mensagem || 'Não foi possível registrar.'); return; }
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
