// ============================================================================
// js/telas/parametros-planos.js — Raiz Gestão
//
// v0.15.1 (09/09/2026) — DESKTOP NUNCA MOSTROU A MATRIZ (print do Nicola):
// o wrapper usava `hidden md:block`, mas o index.html do Gestão tem
// `.hidden { display:none !important }` (linha ~729), que vence qualquer
// `md:block`. Trocado por `max-md:hidden` (Tailwind v4: só esconde abaixo de
// 768px, sem a classe .hidden). Mesmo bug em parametros-perfis.js e
// parametros-campanhas.js, corrigidos juntos.
//
// v0.15.0 (09/09/2026) — A.11 (achado do Nicola no celular: "aparece a
// coluna mas não tenho como escolher plano dentro de funcionalidade"): a
// célula MOBILE não tinha o select "upsell —" (plano_funcionalidade.
// id_oferta_upsell) nem o textarea do aviso — só o desktop. Agora os dois
// aparecem nos 2 layouts; é o id_oferta_upsell que alimenta "Plano
// sugerido" do modal de limite (app 1.148) e a mensagem ao comercial.
//
// v0.14.0 (07/09/2026) — CORREÇÃO: `comercial.categoria_licenca` (nome, item,
// tipo_reset: mensal/anual/transação/nunca) já existia com esta tela pronta
// pra editar (o select "categoria/reset —" na célula), mas nenhuma função do
// banco nunca leu `plano_funcionalidade.id_categoria` — fn_checar_limite()
// (produção) e fn_uso_funcionalidade() ignoravam completamente. O
// `funcionalidades.cota_tipo` criado hoje mais cedo (E.3) resolveu o efeito
// mas duplicou esse mecanismo em vez de ligá-lo — corrigido na mesma sessão
// (migration unificar_categoria_licenca_fn_uso_funcionalidade_v1): a
// contagem agora lê a categoria de verdade, e `cota_tipo` (coluna) foi
// derrubada — o texto do app continua saindo igual (a função devolve o
// mesmo nome de campo, derivado). Nesta tela:
//   - Removido o seletor de "tipo de cota" por FUNCIONALIDADE no cabeçalho
//     da linha (escrevia numa coluna que não existe mais) — o controle
//     certo é por PLANO×funcionalidade, na célula, e já existia.
//   - Select de categoria adicionado também no mobile (só tinha no desktop).
//   - Desktop e mobile agrupados por ÁREA (autenticar, cofre, contratos…),
//     mesmo padrão de Catálogo (parametros-master.js) e Perfis & Acessos
//     (parametros-perfis.js) — antes agrupava por módulo aqui, único lugar
//     diferente das outras duas telas.
//   - Cards "Regra de limites" e "Contador real implementado hoje" removidos
//     — citavam licencas.limite_imoveis/limite_contratos (colunas que não
//     existem) e diziam que só imóveis/contratos tinham contador real; hoje
//     todas as 5 funcionalidades com limite contam de verdade.
//
// v0.12.0 (07/09/2026) — E.3 (cotas): linha da funcionalidade mostra o nome
// comercial; célula ganhou o texto de aviso ao atingir
// (plano_funcionalidade.aviso_padrao_funcionalidade, que já existia e a
// tela não mostrava).
//
// v0.11.0 — matriz ganhou ícone de editar/excluir por plano (desktop: no
// cabeçalho da coluna; mobile: linha abaixo das abas, pro plano ativo).
// pmAbrirEdicaoPlano()/pmExcluirPlano() (parametros-master.js) JÁ EXISTIAM
// desde antes — só nunca tinham um botão nesta tela que os chamasse.
//
// v0.8.1 (novo arquivo) — "Planos & Limites": matriz plano × funcionalidade.
// Cada célula é um toggle (vínculo em plano_funcionalidade); quando ligado,
// expande campos de limite/limite_aviso/categoria/upsell — mesmos 4 campos
// que já existem na tabela. Autosave por célula (onchange já salva).
// ============================================================================

