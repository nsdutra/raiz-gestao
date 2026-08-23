// ============================================================================
// js/telas/parametros-planos.js — Raiz Gestão
//
// v0.8.1 (novo arquivo) — "Planos & Limites": matriz plano × funcionalidade,
// substituindo a lista com "abrir detalhe" da v0.7.0. Cada célula é um
// toggle (vínculo em plano_funcionalidade); quando ligado, expande campos
// de limite/limite_aviso/categoria/upsell — mesmos 4 campos que já existem
// na tabela (plano_funcionalidade.limite, limite_aviso, id_categoria,
// id_oferta_upsell), só que agora editáveis inline na matriz em vez de
// numa lista expansível por plano.
//
// Autosave por célula (mesmo padrão da v0.7.0: onchange já salva, sem
// botão "salvar tudo" — mais simples e sem risco de perder edição em
// múltiplas células por esquecer de clicar salvar).
//
// "Contador real implementado hoje: imóveis e contratos" — bloco
// informativo fixo, porque plano_funcionalidade.limite é só a DEFINIÇÃO
// do teto; fn_verificar_limite() (produção) só mede consumo de verdade
// pra imoveis.criar e contratos.criar. Não afirmamos "consumo" pras
// demais linhas.
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
            ${gestaoCardMetricaLocal('Categorias', pmCategorias.length)}
        </div>

        <!-- Mobile (<768px): plano primeiro, lista vertical (seção 6.1 do prompt v0.9.0) -->
        <div class="md:hidden rounded-2xl border-2 overflow-hidden mb-4" style="border-color:var(--line);background:#fff">
            <div class="p-4 border-b" style="border-color:var(--line)">
                <b class="text-sm" style="color:var(--ink)">Funcionalidades por plano</b>
                <div class="flex gap-2 overflow-x-auto mt-2 pb-1" id="pp-mobile-tabs"></div>
            </div>
            <div id="pp-mobile-lista" class="p-3 space-y-2"></div>
        </div>

        <!-- Desktop (≥768px): matriz comparativa -->
        <div class="hidden md:block rounded-2xl border-2 overflow-hidden" style="border-color:var(--line);background:#fff">
            <div class="p-4 border-b flex items-center justify-between" style="border-color:var(--line)">
                <div>
                    <b class="text-sm" style="color:var(--ink)">Matriz plano × funcionalidade</b>
                    <p class="text-[11px] mt-0.5" style="color:var(--sage)">Marque pra liberar a funcionalidade no plano. Campos de limite aparecem só quando marcado.</p>
                </div>
            </div>
            <div class="overflow-x-auto" id="pp-matrix"></div>
        </div>

        <div class="grid md:grid-cols-2 gap-4 mt-4">
            <div class="p-4 rounded-2xl border-2" style="border-color:var(--line);background:#fff">
                <b class="text-sm" style="color:var(--ink)">Regra de limites</b>
                <p class="text-xs mt-1" style="color:var(--sage)">Limite do plano + override por empresa.</p>
                <div class="bg-slate-50 border-2 border-slate-300 rounded-xl p-3 mt-3 text-xs">
                    <b>Prioridade</b>
                    <ol class="list-decimal pl-5 mt-2 space-y-1" style="color:var(--sage)">
                        <li>Override na licença da empresa (licencas.limite_imoveis / limite_contratos)</li>
                        <li>Limite em plano_funcionalidade</li>
                        <li>Sem limite = acesso liberado</li>
                    </ol>
                </div>
            </div>
            <div class="p-4 rounded-2xl border-2" style="border-color:var(--line);background:#fff">
                <b class="text-sm" style="color:var(--ink)">Contador real implementado hoje</b>
                <p class="text-xs mt-1" style="color:var(--sage)">Não confundir definição de limite com medição de consumo — fn_verificar_limite() só mede estas duas:</p>
                <div class="grid grid-cols-2 gap-2 mt-3">
                    <div class="bg-slate-50 border-2 border-slate-300 rounded-xl p-3 text-xs"><b>Imóveis</b><div class="text-[10px] mt-1" style="color:var(--success)">contador implementado</div></div>
                    <div class="bg-slate-50 border-2 border-slate-300 rounded-xl p-3 text-xs"><b>Contratos</b><div class="text-[10px] mt-1" style="color:var(--success)">contador implementado</div></div>
                </div>
                <p class="text-[10px] mt-2" style="color:var(--sage)">Para as demais funcionalidades, o limite abaixo é só a definição — ainda sem contador genérico de uso no banco.</p>
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

    const lista = document.getElementById('pp-mobile-lista');
    if (!lista) return;
    if (!ppPlanoMobileAtivo) { lista.innerHTML = `<p class="text-xs text-center py-4" style="color:var(--sage)">Nenhum plano cadastrado ainda.</p>`; return; }

    lista.innerHTML = pmFuncionalidades.map(f => {
        const v = ppVinculo(ppPlanoMobileAtivo, f.codigo);
        return `
        <div class="p-3 rounded-xl border" style="border-color:var(--line)">
            <div class="flex items-center justify-between gap-2">
                <div class="min-w-0">
                    <b class="text-xs" style="color:var(--ink)">${f.codigo}</b>
                    <div class="text-[10px] truncate" style="color:var(--sage)">${f.nome_comercial || f.descricao}</div>
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
            ` : ''}
        </div>`;
    }).join('');
}

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

    // Agrupa funcionalidades por módulo (tipo_modulo_id -> tipo_modulos.id).
    const semModulo = { id: null, nome: 'Sem módulo' };
    const grupos = new Map();
    pmFuncionalidades.forEach(f => {
        const mod = pmModulos.find(m => m.id === f.tipo_modulo_id) || semModulo;
        const chave = mod.id || '_sem_modulo';
        if (!grupos.has(chave)) grupos.set(chave, { modulo: mod, itens: [] });
        grupos.get(chave).itens.push(f);
    });

    el.innerHTML = `
        <table class="w-full text-xs" style="border-collapse:separate;border-spacing:0">
            <thead>
                <tr>
                    <th class="sticky left-0 bg-white text-left p-2 border-b" style="border-color:var(--line);min-width:200px">Funcionalidade</th>
                    ${planosOrdenados.map(p => `<th class="p-2 border-b text-left" style="border-color:var(--line);min-width:170px;${p.ativo ? '' : 'opacity:.5'}">${p.descricao}${p.ativo ? '' : ' <span class="text-[9px]">(inativo)</span>'}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${Array.from(grupos.values()).map(g => `
                    <tr><td colspan="${planosOrdenados.length + 1}" class="p-2 pt-4 text-[10px] font-bold uppercase" style="color:var(--sage)">${g.modulo.nome}</td></tr>
                    ${g.itens.map(f => `
                        <tr>
                            <td class="sticky left-0 bg-white p-2 border-b align-top" style="border-color:var(--line)">
                                <b style="color:var(--ink)">${f.codigo}</b>
                                <div class="text-[9px]" style="color:var(--sage)">${f.nome_comercial || f.descricao}</div>
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
