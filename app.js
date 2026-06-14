// CORE ENGINE V4.0.0 (Totalmente integrado ao seu SQL do Supabase)
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

function formatarDataBR(isoString) {
    if(!isoString) return '';
    const d = new Date(isoString);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
}

// BUSCA REMOTA CONECTADA ÀS SUAS TABELAS: 'despesas' e 'receitas'
async function carregarDadosDoSupabase() {
    try {
        // 1. Busca da sua tabela 'despesas'
        const { data: dataDesp, error: errDesp } = await window.supabase.from('despesas').select('*');
        if (!errDesp) despesas = dataDesp || [];
        else console.error("Erro despesas:", errDesp);

        // 2. Busca da sua tabela 'receitas'
        const { data: dataRec, error: errRec } = await window.supabase.from('receitas').select('*');
        if (!errRec) receitas = dataRec || [];
        else console.error("Erro receitas:", errRec);

        // Atualiza a UI
        atualizarInterfacePeriodo();
    } catch (e) {
        console.error("Falha crítica ao buscar dados do Supabase:", e);
    }
}

function atualizarInterfacePeriodo() {
    const txtPeriodo = document.getElementById('txt-periodo-atual');
    if(txtPeriodo) {
        txtPeriodo.innerText = `${mesesExtenso[dataAncorada.getMonth()]} ${dataAncorada.getFullYear()}`;
    }
    renderizarLançamentos();
    renderizarHistoricoProjetos();
    calcularMetricasCards();
    gerarGraficosAnalise();
    if(window.lucide) lucide.createIcons();
}

function verificarPertenceAoPeriodo(item) {
    // Mapeado para ler 'data_criacao' vindo do seu banco SQL
    const campoData = item.data_criacao || item.created_at;
    if(!campoData) return false;
    
    const dItem = new Date(campoData);
    const mAncorado = dataAncorada.getMonth();
    const aAncorado = dataAncorada.getFullYear();
    
    if(item.tipo === "fixo" || item.tipo === "recorrente") {
        if(dItem.getFullYear() < aAncorado) return true;
        if(dItem.getFullYear() === aAncorado && dItem.getMonth() <= mAncorado) return true;
        return false;
    }
    return dItem.getMonth() === mAncorado && dItem.getFullYear() === aAncorado;
}

