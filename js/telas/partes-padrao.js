// ============================================================================
// js/telas/partes-padrao.js — Raiz Gestão
// Versão: 1.0.0 · 15/09/2026
//
// v1.0.0 — PLANO_IMPLEMENTACAO v1.0, etapa E14.3 ("A15"), Onda 12. Tela
// nova pro catálogo de partes padrão (prefeitura, órgão recolhedor) que
// cofre_controle_subtipos referencia — decisão do Nicola: parte padrão
// vale pra TODAS as empresas, cadastrada uma vez aqui (Raiz Matriz),
// materializada por tenant no primeiro uso (fn_parte_padrao_materializar,
// cofre-api.js do app). Mesmo padrão de CRUD simples de Categorias em
// parametros-master.js (pmEsc/pmIconeEditar/pmVazio/pmBotaoToggle
// reaproveitados — scripts soltos, mesmo escopo global, sem import).
// Card novo no hub de Configurações (PM_HUB, parametros-master.js).
//
// Desativar em vez de excluir, de propósito: diferente das Categorias
// (delete físico com erro de FK se estiver em uso), uma parte padrão já
// materializada em algum tenant não deve sumir do catálogo de origem —
// mesmo padrão que cofre_controle_subtipos.ativo já usa.
// ============================================================================

let ppPartes = [];
let ppSubtipos = [];
let ppEditId = null;

// cliente_id da RAIZ PATRIMONIO MATRIZ — "dona" das partes padrão (decisão
// do Nicola, 15/09/2026: cadastro fica na matriz; leitura não é filtrada
// por esse id, qualquer tenant lê via fn_parte_padrao_resolver no app).
const GESTAO_CLIENTE_ID_RAIZ_MATRIZ = '1a0e6701-8b97-4071-9424-7373f52a8543';

async function telaPartesPadraoInit() {
    const area = document.getElementById('area-conteudo');
    area.innerHTML = `
        <div class="mb-1">
            <h1 class="text-lg font-extrabold" style="color:var(--ink)">Partes padrão</h1>
            <p class="text-xs" style="color:var(--sage)">Prefeituras e órgãos recolhedores associados a um subtipo de controle (ex.: IPTU → Prefeitura de Nova Lima). Vale pra todas as empresas — cada uma ganha sua própria cópia na 1ª vez que usa (fica em Partes, dentro da empresa).</p>
        </div>
        <div class="flex items-center justify-between mt-3 mb-2">
            <p class="text-xs" style="color:var(--sage)">${ppPartes.length} cadastrada${ppPartes.length === 1 ? '' : 's'}</p>
            ${pmBotaoToggle('pp-form', 'ppAbrirNovo()')}
        </div>
        <div id="form-pp-form-wrapper" class="hidden mb-4"></div>
        <div id="pp-lista" class="space-y-1.5"><p class="text-xs" style="color:var(--sage)">Carregando…</p></div>
    `;
    try {
        await ppCarregar();
    } catch (err) {
        document.getElementById('pp-lista').innerHTML = `<div class="p-4 rounded-xl text-xs" style="background:#fee2e2;color:#991b1b">Não consegui carregar: ${pmEsc(err.message || String(err))}</div>`;
        return;
    }
    ppRenderLista();
}

async function ppCarregar() {
    if (typeof dbAuth === 'undefined') throw new Error('cliente Supabase (dbAuth) não disponível nesta tela.');
    const [rp, rs] = await Promise.all([
        dbAuth.from('cofre_partes_padrao').select('*').order('nome'),
        dbAuth.from('cofre_controle_subtipos').select('id, codigo, nome, tipo').is('cliente_id', null).order('nome'),
    ]);
    if (rp.error) throw new Error(rp.error.message);
    ppPartes = rp.data || [];
    ppSubtipos = rs.data || [];
    if (rs.error) console.warn('[partes-padrao] subtipos:', rs.error.message);
}

function ppNomeSubtipo(subtipoId) {
    const s = ppSubtipos.find(x => x.id === subtipoId);
    return s ? s.nome : '(subtipo não encontrado)';
}

function ppRenderLista() {
    const c = document.getElementById('pp-lista');
    c.innerHTML = ppPartes.map(p => {
        const localizacao = p.municipio_ibge ? `IBGE ${p.municipio_ibge}` : (p.uf ? `UF ${p.uf}` : 'Nacional / sem restrição');
        return `
            <div class="flex items-center justify-between px-3 py-2 rounded-xl border-2 ${p.ativo ? 'bg-slate-50 border-slate-300' : 'bg-slate-50 border-slate-200 opacity-60'}">
                <div class="min-w-0 cursor-pointer" onclick="ppAbrirEdicao('${p.id}')">
                    <p class="text-sm font-medium truncate" style="color:var(--ink)">${pmEsc(p.nome)}${p.ativo ? '' : ' <span class="text-[10px] font-bold" style="color:var(--sage)">(inativa)</span>'}</p>
                    <p class="text-xs" style="color:var(--sage)">${pmEsc(ppNomeSubtipo(p.subtipo_id))} · ${localizacao}</p>
                </div>
                <div class="flex items-center gap-3 flex-none">
                    <button onclick="ppAbrirEdicao('${p.id}')" title="Editar">${pmIconeEditar()}</button>
                    <button onclick="ppAlternarAtivo('${p.id}', ${p.ativo})" class="text-xs font-bold px-2 py-1 rounded-full border" style="border-color:var(--line);color:var(--sage)">${p.ativo ? 'Desativar' : 'Ativar'}</button>
                </div>
            </div>
        `;
    }).join('') || pmVazio('Nenhuma parte padrão cadastrada ainda.');
}

