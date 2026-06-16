// CORE ENGINE V4.0.0 (Efeito Cascata Protetor, Cards Premium Blindados e Bugfixes de Ortografia)
let dataAncorada = new Date();
let despesas = JSON.parse(localStorage.getItem('fin_despesas')) || [];
let receitas = JSON.parse(localStorage.getItem('fin_receitas')) || [];
let categoriasDisponiveis = JSON.parse(localStorage.getItem('fin_categorias')) || ["Moradia", "Alimentação", "Transporte", "Lazer"];
let projetosProjetados = JSON.parse(localStorage.getItem('fin_projetos')) || [];

let modoFormulario = "despesa"; 
let filtroExtratoAtual = "todos"; // todos | despesas | receitas
let categoriasSelecionadasGrafico = [...categoriasDisponiveis];
let chart1, chart2, chart3;

const mesesExtenso = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function formatarDataBR(isoString) {
    if(!isoString) return '';
    const d = new Date(isoString);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
}

function atualizarInterfacePeriodo() {
    document.getElementById('txt-periodo-atual').innerText = `${mesesExtenso[dataAncorada.getMonth()]} ${dataAncorada.getFullYear()}`;
    renderizarLançamentos();
    renderizarHistoricoGeral();
}

function movimientoPertenceAoPeriodo(item, mesAlvo, anoAlvo) {
    const dataItem = new Date(item.dataCriacao);
    if (anoAlvo < dataItem.getFullYear() || (anoAlvo === dataItem.getFullYear() && mesAlvo < dataItem.getMonth())) return false;
    
    if (item.tipo === 'variavel') {
        return anoAlvo === dataItem.getFullYear() && mesAlvo === dataItem.getMonth();
    }
    if (item.tipo === 'fixo') {
        if (item.validadeAte) {
            const [anoLimite, mesLimite] = item.validadeAte.split('-').map(Number);
            if (anoAlvo > anoLimite || (anoAlvo === anoLimite && mesAlvo > (mesLimite - 1))) return false;
        }
        return true;
    }
    return false;
}

function calcularSaldoRealHojeEstatico() {
    const hoje = new Date();
    const mesHoje = hoje.getMonth();
    const anoHoje = hoje.getFullYear();

    let todasDatas = [...despesas, ...receitas].map(x => new Date(x.dataCriacao));
    if (todasDatas.length === 0) return 0;

    let menorData = new Date(Math.min(...todasDatas));
    let dataVarredura = new Date(menorData.getFullYear(), menorData.getMonth(), 1);
    let dataLimiteHoje = new Date(anoHoje, mesHoje + 1, 1);

    let saldoCalculadoAtéHoje = 0;

    while (dataVarredura < dataLimiteHoje) {
        const vMes = dataVarredura.getMonth();
        const vAno = dataVarredura.getFullYear();

        const recs = receitas.filter(r => movimientoPertenceAoPeriodo(r, vMes, vAno));
        const desps = despesas.filter(d => movimientoPertenceAoPeriodo(d, vMes, vAno));

        saldoCalculadoAtéHoje += (recs.reduce((sum, r) => sum + r.valor, 0) - desps.reduce((sum, d) => sum + d.valor, 0));
        dataVarredura.setMonth(dataVarredura.getMonth() + 1);
    }
    return saldoCalculadoAtéHoje;
}

function calcularProjecaoCascataAtePeriodo(mesAlvo, anoAlvo) {
    const hoje = new Date();
    const mesHoje = hoje.getMonth();
    const anoHoje = hoje.getFullYear();

    let ponteiroSaldoAcumulado = calcularSaldoRealHojeEstatico();

    let todasDatas = [...despesas, ...receitas].map(x => new Date(x.dataCriacao));
    if (todasDatas.length === 0) return 0;

    let menorData = new Date(Math.min(...todasDatas));
    
    let dataVarredura = new Date(anoHoje, mesHoje + 1, 1);
    let dataDestinoAlvo = new Date(anoAlvo, mesAlvo + 1, 1);

    if (dataDestinoAlvo <= dataVarredura) {
        let saldoPassado = 0;
        let scan = new Date(menorData.getFullYear(), menorData.getMonth(), 1);
        let limiteSuperior = new Date(anoAlvo, mesAlvo + 1, 1);
        while (scan < limiteSuperior) {
            const m = scan.getMonth(); const a = scan.getFullYear();
            saldoPassado += (receitas.filter(r => movimientoPertenceAoPeriodo(r, m, a)).reduce((s,r)=>s+r.valor,0) - despesas.filter(d => movimientoPertenceAoPeriodo(d, m, a)).reduce((s,d)=>s+d.valor,0));
            scan.setMonth(scan.getMonth() + 1);
        }
        return saldoPassado;
    }

    while (dataVarredura < dataDestinoAlvo) {
        const vMes = dataVarredura.getMonth();
        const vAno = dataVarredura.getFullYear();

        const recsFuturas = receitas.filter(r => movimientoPertenceAoPeriodo(r, vMes, vAno));
        const despsFuturas = despesas.filter(d => movimientoPertenceAoPeriodo(d, vMes, vAno));

        ponteiroSaldoAcumulado += (recsFuturas.reduce((sum, r) => sum + r.valor, 0) - despsFuturas.reduce((sum, d) => sum + d.valor, 0));
        dataVarredura.setMonth(dataVarredura.getMonth() + 1);
    }

    return ponteiroSaldoAcumulado;
}

