// ============================================================================
// js/telas/comercial-leads.js — Raiz Gestão
//
// v0.5.0 (14/11/2026 — demanda 09277cba, sessão 20261114-2140-crm-reuniao-3; FICHA_REUNIAO_LEAD_GOOGLE_MEET_RAIZ v1.1.0, de acordo do
// Nicola 14/11 21:42) — Propor reunião: tipo de texto (modelos da Edge) com o texto na tela para editar; convite em andamento pede
// confirmação antes de mandar outro; até 4 horários. Reuniões: título, e-mails convidados, sugestões do lead com "Confirmar 1/2",
// situação dos convites; botões travam enquanto processam (evita confirmação em dobro). Versão anterior: 0.4.0.
//
// v0.4.0 (14/11/2026 — demanda 09277cba, sessão 20261114-1955-crm-reuniao-2; pedidos do Nicola 14/11 19:51) — (1) a lista agrupa
// por status da esteira com chips e contador (Hoje · cada etapa aberta · Clientes e perdidos · Todos): só o grupo escolhido
// aparece, a tela não fica inteira aberta; (2) na Adoção, escolher uma pessoa da empresa filtra os dias ativos, o último acesso
// e as funções mais usadas no app e no robô (gestao.fn_empresas_adocao / fn_empresas_adocao_funcionalidades, por pessoa).
// Versão anterior: 0.3.0.
//
// v0.3.0 (14/11/2026 — demanda 09277cba, sessão 20261114-1910-crm-reuniao-1; FICHA_REUNIAO_LEAD_GOOGLE_MEET_RAIZ v1.0.2, de acordo
// do Nicola 14/11 18:42) — na ficha do lead: "O que ele disse" (dores do robô e do levantamento do site), Adoção da empresa
// vinculada (mesmas funções do chip Adoção de Empresas), Preferências de horário (dias, janelas, evitar; dados_origem.
// preferencias_agenda), Reuniões (pedidos e confirmadas, com o link do Meet e Aprovar · Outra data · Recusar) e "Propor
// reunião" com até 3 faixas de dias, duração e prévia dos horários (Edge agenda-google). Versão anterior: 0.2.0.
//
// v0.2.0 (14/11/2026 — demanda 09277cba, sessão 20261114-1710-crm-f3-3; FICHA_LEADS_AJUSTES_RAIZ v1.0.0, de acordo do Nicola
// 14/11 17:09) — três ajustes: (A1) "Empresa no Raiz" na ficha do lead, vincular e desvincular o tenant (vários leads podem
// apontar a mesma empresa; fica em dados_origem.cliente_lead_id); (A2) "+ Lead" para prospecção, só o nome basta (WhatsApp e
// e-mail opcionais, fn_interessado_registrar v2), e contato editável na ficha (nome, WhatsApp, e-mail, empresa e observação);
// (A3) ícone (i) com o significado de cada etapa (fluxo_etapas.descricao) nos grupos e embaixo da etapa escolhida.
// Versão anterior: 0.1.0.
//
// v0.1.0 (14/11/2026 — demanda 09277cba F3, sessão 20261114-1535-crm-f3-2; FICHA_CRM_AGENDA_OCUPACAO_RAIZ v1.2.0
// §4 "Gestão comercial → aba Leads (Hoje · lista · ficha com etapa e linha do tempo)", de acordo do Nicola 12/11 08:40;
// ida 14/11 15:33) — criação. Carregado sob demanda pela aba Leads de comercial.js (não entra no index.html).
//   · Fonte: os interessados da empresa Raiz na esteira Venda de licença (partes_papeis + fluxo_etapas, leitura direta
//     pela regra da empresa — o master está em todas). O lead nasce no teste (fn_trial_criar_nucleo) e a carga de
//     14/11 trouxe os testes que já existiam.
//   · Hoje: próximo passo vencido ou de hoje, e quem está parado na etapa além do prazo do catálogo (prazo_dias).
//   · Lista por etapa (abertas), concluídos/perdidos recolhidos. Toque no cartão abre a ficha no próprio cartão:
//     etapa, próximo passo com data (fn_interessado_mover), WhatsApp e a linha do tempo (fn_comunicacoes_pessoa).
//   · "Propor reunião" aparece desligado: chega com a agenda do Google (D4 do PLANO_ENTREGA3_REUNIAO_LEAD_ROBO v1.0.1).
// ============================================================================

let pclDados = { leads: [], etapas: [], empresas: [], raiz: null };
let pclGrupo = null; // v0.4.0 — grupo escolhido nos chips (null = escolhe sozinho: Hoje, se houver)

function pclEsc(t) { return String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function pclDias(iso) { if (!iso) return null; return Math.floor((Date.now() - new Date(iso).getTime()) / 864e5); }
function pclDiasTxt(n) { return n === null ? '' : n <= 0 ? 'hoje' : n === 1 ? 'há 1 dia' : `há ${n} dias`; }
function pclData(d) { return d ? new Date(d + (d.length === 10 ? 'T12:00:00' : '')).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''; }
function pclDataHora(iso) { const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); }
function pclEtapa(cod) { return pclDados.etapas.find(e => e.etapa_codigo === cod) || { etapa_nome: cod || '—', natureza: 'aberta', ordem: 999 }; }
function pclHojeIso() { return new Date().toLocaleDateString('sv-SE'); }

function pclPrecisaHoje(l) {
    const et = pclEtapa(l.etapa_codigo);
    if (!['aberta', 'pausa'].includes(et.natureza)) return false;
    if (l.proximo_passo_em && l.proximo_passo_em <= pclHojeIso()) return true;
    const n = pclDias(l.etapa_desde);
    return et.natureza === 'aberta' && et.prazo_dias && n !== null && n > et.prazo_dias;
}

