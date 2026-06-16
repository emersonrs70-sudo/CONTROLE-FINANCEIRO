// CORE ENGINE V5.0.0 (Migrado para Supabase Cloud)
let dataAncorada = new Date();
let despesas = [];
let receitas = [];
let categoriasDisponiveis = ["Moradia", "Alimentação", "Transporte", "Lazer"];
let projetosProjetados = [];

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

// --- FUNÇÕES DE CARREGAMENTO DO SUPABASE ---
async function carregarDadosDoSupabase() {
    try {
        // 1. Carregar Categorias
        const { data: catData } = await supabase.from('fin_categorias').select('nome');
        if (catData && catData.length > 0) {
            categoriasDisponiveis = catData.map(c => c.nome);
            categoriasSelecionadasGrafico = [...categoriasDisponiveis];
        }

        // 2. Carregar Despesas
        const { data: despData } = await supabase.from('fin_despesas').select('*');
        if (despData) despesas = despData;

        // 3. Carregar Receitas
        const { data: recData } = await supabase.from('fin_receitas').select('*');
        if (recData) receitas = recData;

        // 4. Carregar Projetos
        const { data: projData } = await supabase.from('fin_projetos').select('*');
        if (projData) projetosProjetados = projData;

        // Atualiza a tela após trazer tudo da nuvem
        atualizarInterfacePeriodo();
        configurarSeletoresCategoriaFiltro();
    } catch (err) {
        console.error("Erro ao conectar ou buscar dados do Supabase:", err);
    }
}

function atualizarInterfacePeriodo() {
    document.getElementById('txt-periodo-atual').innerText = `${mesesExtenso[dataAncorada.getMonth()]} ${dataAncorada.getFullYear()}`;
    renderizarLançamentos();
    renderizarHistoricoMetas();
    renderizarProjetos();
    atualizarCardsTopo();
    renderizarGraficos();
}

function atualizarCardsTopo() {
    const mes = dataAncorada.getMonth();
    const ano = dataAncorada.getFullYear();

    const filtrarPorMes = (lista) => lista.filter(item => {
        const d = new Date(item.data || item.dataAlvo);
        return d.getMonth() === mes && d.getFullYear() === ano;
    });

    const totalDespesas = filtrarPorMes(despesas).reduce((acc, cur) => acc + cur.valor, 0);
    const totalReceitas = filtrarPorMes(receitas).reduce((acc, cur) => acc + cur.valor, 0);
    const saldo = totalReceitas - totalDespesas;

    document.getElementById('card-receitas').innerText = `R$ ${totalReceitas.toFixed(2)}`;
    document.getElementById('card-despesas').innerText = `R$ ${totalDespesas.toFixed(2)}`;
    
    const txtSaldo = document.getElementById('card-saldo');
    txtSaldo.innerText = `R$ ${saldo.toFixed(2)}`;
    if(saldo < 0) {
        txtSaldo.className = "text-2xl font-black text-rose-500 tracking-tight transition-all duration-300 transform hover:scale-105";
    } else {
        txtSaldo.className = "text-2xl font-black text-emerald-500 tracking-tight transition-all duration-300 transform hover:scale-105";
    }
}