// EXPOSIÇÃO EXPLICITA GLOBAL DA ALTERNÂNCIA DOS SUB-PAINÉIS (CORRIGE O PRIMEIRO ERRO)
window.abrirSubPainel = function(idAlvo) {
    const paineis = ['saldo-real', 'saldo', 'receitas', 'despesas', 'metas'];
    paineis.forEach(id => {
        const elemento = document.getElementById(`subpainel-${id}`);
        if (elemento) {
            if (id === idAlvo) {
                elemento.classList.toggle('hidden');
                if (!elemento.classList.contains('hidden')) {
                    elemento.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }
            } else {
                elemento.classList.add('hidden');
            }
        }
    });
};

// EXPOSIÇÃO GLOBAL DA FUNÇÃO DO SIMULADOR COM O NOME EXATO DO HTML (CORRIGE O SEGUNDO ERRO)
window.atualizarSimuladorCortes = function() {
    const sliderLazer = document.getElementById('slider-corte-lazer');
    const sliderCompras = document.getElementById('slider-corte-compras');
    
    if (!sliderLazer || !sliderCompras) return;

    const pctLazer = parseInt(sliderLazer.value);
    const pctCompras = parseInt(sliderCompras.value);

    document.getElementById('txt-corte-lazer-porcentagem').innerText = `${pctLazer}%`;
    document.getElementById('txt-corte-compras-porcentagem').innerText = `${pctCompras}%`;

    const mes = dataAncorada.getMonth();
    const ano = dataAncorada.getFullYear();
    const despesasDoMes = despesas.filter(d => movimientoPertenceAoPeriodo(d, mes, ano));

    const totalLazerReal = despesasDoMes.filter(d => d.categoria === "Lazer").reduce((sum, d) => sum + d.valor, 0);
    const totalComprasReal = despesasDoMes.filter(d => d.categoria === "Alimentação").reduce((sum, d) => sum + d.valor, 0);

    const poupadoLazer = totalLazerReal * (pctLazer / 100);
    const poupadoCompras = totalComprasReal * (pctCompras / 100);
    const economiaTotalCalculada = poupadoLazer + poupadoCompras;

    document.getElementById('txt-corte-lazer-poupado').innerText = `R$ ${poupadoLazer.toFixed(2)}`;
    document.getElementById('txt-corte-compras-poupado').innerText = `R$ ${poupadoCompras.toFixed(2)}`;
    document.getElementById('txt-corte-economia-total').innerText = `R$ ${economiaTotalCalculada.toFixed(2)}`;
};

