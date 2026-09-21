// ============================================================================
// js/telas/alertas.js — Raiz Gestão
// Versão: 1.0.0 · 20/09/2026
//
// v1.0.0 — Entrega AL.4 do PLANO_IMPLEMENTACAO_RESULTADOS_MERCADO_FISCAL
// v2.0.0 ("Raiz Gestão: catálogo configurável de alertas"). Nova tela no
// PM_HUB com duas seções:
//
//   1) Catálogo de alertas (public.alerta_tipos) — lista todo tipo de
//      alerta que o motor central (Fase AL) conhece, com edição do que é
//      seguro e de fato consumido em runtime. NÃO é CRUD completo: os tipos
//      de alerta nascem por migração (são "regra de disparo" definida em
//      código — dominio, entidade_tipo, natureza, destino_rota, acao_tipo —
//      não faz sentido master criar um tipo novo por aqui sem o código que
//      o dispara existir). Por isso só existe edição, nunca criação/exclusão.
//
//      Campos editáveis (auditados 1 a 1 contra quem realmente lê cada
//      coluna, em public/gestao E no repo raiz-edge-functions, antes de
//      expor qualquer coisa — ver nota QUA-01 na demanda): ativo,
//      severidade, antecedencia_padrao_dias, agrupamento,
//      agrupar_a_partir_de, max_diario. Ficaram DE FORA por não terem
//      nenhum consumidor hoje (colunas "parecem config" mas mortas):
//      janela_exibicao_dias, repeticao_padrao_dias, proativo_elegivel,
//      modo_envio_padrao, exposto_ao_usuario, padrao_habilitado,
//      padrao_frequencia. Se um dia ganharem consumidor, entram aqui junto
//      com o código que passa a lê-las (mesma regra, não expor campo morto).
//
//   2) Informativos fiscais (public.informativos) — aqui sim CRUD completo
//      (criar + editar), porque cada linha é conteúdo publicado (uma
//      orientação, um indicador, uma notícia), não uma regra de sistema.
//      Sem exclusão ainda: só existe fn_informativo_upsert (criar/editar) —
//      apagar por ora é "desativar" (ativo=false), que já esconde da leitura
//      funcional (fn_informativos_aplicaveis não filtra por ativo hoje, mas
//      a listagem desta tela deixa claro o estado). Exclusão de verdade
//      fica pra entrega futura, se for pedida.
//
// RPCs (todas em gestao_alertas_crud_v1, schema gestao, master-only,
// logadas em gestao.log_acoes — mesmo padrão de fn_editar_perfil):
//   gestao.fn_alertas_listar_catalogo()
//   gestao.fn_alerta_tipo_atualizar(p_codigo, p_ativo, p_severidade,
//     p_antecedencia_padrao_dias, p_agrupamento, p_agrupar_a_partir_de,
//     p_max_diario)
//   gestao.fn_informativo_upsert(p_id, p_tipo, p_titulo, p_codigo, p_texto,
//     p_resumo_compartilhar, p_selo, p_quem_afeta, p_fonte_nome,
//     p_fonte_url, p_publicado_em, p_vigencia_inicio, p_vigencia_fim,
//     p_versao_interpretacao, p_ativo)
//
// Leitura de informativos é direto por dbAuth.from('informativos') — RLS
// (informativos_leitura) já permite SELECT pra qualquer authenticated, sem
// precisar de RPC pra isso (só escrita passa por RPC, por LOG-01).
//
// Estrutura e helpers compartilhados seguem conciliacao-catalogo.js (tela
// simples, própria, prefixo az*) e o padrão de formulário inline de
// pmRenderCategorias/pmFormCategoria em parametros-master.js (pmBotaoToggle,
// pmIconeEditar, pmIconeExcluir, pmVazio, pmEsc reaproveitados — carregados
// antes deste arquivo no index.html).
// ============================================================================

const AZ_VERSAO = '1.0.0';

let azCatalogo = [];
let azInformativos = [];
let azCatalogoEditCodigo = null;
let azInformativoEditId = null;

