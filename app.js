// CORE ENGINE V4.0.0 (Migrado de LocalStorage para Supabase)
let dataAncorada = new Date();
let despesas = [];
let receitas = [];
let categoriasDisponiveis = ["Moradia", "Alimentação", "Transporte", "Lazer"];
let projetosProjetados = [];

let modoFormulario = "despesa"; 
let filtroExtratoAtual = "todos"; 
let categoriasSelecionadasGrafico = [...categoriasDisponiveis];
let chart1, chart2, chart3;

const mesesExtenso = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// FUNÇÃO AUXILIAR: Geração de UUID compatível caso queira enviar IDs prontos
function gerarUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function formatarDataBR(isoString) {
    if(!isoString) return '';
    const d = new Date(isoString);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
}

// FUNÇÃO REESCRITA: Puxar dados assincronamente das 3 tabelas do Supabase
async function carregarDadosDoSupabase() {
    try {
        // 1. Carrega Despesas
        const { data: dataDesp, error: errDesp } = await window.supabase.from('fin_despesas').select('*');
        if (!errDesp) despesas = dataDesp || [];
        else console.error("Erro fin_despesas:", errDesp);

        // 2. Carrega Receitas
        const { data: dataRec, error: errRec } = await window.supabase.from('fin_receitas').select('*');
        if (!errRec) receitas = dataRec || [];
        else console.error("Erro fin_receitas:", errRec);

        // 3. Carrega Projetos
        const { data: dataProj, error: errProj } = await window.supabase.from('fin_projetos').select('*');
        if (!errProj) projetosProjetados = dataProj || [];
        else console.error("Erro fin_projetos:", errProj);

        // Atualiza a UI após ler as três coleções
        atualizarInterfacePeriodo();
    } catch (e) {
        console.error("Falha crítica ao buscar dados do Supabase:", e);
    }
}

function atualizarInterfacePeriodo() {
    document.getElementById('txt-periodo-atual').innerText = `${mesesExtenso[dataAncorada.getMonth()]} ${dataAncorada.getFullYear()}`;
    renderizarLançamentos();
    renderizarHistoricoProjetos();
    calcularMetricasCards();
    gerarGraficosAnalise();
    lucide.createIcons();
}

function verificarPertenceAoPeriodo(item) {
    if(!item.dataCriacao) return false;
    const dItem = new Date(item.dataCriacao);
    const mAncorado = dataAncorada.getMonth();
    const aAncorado = dataAncorada.getFullYear();
    
    if(item.tipo === "fixo" || item.tipo === "recorrente") {
        if(dItem.getFullYear() < aAncorado) {
            if(item.validadeAte) {
                const dVal = new Date(item.validadeAte + "-02");
                return dVal >= dataAncorada;
            }
            return true;
        }
        if(dItem.getFullYear() === aAncorado && dItem.getMonth() <= mAncorado) {
            if(item.validadeAte) {
                const dVal = new Date(item.validadeAte + "-02");
                return dVal >= dataAncorada;
            }
            return true;
        }
        return false;
    }
    return dItem.getMonth() === mAncorado && dItem.getFullYear() === aAncorado;
}