async function parametrosPlanosInit() {
    const c = document.getElementById('pm-conteudo-area');

    const comLimite = pmPlanoFuncionalidade.filter(pf => pf.limite !== null).length;
    const planosAtivos = pmPlanos.filter(p => p.ativo).length;

    c.innerHTML = `
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
                <h2 class="text-sm font-extrabold" style="color:var(--ink)">Planos & Limites</h2>
                <p class="text-xs mt-0.5" style="color:var(--sage)">Plano define o que a empresa pode usar; limite define quanto.</p>
            </div>
            ${pmBotaoToggle('plano-form', "pmAbrirNovoPlano()")}
        </div>
        <div id="form-plano-form-wrapper" class="hidden mb-4">${pmFormPlano()}</div>

        <div class="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            ${gestaoCardMetricaLocal('Planos ativos', `${planosAtivos} / ${pmPlanos.length}`)}
            ${gestaoCardMetricaLocal('Funcionalidades', pmFuncionalidades.length)}
            ${gestaoCardMetricaLocal('Com limite definido', comLimite)}
            ${gestaoCardMetricaLocal('Categorias de cota', pmCategorias.length)}
        </div>

        <!-- Mobile (<768px): plano primeiro, lista vertical (seção 6.1 do prompt v0.9.0) -->
        <div class="md:hidden rounded-2xl border-2 overflow-hidden mb-4" style="border-color:var(--line);background:#fff">
            <div class="p-4 border-b" style="border-color:var(--line)">
                <b class="text-sm" style="color:var(--ink)">Funcionalidades por plano</b>
                <div class="flex gap-2 overflow-x-auto mt-2 pb-1" id="pp-mobile-tabs"></div>
                <div class="flex gap-4 mt-1" id="pp-mobile-acoes"></div>
            </div>
            <div id="pp-mobile-lista" class="p-3 space-y-2"></div>
        </div>

        <!-- Desktop (≥768px): matriz comparativa -->
        <div class="max-md:hidden rounded-2xl border-2 overflow-hidden" style="border-color:var(--line);background:#fff">
            <div class="p-4 border-b flex items-center justify-between" style="border-color:var(--line)">
                <div>
                    <b class="text-sm" style="color:var(--ink)">Matriz plano × funcionalidade</b>
                    <p class="text-[11px] mt-0.5" style="color:var(--sage)">Marque pra liberar a funcionalidade no plano. Campos de limite aparecem só quando marcado.</p>
                </div>
            </div>
            <div class="overflow-x-auto" id="pp-matrix"></div>
        </div>

        <div class="p-4 rounded-2xl border-2 mt-4" style="border-color:var(--line);background:#fff">
            <b class="text-sm" style="color:var(--ink)">Como um limite funciona</b>
            <p class="text-xs mt-1" style="color:var(--sage)">Cada funcionalidade com limite (célula marcada com número) tem uma <b>categoria de cota</b> (Configurações › Categorias de cota) que diz quando ela reseta — é o que decide se "criar ativo" conta o que existe hoje (nunca reseta) ou se "usar IA" conta eventos do mês (reseta todo dia 1). Mudar a categoria de uma célula muda a contagem na hora, sem deploy.</p>
            <div class="flex flex-wrap gap-1.5 mt-3">
                ${pmCategorias.map(cat => `<span class="text-[10px] font-bold px-2 py-1 rounded-full" style="background:var(--paper);color:var(--ink)">${pmEsc(cat.nome)} · ${pmEsc(cat.tipo_reset)}</span>`).join('') || '<span class="text-[10px]" style="color:var(--sage)">Nenhuma categoria cadastrada — ver Configurações › Categorias de cota.</span>'}
            </div>
        </div>
    `;

    ppRenderizar();
    ppRenderMobile();
}

let ppPlanoMobileAtivo = null;