async function pcoLeadsInit() {
    const el = document.getElementById('pco-conteudo');
    el.innerHTML = `<p class="text-sm" style="color:var(--sage)">Carregando...</p>`;
    const [r1, r2, r3, r4] = await Promise.all([
        dbAuth.from('partes_papeis').select('id, parte_id, fluxo_codigo, etapa_codigo, etapa_desde, proximo_passo, proximo_passo_em, dados_origem, criado_em, partes!inner(id, nome, whatsapp, email, cliente_id)')
            .eq('papel', 'interessado').eq('fluxo_codigo', 'venda_licenca').eq('ativo', true),
        dbAuth.from('fluxo_etapas').select('etapa_codigo, etapa_nome, ordem, opcional, natureza, prazo_dias, descricao').eq('fluxo_codigo', 'venda_licenca').eq('ativo', true).order('ordem'),
        dbAuth.schema('gestao').rpc('fn_lista_empresas'),
        dbAuth.from('cofre_ativos').select('id, cliente_id').eq('dados_especificos->>fluxo_interessado', 'venda_licenca').eq('status', 'ativo').limit(1),
    ]);
    if (r1.error || r2.error) {
        el.innerHTML = `<div class="p-4 rounded-xl border-2" style="background:var(--danger-bg);border-color:var(--danger);color:var(--danger)"><strong>Não foi possível carregar:</strong> ${pclEsc((r1.error || r2.error).message)}</div>`;
        return;
    }
    pclDados = { leads: r1.data || [], etapas: r2.data || [], empresas: (r3.data || []).slice().sort((a, b) => String(a.nome_empresa).localeCompare(String(b.nome_empresa))),
                 raiz: (r4.data || [])[0] || null };
    pclDesenhar();
}