function renderizarLançamentos() {
    const tbody = document.getElementById('lista-lancamentos');
    tbody.innerHTML = '';
    
    const despFiltradas = despesas.filter(verificarPertenceAoPeriodo);
    const recFiltradas = receitas.filter(verificarPertenceAoPeriodo);
    
    let combinados = [];
    if(filtroExtratoAtual === "todos" || filtroExtratoAtual === "despesas") {
        combinados = combinados.concat(despFiltradas.map(d => ({...d, fluxo: 'despesa'})));
    }
    if(filtroExtratoAtual === "todos" || filtroExtratoAtual === "receitas") {
        combinados = combinados.concat(recFiltradas.map(r => ({...r, fluxo: 'receita'})));
    }
    
    combinados.sort((a,b) => new Date(b.dataCriacao) - new Date(a.dataCriacao));
    
    if(combinados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400 font-medium text-[11px]">Nenhuma movimentação indexada neste período.</td></tr>`;
        return;
    }
    
    combinados.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group";
        
        const badgeFluxo = item.fluxo === 'despesa' 
            ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400">${item.categoria || 'Despesa'}</span>`
            : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400">Receita (${item.tipo || 'Geral'})</span>`;
            
        const valorFormatado = item.fluxo === 'despesa'
            ? `<span class="font-bold text-rose-500">- R$ ${item.valor.toFixed(2)}</span>`
            : `<span class="font-bold text-emerald-500">+ R$ ${item.valor.toFixed(2)}</span>`;
            
        tr.innerHTML = `
            <td class="py-2.5 font-semibold text-slate-700 dark:text-slate-300">${item.nome}</td>
            <td class="py-2.5">${badgeFluxo}</td>
            <td class="py-2.5 text-slate-400">${formatarDataBR(item.dataCriacao)}</td>
            <td class="py-2.5 text-right">${valorFormatado}</td>
            <td class="py-2.5 text-center">
                <button onclick="window.excluirItem('${item.id}', '${item.fluxo}')" class="text-slate-300 hover:text-rose-500 dark:text-slate-700 dark:hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderizarHistoricoProjetos() {
    const container = document.getElementById('container-projetos');
    container.innerHTML = '';
    
    if(projetosProjetados.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-slate-400 font-medium sm:col-span-2">Nenhum projeto de poupança ativo.</p>`;
        return;
    }
    
    const saldoTotalGeral = receitas.reduce((acc, r) => acc + r.valor, 0) - despesas.reduce((acc, d) => acc + d.valor, 0);
    const poolAlocavel = Math.max(0, saldoTotalGeral);
    
    projetosProjetados.forEach(proj => {
        const porcCobertura = Math.min(100, Math.max(0, (poolAlocavel / proj.valorAlvo) * 100));
        const card = document.createElement('div');
        card.className = "border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 p-3 rounded-xl flex flex-col gap-2 group relative";
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-slate-800 dark:text-slate-200 text-xs">${proj.nome}</h4>
                    <p class="text-[9px] text-slate-400 font-medium">Alvo: R$ ${proj.valorAlvo.toFixed(2)} até ${formatarDataBR(proj.dataAlvo)}</p>
                </div>
                <button onclick="window.excluirProjeto('${proj.id}')" class="text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
            <div class="w-full bg-slate-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div class="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full transition-all duration-500" style="width: ${porcCobertura}%"></div>
            </div>
            <div class="flex justify-between items-center text-[9px] font-bold text-slate-400">
                <span>Cobertura Atual</span>
                <span class="text-purple-500">${porcCobertura.toFixed(1)}%</span>
            </div>
        `;
        container.appendChild(card);
    });
}

function calcularMetricasCards() {
    const despFiltradas = despesas.filter(verificarPertenceAoPeriodo);
    const recFiltradas = receitas.filter(verificarPertenceAoPeriodo);
    
    const somaReceitas = recFiltradas.reduce((acc, r) => acc + r.valor, 0);
    const somaDespesas = despFiltradas.reduce((acc, d) => acc + d.valor, 0);
    const saldoLiquido = somaReceitas - somaDespesas;
    
    document.getElementById('card-receitas').innerText = `R$ ${somaReceitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('card-despesas').innerText = `R$ ${somaDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    document.getElementById('card-saldo').innerText = `R$ ${saldoLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    
    const tetoHipotetico = 12000;
    const pRec = Math.min(100, (somaReceitas / tetoHipotetico) * 100);
    document.getElementById('perc-receitas').innerText = `${pRec.toFixed(0)}%`;
    
    const pDesp = somaReceitas > 0 ? Math.min(100, (somaDespesas / somaReceitas) * 100) : 0;
    document.getElementById('perc-despesas').innerText = `${pDesp.toFixed(0)}%`;
    
    const txtStatus = document.getElementById('txt-status-saldo');
    if(saldoLiquido < 0) {
        txtStatus.innerText = "Déficit operacional no mês";
        txtStatus.className = "text-[10px] font-bold text-rose-500 mt-1";
    } else if (saldoLiquido > 0) {
        txtStatus.innerText = "Superávit em expansão";
        txtStatus.className = "text-[10px] font-bold text-emerald-500 mt-1";
    } else {
        txtStatus.innerText = "Balanço em ponto de equilíbrio";
        txtStatus.className = "text-[10px] text-slate-400 mt-1";
    }
}

function gerarGraficosAnalise() {
    const despFiltradas = despesas.filter(verificarPertenceAoPeriodo);
    const recFiltradas = receitas.filter(verificarPertenceAoPeriodo);
    
    const dCat = {};
    categoriasDisponiveis.forEach(c => dCat[c] = 0);
    despFiltradas.forEach(d => {
        if(categoriasSelecionadasGrafico.includes(d.categoria)) {
            dCat[d.categoria] = (dCat[d.categoria] || 0) + d.valor;
        }
    });
    
    let fVal = 0, vVal = 0;
    despFiltradas.forEach(d => {
        if(d.tipo === "fixo") fVal += d.valor;
        else vVal += d.valor;
    });
    
    const totalR = recFiltradas.reduce((acc, r) => acc + r.valor, 0);
    const totalD = despFiltradas.reduce((acc, d) => acc + d.valor, 0);
    
    if(chart1) chart1.destroy();
    if(chart2) chart2.destroy();
    if(chart3) chart3.destroy();
    
    const isDark = document.documentElement.classList.contains('dark');
    const colorTexto = isDark ? '#94a3b8' : '#64748b';
    
    const ctx1 = document.getElementById('chart-categoria').getContext('2d');
    chart1 = new Chart(ctx1, {
        type: 'doughnut',
        data: {
            labels: Object.keys(dCat),
            datasets: [{
                data: Object.values(dCat),
                backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#f43f5e']
            }]
        },
        options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }
    });

    const ctx2 = document.getElementById('chart-tipo').getContext('2d');
    chart2 = new Chart(ctx2, {
        type: 'pie',
        data: {
            labels: ['Fixo', 'Variável'],
            datasets: [{
                data: [fVal, vVal],
                backgroundColor: ['#3b82f6', '#ec4899']
            }]
        },
        options: { plugins: { legend: { display: false } }, responsive: true, maintainAspectRatio: false }
    });

    const ctx3 = document.getElementById('chart-balanco').getContext('2d');
    chart3 = new Chart(ctx3, {
        type: 'bar',
        data: {
            labels: ['Fluxo'],
            datasets: [
                { label: 'Receitas', data: [totalR], backgroundColor: '#10b981' },
                { label: 'Despesas', data: [totalD], backgroundColor: '#f43f5e' }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { ticks: { color: colorTexto }, grid: { display: false } }, x: { ticks: { color: colorTexto }, grid: { display: false } } }
        }
    });
}

function configurarAbasFormulario() {
    const botoes = document.querySelectorAll('#abas-formulario button');
    botoes.forEach(btn => {
        btn.onclick = () => {
            botoes.forEach(b => {
                b.className = "text-xs font-bold pb-2 border-b-2 border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-all";
            });
            btn.className = "text-xs font-bold pb-2 border-b-2 border-slate-900 dark:border-white text-slate-900 dark:text-white transition-all";
            modoFormulario = btn.getAttribute('data-aba');
            
            const dynField = document.getElementById('container-campo-dinamico');
            if(modoFormulario === 'receita') {
                dynField.innerHTML = `
                    <div class="col-span-2">
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Origem / Canal</label>
                        <select id="mov-tipo-receita" class="w-full bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-2 py-2 text-xs focus:outline-none transition-all">
                            <option value="Salário">Salário Ativo</option>
                            <option value="Investimentos">Rendimento/Investimento</option>
                            <option value="Freelance">Projetos/Freelance</option>
                        </select>
                    </div>
                `;
            } else {
                dynField.innerHTML = `
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Categoria</label>
                        <select id="mov-categoria" class="w-full bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-2 py-2 text-xs focus:outline-none transition-all">
                            <option value="Moradia">Moradia</option>
                            <option value="Alimentação">Alimentação</option>
                            <option value="Transporte">Transporte</option>
                            <option value="Lazer">Lazer</option>
                        </select>
                    </div>
                    <div>
                        <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Classificação</label>
                        <select id="mov-tipo-despesa" class="w-full bg-slate-50 border border-slate-200 dark:bg-slate-950 dark:border-slate-800 dark:text-white rounded-xl px-2 py-2 text-xs focus:outline-none transition-all">
                            <option value="variavel">Variável</option>
                            <option value="fixo">Fixo Mensal</option>
                        </select>
                    </div>
                `;
            }
        };
    });
}

function inicializarPainelGraficosCollapse() {
    const btn = document.getElementById('btn-toggle-painel');
    const main = document.getElementById('main-layout');
    const painel = document.getElementById('painel-lateral');
    
    btn.onclick = () => {
        painel.classList.toggle('hidden');
        if(painel.classList.contains('hidden')) {
            main.className = "max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-2 gap-6 grid-animado";
        } else {
            main.className = "max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-3 gap-6 grid-animado";
        }
        gerarGraficosAnalise();
    };
}

function configurarEfeitoLupaGraficos() {
    const chatInput = document.getElementById('chat-input');
    const chatArea = document.getElementById('chat-area');
    
    document.getElementById('btn-enviar-chat').onclick = () => {
        const cmd = chatInput.value.trim().toLowerCase();
        if(!cmd) return;
        
        chatArea.innerHTML += `<div class="mt-1 text-right text-purple-600 font-bold">Você: ${chatInput.value}</div>`;
        
        if(cmd === 'dica') {
            const dFiltradas = despesas.filter(verificarPertenceAoPeriodo);
            const totalD = dFiltradas.reduce((acc,d)=>acc+d.valor,0);
            if(totalD > 3000) {
                chatArea.innerHTML += `<div class="mt-1 text-emerald-600 font-medium">Alerta: Custos elevados de alocação variável. Considere mitigar custos secundários.</div>`;
            } else {
                chatArea.innerHTML += `<div class="mt-1 text-emerald-600 font-medium">Parabéns: Índice de liquidez ideal controlado para poupança.</div>`;
            }
        } else {
            chatArea.innerHTML += `<div class="mt-1 text-slate-400">Comando automático não mapeado. Digite "dica".</div>`;
        }
        chatInput.value = '';
        chatArea.scrollTop = chatArea.scrollHeight;
    };
}

function configurarSeletoresExtrato() {
    const botoes = document.querySelectorAll('#filtro-extrato button');
    botoes.forEach(btn => {
        btn.onclick = () => {
            botoes.forEach(b => {
                b.className = "px-2.5 py-1 text-[10px] font-semibold rounded-md text-slate-400 transition-all hover:text-slate-600 dark:hover:text-slate-200";
            });
            btn.className = "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all bg-white text-slate-800 dark:bg-slate-900 dark:text-white shadow-xs";
            filtroExtratoAtual = btn.getAttribute('data-filtro');
            renderizarLançamentos();
        };
    });
}

function configurarFiltrosGraficos() {
    const container = document.getElementById('filtros-categorias-grafico');
    container.innerHTML = '';
    
    categoriasDisponiveis.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = "px-2 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition-all shadow-xs";
        btn.innerText = cat;
        btn.onclick = () => {
            if(categoriasSelecionadasGrafico.includes(cat)) {
                categoriasSelecionadasGrafico = categoriasSelecionadasGrafico.filter(c => c !== cat);
                btn.className = "px-2 py-0.5 rounded text-[9px] font-bold border border-slate-200 dark:border-slate-800 text-slate-400 hover:text-slate-600 transition-all";
            } else {
                categoriasSelecionadasGrafico.push(cat);
                btn.className = "px-2 py-0.5 rounded text-[9px] font-bold bg-slate-900 text-white dark:bg-white dark:text-slate-900 transition-all shadow-xs";
            }
            gerarGraficosAnalise();
        };
        container.appendChild(btn);
    });
}