function renderizarLançamentos() {
    const container = document.getElementById('container-lancamentos');
    container.innerHTML = '';
    
    const mes = dataAncorada.getMonth();
    const ano = dataAncorada.getFullYear();

    let unificada = [
        ...despesas.map(d => ({...d, tipoItem: 'despesa'})),
        ...receitas.map(r => ({...r, tipoItem: 'receita'}))
    ].filter(item => {
        const d = new Date(item.data);
        return d.getMonth() === mes && d.getFullYear() === ano;
    });

    if(filtroExtratoAtual === 'despesas') unificada = unificada.filter(i => i.tipoItem === 'despesa');
    if(filtroExtratoAtual === 'receitas') unificada = unificada.filter(i => i.tipoItem === 'receita');

    unificada.sort((a,b) => new Date(b.data) - new Date(a.data));

    if(unificada.length === 0) {
        container.innerHTML = `<div class="p-8 text-center text-slate-400 dark:text-slate-600 text-xs flex flex-col items-center gap-2"><i data-lucide="inbox" class="w-8 h-8 opacity-40"></i> Nenhum lançamento neste período.</div>`;
        lucide.createIcons();
        return;
    }

    unificada.forEach(item => {
        const div = document.createElement('div');
        div.className = "flex justify-between items-center p-3 rounded-xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900/60 transition-all hover:pl-4 group";
        
        const isDesp = item.tipoItem === 'despesa';
        
        div.innerHTML = `
            <div class="flex items-center gap-3">
                <div class="p-2 rounded-xl ${isDesp ? 'bg-rose-50 text-rose-500 dark:bg-rose-950/30' : 'bg-emerald-50 text-emerald-500 dark:bg-emerald-950/30'}">
                    <i data-lucide="${isDesp ? 'arrow-down-left' : 'arrow-up-right'}" class="w-4 h-4"></i>
                </div>
                <div>
                    <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300">${item.descricao}</h4>
                    <div class="flex gap-2 mt-0.5 items-center">
                        <span class="text-[10px] text-slate-400">${formatarDataBR(item.data)}</span>
                        <span class="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full"></span>
                        <span class="text-[10px] font-medium text-slate-500 px-1.5 py-0.2 bg-slate-100 dark:bg-slate-900 rounded">${item.categoria}</span>
                    </div>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-xs font-black ${isDesp ? 'text-rose-500' : 'text-emerald-500'}">${isDesp ? '-' : '+'} R$ ${item.valor.toFixed(2)}</span>
                <button onclick="excluirLancamento('${item.id}', '${item.tipoItem}')" class="text-slate-300 hover:text-rose-500 dark:text-slate-700 dark:hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity">
                    <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

function renderizarHistoricoMetas() {
    const container = document.getElementById('container-historico-metas');
    if(!container) return;
    container.innerHTML = '';

    const mes = dataAncorada.getMonth();
    const ano = dataAncorada.getFullYear();

    const despMes = despesas.filter(d => {
        const dt = new Date(d.data);
        return dt.getMonth() === mes && dt.getFullYear() === ano;
    });

    categoriasDisponiveis.forEach(cat => {
        const gasta = despMes.filter(d => d.categoria === cat).reduce((acc,cur) => acc+cur.valor, 0);
        if(gasta === 0) return;

        const div = document.createElement('div');
        div.className = "space-y-1.5 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-900/30 transition-colors";
        div.innerHTML = `
            <div class="flex justify-between text-[11px]">
                <span class="font-bold text-slate-600 dark:text-slate-400">${cat}</span>
                <span class="font-black text-slate-700 dark:text-slate-300">R$ ${gasta.toFixed(2)}</span>
            </div>
            <div class="w-full h-1.5 bg-slate-100 dark:bg-slate-900 rounded-full overflow-hidden">
                <div class="h-full bg-purple-500 rounded-full" style="width: ${Math.min((gasta/2000)*100, 100)}%"></div>
            </div>
        `;
        container.appendChild(div);
    });
}

function renderizarProjetos() {
    const container = document.getElementById('container-projetos');
    if(!container) return;
    container.innerHTML = '';

    if(projetosProjetados.length === 0) {
        container.innerHTML = `<div class="p-6 text-center text-slate-400 dark:text-slate-600 text-xs">Nenhum projeto planejado.</div>`;
        return;
    }

    projetosProjetados.forEach(p => {
        const div = document.createElement('div');
        div.className = "p-3 bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-900/60 rounded-xl relative group flex flex-col gap-1";
        div.innerHTML = `
            <button onclick="excluirProjeto('${p.id}')" class="absolute top-3 right-3 text-slate-300 hover:text-rose-500 dark:text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity">
                <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
            <h4 class="text-xs font-bold text-slate-700 dark:text-slate-300 pr-6">${p.nome}</h4>
            <div class="flex justify-between items-center mt-1">
                <span class="text-[10px] text-purple-600 font-bold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-md">Alvo: ${formatarDataBR(p.dataAlvo)}</span>
                <span class="text-xs font-black text-slate-800 dark:text-slate-200">R$ ${p.valor.toFixed(2)}</span>
            </div>
        `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

function renderizarGraficos() {
    const mes = dataAncorada.getMonth();
    const ano = dataAncorada.getFullYear();

    const filtrarPorMes = (lista) => lista.filter(item => {
        const d = new Date(item.data);
        return d.getMonth() === mes && d.getFullYear() === ano;
    });

    const despMes = filtrarPorMes(despesas);
    const recMes = filtrarPorMes(receitas);

    const dadosPizza = categoriasDisponiveis.map(cat => {
        if(!categoriasSelecionadasGrafico.includes(cat)) return 0;
        return despMes.filter(d => d.categoria === cat).reduce((acc, cur) => acc + cur.valor, 0);
    });

    if(chart1) chart1.destroy();
    const ctx1 = document.getElementById('chart-pizza');
    if(ctx1) {
        chart1 = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: categoriasDisponiveis,
                datasets: [{
                    data: dadosPizza,
                    backgroundColor: ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#8b5cf6']
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    const totalD = despMes.reduce((acc,cur)=>acc+cur.valor, 0);
    const totalR = recMes.reduce((acc,cur)=>acc+cur.valor, 0);

    if(chart2) chart2.destroy();
    const ctx2 = document.getElementById('chart-barras');
    if(ctx2) {
        chart2 = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: ['Receitas', 'Despesas'],
                datasets: [{
                    data: [totalR, totalD],
                    backgroundColor: ['#10b981', '#ef4444'],
                    borderRadius: 8
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
        });
    }

    if(chart3) chart3.destroy();
    const ctx3 = document.getElementById('chart-linhas');
    if(ctx3) {
        const diasNoMes = new Date(ano, mes + 1, 0).getDate();
        const labelsDias = Array.from({length: diasNoMes}, (_, i) => i + 1);
        
        const evolucaoCrescente = [];
        let acumulado = 0;
        
        for(let dia = 1; dia <= diasNoMes; dia++) {
            const despDia = despMes.filter(d => {
                const dt = new Date(d.data);
                return dt.getDate() === dia;
            }).reduce((acc,cur)=>acc+cur.valor,0);
            
            acumulado += despDia;
            evolucaoCrescente.push(acumulado);
        }

        chart3 = new Chart(ctx3, {
            type: 'line',
            data: {
                labels: labelsDias,
                datasets: [{
                    label: 'Gasto Acumulado',
                    data: evolucaoCrescente,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

function configurarAbasFormulario() {
    const btnDesp = document.getElementById('tab-despesa');
    const btnRec = document.getElementById('tab-receita');
    const seletorCat = document.getElementById('form-categoria-container');

    if(!btnDesp || !btnRec) return;

    btnDesp.onclick = () => {
        modoFormulario = "despesa";
        btnDesp.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-rose-500 text-white shadow-md shadow-rose-500/20 transition-all";
        btnRec.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-600 hover:text-slate-600 transition-all";
        seletorCat.classList.remove('hidden');
    };

    btnRec.onclick = () => {
        modoFormulario = "receita";
        btnRec.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-white shadow-md shadow-emerald-500/20 transition-all";
        btnDesp.className = "flex-1 py-2 text-xs font-bold rounded-xl bg-slate-50 text-slate-400 dark:bg-slate-950 dark:text-slate-600 hover:text-slate-600 transition-all";
        seletorCat.classList.add('hidden');
    };
}

function inicializarPainelGraficosCollapse() {
    const btnToggle = document.getElementById('btn-toggle-painel-graficos');
    const painelEsquerdo = document.getElementById('painel-esquerdo-graficos');
    const painelDireito = document.getElementById('painel-direito-conteudo');
    const gridMaster = document.getElementById('grid-master');
    const icone = document.getElementById('icone-toggle-painel');

    if(!btnToggle || !painelEsquerdo) return;

    btnToggle.onclick = () => {
        painelEsquerdo.classList.toggle('hidden');
        if(painelEsquerdo.classList.contains('hidden')) {
            gridMaster.style.gridTemplateColumns = "1fr";
            icone.style.transform = "rotate(180deg)";
        } else {
            gridMaster.style.gridTemplateColumns = "420px 1fr";
            icone.style.transform = "rotate(0deg)";
        }
        setTimeout(() => { renderizarGraficos(); }, 400);
    };
}

function configurarEfeitoLupaGraficos() {
    document.querySelectorAll('.card-grafico-premium').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            card.style.setProperty('--mouse-x', `${x}px`);
            card.style.setProperty('--mouse-y', `${y}px`);
        });
    });
}

function configurarSeletoresCategoriaFiltro() {
    const container = document.getElementById('container-filtros-categoria-grafico');
    if(!container) return;
    container.innerHTML = '';

    categoriasDisponiveis.forEach(cat => {
        const btn = document.createElement('button');
        const ativo = categoriasSelecionadasGrafico.includes(cat);
        btn.className = `text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all ${ativo ? 'bg-purple-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400 dark:bg-slate-900 dark:text-slate-700'}`;
        btn.innerText = cat;
        btn.onclick = () => {
            if(categoriasSelecionadasGrafico.includes(cat)) {
                categoriasSelecionadasGrafico = categoriasSelecionadasGrafico.filter(c => c !== cat);
            } else {
                categoriasSelecionadasGrafico.push(cat);
            }
            configurarSeletoresCategoriaFiltro();
            renderizarGraficos();
        };
        container.appendChild(btn);
    });
}

function gerenciarIconeTema() {
    const isDark = document.documentElement.classList.contains('dark');
    const containerIcone = document.getElementById('btn-tema');
    if(!containerIcone) return;
    containerIcone.innerHTML = isDark ? `<i data-lucide="sun" class="w-4 h-4 text-amber-500"></i>` : `<i data-lucide="moon" class="w-4 h-4 text-slate-600"></i>`;
    lucide.createIcons();
}

// --- INTEGRAÇÃO DE INPUTS / SUBMITS COM SUPABASE ---

document.getElementById('form-lancamento').onsubmit = async (e) => {
    e.preventDefault();
    
    const novoItem = {
        id: crypto.randomUUID(),
        descricao: document.getElementById('form-descricao').value,
        valor: parseFloat(document.getElementById('form-valor').value),
        data: document.getElementById('form-data').value,
        categoria: modoFormulario === 'despesa' ? document.getElementById('form-categoria').value : 'Receita'
    };

    if(modoFormulario === 'despesa') {
        const { error } = await supabase.from('fin_despesas').insert([novoItem]);
        if (!error) despesas.push(novoItem);
    } else {
        const { error } = await supabase.from('fin_receitas').insert([novoItem]);
        if (!error) receitas.push(novoItem);
    }

    e.target.reset();
    atualizarInterfacePeriodo();
};

window.excluirLancamento = async function(id, tipo) {
    if(tipo === 'despesa') {
        const { error } = await supabase.from('fin_despesas').delete().eq('id', id);
        if (!error) {
            despesas = despesas.filter(d => d.id !== id);
        }
    } else {
        const { error } = await supabase.from('fin_receitas').delete().eq('id', id);
        if (!error) {
            receitas = receitas.filter(r => r.id !== id);
        }
    }
    atualizarInterfacePeriodo();
};

document.getElementById('form-categoria-gerenciador').onsubmit = async (e) => {
    e.preventDefault();
    const novaCat = document.getElementById('nova-categoria-nome').value.trim();
    if(novaCat && !categoriasDisponiveis.includes(novaCat)) {
        const { error } = await supabase.from('fin_categorias').insert([{ nome: novaCat }]);
        if(!error) {
            categoriasDisponiveis.push(novaCat);
            categoriasSelecionadasGrafico.push(novaCat);
            
            const seletorForm = document.getElementById('form-categoria');
            if(seletorForm) {
                const opt = document.createElement('option');
                opt.value = novaCat; opt.innerText = novaCat;
                seletorForm.appendChild(opt);
            }
            configurarSeletoresCategoriaFiltro();
            atualizarInterfacePeriodo();
        }
    }
    e.target.reset();
};

document.getElementById('form-projeto').onsubmit = async (e) => {
    e.preventDefault();
    const novoProj = {
        id: crypto.randomUUID(),
        nome: document.getElementById('proj-nome').value,
        valor: parseFloat(document.getElementById('proj-valor').value),
        dataAlvo: document.getElementById('proj-data').value
    };

    const { error } = await supabase.from('fin_projetos').insert([novoProj]);
    if(!error) {
        projetosProjetados.push(novoProj);
    }

    e.target.reset();
    atualizarInterfacePeriodo();
};

window.excluirProjeto = async function(id) {
    const { error } = await supabase.from('fin_projetos').delete().eq('id', id);
    if(!error) {
        projetosProjetados = projetosProjetados.filter(p => p.id !== id);
    }
    atualizarInterfacePeriodo();
};

// Configurações de filtros rápidos de tela
document.getElementById('filtro-todos').onclick = (e) => { filtroExtratoAtual = "todos"; alternarEstiloFiltro(e.target); renderizarLançamentos(); };
document.getElementById('filtro-despesas').onclick = (e) => { filtroExtratoAtual = "despesas"; alternarEstiloFiltro(e.target); renderizarLançamentos(); };
document.getElementById('filtro-receitas').onclick = (e) => { filtroExtratoAtual = "receitas"; alternarEstiloFiltro(e.target); renderizarLançamentos(); };

function alternarEstiloFiltro(elementoAtivo) {
    ['filtro-todos', 'filtro-despesas', 'filtro-receitas'].forEach(id => {
        const el = document.getElementById(id);
        el.className = "text-[10px] font-bold px-3 py-1 text-slate-400 dark:text-slate-600 hover:text-slate-600 transition-colors";
    });
    elementoAtivo.className = "text-[10px] font-black px-3 py-1 bg-white dark:bg-slate-900 text-purple-600 rounded-lg shadow-sm border border-slate-100 dark:border-slate-800/60 transition-all";
}

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

// Gatilho de inicialização correto trazendo os dados do Supabase
window.onload = () => {
    configurarAbasFormulario();
    inicializarPainelGraficosCollapse();
    configurarEfeitoLupaGraficos();
    gerenciarIconeTema();
    
    // Dispara a busca assíncrona do banco de dados na nuvem
    carregarDadosDoSupabase();
};
