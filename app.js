// CONFIGURAÇÃO DO CLIENTE SUPABASE
const SUPABASE_URL = "SEU_SUPABASE_URL_AQUI";
const SUPABASE_KEY = "SUA_SUPABASE_ANON_KEY_AQUI";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// CORE ENGINE V4.1.0 (Migrado para Supabase - Mantendo 100% da identidade visual)
let dataAncorada = new Date();
let despesas = [];
let receitas = [];
let categoriasDisponiveis = JSON.parse(localStorage.getItem('fin_categorias')) || ["Moradia", "Alimentação", "Transporte", "Lazer"];
let projetosProjetados = JSON.parse(localStorage.getItem('fin_projetos')) || [];

let modoFormulario = "despesa"; 
let filtroExtratoAtual = "todos"; // todos | despesas | receitas
let categoriasSelecionadasGrafico = [...categoriasDisponiveis];
let chart1, chart2, chart3;

const mesesExtenso = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// CARREGAR DADOS INICIAIS DO SUPABASE
async function carregarDadosSupabase() {
    try {
        const { data: resReceitas, error: errRec } = await supabase.from('receitas').select('*');
        const { data: resDespesas, error: errDesp } = await supabase.from('despesas').select('*');

        if (errRec) throw errRec;
        if (errDesp) throw errDesp;

        receitas = resReceitas || [];
        despesas = resDespesas || [];

        atualizarInterfacePeriodo();
    } catch (error) {
        console.error("Erro ao sincronizar com o Supabase:", error.message);
    }
}

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
    const dataItem = new Date(item.data_criacao || item.dataCriacao);
    if (anoAlvo < dataItem.getFullYear() || (anoAlvo === dataItem.getFullYear() && mesAlvo < dataItem.getMonth())) return false;
    if (item.tipo === 'variavel') {
        return anoAlvo === dataItem.getFullYear() && mesAlvo === dataItem.getMonth();
    }
    if (item.tipo === 'fixo') {
        const validade = item.validadeAte || item.validadeate;
        if (validade) {
            const [anoLimite, mesLimite] = validade.split('-').map(Number);
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
    let todasDatas = [...despesas, ...receitas].map(x => new Date(x.data_criacao || x.dataCriacao));
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

    let todasDatas = [...despesas, ...receitas].map(x => new Date(x.data_criacao || x.dataCriacao));
    if (todasDatas.length === 0) return 0;

    let menorData = new Date(Math.min(...todasDatas));
    let dataVarredura = new Date(anoHoje, mesHoje + 1, 1);
    let dataDestinoAlvo = new Date(anoAlvo, mesAlvo + 1, 1);

    if (dataDestinoAlvo <= dataVarredura) {
        let saldoPassado = 0;
        let scan = new Date(menorData.getFullYear(), menorData.getMonth(), 1);
        let limiteSuperior = new Date(anoAlvo, mesAlvo + 1, 1);
        while (scan < limiteSuperior) {
            const m = scan.getMonth();
            const a = scan.getFullYear();
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
        document.getElementById('txt-saldo-real-calculo').innerText = `Balanço real imediato em conta.\nCaixa imutável do presente momento corrente.`;
    }
    if(document.getElementById('txt-reserva-calculo')) {
        document.getElementById('txt-reserva-calculo').innerText = `Previsão matemática calculada para o fim de ${mesesExtenso[mes]} de ${ano} considerando o efeito bola de neve intermediário: R$ ${saldoProjetadoFinalPeriodo.toFixed(2)}.`;
    }

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

    const sobraCalculada = Math.max(0, saldoProjetadoFinalPeriodo);
    if(document.getElementById('txt-alocacao-metas')) document.getElementById('txt-alocacao-metas').innerText = `R$ ${(sobraCalculada * 0.5).toFixed(2)}`;
    if(document.getElementById('txt-alocacao-reserva')) document.getElementById('txt-alocacao-reserva').innerText = `R$ ${(sobraCalculada * 0.3).toFixed(2)}`;
    if(document.getElementById('txt-alocacao-lazer')) document.getElementById('txt-alocacao-lazer').innerText = `R$ ${(sobraCalculada * 0.2).toFixed(2)}`;

    if(document.getElementById('txt-ba-poupanca')) document.getElementById('txt-ba-poupanca').innerText = `R$ ${(totalReceitas * 0.06).toFixed(2)}`;
    if(document.getElementById('txt-ba-cdb')) document.getElementById('txt-ba-cdb').innerText = `R$ ${(totalReceitas * 0.1075).toFixed(2)}`;
    if(document.getElementById('txt-ba-selic')) document.getElementById('txt-ba-selic').innerText = `R$ ${(totalReceitas * 0.1075).toFixed(2)}`;
    
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
    ].sort((a,b) => new Date(a.data_criacao || a.dataCriacao) - new Date(b.data_criacao || b.dataCriacao));
    
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

    itensExibidos.sort((a,b) => new Date(b.data_criacao || b.dataCriacao) - new Date(a.data_criacao || a.dataCriacao));

    const tabelaCorpo = document.getElementById('tabela-extrato-unificado-corpo');
    if(itensExibidos.length === 0) {
        tabelaCorpo.innerHTML = `<tr><td colspan="6" class="text-center py-6 text-slate-400 text-xs">Nenhum registro encontrado para este filtro neste mês.</td></tr>`;
    } else {
        tabelaCorpo.innerHTML = itensExibidos.map(item => {
            const isDesp = item.fluxo === 'despesa';
            return `
                <tr class="border-b text-sm dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/40">
                    <td class="py-2.5 text-xs font-semibold text-slate-500">${formatarDataBR(item.data_criacao || item.dataCriacao)}</td>
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
    if (typeof renderizarProjetos === 'function') renderizarProjetos(totalReceitas);
    if (typeof atualizarFiltrosEGráficos === 'function') atualizarFiltrosEGráficos(despesasDoMes, totalReceitas, totalDespesas);
}

function renderizarHistoricoGeral() {
    const busca = document.getElementById('busca-historico') ? document.getElementById('busca-historico').value.toLowerCase() : '';
    const catFiltro = document.getElementById('filtro-cat-historico') ? document.getElementById('filtro-cat-historico').value : 'todos';
    const tBodyH = document.getElementById('tabela-historico-geral-corpo');
    if (!tBodyH) return;

    let unificado = [
        ...despesas.map(d => ({...d, fluxo: 'despesa'})),
        ...receitas.map(r => ({...r, fluxo: 'receita', categoria: 'Renda'}))
    ].sort((a,b) => new Date(b.data_criacao || b.dataCriacao) - new Date(a.data_criacao || a.dataCriacao));

    let filtrado = unificado.filter(item => {
        const bateTexto = item.nome.toLowerCase().includes(busca);
        const bateCat = catFiltro === 'todos' || item.categoria === catFiltro;
        return bateTexto && bateCat;
    });

    tBodyH.innerHTML = filtrado.map(item => `
        <tr class="border-b dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/20 text-xs">
            <td class="py-2">${item.fluxo === 'despesa' ? '🔻 Despesa' : '🔺 Receita'}</td>
            <td>${formatarDataBR(item.data_criacao || item.dataCriacao)}</td>
            <td class="font-medium">${item.nome}</td>
            <td class="text-slate-400">${item.categoria} (${item.tipo || 'Variavel'})</td>
            <td class="text-right font-bold ${item.fluxo === 'despesa' ? 'text-red-500' : 'text-emerald-500'}">
                ${item.fluxo === 'despesa' ? '-' : '+'} R$ ${item.valor.toFixed(2)}
            </td>
        </tr>
    `).join('');
}

// CAPTURA DO FORMULÁRIO (SALVAR / ENVIAR PARA O SUPABASE)
document.getElementById('form-movimentacao').onsubmit = async (e) => {
    e.preventDefault();
    
    const idEdicao = document.getElementById('form-id-edicao') ? document.getElementById('form-id-edicao').value : '';
    const nome = document.getElementById('mov-nome').value;
    const valor = parseFloat(document.getElementById('mov-valor').value);
    const dataCriacao = document.getElementById('mov-data').value ? new Date(document.getElementById('mov-data').value).toISOString() : new Date().toISOString();
    
    let tabela = modoFormulario === 'despesa' ? 'despesas' : 'receitas';
    
    let payload = { nome, valor, data_criacao: dataCriacao };
    
    if (modoFormulario === 'despesa') {
        payload.categoria = document.getElementById('mov-categoria').value;
        payload.tipo = document.getElementById('mov-tipo').value;
        if (payload.tipo === 'fixo') {
            payload.validadeAte = document.getElementById('mov-validade') ? document.getElementById('mov-validade').value : null;
        }
    }

    try {
        if (idEdicao) {
            // Modo Edição
            const { error } = await supabase.from(tabela).update(payload).eq('id', idEdicao);
            if (error) throw error;
        } else {
            // Modo Criação
            const { error } = await supabase.from(tabela).insert([payload]);
            if (error) throw error;
        }
        
        e.target.reset();
        if(document.getElementById('form-id-edicao')) document.getElementById('form-id-edicao').value = '';
        await carregarDadosSupabase();
    } catch (error) {
        alert("Erro ao salvar lançamento: " + error.message);
    }
};

// EXCLUIR ITEM DO SUPABASE
window.excluirItem = async function(id, fluxo) {
    if(!confirm("Tem certeza que deseja excluir este item?")) return;
    let tabela = fluxo === 'despesa' ? 'despesas' : 'receitas';
    try {
        const { error } = await supabase.from(tabela).delete().eq('id', id);
        if (error) throw error;
        await carregarDadosSupabase();
    } catch (error) {
        alert("Erro ao excluir: " + error.message);
    }
};

// CARREGAR ITEM PARA EDIÇÃO
window.carregarItemParaEdicao = function(id, fluxo) {
    let item = fluxo === 'despesa' ? despesas.find(d => d.id === id) : receitas.find(r => r.id === id);
    if (!item) return;

    if (fluxo === 'despesa') {
        window.configurarModoFormulario('despesa');
        document.getElementById('mov-categoria').value = item.categoria;
        document.getElementById('mov-tipo').value = item.tipo || 'variavel';
    } else {
        window.configurarModoFormulario('receita');
    }

    document.getElementById('mov-nome').value = item.nome;
    document.getElementById('mov-valor').value = item.valor;
    
    if (item.data_criacao || item.dataCriacao) {
        const d = new Date(item.data_criacao || item.dataCriacao);
        document.getElementById('mov-data').value = d.toISOString().split('T')[0];
    }
    
    if(!document.getElementById('form-id-edicao')) {
        const inputId = document.createElement('input');
        inputId.type = 'hidden';
        inputId.id = 'form-id-edicao';
        document.getElementById('form-movimentacao').appendChild(inputId);
    }
    document.getElementById('form-id-edicao').value = item.id;
    document.getElementById('form-movimentacao').scrollIntoView({ behavior: 'smooth' });
};

// MAPEAMENTO DE EVENTOS DOS BOTÕES DE NAVEGAÇÃO
document.getElementById('btn-mes-anterior').onclick = () => { dataAncorada.setMonth(dataAncorada.getMonth()-1); atualizarInterfacePeriodo(); };
document.getElementById('btn-mes-seguinte').onclick = () => { dataAncorada.setMonth(dataAncorada.getMonth()+1); atualizarInterfacePeriodo(); };
document.getElementById('btn-mes-atual').onclick = () => { dataAncorada = new Date(); atualizarInterfacePeriodo(); };

document.getElementById('btn-tema').onclick = () => {
    document.documentElement.classList.toggle('dark');
    if (typeof gerenciarIconeTema === 'function') gerenciarIconeTema();
    atualizarInterfacePeriodo();
};

// INICIALIZAÇÃO AUTOMÁTICA AO CARREGAR A PÁGINA
window.onload = () => {
    if (typeof configurarAbasFormulario === 'function') configurarAbasFormulario();
    if (typeof inicializarPainelGraficosCollapse === 'function') inicializarPainelGraficosCollapse();
    if (typeof configurarEfeitoLupaGraficos === 'function') configurarEfeitoLupaGraficos();
    if (typeof configurarSeletoresExtrato === 'function') configurarSeletoresExtrato();
    
    // Inicia a carga de dados direto do Banco de Dados Supabase
    carregarDadosSupabase();
};