// FUNÇÃO REESCRITA: Adicionar Despesas/Receitas diretamente nas tabelas do Supabase
function configurarAcoesFormulario() {
    const chk = document.getElementById('mov-recorrente');
    const cVal = document.getElementById('container-validade');
    
    chk.onchange = () => {
        if(chk.checked) cVal.classList.remove('hidden');
        else cVal.classList.add('hidden');
    };

    document.getElementById('form-movimentacao').onsubmit = async function(e) {
        e.preventDefault();
        
        const isRecorrente = document.getElementById('mov-recorrente').checked;
        const validade = document.getElementById('mov-validade').value;
        const dataInput = document.getElementById('mov-data').value;
        
        const itemParaSalvar = {
            id: gerarUUID(), // Usado por garantia, mas as PKs do Supabase gerenciam de forma nativa
            nome: document.getElementById('mov-nome').value,
            valor: parseFloat(document.getElementById('mov-valor').value),
            dataCriacao: dataInput ? new Date(dataInput + "T12:00:00").toISOString() : new Date().toISOString()
        };

        let tabelaDestino = '';

        if(modoFormulario === "despesa") {
            tabelaDestino = 'fin_despesas';
            itemParaSalvar.categoria = document.getElementById('mov-categoria').value;
            itemParaSalvar.tipo = isRecorrente ? "recorrente" : document.getElementById('mov-tipo-despesa').value;
            if(isRecorrente && validade) itemParaSalvar.validadeAte = validade;
        } else {
            tabelaDestino = 'fin_receitas';
            itemParaSalvar.tipo = document.getElementById('mov-tipo-receita').value;
            if(isRecorrente) itemParaSalvar.categoria = "recorrente";
            if(isRecorrente && validade) itemParaSalvar.validadeAte = validade;
        }

        // Requisição remota assíncrona ao Supabase
        const { error } = await window.supabase
            .from(tabelaDestino)
            .insert([itemParaSalvar]);

        if (!error) {
            e.target.reset();
            cVal.classList.add('hidden');
            // Recarrega todo o ecossistema sincronizado com as tabelas nuvem
            await carregarDadosDoSupabase();
        } else {
            alert("Erro ao persistir no Supabase: " + error.message);
        }
    };
}