function renderizarLançamentos() {
    const tbody = document.getElementById('lista-lancamentos');
    if(!tbody) return;
    
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
    
    // Ordena por data_criacao protegendo contra nulos
    combinados.sort((a,b) => new Date(b.data_criacao || b.created_at || 0) - new Date(a.data_criacao || a.created_at || 0));
    
    if(combinados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-4 text-center text-slate-400 font-medium text-[11px]">Nenhuma movimentação indexada neste período.</td></tr>`;
        return;
    }
    
    combinados.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50/50 dark:hover:bg-slate-900/30 transition-colors group";
        
        const valorNum = Number(item.valor) || 0;
        
        const badgeFluxo = item.fluxo === 'despesa' 
            ? `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-50 text-rose-500 dark:bg-rose-950/40 dark:text-rose-400">${item.categoria || 'Despesa'}</span>`
            : `<span class="px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 text-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-400">Receita (${item.tipo || 'Geral'})</span>`;
            
        const valorFormatado = item.fluxo === 'despesa'
            ? `<span class="font-bold text-rose-500">- R$ ${valorNum.toFixed(2)}</span>`
            : `<span class="font-bold text-emerald-500">+ R$ ${valorNum.toFixed(2)}</span>`;
            
        tr.innerHTML = `
            <td class="py-2.5 font-semibold text-slate-700 dark:text-slate-300">${item.nome}</td>
            <td class="py-2.5">${badgeFluxo}</td>
            <td class="py-2.5 text-slate-400">${formatarDataBR(item.data_criacao || item.created_at)}</td>
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
    if(!container) return;
    container.innerHTML = '';
    
    if(projetosProjetados.length === 0) {
        container.innerHTML = `<p class="text-[11px] text-slate-400 font-medium sm:col-span-2">Nenhum projeto de poupança ativo.</p>`;
        return;
    }
    
    const poolAlocavel = Math.max(0, receitas.reduce((acc, r) => acc + (Number(r.valor) || 0), 0) - despesas.reduce((acc, d) => acc + (Number(d.valor) || 0), 0));
    
    projetosProjetados.forEach(proj => {
        const porcCobertura = Math.min(100, Math.max(0, (poolAlocavel / proj.valorAlvo) * 100));
        const card = document.createElement('div');
        card.className = "border border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/30 p-3 rounded-xl flex flex-col gap-2 group relative";
        card.innerHTML = `
            <div class="flex justify-between items-start">
                <div>
                    <h4 class="font-bold text-slate-800 dark:text-slate-200 text-xs">${proj.nome}</h4>
                    <p class="text-[9px] text-slate-400 font-medium">Alvo: R$ ${proj.valorAlvo.toFixed(2)}</p>
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
    
    const somaReceitas = recFiltradas.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    const somaDespesas = despFiltradas.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
    const saldoLiquido = somaReceitas - somaDespesas;
    
    const cRec = document.getElementById('card-receitas');
    const cDesp = document.getElementById('card-despesas');
    const cSal = document.getElementById('card-saldo');
    
    if(cRec) cRec.innerText = `R$ ${somaReceitas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if(cDesp) cDesp.innerText = `R$ ${somaDespesas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    if(cSal) cSal.innerText = `R$ ${saldoLiquido.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;
    
    const pRec = Math.min(100, (somaReceitas / 12000) * 100);
    const elPercRec = document.getElementById('perc-receitas');
    if(elPercRec) elPercRec.innerText = `${pRec.toFixed(0)}%`;
    
    const pDesp = somaReceitas > 0 ? Math.min(100, (somaDespesas / somaReceitas) * 100) : 0;
    const elPercDesp = document.getElementById('perc-despesas');
    if(elPercDesp) elPercDesp.innerText = `${pDesp.toFixed(0)}%`;
    
    const txtStatus = document.getElementById('txt-status-saldo');
    if(txtStatus) {
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
}

function gerarGraficosAnalise() {
    if(!document.getElementById('chart-categoria')) return;

    const despFiltradas = despesas.filter(verificarPertenceAoPeriodo);
    const recFiltradas = receitas.filter(verificarPertenceAoPeriodo);
    
    const dCat = {};
    categoriasDisponiveis.forEach(c => dCat[c] = 0);
    despFiltradas.forEach(d => {
        if(categoriasSelecionadasGrafico.includes(d.categoria)) {
            dCat[d.categoria] = (dCat[d.categoria] || 0) + (Number(d.valor) || 0);
        }
    });
    
    let fVal = 0, vVal = 0;
    despFiltradas.forEach(d => {
        if(d.tipo === "fixo") fVal += (Number(d.valor) || 0);
        else vVal += (Number(d.valor) || 0);
    });
    
    const totalR = recFiltradas.reduce((acc, r) => acc + (Number(r.valor) || 0), 0);
    const totalD = despFiltradas.reduce((acc, d) => acc + (Number(d.valor) || 0), 0);
    
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
            if(!dynField) return;

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
    
    if(!btn) return;
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
    const btnEnviar = document.getElementById('btn-enviar-chat');
    
    if(!btnEnviar) return;

    btnEnviar.onclick = () => {
        const cmd = chatInput.value.trim().toLowerCase();
        if(!cmd) return;
        
        chatArea.innerHTML += `<div class="mt-1 text-right text-purple-600 font-bold">Você: ${chatInput.value}</div>`;
        
        if(cmd === 'dica') {
            const dFiltradas = despesas.filter(verificarPertenceAoPeriodo);
            const totalD = dFiltradas.reduce((acc,d)=>acc+(Number(d.valor) || 0),0);
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
    if(!container) return;
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

function configurarAcoesFormulario() {
    const chk = document.getElementById('mov-recorrente');
    const cVal = document.getElementById('container-validade');
    const formMov = document.getElementById('form-movimentacao');
    
    if (chk && cVal) {
        chk.onchange = () => {
            if(chk.checked) cVal.classList.remove('hidden');
            else cVal.classList.add('hidden');
        };
    }

    if(formMov) {
        formMov.onSubmit = async function(e) {
            e.preventDefault();
            
            const dataInput = document.getElementById('mov-data').value;
            const campoCategoria = document.getElementById('mov-categoria');
            const campoTipoDespesa = document.getElementById('mov-tipo-despesa');
            
            const itemParaSalvar = {
                nome: document.getElementById('mov-nome').value,
                valor: parseFloat(document.getElementById('mov-valor').value) || 0,
                data_criacao: dataInput ? new Date(dataInput + "T12:00:00").toISOString() : new Date().toISOString()
            };

            let tabelaDestino = '';

            if(modoFormulario === "despesa") {
                tabelaDestino = 'despesas';
                itemParaSalvar.categoria = campoCategoria ? campoCategoria.value : "Lazer";
                itemParaSalvar.tipo = campoTipoDespesa ? campoTipoDespesa.value : "variavel";
            } else {
                tabelaDestino = 'receitas';
            }

            const { error } = await window.supabase
                .from(tabelaDestino)
                .insert([itemParaSalvar]);

            if (!error) {
                e.target.reset();
                if (cVal) cVal.classList.add('hidden');
                await carregarDadosDoSupabase();
            } else {
                alert("Erro ao salvar no Supabase: " + error.message);
            }
        };
    }
}

window.excluirItem = async function(id, fluxo) {
    const tabelaDestino = fluxo === 'despesa' ? 'despesas' : 'receitas';
    
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

const formProj = document.getElementById('form-projeto');
if(formProj) {
    formProj.onSubmit = function(e) {
        e.preventDefault();
        projetosProjetados.push({
            id: 'p-' + Date.now(),
            nome: document.getElementById('proj-nome').value,
            valorAlvo: parseFloat(document.getElementById('proj-valor').value) || 0
        });
        renderizarHistoricoProjetos();
        e.target.reset();
    };
}

window.excluirProjeto = function(id) {
    projetosProjetados = projetosProjetados.filter(p => p.id !== id);
    renderizarHistoricoProjetos();
};

function gerenciarIconeTema() {
    const dark = document.documentElement.classList.contains('dark');
    const btn = document.getElementById('btn-tema');
    if(!btn) return;
    if(dark) btn.innerHTML = `<i data-lucide="sun" class="w-4 h-4"></i>`;
    else btn.innerHTML = `<i data-lucide="moon" class="w-4 h-4"></i>`;
}

const btnAnterior = document.getElementById('btn-mes-anterior');
const btnSeguinte = document.getElementById('btn-mes-seguinte');
const btnAtual = document.getElementById('btn-mes-atual');
const btnTema = document.getElementById('btn-tema');

if(btnAnterior) btnAnterior.onclick = () => { dataAncorada.setMonth(dataAncorada.getMonth()-1); atualizarInterfacePeriodo(); };
if(btnSeguinte) btnSeguinte.onclick = () => { dataAncorada.setMonth(dataAncorada.getMonth()+1); atualizarInterfacePeriodo(); };
if(btnAtual) btnAtual.onclick = () => { dataAncorada = new Date(); atualizarInterfacePeriodo(); };

if(btnTema) {
    btnTema.onclick = () => {
        document.documentElement.classList.toggle('dark');
        gerenciarIconeTema();
        atualizarInterfacePeriodo();
    };
}

const btnChatTrig = document.getElementById('btn-chat-trigger');
const btnMinChat = document.getElementById('btn-minimizar-chat');
if(btnChatTrig) btnChatTrig.onclick = () => document.getElementById('caixa-chat').classList.toggle('hidden');
if(btnMinChat) btnMinChat.onclick = () => document.getElementById('caixa-chat').classList.add('hidden');

window.onload = () => {
    configurarAbasFormulario();
    inicializarPainelGraficosCollapse();
    configurarEfeitoLupaGraficos();
    configurarSeletoresExtrato();
    configurarFiltrosGraficos();
    configurarAcoesFormulario();
    gerenciarIconeTema();
    
    carregarDadosDoSupabase();
};