function ppRenderMobile() {
    const planosOrdenados = [...pmPlanos].sort((a, b) => (a.ativo === b.ativo) ? 0 : (a.ativo ? -1 : 1));
    if (!ppPlanoMobileAtivo || !planosOrdenados.some(p => p.codigo === ppPlanoMobileAtivo)) {
        ppPlanoMobileAtivo = planosOrdenados[0]?.codigo || null;
    }

    const tabs = document.getElementById('pp-mobile-tabs');
    if (tabs) {
        tabs.innerHTML = planosOrdenados.map(p => `
            <button onclick="ppMudarPlanoMobile('${p.codigo}')" class="px-3 py-1.5 rounded-full text-xs font-bold flex-none"
                style="background:${p.codigo === ppPlanoMobileAtivo ? 'var(--pine)' : 'var(--paper)'};color:${p.codigo === ppPlanoMobileAtivo ? '#fff' : 'var(--ink)'}">${p.descricao}${p.ativo ? '' : ' (inativo)'}</button>
        `).join('');
    }

    const acoes = document.getElementById('pp-mobile-acoes');
    if (acoes) {
        const ativo = pmPlanos.find(p => p.codigo === ppPlanoMobileAtivo);
        acoes.innerHTML = ativo ? `
            <button onclick="pmAbrirEdicaoPlano('${ativo.codigo}')" class="text-[11px] font-bold flex items-center gap-1" style="color:var(--pine)">${pmIconeEditar()} Editar nome/status</button>
            <button onclick="pmExcluirPlano('${ativo.codigo}','${pmEsc(ativo.descricao)}')" class="text-[11px] font-bold flex items-center gap-1" style="color:var(--danger)">${pmIconeExcluir()} Excluir</button>
        ` : '';
    }

    const lista = document.getElementById('pp-mobile-lista');
    if (!lista) return;
    if (!ppPlanoMobileAtivo) { lista.innerHTML = `<p class="text-xs text-center py-4" style="color:var(--sage)">Nenhum plano cadastrado ainda.</p>`; return; }

    // v0.14.0 — agrupado por área (igual ao desktop e às outras 2 telas);
    // célula ganhou o seletor de categoria de cota (só existia no desktop).
    const porArea = {};
    pmFuncionalidades.forEach(f => { const a = f.area || '(sem área)'; (porArea[a] = porArea[a] || []).push(f); });
    lista.innerHTML = Object.keys(porArea).sort().map(area => {
        const fechada = ppAreasFechadasMobile.has(area);
        return `
        <button type="button" onclick="ppAlternarAreaMobile('${pmEsc(area)}')" class="w-full flex items-center justify-between py-1.5">
            <span class="text-[11px] font-bold uppercase tracking-wide" style="color:var(--pine)">${fechada ? '▸' : '▾'} ${pmEsc(area)} <span class="font-normal" style="color:var(--sage)">· ${porArea[area].length}</span></span>
        </button>
        ${fechada ? '' : porArea[area].map(f => {
            const v = ppVinculo(ppPlanoMobileAtivo, f.codigo);
            return `
            <div class="p-3 rounded-xl border mb-1.5" style="border-color:var(--line)">
                <div class="flex items-center justify-between gap-2">
                    <div class="min-w-0">
                        <b class="text-xs" style="color:var(--ink)">${pmEsc(f.nome_comercial || f.codigo)}</b>
                        <div class="text-[10px] truncate font-mono" style="color:var(--sage)">${f.codigo}</div>
                    </div>
                    <input type="checkbox" ${v ? 'checked' : ''} class="flex-none" onchange="ppToggleMobile('${ppPlanoMobileAtivo}','${f.codigo}', this.checked)">
                </div>
                ${v ? `
                    <div class="mt-2 grid grid-cols-2 gap-1.5">
                        <input type="number" placeholder="sem limite" value="${v.limite ?? ''}"
                            onchange="ppAtualizarCampo('${ppPlanoMobileAtivo}','${f.codigo}','limite', this.value === '' ? null : Number(this.value))"
                            class="w-full p-2 border rounded text-xs">
                        <input type="number" placeholder="aviso a partir de" value="${v.limite_aviso ?? ''}"
                            onchange="ppAtualizarCampo('${ppPlanoMobileAtivo}','${f.codigo}','limite_aviso', this.value === '' ? null : Number(this.value))"
                            class="w-full p-2 border rounded text-xs">
                    </div>
                    <select onchange="ppAtualizarCampo('${ppPlanoMobileAtivo}','${f.codigo}','id_categoria', this.value || null)" class="w-full p-2 border rounded text-xs mt-1.5">
                        <option value="">categoria/reset —</option>
                        ${pmCategorias.map(cat => `<option value="${cat.id_categoria_licenca}" ${v?.id_categoria === cat.id_categoria_licenca ? 'selected' : ''}>${pmEsc(cat.nome)} · ${pmEsc(cat.tipo_reset)}</option>`).join('')}
                    </select>
                    <select onchange="ppAtualizarCampo('${ppPlanoMobileAtivo}','${f.codigo}','id_oferta_upsell', this.value || null)" class="w-full p-2 border rounded text-xs mt-1.5">
                        <option value="">upsell — plano sugerido ao chegar no limite</option>
                        ${pmPlanos.filter(p2 => p2.ativo && p2.codigo !== ppPlanoMobileAtivo).map(p2 => `<option value="${p2.codigo}" ${v?.id_oferta_upsell === p2.codigo ? 'selected' : ''}>${pmEsc(p2.descricao)}</option>`).join('')}
                    </select>
                    <textarea rows="2" placeholder="aviso ao atingir (texto que o cliente lê no app/bot; vazio = padrão)" onchange="ppAtualizarCampo('${ppPlanoMobileAtivo}','${f.codigo}','aviso_padrao_funcionalidade', this.value.trim() || null)" class="w-full p-2 border rounded text-xs mt-1.5">${pmEsc(v?.aviso_padrao_funcionalidade || '')}</textarea>
                ` : ''}
            </div>`;
        }).join('')}`;
    }).join('');
}
let ppAreasFechadasMobile = new Set();
function ppAlternarAreaMobile(area) { if (ppAreasFechadasMobile.has(area)) ppAreasFechadasMobile.delete(area); else ppAreasFechadasMobile.add(area); ppRenderMobile(); }