function ppFormHtml() {
    return `
        <div class="bg-slate-50 p-4 rounded-xl border-2 border-slate-300 space-y-3">
            <div>
                <label class="block text-xs font-bold text-gray-600">Subtipo de controle <span style="color:var(--danger)">*</span></label>
                <select id="pp-subtipo" required class="w-full p-2 border rounded mt-1 text-sm">
                    <option value="">— selecione —</option>
                    ${ppSubtipos.map(s => `<option value="${s.id}">${pmEsc(s.nome)} (${pmEsc(s.tipo)})</option>`).join('')}
                </select>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Nome <span style="color:var(--danger)">*</span></label>
                <input type="text" id="pp-nome" required placeholder="ex.: Prefeitura Municipal de Nova Lima" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">Código IBGE do município</label>
                    <input type="text" id="pp-municipio" placeholder="ex.: 3144805" class="w-full p-2 border rounded mt-1 text-sm">
                    <p class="text-[11px] mt-0.5" style="color:var(--sage)">Só se for específico de 1 cidade (ex.: IPTU). Em branco = vale pra qualquer município.</p>
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">UF</label>
                    <input type="text" id="pp-uf" maxlength="2" placeholder="ex.: MG" class="w-full p-2 border rounded mt-1 text-sm uppercase">
                    <p class="text-[11px] mt-0.5" style="color:var(--sage)">Só se for específico de 1 estado (ex.: Detran). Em branco = nacional.</p>
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">CNPJ / documento</label>
                <input type="text" id="pp-documento" placeholder="opcional" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-gray-600">WhatsApp</label>
                    <input type="text" id="pp-whatsapp" placeholder="opcional" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
                <div>
                    <label class="block text-xs font-bold text-gray-600">E-mail</label>
                    <input type="text" id="pp-email" placeholder="opcional" class="w-full p-2 border rounded mt-1 text-sm">
                </div>
            </div>
            <div>
                <label class="block text-xs font-bold text-gray-600">Endereço</label>
                <input type="text" id="pp-endereco" placeholder="opcional" class="w-full p-2 border rounded mt-1 text-sm">
            </div>
            <button onclick="ppSalvar()" id="pp-btn-salvar" class="w-full text-white font-bold py-2.5 rounded-lg text-sm" style="background:var(--pine)">Salvar</button>
            <p id="pp-status" class="raiz-indicador-inline text-[11px]"></p>
        </div>
    `;
}

function ppAbrirNovo() {
    ppEditId = null;
    const wrapper = document.getElementById('form-pp-form-wrapper');
    wrapper.innerHTML = ppFormHtml();
    wrapper.classList.remove('hidden');
    document.getElementById('pp-btn-salvar').textContent = 'Salvar';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function ppAbrirEdicao(id) {
    const p = ppPartes.find(x => x.id === id);
    if (!p) return;
    ppEditId = id;
    const wrapper = document.getElementById('form-pp-form-wrapper');
    wrapper.innerHTML = ppFormHtml();
    wrapper.classList.remove('hidden');
    document.getElementById('pp-subtipo').value = p.subtipo_id;
    document.getElementById('pp-nome').value = p.nome;
    document.getElementById('pp-municipio').value = p.municipio_ibge || '';
    document.getElementById('pp-uf').value = p.uf || '';
    document.getElementById('pp-documento').value = p.documento || '';
    document.getElementById('pp-whatsapp').value = p.whatsapp || '';
    document.getElementById('pp-email').value = p.email || '';
    document.getElementById('pp-endereco').value = p.endereco || '';
    document.getElementById('pp-btn-salvar').textContent = 'Salvar alterações';
    wrapper.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

async function ppSalvar() {
    const subtipo_id = document.getElementById('pp-subtipo').value;
    const nome = document.getElementById('pp-nome').value.trim();
    const status = document.getElementById('pp-status');
    if (!subtipo_id || !nome) { status.textContent = 'Selecione o subtipo e preencha o nome.'; return; }

    const payload = {
        subtipo_id,
        nome,
        municipio_ibge: document.getElementById('pp-municipio').value.trim() || null,
        uf: document.getElementById('pp-uf').value.trim().toUpperCase() || null,
        documento: document.getElementById('pp-documento').value.trim() || null,
        whatsapp: document.getElementById('pp-whatsapp').value.trim() || null,
        email: document.getElementById('pp-email').value.trim() || null,
        endereco: document.getElementById('pp-endereco').value.trim() || null,
    };
    if (!ppEditId) payload.cliente_id = GESTAO_CLIENTE_ID_RAIZ_MATRIZ;

    const { error } = ppEditId
        ? await dbAuth.from('cofre_partes_padrao').update(payload).eq('id', ppEditId)
        : await dbAuth.from('cofre_partes_padrao').insert(payload);

    if (error) { status.textContent = 'Erro: ' + error.message; return; }
    await ppCarregar();
    ppRenderLista();
    document.getElementById('form-pp-form-wrapper').classList.add('hidden');
}

async function ppAlternarAtivo(id, ativoAtual) {
    const { error } = await dbAuth.from('cofre_partes_padrao').update({ ativo: !ativoAtual }).eq('id', id);
    if (error) { alert('Erro: ' + error.message); return; }
    await ppCarregar();
    ppRenderLista();
}