function pclDesenhar() {
    const el = document.getElementById('pco-conteudo'); if (!el) return;
    const { leads, etapas } = pclDados;
    const abertos = leads.filter(l => ['aberta', 'pausa'].includes(pclEtapa(l.etapa_codigo).natureza));
    const fechados = leads.filter(l => !abertos.includes(l));
    const hoje = abertos.filter(pclPrecisaHoje).sort((a, b) => String(a.proximo_passo_em || '9').localeCompare(String(b.proximo_passo_em || '9')));
    const n = cod => leads.filter(l => l.etapa_codigo === cod).length;
    window.__pclLista = leads;
    const idx = l => leads.indexOf(l);
    const grupos = etapas.filter(e => ['aberta', 'pausa'].includes(e.natureza))
        .map(e => ({ e, ls: abertos.filter(l => l.etapa_codigo === e.etapa_codigo).sort((a, b) => String(a.etapa_desde).localeCompare(String(b.etapa_desde))) }))
        .filter(g => g.ls.length);
    el.innerHTML = `
        <div class="flex items-center justify-between gap-2 flex-wrap mb-4">
            <h2 class="text-sm font-extrabold flex items-center" style="color:var(--ink)">Leads da Raiz
                ${gestaoInfoIcone('Interessados da empresa Raiz na esteira Venda de licença. Quem cria o teste (site ou robô) entra sozinho em "Em teste". Etapas opcionais: Apresentação e Proposta.')}
            </h2>
            <div class="flex gap-2">
                <button onclick="pclNovoAbrir()" class="text-xs font-bold px-3 py-2 rounded-lg border-2" style="border-color:var(--pine);color:var(--pine)">+ Lead</button>
                <button onclick="pcoLeadsInit()" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Atualizar</button>
            </div>
        </div>
        <div id="pcl-novo" class="mb-4" hidden></div>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            ${gestaoCardMetrica('Para hoje', hoje.length, hoje.length ? 'red' : undefined, 'Próximo passo vencido ou de hoje, ou parado na etapa além do prazo do catálogo.')}
            ${gestaoCardMetrica('Em andamento', abertos.length)}
            ${gestaoCardMetrica('Em teste', n('em_teste'))}
            ${gestaoCardMetrica('Clientes', n('cliente'), n('cliente') ? 'green' : undefined)}
        </div>
        ${pclChipsGrupos(hoje, grupos, fechados, leads)}
        ${pclGrupoAtual(hoje, grupos, fechados) === 'hoje' ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">${hoje.map(l => pclCartao(l, idx(l), 'h')).join('') || '<p class="text-sm" style="color:var(--sage)">Nada para hoje.</p>'}</div>` : ''}
        ${grupos.filter(g => ['todos', g.e.etapa_codigo].includes(pclGrupoAtual(hoje, grupos, fechados))).map(g => `
            <h3 class="text-xs font-bold mb-2 flex items-center" style="color:var(--sage)">${pclEsc(g.e.etapa_nome)}${g.e.opcional ? ' (opcional)' : ''} · ${g.ls.length}${g.e.descricao ? gestaoInfoIcone(pclEsc(g.e.descricao)) : ''}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">${g.ls.map(l => pclCartao(l, idx(l), 'g')).join('')}</div>`).join('')}
        ${['todos', 'fechados'].includes(pclGrupoAtual(hoje, grupos, fechados)) && fechados.length ? `<h3 class="text-xs font-bold mb-2" style="color:var(--sage)">Clientes e perdidos · ${fechados.length}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">${fechados.map(l => pclCartao(l, idx(l), 'f')).join('')}</div>` : ''}
    `;
}

function pclCartao(l, i, k) {
    const u = k + i; // o mesmo lead pode estar em Hoje e na etapa: ids por seção
    const et = pclEtapa(l.etapa_codigo);
    const nDias = pclDias(l.etapa_desde);
    const atrasado = l.proximo_passo_em && l.proximo_passo_em < pclHojeIso();
    const cor = et.natureza === 'ganho' ? 'background:var(--success-bg);color:var(--success)' : et.natureza === 'perdido' ? 'background:var(--danger-bg);color:var(--danger)'
        : et.natureza === 'pausa' ? 'background:var(--line);color:var(--sage)' : 'background:var(--info-bg,#e8f0f5);color:var(--info,#3d6b8c)';
    const emp = (l.dados_origem && l.dados_origem.empresa) || '';
    const obs = (l.dados_origem && l.dados_origem.obs) || '';
    const vinc = pclEmpresaNome(l.dados_origem && l.dados_origem.cliente_lead_id);
    return `
        <div class="p-3 rounded-xl border-2" style="border-color:var(--line);background:var(--card,#fff)" id="pcl-c-${u}">
            <button type="button" onclick="pclAlternar(${i}, '${u}')" class="text-left w-full" style="min-height:44px">
                <div class="flex items-center justify-between gap-2">
                    <p class="text-sm font-bold" style="color:var(--ink)">${pclEsc(l.partes?.nome || 'Lead')}</p>
                    <span class="text-xs font-bold px-2 py-0.5 rounded-full" style="${cor}">${pclEsc(et.etapa_nome)}</span>
                </div>
                ${emp || obs ? `<p class="text-xs mt-1" style="color:var(--ink)">${pclEsc([emp, obs].filter(Boolean).join(' · '))}</p>` : ''}
                ${vinc ? `<p class="text-xs mt-1" style="color:var(--success)">🏢 ${pclEsc(vinc)}</p>` : ''}
                ${!l.partes?.whatsapp ? '<p class="text-xs mt-1" style="color:var(--warning)">Sem WhatsApp</p>' : ''}
                <p class="text-xs mt-1" style="color:var(--sage)">Na etapa ${pclDiasTxt(nDias)}${l.proximo_passo ? ` · → ${pclEsc(l.proximo_passo)}${l.proximo_passo_em ? ` <span style="${atrasado ? 'color:var(--danger);font-weight:700' : ''}">(${pclData(l.proximo_passo_em)})</span>` : ''}` : ''}</p>
            </button>
            <div id="pcl-f-${u}" hidden></div>
        </div>`;
}

async function pclAlternar(i, u) {
    const l = (window.__pclLista || [])[i];
    const box = document.getElementById('pcl-f-' + u);
    if (!l || !box) return;
    if (!box.hidden) { box.hidden = true; return; }
    const wa = String(l.partes?.whatsapp || '').replace(/\D/g, '');
    const waLink = wa ? (wa.startsWith('55') ? wa : '55' + wa) : '';
    box.innerHTML = `
        <div class="mt-3 pt-3" style="border-top:1px solid var(--line)">
            <div id="pcl-dor-${u}"></div>
            <div id="pcl-ad-${u}"></div>
            ${pclCamposContato(u, l)}
            ${pclCamposPreferencias(u, l)}
            <label class="text-xs font-bold" style="color:var(--sage)">Etapa</label>
            <select id="pcl-et-${u}" onchange="pclMostrarDescricao('${u}')" class="w-full text-sm p-2 rounded-lg border mt-1" style="border-color:var(--line)">
                ${pclDados.etapas.map(e => `<option value="${e.etapa_codigo}"${e.etapa_codigo === l.etapa_codigo ? ' selected' : ''}>${pclEsc(e.etapa_nome)}${e.opcional ? ' (opcional)' : ''}</option>`).join('')}
            </select>
            <p id="pcl-ed-${u}" class="text-xs mt-1 mb-2" style="color:var(--sage)">${pclEsc(pclEtapa(l.etapa_codigo).descricao || '')}</p>
            <label class="text-xs font-bold" style="color:var(--sage)">Próximo passo</label>
            <input id="pcl-pp-${u}" maxlength="160" value="${pclEsc(l.proximo_passo || '')}" placeholder="Ex.: ligar para combinar a reunião" class="w-full text-sm p-2 rounded-lg border mt-1 mb-2" style="border-color:var(--line)">
            <label class="text-xs font-bold" style="color:var(--sage)">Até quando</label>
            <input id="pcl-em-${u}" type="date" value="${pclEsc(l.proximo_passo_em || '')}" class="w-full text-sm p-2 rounded-lg border mt-1 mb-3" style="border-color:var(--line)">
            <div class="flex gap-2 flex-wrap mb-3">
                <button onclick="pclSalvar(${i}, '${u}')" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Salvar</button>
                ${waLink ? `<a href="https://wa.me/${waLink}" target="_blank" rel="noopener" class="text-xs font-bold px-3 py-2 rounded-lg border-2" style="border-color:var(--pine);color:var(--pine)">WhatsApp</a>` : ''}
                <button onclick="pclProporAbrir(${i}, '${u}')" ${waLink ? '' : 'disabled title="Complete o WhatsApp para propor reunião"'} class="text-xs font-bold px-3 py-2 rounded-lg border-2" style="border-color:var(--brass);color:var(--brass);${waLink ? '' : 'opacity:.5'}">Propor reunião</button>
            </div>
            <div id="pcl-pr-${u}" class="mb-3" hidden></div>
            <p class="text-xs font-bold mb-1" style="color:var(--sage)">Reuniões</p>
            <div id="pcl-re-${u}" class="mb-3"><p class="text-xs" style="color:var(--sage)">Carregando...</p></div>
            <p class="text-xs font-bold mb-1" style="color:var(--sage)">Linha do tempo</p>
            <div id="pcl-tl-${u}"><p class="text-xs" style="color:var(--sage)">Carregando...</p></div>
        </div>`;
    box.hidden = false;
    pclDesenharAdocao(u, l); pclDesenharReunioes(i, u, l);
    const { data, error } = await dbAuth.rpc('fn_comunicacoes_pessoa', { p_cliente_id: l.partes?.cliente_id, p_parte_id: l.parte_id, p_whatsapp: null, p_limite: 40 });
    const tl = document.getElementById('pcl-tl-' + u); if (!tl) return;
    if (error) { tl.innerHTML = `<p class="text-xs" style="color:var(--danger)">Não consegui ler: ${pclEsc(error.message)}</p>`; return; }
    const dores = (data || []).filter(p => p.fonte === 'dor');
    const db = document.getElementById('pcl-dor-' + u);
    if (db && dores.length) db.innerHTML = `<div class="p-3 rounded-xl mb-3" style="background:var(--warning-bg,#fff7e6)">
        <p class="text-xs font-bold mb-1" style="color:var(--ink)">O que ele disse</p>
        ${dores.map(d => `<p class="text-xs mb-1" style="color:var(--ink)"><b>${pclEsc(d.titulo)}</b> (${pclData(String(d.quando).slice(0, 10))}): ${pclEsc(d.texto || '—')}</p>`).join('')}</div>`;
    const cor = { robo: 'var(--sage)', comunicacao: 'var(--info,#3d6b8c)', app: 'var(--success)', esteira: 'var(--brass)', dor: 'var(--warning)' };
    const nome = { robo: 'robô', comunicacao: 'comunicação', app: 'app', esteira: 'esteira', dor: 'dor' };
    tl.innerHTML = `<div class="pl-3" style="border-left:2px solid var(--line)">${(data || []).map(p => `
        <div class="py-1">
            <p class="text-xs" style="color:var(--ink)"><span style="color:${cor[p.fonte] || 'var(--sage)'}">●</span> ${pclEsc(p.titulo || p.fonte)}${p.texto ? ' — ' + pclEsc(p.texto) : ''}</p>
            <p class="text-xs" style="color:var(--sage)">${pclDataHora(p.quando)} · ${nome[p.fonte] || p.fonte}</p>
        </div>`).join('') || '<p class="text-xs" style="color:var(--sage)">Nada registrado com esse número.</p>'}</div>`;
}

async function pclSalvar(i, u) {
    const l = (window.__pclLista || [])[i]; if (!l) return;
    const ok = await pclGravarContato(u, l);
    if (!ok) return;
    const etapa = document.getElementById('pcl-et-' + u)?.value;
    const pp = (document.getElementById('pcl-pp-' + u)?.value || '').trim();
    const em = document.getElementById('pcl-em-' + u)?.value || null;
    const { data, error } = await dbAuth.rpc('fn_interessado_mover', { p_papel_id: l.id, p_etapa: etapa !== l.etapa_codigo ? etapa : null,
        p_proximo_passo: pp, p_em: pp ? em : null, p_canal: 'gestao' });
    if (error || !data?.ok) { alert(error?.message || data?.mensagem || 'Não consegui salvar.'); return; }
    await pcoLeadsInit();
}

// ---------------------------------------------------------------- v0.2.0 · contato, empresa no Raiz, descrição da etapa, + Lead
function pclEmpresaNome(id) { if (!id) return ''; const e = pclDados.empresas.find(x => x.cliente_id === id); return e ? e.nome_empresa : 'Empresa vinculada'; }
function pclSoDigitos(t) { const d = String(t || '').replace(/\D/g, ''); return d ? (d.length <= 11 ? '55' + d : d) : null; }
function pclCampo(id, rotulo, valor, extra = '') {
    return `<label class="text-xs font-bold" style="color:var(--sage)">${rotulo}</label>
        <input id="${id}" value="${pclEsc(valor || '')}" ${extra} class="w-full text-sm p-2 rounded-lg border mt-1 mb-2" style="border-color:var(--line)">`;
}
function pclSelectEmpresa(id, atual) {
    return `<label class="text-xs font-bold flex items-center" style="color:var(--sage)">Empresa no Raiz${gestaoInfoIcone('O tenant (empresa) do lead no Raiz. Vários leads podem apontar a mesma empresa. Deixe em "Nenhuma" enquanto o oficial não existir.')}</label>
        <select id="${id}" class="w-full text-sm p-2 rounded-lg border mt-1 mb-2" style="border-color:var(--line)">
            <option value="">Nenhuma</option>
            ${pclDados.empresas.map(e => `<option value="${e.cliente_id}"${e.cliente_id === atual ? ' selected' : ''}>${pclEsc(e.nome_empresa)}</option>`).join('')}
        </select>`;
}
function pclCamposContato(u, l) {
    const d = l.dados_origem || {};
    return `<div class="grid grid-cols-1 md:grid-cols-2 gap-x-3">
            <div>${pclCampo('pcl-nm-' + u, 'Nome', l.partes?.nome, 'maxlength="160"')}</div>
            <div>${pclCampo('pcl-wa-' + u, 'WhatsApp', l.partes?.whatsapp, 'type="tel" placeholder="(11) 9…"')}</div>
            <div>${pclCampo('pcl-ml-' + u, 'E-mail', l.partes?.email, 'type="email"')}</div>
            <div>${pclCampo('pcl-ep-' + u, 'Empresa (texto)', d.empresa, 'maxlength="120" placeholder="Ex.: Construtora em BH"')}</div>
        </div>
        ${pclCampo('pcl-ob-' + u, 'Observação', d.obs, 'maxlength="200" placeholder="Ex.: tio do Nicola"')}
        ${pclSelectEmpresa('pcl-cl-' + u, d.cliente_lead_id || '')}`;
}
function pclMostrarDescricao(u) {
    const cod = document.getElementById('pcl-et-' + u)?.value;
    const el = document.getElementById('pcl-ed-' + u); if (el) el.textContent = pclEtapa(cod).descricao || '';
}
async function pclGravarContato(u, l) {
    const v = id => (document.getElementById(id + u)?.value || '').trim();
    const nome = v('pcl-nm-'), wa = pclSoDigitos(v('pcl-wa-')), email = v('pcl-ml-') || null;
    if (!nome) { alert('O nome não pode ficar vazio.'); return false; }
    if (wa && wa.length < 12) { alert('WhatsApp com DDD, por favor.'); return false; }
    if (nome !== (l.partes?.nome || '') || wa !== (l.partes?.whatsapp ? pclSoDigitos(l.partes.whatsapp) : null) || email !== (l.partes?.email || null)) {
        const { error } = await dbAuth.from('partes').update({ nome, whatsapp: wa, email }).eq('id', l.parte_id);
        if (error) { alert('Não consegui salvar o contato: ' + error.message); return false; }
    }
    const d = { ...(l.dados_origem || {}) };
    const emp = v('pcl-ep-'), obs = v('pcl-ob-'), cli = v('pcl-cl-');
    if (emp) d.empresa = emp; else delete d.empresa;
    if (obs) d.obs = obs; else delete d.obs;
    if (cli) d.cliente_lead_id = cli; else delete d.cliente_lead_id;
    const pref = pclLerPreferencias(u);
    if (pref) d.preferencias_agenda = pref; else delete d.preferencias_agenda;
    if (JSON.stringify(d) !== JSON.stringify(l.dados_origem || {})) {
        const { error } = await dbAuth.from('partes_papeis').update({ dados_origem: d }).eq('id', l.id);
        if (error) { alert('Não consegui salvar a empresa: ' + error.message); return false; }
    }
    return true;
}
function pclNovoAbrir() {
    const box = document.getElementById('pcl-novo'); if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    if (!pclDados.raiz) { alert('Não achei o bem da esteira Venda de licença (Raiz Licença).'); return; }
    const l = { partes: {}, dados_origem: {}, etapa_codigo: 'novo' };
    box.innerHTML = `<div class="p-3 rounded-xl border-2" style="border-color:var(--pine);background:var(--card,#fff)">
        <p class="text-sm font-bold mb-2" style="color:var(--ink)">Novo lead</p>
        ${pclCamposContato('n', l)}
        <label class="text-xs font-bold" style="color:var(--sage)">Etapa</label>
        <select id="pcl-et-n" onchange="pclMostrarDescricao('n')" class="w-full text-sm p-2 rounded-lg border mt-1" style="border-color:var(--line)">
            ${pclDados.etapas.map(e => `<option value="${e.etapa_codigo}"${e.etapa_codigo === 'novo' ? ' selected' : ''}>${pclEsc(e.etapa_nome)}${e.opcional ? ' (opcional)' : ''}</option>`).join('')}
        </select>
        <p id="pcl-ed-n" class="text-xs mt-1 mb-2" style="color:var(--sage)">${pclEsc(pclEtapa('novo').descricao || '')}</p>
        ${pclCampo('pcl-pp-n', 'Próximo passo', '', 'maxlength="160" placeholder="Ex.: follow-up do convite"')}
        ${pclCampo('pcl-em-n', 'Até quando', '', 'type="date"')}
        <div class="flex gap-2"><button onclick="pclNovoSalvar()" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Registrar</button>
        <button onclick="document.getElementById('pcl-novo').hidden = true" class="text-xs font-bold px-3 py-2 rounded-lg" style="color:var(--sage)">Cancelar</button></div>
    </div>`;
    box.hidden = false;
}
async function pclNovoSalvar() {
    const v = id => (document.getElementById(id)?.value || '').trim();
    const nome = v('pcl-nm-n'), wa = pclSoDigitos(v('pcl-wa-n'));
    if (!nome && !wa) { alert('Informe o nome ou o WhatsApp.'); return; }
    if (wa && wa.length < 12) { alert('WhatsApp com DDD, por favor.'); return; }
    const { data, error } = await dbAuth.rpc('fn_interessado_registrar', { p_cliente_id: pclDados.raiz.cliente_id, p_ativo_id: pclDados.raiz.id,
        p_whatsapp: wa, p_nome: nome || null, p_origem: 'prospeccao', p_canal: 'gestao' });
    if (error) { alert(error.message); return; }
    if (data && data.novo === false) { alert('Essa pessoa já é lead (mesmo WhatsApp). Abra o cartão dela para editar.'); return; }
    const lead = { id: data.papel_id, parte_id: data.parte_id, partes: { nome: nome || null, whatsapp: wa, email: null }, dados_origem: { origem: 'prospeccao', canal: 'gestao', ...(wa ? { whatsapp: wa } : {}) } };
    if (!nome) document.getElementById('pcl-nm-n').value = 'Interessado ' + String(wa).slice(-4);
    if (!(await pclGravarContato('n', lead))) return;
    const etapa = v('pcl-et-n'), pp = v('pcl-pp-n'), em = v('pcl-em-n') || null;
    if (etapa !== data.etapa || pp) {
        const r = await dbAuth.rpc('fn_interessado_mover', { p_papel_id: data.papel_id, p_etapa: etapa !== data.etapa ? etapa : null, p_proximo_passo: pp || null, p_em: pp ? em : null, p_canal: 'gestao' });
        if (r.error || !r.data?.ok) { alert(r.error?.message || r.data?.mensagem || 'Lead criado, mas não consegui mudar a etapa.'); }
    }
    await pcoLeadsInit();
}

// ---------------------------------------------------------------- v0.3.0 · preferências, adoção, reuniões e Propor reunião
const PCL_DIAS = [[1, 'Seg'], [2, 'Ter'], [3, 'Qua'], [4, 'Qui'], [5, 'Sex'], [6, 'Sáb'], [7, 'Dom']];
const PCL_EVITAR = [['manha', 'Manhã'], ['tarde', 'Tarde'], ['noite', 'Noite']];
function pclChip(attr, val, rot, on) {
    return `<button type="button" ${attr}="${val}" onclick="this.classList.toggle('pcl-on');this.style.background=this.classList.contains('pcl-on')?'var(--pine)':'#fff';this.style.color=this.classList.contains('pcl-on')?'#fff':'var(--ink)'"
        class="text-xs px-2 py-1 rounded-full border${on ? ' pcl-on' : ''}" style="border-color:var(--line);background:${on ? 'var(--pine)' : '#fff'};color:${on ? '#fff' : 'var(--ink)'}">${rot}</button>`;
}
function pclCamposPreferencias(u, l) {
    const p = (l.dados_origem && l.dados_origem.preferencias_agenda) || {};
    const j = (p.janelas && p.janelas[0]) || {};
    return `<details class="mb-2" ${p.dias || p.janelas || p.evitar || p.obs ? 'open' : ''}><summary class="text-xs font-bold flex items-center" style="color:var(--sage);cursor:pointer">Preferências de horário${gestaoInfoIcone('Usadas para escolher os horários do convite de reunião. Ex.: só de segunda a sexta, depois das 16:00; evitar a noite.')}</summary>
        <div class="mt-2" id="pcl-pf-${u}">
            <p class="text-xs mb-1" style="color:var(--sage)">Dias (nenhum marcado = todos)</p>
            <div class="flex gap-1 flex-wrap mb-2">${PCL_DIAS.map(([n, r]) => pclChip('data-pf-dia', n, r, (p.dias || []).includes(n))).join('')}</div>
            <div class="grid grid-cols-2 gap-2">
                <div>${pclCampo('pcl-pfde-' + u, 'A partir de', j.de || '', 'type="time"')}</div>
                <div>${pclCampo('pcl-pfate-' + u, 'Até', j.ate || '', 'type="time"')}</div>
            </div>
            <p class="text-xs mb-1" style="color:var(--sage)">Evitar</p>
            <div class="flex gap-1 flex-wrap mb-2">${PCL_EVITAR.map(([k, r]) => pclChip('data-pf-ev', k, r, (p.evitar || []).includes(k))).join('')}</div>
            ${pclCampo('pcl-pfob-' + u, 'Observação', p.obs || '', 'maxlength="160" placeholder="Ex.: tem filhos pequenos, evita a noite"')}
        </div></details>`;
}
function pclLerPreferencias(u) {
    const box = document.getElementById('pcl-pf-' + u); if (!box) return null;
    const dias = [...box.querySelectorAll('[data-pf-dia].pcl-on')].map(b => Number(b.getAttribute('data-pf-dia')));
    const evitar = [...box.querySelectorAll('[data-pf-ev].pcl-on')].map(b => b.getAttribute('data-pf-ev'));
    const de = document.getElementById('pcl-pfde-' + u)?.value || '', ate = document.getElementById('pcl-pfate-' + u)?.value || '';
    const obs = (document.getElementById('pcl-pfob-' + u)?.value || '').trim();
    const p = {};
    if (dias.length) p.dias = dias;
    if (de || ate) p.janelas = [{ de: de || '00:00', ate: ate || '23:59' }];
    if (evitar.length) p.evitar = evitar;
    if (obs) p.obs = obs;
    return Object.keys(p).length ? p : null;
}
async function pclDesenharAdocao(u, l, pessoaId) {
    const el = document.getElementById('pcl-ad-' + u); if (!el) return;
    const cli = l.dados_origem && l.dados_origem.cliente_lead_id;
    if (!cli) { el.innerHTML = `<p class="text-xs mb-2" style="color:var(--sage)">Adoção: vincule a empresa no Raiz para ver o uso.</p>`; return; }
    const g = dbAuth.schema('gestao');
    const [r1, r2, r3] = await Promise.all([
        pessoaId ? Promise.resolve({ data: null }) : g.rpc('fn_uso_empresa_resumo', { p_cliente_id: cli }),
        g.rpc('fn_empresas_adocao', { p_cliente_id: cli }),
        g.rpc('fn_empresas_adocao_funcionalidades', { p_cliente_id: cli, p_pessoa_id: pessoaId || null }),
    ]);
    if (r2.error && r1.error) { el.innerHTML = `<p class="text-xs mb-2" style="color:var(--danger)">Adoção: ${pclEsc(r2.error.message)}</p>`; return; }
    const res = Array.isArray(r1.data) ? r1.data[0] : r1.data;
    const todas = r2.data || [];
    const pessoas = pessoaId ? todas.filter(p => p.pessoa_id === pessoaId) : todas;
    const ult = pessoas.map(p => p.ultimo_login).filter(Boolean).sort().pop();
    const funcs = (r3.data || []).slice().sort((a, b) => Number(b.qtd) - Number(a.qtd));
    const top = (canal) => funcs.filter(f => String(f.canal || '').toLowerCase().includes(canal)).slice(0, 3).map(f => `${pclEsc(f.item)} (${f.qtd})`).join(', ');
    const app = top('app'), bot = top('bot') || top('whats');
    el.innerHTML = `<div class="p-3 rounded-xl mb-3" style="background:var(--info-bg,#e8f0f5)">
        <div class="flex items-center justify-between gap-2 flex-wrap mb-1">
            <p class="text-xs font-bold" style="color:var(--ink)">Adoção · ${pclEsc(pclEmpresaNome(cli))}${res ? ` · ${pclEsc(res.plano_codigo || '')} ${pclEsc(res.licenca_status || '')}` : ''}</p>
            ${todas.length > 1 ? `<select onchange="pclDesenharAdocao('${u}', (window.__pclLista || []).find(x => x.id === '${l.id}'), this.value || null)" class="text-xs p-1 rounded border" style="border-color:var(--line)">
                <option value="">Todas as pessoas</option>${todas.map(p => `<option value="${p.pessoa_id}"${p.pessoa_id === pessoaId ? ' selected' : ''}>${pclEsc(p.pessoa_nome)}</option>`).join('')}</select>` : ''}
        </div>
        ${res && !pessoaId ? `<p class="text-xs" style="color:var(--ink)">${Number(res.total_acoes_app_30d || 0)} ações no app e ${Number(res.total_eventos_bot_30d || 0)} no robô em 30 dias</p>` : ''}
        <p class="text-xs" style="color:var(--ink)">${pessoas.map(p => `${pclEsc(p.pessoa_nome)}: ${p.dias_ativos}/${p.dias_periodo} dias ativos`).join(' · ') || 'Sem uso no período.'}${ult ? ` · último acesso ${pclDataHora(ult)}` : ''}</p>
        ${app ? `<p class="text-xs mt-1" style="color:var(--sage)">Mais usado no app: ${app}</p>` : ''}
        ${bot ? `<p class="text-xs" style="color:var(--sage)">Mais usado no robô: ${bot}</p>` : ''}
    </div>`;
}
// v0.4.0 — chips dos grupos da esteira (com contador); só o grupo escolhido aparece
function pclGrupoAtual(hoje, grupos, fechados) {
    const validos = ['todos', ...(hoje.length ? ['hoje'] : []), ...grupos.map(g => g.e.etapa_codigo), ...(fechados.length ? ['fechados'] : [])];
    if (pclGrupo && validos.includes(pclGrupo)) return pclGrupo; // grupo que esvaziou volta ao padrão
    return hoje.length ? 'hoje' : (grupos[0] ? grupos[0].e.etapa_codigo : 'todos');
}
function pclChipsGrupos(hoje, grupos, fechados, leads) {
    const atual = pclGrupoAtual(hoje, grupos, fechados);
    const chip = (id, rot, n) => `<button type="button" onclick="pclGrupo='${id}';pclDesenhar()" class="text-xs font-bold px-3 py-1.5 rounded-full border whitespace-nowrap"
        style="border-color:${atual === id ? 'var(--pine)' : 'var(--line)'};background:${atual === id ? 'var(--pine)' : '#fff'};color:${atual === id ? '#fff' : 'var(--ink)'}">${rot} · ${n}</button>`;
    return `<div class="flex gap-2 mb-4 overflow-x-auto pb-1">
        ${chip('hoje', 'Hoje', hoje.length)}
        ${grupos.map(g => chip(g.e.etapa_codigo, pclEsc(g.e.etapa_nome), g.ls.length)).join('')}
        ${fechados.length ? chip('fechados', 'Clientes e perdidos', fechados.length) : ''}
        ${chip('todos', 'Todos', leads.length)}
    </div>`;
}
async function pclDesenharReunioes(i, u, l) {
    const el = document.getElementById('pcl-re-' + u); if (!el) return;
    const [{ data, error }, cv] = await Promise.all([
        dbAuth.from('cofre_ocorrencias_controle').select('id, inicio_em, fim_em, aguardando_ate, status_execucao, evento_externo')
            .eq('parte_id', l.parte_id).not('inicio_em', 'is', null).order('inicio_em', { ascending: false }).limit(10),
        pclEdge({ acao: 'convites', papel_id: l.id }),
    ]);
    if (error) { el.innerHTML = `<p class="text-xs" style="color:var(--danger)">${pclEsc(error.message)}</p>`; return; }
    const convites = (cv && cv.convites) || [];
    const linhaConv = convites.length ? `<p class="text-xs mb-2" style="color:var(--sage)">Convites: ${convites.slice(0, 3).map(c => `${pclEsc(c.quando_txt)} — ${pclEsc(c.situacao)}`).join(' · ')}</p>` : '';
    if (!(data || []).length) { el.innerHTML = linhaConv + '<p class="text-xs" style="color:var(--sage)">Nenhuma reunião ainda.</p>'; return; }
    const btn = (rot, js, cor) => `<button onclick="${js}" class="text-xs font-bold px-2 py-1 rounded ${cor === 'pine' ? 'text-white' : 'border'}" style="${cor === 'pine' ? 'background:var(--pine)' : cor === 'danger' ? 'border-color:var(--danger);color:var(--danger)' : 'border-color:var(--line)'}">${rot}</button>`;
    el.innerHTML = linhaConv + data.map(o => {
        const ev = o.evento_externo || {};
        const st = o.status_execucao === 'cancelado' ? 'Cancelada' : o.aguardando_ate ? (ev.sugestoes ? 'Lead sugeriu horários' : 'Aguardando você') : 'Confirmada';
        const link = ev.link && !ev.cancelado_em ? ev.link : '';
        const pend = o.aguardando_ate && o.status_execucao !== 'cancelado';
        const sug = pend && Array.isArray(ev.sugestoes) ? ev.sugestoes : null;
        return `<div class="p-2 rounded-lg border mb-1" style="border-color:var(--line)">
            <p class="text-xs" style="color:var(--ink)"><b>${pclDataHora(o.inicio_em)}</b>${ev.titulo ? ' · ' + pclEsc(ev.titulo) : ''} · ${st}${link ? ` · <a href="${pclEsc(link)}" target="_blank" rel="noopener" style="color:var(--pine);text-decoration:underline">Entrar no Meet</a>` : ''}</p>
            ${(ev.convidados || []).length ? `<p class="text-xs" style="color:var(--sage)">E-mails: ${ev.convidados.map(pclEsc).join(', ')}</p>` : ''}
            ${sug ? `<p class="text-xs mt-1" style="color:var(--ink)">Sugestões: ${sug.map((x, k) => `${k + 1}) ${pclDataHora(x.inicio)}`).join(' · ')}</p>` : ''}
            ${pend ? `<div class="flex gap-2 mt-1 flex-wrap">
                ${sug ? sug.map((x, k) => btn('Confirmar ' + (k + 1), `pclConfirmarSugestao(this,'${o.id}',${k},${i},'${u}')`, 'pine')).join('')
                      : btn('Aprovar', `pclDecidir(this,'${o.id}','aprovar',${i},'${u}')`, 'pine')}
                ${btn('Novos horários', `pclDecidir(this,'${o.id}','outra_data',${i},'${u}')`)}
                ${btn('Recusar', `pclDecidir(this,'${o.id}','recusar',${i},'${u}')`, 'danger')}
            </div>` : ''}</div>`;
    }).join('');
}
async function pclEdge(body) {
    const { data, error } = await dbAuth.functions.invoke('agenda-google', { body });
    if (error) { let m = error.message; try { const j = await error.context.json(); m = j.mensagem || m; } catch (_) {} return { ok: false, mensagem: m }; }
    return data || { ok: false, mensagem: 'Sem resposta.' };
}
// v0.5.0 — trava o botão enquanto processa (dois toques criavam dois eventos no Google)
async function pclTravado(botao, fn) {
    if (botao && botao.disabled) return;
    const grupo = botao ? botao.parentElement.querySelectorAll('button') : [];
    grupo.forEach(b => { b.disabled = true; b.style.opacity = '.5'; });
    try { return await fn(); } finally { grupo.forEach(b => { b.disabled = false; b.style.opacity = ''; }); }
}
async function pclDecidir(botao, ocId, decisao, i, u) {
    if (decisao === 'recusar' && !confirm('Recusar o pedido? O lead recebe uma mensagem cordial.')) return;
    await pclTravado(botao, async () => {
        const r = await pclEdge({ acao: 'decidir', ocorrencia_id: ocId, decisao });
        alert(r.mensagem || (r.ok ? 'Feito.' : 'Não deu certo.'));
    });
    const l = (window.__pclLista || [])[i]; if (l) pclDesenharReunioes(i, u, l);
}
async function pclConfirmarSugestao(botao, ocId, k, i, u) {
    await pclTravado(botao, async () => {
        const r = await pclEdge({ acao: 'confirmar_sugestao', ocorrencia_id: ocId, idx: k });
        alert(r.mensagem || (r.ok ? 'Confirmado.' : 'Não deu certo.'));
    });
    const l = (window.__pclLista || [])[i]; if (l) pclDesenharReunioes(i, u, l);
}
let pclModelos = null;
async function pclModelosCarregar() {
    if (pclModelos) return pclModelos;
    const r = await pclEdge({ acao: 'modelos' });
    pclModelos = (r && r.modelos) || { configuracao: { rotulo: 'Configuração inicial', texto: '' } };
    return pclModelos;
}
function pclTextoModelo(i, u) {
    const l = (window.__pclLista || [])[i]; const m = (pclModelos || {})[document.getElementById('pcl-mo-' + u)?.value] || {};
    const nome = String(l?.partes?.nome || '').split(' ')[0] || 'tudo bem';
    const dur = document.getElementById('pcl-du-' + u)?.value === '60' ? '1 hora' : '30 min';
    const tx = document.getElementById('pcl-tx-' + u);
    if (tx) tx.value = String(m.texto || '').replaceAll('{nome}', nome).replaceAll('{duracao}', dur);
}
async function pclProporAbrir(i, u) {
    const box = document.getElementById('pcl-pr-' + u); if (!box) return;
    if (!box.hidden) { box.hidden = true; return; }
    const modelos = await pclModelosCarregar();
    const faixa = k => `<div class="grid grid-cols-2 gap-2"><div>${pclCampo(`pcl-fd${k}-${u}`, `Faixa ${k} · de`, '', 'type="date"')}</div><div>${pclCampo(`pcl-fa${k}-${u}`, 'até', '', 'type="date"')}</div></div>`;
    box.innerHTML = `<div class="p-3 rounded-xl border-2" style="border-color:var(--brass)">
        <p class="text-xs font-bold mb-2 flex items-center" style="color:var(--ink)">Propor reunião${gestaoInfoIcone('Escolha o tipo de texto e ajuste à vontade. Até 4 horários saem das faixas de dias (sem faixa: os próximos 5 dias úteis), respeitando a sua agenda, o Google da Raiz e as preferências do lead. Se ele escolher um dos 4, a reunião já fica confirmada; se sugerir outro horário, você confirma em Reuniões.')}</p>
        <label class="text-xs font-bold" style="color:var(--sage)">Tipo de texto</label>
        <select id="pcl-mo-${u}" onchange="pclTextoModelo(${i}, '${u}')" class="w-full text-sm p-2 rounded-lg border mt-1 mb-2" style="border-color:var(--line)">
            ${Object.entries(modelos).map(([k, m]) => `<option value="${k}">${pclEsc(m.rotulo || k)}</option>`).join('')}</select>
        <label class="text-xs font-bold" style="color:var(--sage)">Texto que o lead recebe</label>
        <textarea id="pcl-tx-${u}" rows="4" maxlength="900" class="w-full text-sm p-2 rounded-lg border mt-1 mb-1" style="border-color:var(--line)"></textarea>
        <p class="text-xs mb-2" style="color:var(--sage)">Fora da janela de 24 h do lead, a Meta só aceita o modelo aprovado (texto padrão).</p>
        ${faixa(1)}${faixa(2)}${faixa(3)}
        <label class="text-xs font-bold" style="color:var(--sage)">Duração</label>
        <select id="pcl-du-${u}" onchange="pclTextoModelo(${i}, '${u}')" class="w-full text-sm p-2 rounded-lg border mt-1 mb-2" style="border-color:var(--line)"><option value="30">30 min</option><option value="60">1 hora</option></select>
        <div class="flex gap-2 mb-2">
            <button onclick="pclPropor(${i}, '${u}', false, this)" class="text-xs font-bold px-3 py-2 rounded-lg border-2" style="border-color:var(--pine);color:var(--pine)">Ver horários</button>
            <button onclick="pclPropor(${i}, '${u}', true, this)" class="text-xs font-bold px-3 py-2 rounded-lg text-white" style="background:var(--pine)">Enviar convite</button>
        </div>
        <div id="pcl-prv-${u}"></div></div>`;
    box.hidden = false;
    pclTextoModelo(i, u);
}
async function pclPropor(i, u, enviar, botao) {
    const l = (window.__pclLista || [])[i]; if (!l) return;
    const faixas = [1, 2, 3].map(k => ({ de: document.getElementById(`pcl-fd${k}-${u}`)?.value, ate: document.getElementById(`pcl-fa${k}-${u}`)?.value || document.getElementById(`pcl-fd${k}-${u}`)?.value }))
        .filter(f => f.de);
    const el = document.getElementById('pcl-prv-' + u);
    if (el) el.innerHTML = '<p class="text-xs" style="color:var(--sage)">Calculando...</p>';
    const corpo = { acao: enviar ? 'propor' : 'previa', papel_id: l.id, faixas, duracao: Number(document.getElementById('pcl-du-' + u)?.value || 30),
        modelo: document.getElementById('pcl-mo-' + u)?.value, texto: document.getElementById('pcl-tx-' + u)?.value || '', forcar: false };
    let r = await pclTravado(botao, () => pclEdge(corpo));
    if (r && r.precisa_confirmar) { // v0.5.0 — convite em andamento
        if (!confirm(r.mensagem)) { if (el) el.innerHTML = '<p class="text-xs" style="color:var(--sage)">Convite não enviado.</p>'; return; }
        r = await pclTravado(botao, () => pclEdge({ ...corpo, forcar: true }));
    }
    if (!el) return;
    const lista = r.horarios_txt || [];
    el.innerHTML = `<p class="text-xs mb-1" style="color:${r.ok ? 'var(--ink)' : 'var(--danger)'}">${pclEsc(enviar ? (r.mensagem || '') : (lista.length ? `${lista.length} horário(s) vão sair:` : 'Nenhum horário livre com essas faixas e preferências.'))}${!r.ok && !enviar ? ' ' + pclEsc(r.mensagem || '') : ''}</p>
        ${lista.length ? `<p class="text-xs" style="color:var(--sage)">${lista.map(pclEsc).join(' · ')}</p>` : ''}`;
    if (enviar && r.ok) setTimeout(() => pcoLeadsInit(), 1200);
}