async function ppToggleMobile(planoCodigo, funcCodigo, marcado) {
    await ppToggle(planoCodigo, funcCodigo, marcado);
    ppRenderMobile();
}

function ppMudarPlanoMobile(codigo) {
    ppPlanoMobileAtivo = codigo;
    ppRenderMobile();
}
function gestaoCardMetricaLocal(label, valor) {
    return `
        <div class="p-3 rounded-xl border-2" style="border-color:var(--line);background:#fff">
            <p class="text-[10px] font-bold uppercase tracking-wide" style="color:var(--sage)">${label}</p>
            <p class="text-xl font-extrabold mt-1" style="color:var(--ink)">${valor}</p>
        </div>
    `;
}

function ppRenderizar() {
    const el = document.getElementById('pp-matrix');
    const planosOrdenados = [...pmPlanos].sort((a, b) => (a.ativo === b.ativo) ? 0 : (a.ativo ? -1 : 1));

    // v0.14.0 — agrupa por ÁREA (mesmo padrão de Catálogo e Perfis & Acessos),
    // não mais por módulo.
    const grupos = new Map();
    pmFuncionalidades.forEach(f => {
        const chave = f.area || '(sem área)';
        if (!grupos.has(chave)) grupos.set(chave, { area: chave, itens: [] });
        grupos.get(chave).itens.push(f);
    });

    el.innerHTML = `
        <table class="w-full text-xs" style="border-collapse:separate;border-spacing:0">
            <thead>
                <tr>
                    <th class="sticky left-0 bg-white text-left p-2 border-b" style="border-color:var(--line);min-width:200px">Funcionalidade</th>
                    ${planosOrdenados.map(p => `
                        <th class="p-2 border-b text-left align-top" style="border-color:var(--line);min-width:170px;${p.ativo ? '' : 'opacity:.5'}">
                            <div class="flex items-start justify-between gap-1">
                                <span>${p.descricao}${p.ativo ? '' : ' <span class="text-[9px]">(inativo)</span>'}</span>
                                <span class="flex gap-1 flex-none">
                                    <button type="button" onclick="pmAbrirEdicaoPlano('${p.codigo}')" title="Editar nome/status de ${pmEsc(p.descricao)}">${pmIconeEditar()}</button>
                                    <button type="button" onclick="pmExcluirPlano('${p.codigo}','${pmEsc(p.descricao)}')" title="Excluir ${pmEsc(p.descricao)}">${pmIconeExcluir()}</button>
                                </span>
                            </div>
                            <span class="text-[9px] font-normal" style="color:var(--sage)">código: ${p.codigo}</span>
                        </th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${Array.from(grupos.values()).map(g => `
                    <tr><td colspan="${planosOrdenados.length + 1}" class="p-2 pt-4 text-[10px] font-bold uppercase" style="color:var(--sage)">${pmEsc(g.area)} <span class="font-normal">· ${g.itens.length}</span></td></tr>
                    ${g.itens.map(f => `
                        <tr>
                            <td class="sticky left-0 bg-white p-2 border-b align-top" style="border-color:var(--line)">
                                <b style="color:var(--ink)">${pmEsc(f.nome_comercial || f.codigo)}</b>
                                <div class="text-[9px] font-mono" style="color:var(--sage)">${f.codigo}</div>
                            </td>
                            ${planosOrdenados.map(p => ppCelula(p.codigo, f.codigo)).join('')}
                        </tr>
                    `).join('')}
                `).join('')}
            </tbody>
        </table>
    `;
}

function ppVinculo(planoCodigo, funcCodigo) {
    return pmPlanoFuncionalidade.find(pf => pf.plano_codigo === planoCodigo && pf.funcionalidade_codigo === funcCodigo);
}

function ppCelula(planoCodigo, funcCodigo) {
    const v = ppVinculo(planoCodigo, funcCodigo);
    const domId = `pp-${planoCodigo}-${funcCodigo}`.replace(/[^a-zA-Z0-9-_]/g, '_');
    return `
        <td class="p-2 border-b align-top" style="border-color:var(--line)">
            <label class="inline-flex items-center gap-2 cursor-pointer">
                <input type="checkbox" ${v ? 'checked' : ''} onchange="ppToggle('${planoCodigo}','${funcCodigo}', this.checked)">
                <span class="text-[10px]" style="color:var(--sage)">${v ? 'liberado' : 'bloqueado'}</span>
            </label>
            <div id="${domId}" class="mt-1.5 space-y-1 ${v ? '' : 'hidden'}">
                <input type="number" placeholder="sem limite" value="${v?.limite ?? ''}"
                    onchange="ppAtualizarCampo('${planoCodigo}','${funcCodigo}','limite', this.value === '' ? null : Number(this.value))"
                    class="w-full p-1 border rounded text-[11px]">
                <input type="number" placeholder="avisar a partir de" value="${v?.limite_aviso ?? ''}"
                    onchange="ppAtualizarCampo('${planoCodigo}','${funcCodigo}','limite_aviso', this.value === '' ? null : Number(this.value))"
                    class="w-full p-1 border rounded text-[11px]">
                <select onchange="ppAtualizarCampo('${planoCodigo}','${funcCodigo}','id_categoria', this.value || null)" class="w-full p-1 border rounded text-[11px]">
                    <option value="">categoria/reset —</option>
                    ${pmCategorias.map(cat => `<option value="${cat.id_categoria_licenca}" ${v?.id_categoria === cat.id_categoria_licenca ? 'selected' : ''}>${cat.nome} · ${cat.tipo_reset}</option>`).join('')}
                </select>
                <select onchange="ppAtualizarCampo('${planoCodigo}','${funcCodigo}','id_oferta_upsell', this.value || null)" class="w-full p-1 border rounded text-[11px]">
                    <option value="">upsell —</option>
                    ${pmPlanos.map(p2 => `<option value="${p2.codigo}" ${v?.id_oferta_upsell === p2.codigo ? 'selected' : ''}>${p2.descricao}</option>`).join('')}
                </select>
                <textarea rows="2" placeholder="aviso ao atingir (texto que o cliente lê no app/bot; vazio = padrão)" onchange="ppAtualizarCampo('${planoCodigo}','${funcCodigo}','aviso_padrao_funcionalidade', this.value.trim() || null)" class="w-full p-1 border rounded text-[11px]">${pmEsc(v?.aviso_padrao_funcionalidade || '')}</textarea>
            </div>
        </td>
    `;
}

async function ppToggle(planoCodigo, funcCodigo, marcado) {
    if (marcado) {
        const { error } = await dbAuth.from('plano_funcionalidade').insert({ plano_codigo: planoCodigo, funcionalidade_codigo: funcCodigo });
        if (error) { alert('Erro ao vincular: ' + error.message); return; }
    } else {
        const { error } = await dbAuth.from('plano_funcionalidade').delete()
            .eq('plano_codigo', planoCodigo).eq('funcionalidade_codigo', funcCodigo);
        if (error) { alert('Erro ao desvincular: ' + error.message); return; }
    }
    await pmCarregarTudo();
    ppRenderizar();
}

async function ppAtualizarCampo(planoCodigo, funcCodigo, campo, valor) {
    const { error } = await dbAuth.from('plano_funcionalidade')
        .update({ [campo]: valor })
        .eq('plano_codigo', planoCodigo).eq('funcionalidade_codigo', funcCodigo);
    if (error) { alert('Erro ao salvar: ' + error.message); return; }
    // Atualiza só o estado local (sem recarregar tudo) pra não perder foco/scroll.
    const v = ppVinculo(planoCodigo, funcCodigo);
    if (v) v[campo] = valor;
}