// OPERAÇÕES ASSÍNCRONAS DE EXCLUSÃO
window.excluirItem = async function(id, fluxo) {
    const tabelaDestino = fluxo === 'despesa' ? 'fin_despesas' : 'fin_receitas';
    
    const { error } = await window.supabase
        .from(tabelaDestino)
        .delete()
        .eq('id', id);

    if (!error) {
        await carregarDadosDoSupabase();
    } else {
        alert("Erro ao excluir do Supabase: " + error.message);
    }
};

document.getElementById('form-projeto').onsubmit = async function(e) {
    e.preventDefault();
    const novoProjeto = {
        id: gerarUUID(),
        nome: document.getElementById('proj-nome').value,
        valorAlvo: parseFloat(document.getElementById('proj-valor').value),
        dataAlvo: document.getElementById('proj-data').value,
        dataCriacao: new Date().toISOString()
    };

    const { error } = await window.supabase
        .from('fin_projetos')
        .insert([novoProjeto]);

    if (!error) {
        e.target.reset();
        await carregarDadosDoSupabase();
    } else {
        alert("Erro ao criar projeto no Supabase: " + error.message);
    }
};

window.excluirProjeto = async function(id) {
    const { error } = await window.supabase
        .from('fin_projetos')
        .delete()
        .eq('id', id);

    if (!error) {
        await carregarDadosDoSupabase();
    } else {
        alert("Erro ao remover projeto do Supabase: " + error.message);
    }
};

function gerenciarIconeTema() {
    const dark = document.documentElement.classList.contains('dark');
    const btn = document.getElementById('btn-tema');
    if(dark) {
        btn.innerHTML = `<i data-lucide="sun" class="w-4 h-4"></i>`;
    } else {
        btn.innerHTML = `<i data-lucide="moon" class="w-4 h-4"></i>`;
    }
}

// INICIALIZAÇÃO INJETADA DO SUPABASE
window.onload = () => {
    configurarAbasFormulario();
    inicializarPainelGraficosCollapse();
    configurarEfeitoLupaGraficos();
    configurarSeletoresExtrato();
    configurarFiltrosGraficos();
    configurarAcoesFormulario();
    gerenciarIconeTema();
    
    // Dispara a busca remota assíncrona ao invés de ler localStorage local
    carregarDadosDoSupabase();
};