function renderizarLançamentos() {
    const mes = dataAncorada.getMonth();
    const ano = dataAncorada.getFullYear();
    
    const despesasDoMes = despesas.filter(d => movimientoPertenceAoPeriodo(d, mes, ano));
    const receitasDoMes = receitas.filter(r => movimientoPertenceAoPeriodo(r, mes, ano));

    const totalReceitas = receitasDoMes.reduce((sum, r) => sum + r.valor, 0);
    const totalDespesas = despesasDoMes.reduce((sum, d) => sum + d.valor, 0);

    const saldoDisponivelHojeReal = calcularSaldoRealHojeEstatico(); 
    const saldoProjetadoFinalPeriodo = calcularProjecaoCascataAtePeriodo(mes, ano);

    document.getElementById('card-receitas').innerText = `+ R$ ${totalReceitas.toFixed(2)}`;
    document.getElementById('card-despesas').innerText = `- R$ ${totalDespesas.toFixed(2)}`;
    
    document.getElementById('card-saldo-real').innerText = `R$ ${saldoDisponivelHojeReal.toFixed(2)}`;
    const cardRealContainer = document.getElementById('card-saldo-real');
    cardRealContainer.className = `text-2xl font-bold mt-1 ${saldoDisponivelHojeReal < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`;
    
    document.getElementById('card-saldo').innerText = `R$ ${saldoProjetadoFinalPeriodo.toFixed(2)}`;
    const cardSaldoContainer = document.getElementById('card-saldo');
    cardSaldoContainer.className = `text-2xl font-bold mt-1 ${saldoProjetadoFinalPeriodo < 0 ? 'text-red-500' : 'text-purple-600 dark:text-purple-400'}`;

    if(document.getElementById('txt-saldo-real-calculo')) {
        document.getElementById('txt-saldo-real-calculo').innerText = `Balanço real imediato em conta. Caixa imutável do presente momento corrente.`;
    }
    if(document.getElementById('txt-reserva-calculo')) {
        document.getElementById('txt-reserva-calculo').innerText = `Previsão matemática calculada para o fim de ${mesesExtenso[mes]} de ${ano} considerando o efeito bola de neve intermediário: R$ ${saldoProjetadoFinalPeriodo.toFixed(2)}.`;
    }

    // REATIVIDADE DO MODO HARDCORE (CARD 1 - LOTE 2)
    const hoje = new Date();
    const ultimoDiaMes = new Date(ano, mes + 1, 0).getDate();
    const diasRestantes = Math.max(1, (ultimoDiaMes - hoje.getDate()) + 1);
    const limiteDiarioSeguro = saldoDisponivelHojeReal > 0 ? (saldoDisponivelHojeReal / diasRestantes) : 0;
    
    if(document.getElementById('txt-hardcore-limite')) {
        document.getElementById('txt-hardcore-limite').innerText = `R$ ${limiteDiarioSeguro.toFixed(2)}`;
    }
    if(document.getElementById('txt-hardcore-porcentagem')) {
        const pctVida = Math.min(100, Math.max(0, (saldoDisponivelHojeReal / 5000) * 100));
        document.getElementById('txt-hardcore-porcentagem').innerText = `${pctVida.toFixed(0)}%`;
        const barraVida = document.getElementById('barra-hardcore-vida');
        if(barraVida) barraVida.style.width = `${pctVida}%`;
    }

    // REATIVIDADE DO TERMÔMETRO DE SOBRA (CARD 2 - LOTE 1)
    const sobraCalculada = Math.max(0, saldoProjetadoFinalPeriodo);
    if(document.getElementById('txt-alocacao-metas')) document.getElementById('txt-alocacao-metas').innerText = `R$ ${(sobraCalculada * 0.5).toFixed(2)}`;
    if(document.getElementById('txt-alocacao-reserva')) document.getElementById('txt-alocacao-reserva').innerText = `R$ ${(sobraCalculada * 0.3).toFixed(2)}`;
    if(document.getElementById('txt-alocacao-lazer')) document.getElementById('txt-alocacao-lazer').innerText = `R$ ${(sobraCalculada * 0.2).toFixed(2)}`;

    // REATIVIDADE DO B-A-BA (CARD 3)
    if(document.getElementById('txt-ba-poupanca')) document.getElementById('txt-ba-poupanca').innerText = `R$ ${(totalReceitas * 0.06).toFixed(2)}`;
    if(document.getElementById('txt-ba-cdb')) document.getElementById('txt-ba-cdb').innerText = `R$ ${(totalReceitas * 0.1075).toFixed(2)}`;
    if(document.getElementById('txt-ba-selic')) document.getElementById('txt-ba-selic').innerText = `R$ ${(totalReceitas * 0.1075).toFixed(2)}`;

    // Calibração em tempo real dos sliders baseados nas movimentações registradas
    window.atualizarSimuladorCortes();

    const banner = document.getElementById('status-geral-banner');
    const tituloBanner = document.getElementById('status-geral-titulo');
    const descBanner = document.getElementById('status-geral-desc');
    const dAlerta = document.getElementById('container-alertas-gargalo');
    
    let categoriesGargalo = [];
    let gastosPorCat = {};
    despesasDoMes.forEach(d => gastosPorCat[d.categoria] = (gastosPorCat[d.categoria] || 0) + d.valor);
    
    if(totalReceitas > 0) {
        Object.entries(gastosPorCat).forEach(([cat, val]) => {
            if(val / totalReceitas > 0.30) categoriesGargalo.push(cat);
        });
    }
    if(dAlerta) {
        if(categoriesGargalo.length > 0) {
            dAlerta.classList.remove('hidden');
            dAlerta.innerHTML = `⚠️ Alerta de Linha: Categoria(s) <strong>${categoriesGargalo.join(', ')}</strong> consumiram mais de 30% da renda do período!`;
        } else {
            dAlerta.classList.add('hidden');
        }
    }

    if (banner && tituloBanner && descBanner) {
        if (totalReceitas === 0 && totalDespesas === 0) {
            banner.className = "p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-50 border-slate-300 dark:bg-slate-900 dark:border-slate-800";
            tituloBanner.innerText = "Painel Planejado! ☕";
            descBanner.innerText = "Nenhuma movimentação encontrada para o mês selecionado.";
        } else if (saldoProjetadoFinalPeriodo < 0) {
            banner.className = "p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-red-50 border-red-300 text-red-900 dark:bg-red-950/40 dark:border-red-900 dark:text-red-200";
            tituloBanner.innerText = "Déficit Orçamentário Alvo! 🚨";
            descBanner.innerText = `A projeção indica saldo negativo acumulado de R$ ${Math.abs(saldoProjetadoFinalPeriodo).toFixed(2)} para este período.`;
        } else {
            banner.className = "p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-3 bg-emerald-50 border-emerald-300 text-emerald-900 dark:bg-emerald-950/40 dark:border-emerald-900 dark:text-emerald-200";
            tituloBanner.innerText = "Projeção Saudável! 🚀";
            descBanner.innerText = `Seu caixa acumulado se mantém positivo e sustentável até o fim do período selecionado.`;
        }
    }

    const h2Titulo = document.getElementById('titulo-painel-extrato');
    const thSaldo = document.getElementById('th-saldo-progressivo');
    
    let itensUnificados = [
        ...despesasDoMes.map(d => ({...d, fluxo: 'despesa'})),
        ...receitasDoMes.map(r => ({...r, fluxo: 'receita', categoria: 'Renda'}))
    ].sort((a,b) => new Date(a.dataCriacao) - new Date(b.dataCriacao));

    let baseAcumuladaAnteriorAoMes = calcularProjecaoCascataAtePeriodo(mes - 1, mes === 0 ? ano - 1 : ano);
    let ponteiroSaldo = baseAcumuladaAnteriorAoMes;
    itensUnificados.forEach(item => {
        if(item.fluxo === 'receita') {
            ponteiroSaldo += item.valor;
        } else {
            ponteiroSaldo -= item.valor;
        }
        item.saldoAposLinha = ponteiroSaldo;
    });

    let itensExibidos = [...itensUnificados];
    if(filtroExtratoAtual === 'despesas') {
        itensExibidos = itensUnificados.filter(x => x.fluxo === 'despesa');
        h2Titulo.innerHTML = `<i data-lucide="trending-down" class="w-5 h-5 text-red-500"></i> Despesas do Período`;
        thSaldo.classList.add('hidden');
    } else if(filtroExtratoAtual === 'receitas') {
        itensExibidos = itensUnificados.filter(x => x.fluxo === 'receita');
        h2Titulo.innerHTML = `<i data-lucide="trending-up" class="w-5 h-5 text-emerald-500"></i> Receitas do Período`;
        thSaldo.classList.add('hidden');
    } else {
        h2Titulo.innerHTML = `<i data-lucide="list-checks" class="w-5 h-5 text-purple-600"></i> Extrato Geral`;
        thSaldo.classList.remove('hidden');
    }

    itensExibidos.sort((a,b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));

    const tabelaCorpo = document.getElementById('tabela-extrato-unificado-corpo');
    if(itensExibidos.length === 0) {
        tabelaCorpo.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400 text-xs">Nenhum registro encontrado para este filtro neste mês.</td></tr>`;
    } else {
        tabelaCorpo.innerHTML = itensExibidos.map(item => {
            const isDesp = item.fluxo === 'despesa';
            return `
                <tr class="border-b text-sm dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td class="py-2.5 text-xs font-semibold text-slate-500">${formatarDataBR(item.dataCriacao)}</td>
                    <td class="py-2.5 font-medium">
                        ${item.nome}
                        <span class="block text-[10px] text-slate-400">${item.categoria}</span>
                    </td>
                    <td class="py-2.5 uppercase text-xs text-slate-500">${item.tipo || 'variavel'}</td>
                    <td class="py-2.5 text-right font-medium ${isDesp ? 'text-red-500' : 'text-emerald-500'}">
                        ${isDesp ? '-' : '+'} R$ ${item.valor.toFixed(2)}
                    </td>
                    <td class="py-2.5 text-right font-semibold text-slate-600 dark:text-slate-400 ${filtroExtratoAtual !== 'todos' ? 'hidden' : ''}">
                        R$ ${item.saldoAposLinha.toFixed(2)}
                    </td>
                    <td class="py-2.5 text-center space-x-2">
                        <button onclick="carregarItemParaEdicao('${item.id}', '${item.fluxo}')" class="text-purple-500 hover:text-purple-700 font-medium text-xs">Editar</button>
                        <button onclick="excluirItem('${item.id}', '${item.fluxo}')" class="text-slate-400 hover:text-red-500 text-xs">Excluir</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    let topCats = Object.entries(gastosPorCat).sort((a,b)=>b[1]-a[1]).slice(0,2).map(c => `${c[0]} (R$ ${c[1].toFixed(2)})`);
    document.getElementById('txt-maiores-gargalos').innerText = topCats.length ? `Seus maiores gastos se concentram em: ${topCats.join(' e ')}.` : 'Nenhum gasto registrado.';

    lucide.createIcons();
    renderizarProjetos(totalReceitas);
    atualizarFiltrosEGráficos(despesasDoMes, totalReceitas, totalDespesas);
}

function renderizarHistoricoGeral() {
    const busca = document.getElementById('busca-historico').value.toLowerCase();
    const catFiltro = document.getElementById('filtro-cat-historico').value;
    const tBodyH = document.getElementById('tabela-historico-geral-corpo');

    let unificado = [
        ...despesas.map(d => ({...d, fluxo: 'despesa'})),
        ...receitas.map(r => ({...r, fluxo: 'receita', categoria: 'Renda'}))
    ].sort((a,b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));

    let filtrado = unificado.filter(item => {
        const bateTexto = item.nome.toLowerCase().includes(busca);
        const bateCat = catFiltro === 'todos' || item.categoria === catFiltro;
        return bateTexto && bateCat;
    });

    tBodyH.innerHTML = filtrado.map(item => `
        <tr class="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/20 text-xs">
            <td class="py-2">${item.fluxo === 'despesa' ? '🔻 Despesa' : '🔺 Receita'}</td>
            <td>${formatarDataBR(item.dataCriacao)}</td>
            <td class="font-medium">${item.nome}</td>
            <td class="text-slate-400">${item.categoria} (${item.tipo})</td>
            <td class="text-right font-bold ${item.fluxo === 'despesa' ? 'text-red-500' : 'text-emerald-500'}">
                ${item.fluxo === 'despesa' ? '-' : '+'} R$ ${item.valor.toFixed(2)}
            </td>
        </tr>
    `).join('');
}

function configurarSeletoresExtrato() {
    const btnTodos = document.getElementById('filtro-extrato-todos');
    const btnDesp = document.getElementById('filtro-extrato-despesas');
    const btnRecs = document.getElementById('filtro-extrato-receitas');

    const resetEstilos = () => {
        [btnTodos, btnDesp, btnRecs].forEach(b => {
            b.className = "px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all";
        });
    };

    btnTodos.onclick = () => {
        resetEstilos(); filtroExtratoAtual = "todos";
        btnTodos.className = "px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-sm transition-all";
        renderizarLançamentos();
    };

    btnDesp.onclick = () => {
        resetEstilos(); filtroExtratoAtual = "despesas";
        btnDesp.className = "px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-red-500 font-bold shadow-sm transition-all";
        renderizarLançamentos();
    };

    btnRecs.onclick = () => {
        resetEstilos(); filtroExtratoAtual = "receitas";
        btnRecs.className = "px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 text-emerald-500 font-bold shadow-sm transition-all";
        renderizarLançamentos();
    };
}

window.carregarItemParaEdicao = function(id, fluxo) {
    const item = fluxo === 'despesa' ? despesas.find(x=>x.id===id) : receitas.find(x=>x.id===id);
    if(!item) return;

    document.getElementById('lancamento-id-edicao').value = item.id;
    document.getElementById('lancamento-nome').value = item.nome;
    document.getElementById('lancamento-valor').value = item.valor;
    document.getElementById('lancamento-data').value = item.dataCriacao.split('T')[0];
    document.getElementById('despesa-tipo').value = item.tipo || 'variavel';
    document.getElementById('despesa-validade').value = item.validadeAte || '';

    if(fluxo === 'despesa') {
        document.getElementById('tab-despesa').click();
        document.getElementById('despesa-categoria').value = categoriasDisponiveis.includes(item.categoria) ? item.categoria : 'Outros';
        if(document.getElementById('despesa-categoria').value === 'Outros') {
            document.getElementById('bloco-nova-categoria').classList.remove('hidden');
            document.getElementById('despesa-nova-categoria-nome').value = item.categoria;
        }
    } else {
        document.getElementById('tab-receita').click();
    }

    document.getElementById('btn-submit-unificado').innerText = "Salvar Alterações";
    document.getElementById('btn-cancelar-edicao').classList.remove('hidden');
    document.getElementById('form-lancamento-unificado').scrollIntoView({ behavior: 'smooth' });
};

document.getElementById('btn-cancelar-edicao').onclick = () => {
    document.getElementById('form-lancamento-unificado').reset();
    document.getElementById('lancamento-id-edicao').value = "";
    document.getElementById('btn-submit-unificado').innerText = "Adicionar Lançamento";
    document.getElementById('btn-cancelar-edicao').classList.add('hidden');
    document.getElementById('bloco-nova-categoria').classList.add('hidden');
    document.getElementById('bloco-validade-fixo').classList.add('hidden');
    document.getElementById('tab-despesa').click();
};

function configurarAbasFormulario() {
    const tabDespesa = document.getElementById('tab-despesa');
    const tabReceita = document.getElementById('tab-receita');
    const bCategoria = document.getElementById('bloco-select-categoria');
    const bTipoGasto = document.getElementById('bloco-tipo-gasto');
    const bValidade = document.getElementById('bloco-validade-fixo');
    const bNovaCat = document.getElementById('bloco-nova-categoria');
    const lblTipo = document.getElementById('lbl-tipo-fluxo');
    const titulo = document.getElementById('titulo-lancamento-unificado');
    const btnSubmit = document.getElementById('btn-submit-unificado');

    tabDespesa.onclick = () => {
        modoFormulario = "despesa";
        tabDespesa.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-red-600 text-white shadow-sm";
        tabReceita.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900";
        titulo.innerHTML = `📉 Nova Despesa`;
        if(document.getElementById('lancamento-id-edicao').value === "") {
            btnSubmit.className = "w-full bg-red-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors";
            btnSubmit.innerText = "Adicionar Lançamento";
        }
        bCategoria.classList.remove('hidden');
        bTipoGasto.classList.remove('hidden');
        lblTipo.innerText = "Tipo de Gasto";
        if(document.getElementById('despesa-tipo').value === 'fixo') bValidade.classList.remove('hidden');
        if(document.getElementById('despesa-categoria').value === 'Outros') bNovaCat.classList.remove('hidden');
    };

    tabReceita.onclick = () => {
        modoFormulario = "receita";
        tabReceita.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all bg-emerald-600 text-white shadow-sm";
        tabDespesa.className = "flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900";
        titulo.innerHTML = `📈 Nova Receita`;
        if(document.getElementById('lancamento-id-edicao').value === "") {
            btnSubmit.className = "w-full bg-emerald-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors";
            btnSubmit.innerText = "Adicionar Lançamento";
        }
        bCategoria.classList.add('hidden');
        bNovaCat.classList.add('hidden');
        lblTipo.innerText = "Tipo de Receita";
        if(document.getElementById('despesa-tipo').value === 'fixo') bValidade.classList.remove('hidden');
    };
}

document.getElementById('form-lancamento-unificado').onsubmit = (e) => {
    e.preventDefault();
    const idEdicao = document.getElementById('lancamento-id-edicao').value;
    const nome = document.getElementById('lancamento-nome').value;
    const valor = parseFloat(document.getElementById('lancamento-valor').value);
    const dataTransacao = new Date(document.getElementById('lancamento-data').value + "T12:00:00");
    const tipo = document.getElementById('despesa-tipo').value;
    const validade = document.getElementById('despesa-validade').value || null;

    if(idEdicao) {
        despesas = despesas.filter(x => x.id !== idEdicao);
        receitas = receitas.filter(x => x.id !== idEdicao);
    }

    if (modoFormulario === 'despesa') {
        let cat = document.getElementById('despesa-categoria').value;
        if(cat === 'Outros') {
            const nova = document.getElementById('despesa-nova-categoria-nome').value.trim();
            if(nova) { 
                cat = nova; 
                if(!categoriasDisponiveis.includes(cat)) { 
                    categoriasDisponiveis.push(cat); 
                    categoriasSelecionadasGrafico.push(cat); 
                    localStorage.setItem('fin_categorias', JSON.stringify(categoriasDisponiveis)); 
                } 
            }
        }
        despesas.push({
            id: idEdicao || 'd_' + Math.random().toString(36).substr(2, 9),
            nome: nome, valor: valor, categoria: cat, tipo: tipo, validadeAte: validade,
            dataCriacao: dataTransacao.toISOString()
        });
        localStorage.setItem('fin_despesas', JSON.stringify(despesas));
    } else {
        receitas.push({ 
            id: idEdicao || 'r_' + Math.random().toString(36).substr(2, 9), 
            nome: nome, valor: valor, categoria: 'Renda', tipo: tipo, validadeAte: validade,
            dataCriacao: dataTransacao.toISOString() 
        });
        localStorage.setItem('fin_receitas', JSON.stringify(receitas));
    }

    document.getElementById('lancamento-id-edicao').value = "";
    document.getElementById('btn-cancelar-edicao').classList.add('hidden');
    document.getElementById('btn-submit-unificado').innerText = "Adicionar Lançamento";
    e.target.reset();
    document.getElementById('bloco-nova-categoria').classList.add('hidden');
    document.getElementById('bloco-validade-fixo').classList.add('hidden');
    document.getElementById('tab-despesa').click();
    atualizarInterfacePeriodo();
};

function renderizarProjetos(rendaMensal) {
    const tBodyP = document.getElementById('tabela-projetos-corpo');
    tBodyP.innerHTML = '';
    let totalMensalDemandado = 0;

    projetosProjetados.forEach(p => {
        const hoje = new Date();
        const dataAlvo = new Date(p.dataAlvo);
        let mesesRestantes = (dataAlvo.getFullYear() - hoje.getFullYear()) * 12 + (dataAlvo.getMonth() - hoje.getMonth());
        if (mesesRestantes <= 0) mesesRestantes = 1;

        const demandaMensal = p.valor / mesesRestantes;
        totalMensalDemandado += demandaMensal;
        const porcentagemRenda = rendaMensal > 0 ? (demandaMensal / rendaMensal) * 100 : 0;

        let totalMetasCusto = projetosProjetados.reduce((a, b) => a + b.valor, 0);
        let saldoDisponivelProporcional = calcularSaldoRealHojeEstatico();
        let pctProgresso = totalMetasCusto > 0 ? Math.min(100, Math.max(0, (saldoDisponivelProporcional / totalMetasCusto) * 100)) : 0;

        tBodyP.innerHTML += `
            <tr class="border-b text-xs dark:border-slate-800">
                <td class="py-3 font-bold">${p.nome}</td>
                <td>R$ ${p.valor.toFixed(2)}</td>
                <td class="pr-2">
                    <div class="w-24 bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden flex">
                        <div class="bg-gradient-to-r from-purple-500 to-indigo-500 h-full" style="width: ${pctProgresso}%"></div>
                    </div>
                    <span class="text-[9px] text-slate-400">${pctProgresso.toFixed(0)}% poupado</span>
                </td>
                <td>${p.dataAlvo.split('-').reverse().join('/')}</td>
                <td class="text-purple-600 font-bold">R$ ${demandaMensal.toFixed(2)}/mês</td>
                <td><span class="px-1.5 py-0.5 bg-purple-100 dark:bg-purple-950 rounded text-purple-700">${porcentagemRenda.toFixed(1)}%</span></td>
                <td class="text-center"><button onclick="excluirProjeto('${p.id}')" class="text-red-400 hover:text-red-600">Remover</button></td>
            </tr>
        `;
    });
    const totalComprometidoProjetos = rendaMensal > 0 ? (totalMensalDemandado / rendaMensal) * 100 : 0;
    document.getElementById('card-meta-txt').innerText = `${totalComprometidoProjetos.toFixed(0)}%`;
}

function popularSelectCategorias() {
    const select = document.getElementById('despesa-categoria');
    if(!select) return;
    const prevVal = select.value; select.innerHTML = '';
    categoriasDisponiveis.forEach(c => select.innerHTML += `<option value="${c}">${c}</option>`);
    select.innerHTML += `<option value="Outros">⚙️ Outros (Criar Nova)</option>`;
    if(prevVal) select.value = prevVal;

    const selectH = document.getElementById('filtro-cat-historico');
    if(selectH) {
        selectH.innerHTML = '<option value="todos">Todas Categorias</option>';
        categoriasDisponiveis.forEach(c => selectH.innerHTML += `<option value="${c}">${c}</option>`);
        selectH.innerHTML += '<option value="Renda">Receitas/Renda</option>';
    }
}

function gerenciarIconeTema() {
    const isDark = document.documentElement.classList.contains('dark');
    const icone = document.getElementById('icone-tema');
    
    if(isDark) {
        icone.setAttribute('data-lucide', 'moon');
        icone.style.color = "#a855f7";
    } else {
        icone.setAttribute('data-lucide', 'sun');
        icone.style.color = "#eab308";
    }
    lucide.createIcons();
}

window.excluirItem = function(id, fluxo) {
    if(fluxo === 'despesa') {
        despesas = despesas.filter(x=>x.id!==id);
        localStorage.setItem('fin_despesas', JSON.stringify(despesas));
    } else {
        receitas = receitas.filter(x=>x.id!==id);
        localStorage.setItem('fin_receitas', JSON.stringify(receitas));
    }
    atualizarInterfacePeriodo();
};

document.getElementById('busca-historico').oninput = () => renderizarHistoricoGeral();
document.getElementById('filtro-cat-historico').onchange = () => renderizarHistoricoGeral();
document.getElementById('despesa-categoria').addEventListener('change', (e) => {
    document.getElementById('bloco-nova-categoria').classList.toggle('hidden', e.target.value !== 'Outros');
});
document.getElementById('despesa-tipo').addEventListener('change', (e) => {
    document.getElementById('bloco-validade-fixo').classList.toggle('hidden', e.target.value !== 'fixo');
});

function configurarEfeitoLupaGraficos() {
    const container = document.getElementById('grid-container-graficos');
    const box1 = document.getElementById('box-chart-1');
    const box2 = document.getElementById('box-chart-2');
    const box3 = document.getElementById('box-chart-3');
    const boxes = [box1, box2, box3];

    boxes.forEach((focado, index) => {
        focado.addEventListener('mouseenter', () => {
            if (window.innerWidth >= 1024) {
                let templates = ["0.6fr", "0.6fr", "0.6fr"];
                templates[index] = "1.8fr";
                container.style.gridTemplateColumns = templates.join(" ");
                focado.classList.add("shadow-lg", "border-purple-500/40");
            }
        });
        focado.addEventListener('mouseleave', () => {
            if (window.innerWidth >= 1024) {
                container.style.gridTemplateColumns = "1fr 1fr 1fr";
                focado.classList.remove("shadow-lg", "border-purple-500/40");
            }
        });
    });
}

function inicializarPainelGraficosCollapse() {
    const btn = document.getElementById('btn-toggle-graficos');
    const painel = document.getElementById('painel-graficos');
    const txtStatus = document.getElementById('txt-status-graficos');
    const iconeSeta = document.getElementById('icone-seta-graficos');

    btn.addEventListener('click', () => {
        if(painel.classList.contains('hidden')) {
            painel.classList.remove('hidden');
            txtStatus.innerText = "Clique para Ocultar";
            iconeSeta.style.transform = "rotate(180deg)";
            atualizarInterfacePeriodo();
        } else {
            painel.classList.add('hidden');
            txtStatus.innerText = "Clique para Expandir";
            iconeSeta.style.transform = "rotate(0deg)";
        }
    });
}

function atualizarFiltrosEGráficos(despesasMes, receitaTotal, despesaTotal) {
    const isDark = document.documentElement.classList.contains('dark');
    const corTexto = isDark ? '#94a3b8' : '#64748b';
    const corGrid = isDark ? 'rgba(148, 163, 184, 0.1)' : '#f1f5f9';

    const containerCheck = document.getElementById('container-checkbox-categorias');
    containerCheck.innerHTML = '';

    categoriasDisponiveis.forEach(cat => {
        const checked = categoriasSelecionadasGrafico.includes(cat) ? 'checked' : '';
        const label = document.createElement('label');
        label.className = "flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded cursor-pointer select-none text-[9px]";
        label.innerHTML = `<input type="checkbox" value="${cat}" ${checked}> ${cat}`;
        
        label.querySelector('input').addEventListener('change', (e) => {
            if (e.target.checked) {
                if(!categoriasSelecionadasGrafico.includes(cat)) categoriasSelecionadasGrafico.push(cat);
            } else {
                categoriasSelecionadasGrafico = categoriasSelecionadasGrafico.filter(x => x !== cat);
            }
            mudarDadosGraficoLinhas(despesaTotal);
        });
        containerCheck.appendChild(label);
    });

    popularSelectCategorias();
    mudarDadosGraficoLinhas(despesaTotal);

    if(chart1) chart1.destroy();
    let resumoCats = {}; despesasMes.forEach(d => resumoCats[d.categoria] = (resumoCats[d.categoria]||0)+d.valor);
    chart1 = new Chart(document.getElementById('chartCategorias').getContext('2d'), {
        type: 'doughnut',
        data: { labels: Object.keys(resumoCats), datasets: [{ data: Object.values(resumoCats), backgroundColor: ['#a855f7', '#10b981', '#3b82f6', '#f59e0b', '#ec4899'] }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: corTexto } } } }
    });

    if(chart3) chart3.destroy();
    chart3 = new Chart(document.getElementById('chartProporcao').getContext('2d'), {
        type: 'bar',
        data: { labels: ['Receitas', 'Despesas'], datasets: [{ data: [receitaTotal, despesaTotal], backgroundColor: ['#10b981', '#ef4444'], borderRadius: 8, borderSkipped: false }] },
        options: { 
            responsive: true, maintainAspectRatio: false,
            scales: {
                y: { display: true, grid: { display: true, color: corGrid }, ticks: { color: corTexto } },
                x: { grid: { display: false }, ticks: { color: corTexto } }
            },
            plugins: { legend: { display: false } } 
        }
    });
}

function mudarDadosGraficoLinhas(baseValor) {
    const isDark = document.documentElement.classList.contains('dark');
    const corTexto = isDark ? '#94a3b8' : '#64748b';
    const corGrid = isDark ? 'rgba(148, 163, 184, 0.1)' : '#f1f5f9';
    const periodo = document.getElementById('filtro-linhas-periodo').value;
    const titulo = document.getElementById('titulo-dinamico-linhas');
    
    let textoCategorias = categoriasSelecionadasGrafico.length === categoriasDisponiveis.length ? "Todas" : categoriasSelecionadasGrafico.join(', ');
    if (categoriasSelecionadasGrafico.length === 0) textoCategorias = "Nenhum Filtro";
    titulo.innerText = `${textoCategorias}`;

    let labels = Array.from({length: 30}, (_, i) => `Dia ${i + 1}`);
    if (periodo === '7dias') labels = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
    if (periodo === '6meses') labels = [...mesesExtenso].slice(0,6);

    const datasets = [];
    const cores = ['#a855f7', '#10b981', '#3b82f6', '#f59e0b', '#ec4899'];
    
    categoriasSelecionadasGrafico.forEach((cat, idx) => {
        let mockData = labels.map((_, i) => (baseValor / (categoriasDisponiveis.length || 1)) * (1 + Math.sin(i + idx) * 0.35));
        datasets.push({ label: cat, data: mockData, borderColor: cores[idx % cores.length], tension: 0.25, fill: false });
    });

    if(chart2) chart2.destroy();
    chart2 = new Chart(document.getElementById('chartEvolucao').getContext('2d'), {
        type: 'line',
        data: { labels: labels, datasets: datasets },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { grid: { color: corGrid }, ticks: { color: corTexto } }, x: { grid: { color: corGrid }, ticks: { color: corTexto } } }, plugins: { legend: { labels: { color: corTexto } } } }
    });
}

document.getElementById('form-projeto').onsubmit = (e) => {
    e.preventDefault();
    projetosProjetados.push({
        id: 'p_' + Math.random().toString(36).substr(2, 9),
        nome: document.getElementById('proj-nome').value,
        valor: parseFloat(document.getElementById('proj-valor').value),
        dataAlvo: document.getElementById('proj-data').value
    });
    localStorage.setItem('fin_projetos', JSON.stringify(projetosProjetados));
    e.target.reset();
    atualizarInterfacePeriodo();
};

window.excluirProjeto = function(id) { projetosProjetados = projetosProjetados.filter(p => p.id !== id); localStorage.setItem('fin_projetos', JSON.stringify(projetosProjetados)); atualizarInterfacePeriodo(); };
document.getElementById('btn-mes-anterior').onclick = () => { dataAncorada.setMonth(dataAncorada.getMonth()-1); atualizarInterfacePeriodo(); };
document.getElementById('btn-mes-seguinte').onclick = () => { dataAncorada.setMonth(dataAncorada.getMonth()+1); atualizarInterfacePeriodo(); };
document.getElementById('btn-mes-atual').onclick = () => { dataAncorada = new Date(); atualizarInterfacePeriodo(); };

document.getElementById('btn-tema').onclick = () => {
    document.documentElement.classList.toggle('dark');
    gerenciarIconeTema();
    atualizarInterfacePeriodo();
};

document.getElementById('btn-chat-trigger').onclick = () => document.getElementById('caixa-chat').classList.toggle('hidden');
document.getElementById('btn-minimizar-chat').onclick = () => document.getElementById('caixa-chat').classList.add('hidden');

window.onload = () => {
    configurarAbasFormulario();
    inicializarPainelGraficosCollapse();
    configurarEfeitoLupaGraficos();
    configurarSeletoresExtrato();
    gerenciarIconeTema();
    atualizarInterfacePeriodo();
};