const AZ_SEVERIDADES = ['informativo', 'atencao', 'critico'];
const AZ_AGRUPAMENTOS = ['por_alerta', 'por_tipo', 'por_entidade'];
const AZ_INFORMATIVO_TIPOS = ['orientacao_tributaria', 'calendario', 'indicador', 'noticia'];

function azEsc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

const AZ_SEVERIDADE_COR = {
    informativo: { bg: '#f1f5f9', fg: '#64748b' },
    atencao: { bg: '#fef3c7', fg: '#92400e' },
    critico: { bg: '#fee2e2', fg: '#991b1b' },
};

// ---------------------------------------------------------------- ENTRADA
async function telaAlertasCatalogoInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="mb-1">
            <h1 class="text-lg font-extrabold" style="color:var(--ink)">Alertas</h1>
            <p class="text-xs" style="color:var(--sage)">Catálogo de tipos de alerta do motor central e informativos fiscais publicados — globais, valem pra todas as empresas.</p>
        </div>
        <div id="az-conteudo" class="mt-3"><p class="text-xs" style="color:var(--sage)">Carregando…</p></div>`;
    await azCarregarTudo();
}

async function azCarregarTudo() {
    const cont = document.getElementById('az-conteudo');
    try {
        if (typeof dbAuth === 'undefined') throw new Error('cliente Supabase (dbAuth) não disponível nesta tela.');
        const [rCat, rInf] = await Promise.all([
            dbAuth.schema('gestao').rpc('fn_alertas_listar_catalogo'),
            dbAuth.from('informativos').select('*').order('publicado_em', { ascending: false, nullsFirst: false }),
        ]);
        if (rCat.error) throw new Error(rCat.error.message);
        if (rInf.error) throw new Error(rInf.error.message);
        azCatalogo = rCat.data || [];
        azInformativos = rInf.data || [];
    } catch (err) {
        cont.innerHTML = `
            <div class="p-4 rounded-xl text-xs" style="background:#fee2e2;color:#991b1b">
                Não consegui carregar: ${azEsc(err.message || String(err))}<br>
                Se o erro for de permissão, confira se sua conta está em <b>plataforma_operadores</b> — esta tela só é acessível pelo operador da plataforma.
            </div>`;
        return;
    }
    azRenderConteudo();
}

function azRenderConteudo() {
    const cont = document.getElementById('az-conteudo');
    const ativos = azCatalogo.filter(t => t.ativo).length;
    const infAtivos = azInformativos.filter(i => i.ativo).length;
    cont.innerHTML = `
        <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            ${gestaoCardMetrica('Tipos de alerta', azCatalogo.length, null, 'public.alerta_tipos — regra de disparo definida em código; aqui só se ajusta comportamento.')}
            ${gestaoCardMetrica('Tipos ativos', ativos, ativos < azCatalogo.length ? 'amber' : null, 'Tipo inativo não é considerado por fn_alertas_listar.')}
            ${gestaoCardMetrica('Informativos', azInformativos.length, null, 'public.informativos — conteúdo publicado (orientação, calendário, indicador, notícia).')}
            ${gestaoCardMetrica('Informativos ativos', infAtivos, infAtivos < azInformativos.length ? 'amber' : null, 'Informativo inativo fica fora de fn_informativos_aplicaveis.')}
        </div>
        <div id="az-catalogo-secao" class="mb-6"></div>
        <div id="az-informativos-secao"></div>
    `;
    azRenderCatalogo();
    azRenderInformativos();
}

// ============================================================================
// SEÇÃO 1 — CATÁLOGO DE ALERTAS (public.alerta_tipos) — só edição
// ============================================================================

function azRenderCatalogo() {
    const c = document.getElementById('az-catalogo-secao');
    azCatalogoEditCodigo = null;
    const porDominio = {};
    azCatalogo.forEach(t => { (porDominio[t.dominio] = porDominio[t.dominio] || []).push(t); });
    c.innerHTML = `
        <p class="text-sm font-bold mb-1" style="color:var(--ink)">Catálogo de alertas</p>
        <p class="text-xs mb-3" style="color:var(--sage)">Tipo de alerta é definido em código (dominio, entidade, natureza, ação) — aqui só se ajusta severidade, antecedência e agrupamento. Clique numa linha pra editar.</p>
        <div id="form-az-catalogo-wrapper" class="hidden mb-4"></div>
        <div class="space-y-3">
            ${Object.keys(porDominio).sort().map(dom => `
                <div>
                    <p class="text-[11px] font-bold uppercase tracking-wide mb-1" style="color:var(--sage)">${azEsc(dom)}</p>
                    <div class="space-y-1.5">
                        ${porDominio[dom].map(t => {
                            const cor = AZ_SEVERIDADE_COR[t.severidade] || AZ_SEVERIDADE_COR.informativo;
                            return `
                            <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300 cursor-pointer" onclick="azAbrirEdicaoCatalogo('${t.codigo}')">
                                <div class="min-w-0">
                                    <p class="text-sm font-medium truncate" style="color:var(--ink)">${azEsc(t.nome || t.codigo)} <span class="font-mono text-[10px]" style="color:var(--sage)">${azEsc(t.codigo)}</span></p>
                                    <p class="text-xs" style="color:var(--sage)">${azEsc(t.entidade_tipo)} · ${azEsc(t.natureza)} · agrupa: ${azEsc(t.agrupamento)}${t.antecedencia_padrao_dias != null ? ' · antecedência: ' + t.antecedencia_padrao_dias + 'd' : ''}${t.max_diario != null ? ' · teto/dia: ' + t.max_diario : ''}</p>
                                </div>
                                <div class="flex items-center gap-2 flex-none">
                                    <span class="rz-badge" style="background:${cor.bg};color:${cor.fg}">${azEsc(t.severidade)}</span>
                                    <span class="rz-badge" style="background:${t.ativo ? '#dcfce7' : '#f1f5f9'};color:${t.ativo ? '#166534' : '#64748b'}">${t.ativo ? 'ativo' : 'inativo'}</span>
                                    ${pmIconeEditar()}
                                </div>
                            </div>`;
                        }).join('')}
                    </div>
                </div>
            `).join('') || pmVazio('Nenhum tipo de alerta cadastrado ainda.')}
        </div>
    `;
}

function azFormCatalogo(t) {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div class="grid grid-cols-2 gap-3 text-xs" style="color:var(--sage)">
                <p><span class="font-bold" style="color:var(--ink)">Código:</span> <span class="font-mono">${azEsc(t.codigo)}</span></p>
                <p><span class="font-bold" style="color:var(--ink)">Domínio:</span> ${azEsc(t.dominio)}</p>
                <p><span class="font-bold" style="color:var(--ink)">Entidade:</span> ${azEsc(t.entidade_tipo)}</p>
                <p><span class="font-bold" style="color:var(--ink)">Natureza:</span> ${azEsc(t.natureza)}</p>
                <p><span class="font-bold" style="color:var(--ink)">Destino:</span> ${azEsc(t.destino_rota || '—')}</p>
                <p><span class="font-bold" style="color:var(--ink)">Ação sugerida:</span> ${azEsc(t.acao_sugerida || '—')}</p>
            </div>
            <hr style="border-color:var(--line)">
            <div class="flex items-center gap-2">
                <input type="checkbox" id="az-cat-ativo" ${t.ativo ? 'checked' : ''} class="w-4 h-4">
                <label for="az-cat-ativo" class="text-xs font-bold text-gray-600">Ativo (considerado por fn_alertas_listar)</label>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Severidade <span style="color:var(--danger)">*</span></label>
                <select id="az-cat-severidade" required class="w-full p-2 border rounded mt-1 text-sm">
                    ${AZ_SEVERIDADES.map(s => `<option value="${s}" ${t.severidade === s ? 'selected' : ''}>${s}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Antecedência padrão (dias) — usado só quando o item não tem prazo próprio</label>
                <input type="number" min="0" id="az-cat-antecedencia" value="${t.antecedencia_padrao_dias ?? ''}" placeholder="deixe em branco se não se aplica" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Agrupamento <span style="color:var(--danger)">*</span></label>
                <select id="az-cat-agrupamento" required class="w-full p-2 border rounded mt-1 text-sm">
                    ${AZ_AGRUPAMENTOS.map(a => `<option value="${a}" ${t.agrupamento === a ? 'selected' : ''}>${a}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Agrupar a partir de (qtd mínima) <span style="color:var(--danger)">*</span></label>
                <input type="number" min="2" id="az-cat-agrupar-de" value="${t.agrupar_a_partir_de ?? 2}" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Teto diário (envios do bot por cliente/dia) — em branco = usa o padrão geral do bot</label>
                <input type="number" min="1" id="az-cat-max-diario" value="${t.max_diario ?? ''}" placeholder="ex.: 6" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div class="flex gap-2">
                <button onclick="azSalvarCatalogo()" id="az-cat-btn-salvar" class="flex-1 text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar alterações</button>
                <button onclick="azFecharFormCatalogo()" class="px-4 py-2.5 rounded-lg text-sm font-bold border" style="border-color:var(--line);color:var(--sage)">Cancelar</button>
            </div>
            <p id="az-cat-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function azAbrirEdicaoCatalogo(codigo) {
    const t = azCatalogo.find(x => x.codigo === codigo);
    if (!t) return;
    azCatalogoEditCodigo = codigo;
    const wrapper = document.getElementById('form-az-catalogo-wrapper');
    wrapper.classList.remove('hidden');
    wrapper.innerHTML = azFormCatalogo(t);
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function azFecharFormCatalogo() {
    azCatalogoEditCodigo = null;
    const wrapper = document.getElementById('form-az-catalogo-wrapper');
    wrapper.classList.add('hidden');
    wrapper.innerHTML = '';
}

async function azSalvarCatalogo() {
    const codigo = azCatalogoEditCodigo;
    if (!codigo) return;
    const status = document.getElementById('az-cat-status');
    const ativo = document.getElementById('az-cat-ativo').checked;
    const severidade = document.getElementById('az-cat-severidade').value;
    const antecedenciaRaw = document.getElementById('az-cat-antecedencia').value;
    const antecedencia = antecedenciaRaw === '' ? null : Number(antecedenciaRaw);
    const agrupamento = document.getElementById('az-cat-agrupamento').value;
    const agruparDe = Number(document.getElementById('az-cat-agrupar-de').value);
    const maxDiarioRaw = document.getElementById('az-cat-max-diario').value;
    const maxDiario = maxDiarioRaw === '' ? null : Number(maxDiarioRaw);

    if (!agruparDe || agruparDe < 2) { status.textContent = 'Agrupar a partir de precisa ser 2 ou mais.'; return; }

    status.textContent = 'Salvando…';
    const { error } = await dbAuth.schema('gestao').rpc('fn_alerta_tipo_atualizar', {
        p_codigo: codigo, p_ativo: ativo, p_severidade: severidade,
        p_antecedencia_padrao_dias: antecedencia, p_agrupamento: agrupamento,
        p_agrupar_a_partir_de: agruparDe, p_max_diario: maxDiario,
    });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    azFecharFormCatalogo();
    await azCarregarTudo();
}

// ============================================================================
// SEÇÃO 2 — INFORMATIVOS FISCAIS (public.informativos) — criar + editar
// ============================================================================

function azRenderInformativos() {
    const c = document.getElementById('az-informativos-secao');
    azInformativoEditId = null;
    c.innerHTML = `
        <div class="flex items-center justify-between mb-1">
            <p class="text-sm font-bold" style="color:var(--ink)">Informativos fiscais</p>
            ${pmBotaoToggle('az-informativo-form', 'azAbrirNovoInformativo()')}
        </div>
        <p class="text-xs mb-3" style="color:var(--sage)">Conteúdo publicado pra clientes conforme regime/perfil (public.informativos → fn_informativos_aplicaveis). Sem exclusão ainda — pra tirar de circulação, desative.</p>
        <div id="form-az-informativo-wrapper" class="hidden mb-4"></div>
        <div class="space-y-1.5">
            ${azInformativos.map(i => `
                <div class="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-xl border-2 border-slate-300 cursor-pointer" onclick="azAbrirEdicaoInformativo('${i.id}')">
                    <div class="min-w-0">
                        <p class="text-sm font-medium truncate" style="color:var(--ink)">${azEsc(i.titulo)}${i.selo ? ' · <span class="rz-badge" style="background:#fef3c7;color:#92400e">' + azEsc(i.selo) + '</span>' : ''}</p>
                        <p class="text-xs" style="color:var(--sage)">${azEsc(i.tipo)}${i.codigo ? ' · ' + azEsc(i.codigo) : ''}${i.publicado_em ? ' · publicado ' + azEsc(i.publicado_em) : ''}</p>
                    </div>
                    <div class="flex items-center gap-2 flex-none">
                        <span class="rz-badge" style="background:${i.ativo ? '#dcfce7' : '#fee2e2'};color:${i.ativo ? '#166534' : '#991b1b'}">${i.ativo ? 'ativo' : 'inativo'}</span>
                        ${pmIconeEditar()}
                    </div>
                </div>
            `).join('') || pmVazio('Nenhum informativo publicado ainda.')}
        </div>
    `;
}

function azFormInformativo(i) {
    const quemAfetaTexto = i && i.quem_afeta ? JSON.stringify(i.quem_afeta, null, 2) : '';
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Tipo <span style="color:var(--danger)">*</span></label>
                <select id="az-inf-tipo" required class="w-full p-2 border rounded mt-1 text-sm">
                    ${AZ_INFORMATIVO_TIPOS.map(t => `<option value="${t}" ${i && i.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Título <span style="color:var(--danger)">*</span></label>
                <input type="text" id="az-inf-titulo" required value="${azEsc(i ? i.titulo : '')}" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Código (opcional, ex.: referência interna)</label>
                <input type="text" id="az-inf-codigo" value="${azEsc(i ? (i.codigo || '') : '')}" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Texto completo</label>
                <textarea id="az-inf-texto" rows="4" class="w-full p-2 border rounded mt-1 text-sm">${azEsc(i ? (i.texto || '') : '')}</textarea>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Resumo pra compartilhar (bot/WhatsApp)</label>
                <textarea id="az-inf-resumo" rows="2" class="w-full p-2 border rounded mt-1 text-sm">${azEsc(i ? (i.resumo_compartilhar || '') : '')}</textarea>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Selo (ex.: "novidade", "prazo curto")</label>
                <input type="text" id="az-inf-selo" value="${azEsc(i ? (i.selo || '') : '')}" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Quem afeta (JSON — chaves aceitas: regime_tributario, papel_na_locacao, natureza)</label>
                <textarea id="az-inf-quem-afeta" rows="3" placeholder='ex.: {"regime_tributario": ["lucro_presumido"]}' class="w-full p-2 border rounded mt-1 text-sm font-mono">${azEsc(quemAfetaTexto)}</textarea>
                <p class="text-[10px] mt-1" style="color:var(--sage)">Em branco = aplica a todo mundo (fn_informativos_aplicaveis não filtra por esse campo se ele for nulo).</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Fonte (nome)</label>
                    <input type="text" id="az-inf-fonte-nome" value="${azEsc(i ? (i.fonte_nome || '') : '')}" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Fonte (URL)</label>
                    <input type="url" id="az-inf-fonte-url" value="${azEsc(i ? (i.fonte_url || '') : '')}" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
            </div>
            <div class="grid grid-cols-3 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Publicado em</label>
                    <input type="date" id="az-inf-publicado" value="${i && i.publicado_em ? i.publicado_em : ''}" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Vigência início</label>
                    <input type="date" id="az-inf-vig-inicio" value="${i && i.vigencia_inicio ? i.vigencia_inicio : ''}" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">Vigência fim</label>
                    <input type="date" id="az-inf-vig-fim" value="${i && i.vigencia_fim ? i.vigencia_fim : ''}" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Versão da interpretação (controle interno, ex.: "IN 2126 v1")</label>
                <input type="text" id="az-inf-versao" value="${azEsc(i ? (i.versao_interpretacao || '') : '')}" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div class="flex items-center gap-2">
                <input type="checkbox" id="az-inf-ativo" ${!i || i.ativo ? 'checked' : ''} class="w-4 h-4">
                <label for="az-inf-ativo" class="text-xs font-bold text-gray-600">Ativo (visível em fn_informativos_aplicaveis)</label>
            </div>
            <div class="flex gap-2">
                <button onclick="azSalvarInformativo()" id="az-inf-btn-salvar" class="flex-1 text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">${i ? 'Salvar alterações' : 'Publicar informativo'}</button>
                <button onclick="azFecharFormInformativo()" class="px-4 py-2.5 rounded-lg text-sm font-bold border" style="border-color:var(--line);color:var(--sage)">Cancelar</button>
            </div>
            <p id="az-inf-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function azAbrirNovoInformativo() {
    azInformativoEditId = null;
    const wrapper = document.getElementById('form-az-informativo-wrapper');
    wrapper.classList.remove('hidden');
    wrapper.innerHTML = azFormInformativo(null);
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function azAbrirEdicaoInformativo(id) {
    const i = azInformativos.find(x => x.id === id);
    if (!i) return;
    azInformativoEditId = id;
    const wrapper = document.getElementById('form-az-informativo-wrapper');
    wrapper.classList.remove('hidden');
    wrapper.innerHTML = azFormInformativo(i);
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function azFecharFormInformativo() {
    azInformativoEditId = null;
    const wrapper = document.getElementById('form-az-informativo-wrapper');
    wrapper.classList.add('hidden');
    wrapper.innerHTML = '';
}

async function azSalvarInformativo() {
    const status = document.getElementById('az-inf-status');
    const tipo = document.getElementById('az-inf-tipo').value;
    const titulo = document.getElementById('az-inf-titulo').value.trim();
    if (!titulo) { status.textContent = 'Título é obrigatório.'; return; }

    const codigo = document.getElementById('az-inf-codigo').value.trim() || null;
    const texto = document.getElementById('az-inf-texto').value.trim() || null;
    const resumo = document.getElementById('az-inf-resumo').value.trim() || null;
    const selo = document.getElementById('az-inf-selo').value.trim() || null;
    const fonteNome = document.getElementById('az-inf-fonte-nome').value.trim() || null;
    const fonteUrl = document.getElementById('az-inf-fonte-url').value.trim() || null;
    const publicado = document.getElementById('az-inf-publicado').value || null;
    const vigInicio = document.getElementById('az-inf-vig-inicio').value || null;
    const vigFim = document.getElementById('az-inf-vig-fim').value || null;
    const versaoInterp = document.getElementById('az-inf-versao').value.trim() || null;
    const ativo = document.getElementById('az-inf-ativo').checked;

    const quemAfetaTexto = document.getElementById('az-inf-quem-afeta').value.trim();
    let quemAfeta = null;
    if (quemAfetaTexto) {
        try { quemAfeta = JSON.parse(quemAfetaTexto); }
        catch (e) { status.textContent = 'JSON de "quem afeta" inválido: ' + e.message; return; }
    }

    status.textContent = 'Salvando…';
    const { error } = await dbAuth.schema('gestao').rpc('fn_informativo_upsert', {
        p_id: azInformativoEditId, p_tipo: tipo, p_titulo: titulo, p_codigo: codigo,
        p_texto: texto, p_resumo_compartilhar: resumo, p_selo: selo, p_quem_afeta: quemAfeta,
        p_fonte_nome: fonteNome, p_fonte_url: fonteUrl, p_publicado_em: publicado,
        p_vigencia_inicio: vigInicio, p_vigencia_fim: vigFim,
        p_versao_interpretacao: versaoInterp, p_ativo: ativo,
    });
    if (error) { status.textContent = 'Erro: ' + error.message; return; }

    azFecharFormInformativo();
    await azCarregarTudo();
}
