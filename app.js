// CORE ENGINE V5.1.0 - CONTROLE COMPORTAMENTAL E ENGAGAMENTO MOBILE

// --- INICIALIZAÇÃO DO CLIENTE SUPABASE ---
if (typeof supabase !== 'undefined' && !window.supabase) {
    const _supabaseUrl = 'https://uhvxrxqioovjvwjqbyes.supabase.co'; 
    const _supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVodnhyeHFpb292anZ3anFieWVzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE0NTMxMjcsImV4cCI6MjA5NzAyOTEyN30.8RDULQ6XpN3WqLg7i_jrAFB4210gMD85HXWQO7yFIvs';
    window.supabase = supabase.createClient(_supabaseUrl, _supabaseAnonKey);
}

// --- VARIÁVEIS DE ESTADO ---
let dataAncorada = new Date();
let despesas = [];
let receitas = [];
let categoriasDisponiveis = ["Moradia", "Alimentação", "Transporte", "Lazer", "Outros"];
let projetosProjetados = [];

let modoFormulario = "despesa"; // despesa | receita
let filtroExtratoAtual = "todos"; // todos | despesas | receitas
let subpainelAberto = null;

let chart1, chart2, chart3;

const mesesExtenso = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// --- FORMATADORES ---
function formatarDataBR(isoString) {
    if(!isoString) return '';
    const d = new Date(isoString);
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
}

function formatarMoeda(valor) {
    return `R$ ${parseFloat(valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// --- PONTO 1: ATALHOS RÁPIDOS DE VALOR ---
window.adicionarValorRapido = function(valor) {
    const input = document.getElementById('lancamento-valor');
    if(!input) return;
    const valorAtual = parseFloat(input.value) || 0;
    input.value = (valorAtual + valor).toFixed(2);
    
    // Feedback visual local no input de valor
    input.classList.add('ring-2', 'ring-purple-500');
    setTimeout(() => input.classList.remove('ring-2', 'ring-purple-500'), 250);
};

// --- PONTO 3: GRATIFICAÇÃO VISUAL IMEDIATA (TOAST SYSTEM) ---
window.mostrarToast = function(mensagem, tipo = 'sucesso') {
    const container = document.getElementById('toast-container');
    if(!container) return;

    const toast = document.createElement('div');
    toast.className = `flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg border text-xs font-bold transition-all duration-300 opacity-0 translate-y-2 pointer-events-auto bg-white dark:bg-slate-900 ${
        tipo === 'sucesso' 
        ? 'border-emerald-200 dark:border-emerald-950 text-emerald-600 dark:text-emerald-400' 
        : 'border-blue-200 dark:border-blue-950 text-blue-600 dark:text-blue-400'
    }`;

    const icon = tipo === 'sucesso' ? 'sparkles' : 'bell';
    toast.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4"></i> <span>${mensagem}</span>`;
    container.appendChild(toast);
    lucide.createIcons();

    // Animar Entrada
    setTimeout(() => {
        toast.classList.remove('opacity-0', 'translate-y-2');
        toast.classList.add('opacity-100', 'translate-y-0');
    }, 50);

    // Animar Saída e Remover
    setTimeout(() => {
        toast.classList.add('opacity-0', '-translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3200);
};

function piscarElemento(id) {
    const el = document.getElementById(id);
    if(!el) return;
    el.classList.add('ring-4', 'ring-purple-500/50', 'scale-105');
    setTimeout(() => {
        el.classList.remove('ring-4', 'ring-purple-500/50', 'scale-105');
    }, 500);
}

// --- CONTROLE COM PORTAMENTAL: CÁLCULO DE STREAK DIÁRIO ---
function calcularStreakDiario() {
    const todasDatas = [
        ...despesas.map(d => d.data),
        ...receitas.map(r => r.data)
    ].filter(Boolean);

    if (todasDatas.length === 0) return 0;

    // Eliminar datas duplicadas e organizar de forma decrescente
    const datasUnicas = [...new Set(todasDatas)].sort((a, b) => new Date(b) - new Date(a));

    const hoje = new Date();
    const formatarLocalDate = (date) => {
        const yyyy = date.getFullYear();
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}`;
    };

    const hojeStr = formatarLocalDate(hoje);
    const ontem = new Date(hoje);
    ontem.setDate(hoje.getDate() - 1);
    const ontemStr = formatarLocalDate(ontem);

    // Se o último registro foi antes de ontem, o streak quebrou
    if (datasUnicas[0] < ontemStr && datasUnicas[0] !== hojeStr) {
        return 0;
    }

    let streak = 0;
    let dataEsperada = new Date(datasUnicas[0]); 

    for (let i = 0; i < datasUnicas.length; i++) {
        const dataAtualStr = datasUnicas[i];
        const dataEsperadaStr = formatarLocalDate(dataEsperada);

        if (dataAtualStr === dataEsperadaStr) {
            streak++;
            dataEsperada.setDate(dataEsperada.getDate() - 1);
        } else {
            break;
        }
    }
    return streak;
}

function atualizarUIStreak() {
    const streak = calcularStreakDiario();
    const container = document.getElementById('streak-container');
    if (!container) return;

    if (streak > 0) {
        container.className = "flex items-center gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-amber-200 dark:border-amber-900/40 shadow-sm transition-all duration-300";
        container.innerHTML = `<i data-lucide="flame" class="w-3.5 h-3.5 text-amber-500 fill-amber-500 animate-pulse"></i> <span>${streak} ${streak === 1 ? 'dia' : 'dias'}</span>`;
    } else {
        container.className = "flex items-center gap-1 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 px-2.5 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-800 shadow-sm transition-all duration-300";
        container.innerHTML = `<i data-lucide="flame-kindling" class="w-3.5 h-3.5"></i> <span>0 dias</span>`;
    }
    lucide.createIcons();
}

// --- PONTO 4: LEMBRETES E NUDGES DE COMPORTAMENTO ---
function atualizarNudgesHoje() {
    const hoje = new Date();
    const hojeStr = hoje.toISOString().split('T')[0];
    
    const registrouHoje = [
        ...despesas.map(d => d.data),
        ...receitas.map(r => r.data)
    ].includes(hojeStr);

    const statusBanner = document.getElementById('status-geral-banner');
    const statusTitulo = document.getElementById('status-geral-titulo');
    const statusDesc = document.getElementById('status-geral-desc');
    const streak = calcularStreakDiario();

    if (!registrouHoje) {
        // Alerta amigável de incentivo
        statusBanner.className = "p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-amber-50/50 border-amber-200 dark:bg-slate-900/40 dark:border-amber-950/40 shadow-sm transition-all duration-300";
        statusTitulo.innerHTML = `<span class="text-amber-600 dark:text-amber-400 flex items-center gap-1.5"><i data-lucide="flame" class="w-4 h-4 fill-amber-500"></i> Proteja seu Streak Diário!</span>`;
        statusDesc.innerText = streak > 0 
            ? `Você ainda não anotou seus gastos de hoje. Registre qualquer lançamento para garantir seu streak de ${streak} ${streak === 1 ? 'dia' : 'dias'}!`
            : `Mantenha o controle sob rédeas curtas. Faça seu primeiro registro do dia e ative sua chama de hábito!`;
    } else {
        // Sucesso
        statusBanner.className = "p-4 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white border-slate-200 dark:bg-slate-900 dark:border-slate-800 shadow-sm transition-all duration-300";
        statusTitulo.innerHTML = `<span class="text-emerald-500 dark:text-emerald-400 flex items-center gap-1.5"><i data-lucide="check-circle" class="w-4 h-4"></i> Organização em dia!</span>`;
        statusDesc.innerText = streak > 0
            ? `Seu streak de ${streak} ${streak === 1 ? 'dia' : 'dias'} está assegurado hoje. Excelente rotina financeira!`
            : `Sua saúde financeira agradece. Dados salvos com sucesso!`;
    }
    lucide.createIcons();
}

// --- NAVEGAÇÃO DE ABAS (MOBILE) ---
// --- CONTROLE DE NAVEGAÇÃO DE ABAS (MOBILE) COM ANIMAÇÃO ---
function mudarAbaMobile(idAba) {
    document.querySelectorAll('.mobile-tab').forEach(secao => {
        secao.classList.add('hidden');
        secao.classList.remove('grid', 'block');
    });

    const secaoAtiva = document.getElementById(`secao-${idAba}`);
    if (secaoAtiva) {
        secaoAtiva.classList.remove('hidden');
        // Mantém a estrutura de grid ativa para organizar o espaçamento das transações
        if (idAba === 'transacoes') {
            secaoAtiva.classList.add('grid');
        } else {
            secaoAtiva.classList.add('block');
        }
    }

    const abas = ['dashboard', 'transacoes', 'planejador'];
    abas.forEach(aba => {
        const btn = document.getElementById(`nav-btn-${aba}`);
        if(btn) {
            const icon = btn.querySelector('i');
            if(aba === idAba) {
                btn.className = "flex flex-col items-center gap-0.5 text-purple-600 dark:text-purple-400 font-black transition-all duration-300 scale-105";
                if (icon) {
                    icon.classList.add('scale-110', 'text-purple-600', 'dark:text-purple-400');
                    // Executa um efeito físico leve de toque ("pop") no ícone selecionado
                    icon.animate([
                        { transform: 'scale(1)' },
                        { transform: 'scale(1.25)' },
                        { transform: 'scale(1)' }
                    ], {
                        duration: 300,
                        easing: 'ease-out'
                    });
                }
            } else {
                btn.className = "flex flex-col items-center gap-0.5 text-slate-400 dark:text-slate-600 transition-all duration-300";
                if (icon) {
                    icon.classList.remove('scale-110', 'text-purple-600', 'dark:text-purple-400');
                }
            }
        }
    });

    if (idAba === 'planejador') {
        setTimeout(renderizarGraficos, 100);
    }
}
// --- CARREGAMENTO DO SUPABASE ---
async function carregarDadosDoSupabase() {
    try {
        const { data: catData } = await supabase.from('fin_categorias').select('nome');
        if (catData && catData.length > 0) {
            categoriasDisponiveis = [...new Set([...categoriasDisponiveis, ...catData.map(c => c.nome)])];
        }

        const { data: despData } = await supabase.from('fin_despesas').select('*');
        if (despData) despesas = despData;

        const { data: recData } = await supabase.from('fin_receitas').select('*');
        if (recData) receitas = recData;

        const { data: projData } = await supabase.from('fin_projetos').select('*');
        if (projData) projetosProjetados = projData;

        inicializarComponentesSelect();
        atualizarInterfacePeriodo();
    } catch (err) {
        console.error("Erro ao sincronizar do Supabase:", err);
    }
}

function atualizarInterfacePeriodo() {
    document.getElementById('txt-periodo-atual').innerText = `${mesesExtenso[dataAncorada.getMonth()]} ${dataAncorada.getFullYear()}`;
    
    atualizarCardsTopo();
    renderizarLancamentosExtrato();
    renderizarProjetos();
    renderizarHistoricoGeral();
    renderizarGraficos();
    atualizarAnalisesCalculadas();
    
    // Atualização dos Gatilhos de Comportamento
    atualizarUIStreak();
    atualizarNudgesHoje();
}

function inicializarComponentesSelect() {
    const selectForm = document.getElementById('despesa-categoria');
    const selectHist = document.getElementById('filtro-cat-historico');
    
    if (selectForm) {
        selectForm.innerHTML = '';
        categoriasDisponiveis.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            selectForm.appendChild(opt);
        });
    }

    if (selectHist) {
        selectHist.innerHTML = '<option value="todas">Todas Categorias</option>';
        categoriasDisponiveis.forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.innerText = cat;
            selectHist.appendChild(opt);
        });
    }
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
    const saldoProjetado = totalReceitas - totalDespesas;

    const saldoHistoricoReal = receitas.reduce((acc, r) => acc + r.valor, 0) - despesas.reduce((acc, d) => acc + d.valor, 0);

    document.getElementById('card-receitas').innerText = `+ R$ ${totalReceitas.toFixed(2)}`;
    document.getElementById('card-despesas').innerText = `- R$ ${totalDespesas.toFixed(2)}`;
    document.getElementById('card-saldo-real').innerText = formatarMoeda(saldoHistoricoReal);
    
    const cardSaldoProj = document.getElementById('card-saldo');
    cardSaldoProj.innerText = formatarMoeda(saldoProjetado);
    if(saldoProjetado < 0) {
        cardSaldoProj.className = "text-xl font-bold text-red-500 mt-1 transition-all duration-300";
    } else {
        cardSaldoProj.className = "text-xl font-bold text-emerald-500 mt-1 transition-all duration-300";
    }

    const cardMetaTxt = document.getElementById('card-meta-txt');
    if (projetosProjetados.length > 0) {
        const totalMetas = projetosProjetados.reduce((acc, p) => acc + p.valor, 0);
        const percent = Math.min((saldoHistoricoReal / (totalMetas || 1)) * 100, 100);
        cardMetaTxt.innerText = `${Math.max(0, percent).toFixed(0)}%`;
    } else {
        cardMetaTxt.innerText = "0%";
    }
}

// --- SUBPAINÉIS ---
function abrirSubPainel(tipo) {
    const paineis = ['saldo-real', 'saldo', 'receitas', 'despesas', 'metas'];
    paineis.forEach(p => {
        const el = document.getElementById(`subpainel-${p}`);
        if(p === tipo && subpainelAberto !== tipo) {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    });

    subpainelAberto = (subpainelAberto === tipo) ? null : tipo;
    calcularSubPainelEspecifico(tipo);
}

function calcularSubPainelEspecifico(tipo) {
    if (tipo === 'saldo-real') {
        const saldoReal = receitas.reduce((acc, r) => acc + r.valor, 0) - despesas.reduce((acc, d) => acc + d.valor, 0);
        const hoje = new Date();
        const ultimoDiaDoMes = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).getDate();
        const diasRestantes = Math.max(1, ultimoDiaDoMes - hoje.getDate() + 1);

        const limiteDiario = Math.max(0, saldoReal / diasRestantes);
        document.getElementById('txt-hardcore-limite').innerText = formatarMoeda(limiteDiario);

        const percentCaixa = Math.min((saldoReal / 3000) * 100, 100);
        document.getElementById('txt-hardcore-porcentagem').innerText = `${Math.max(0, percentCaixa).toFixed(0)}%`;
        document.getElementById('barra-hardcore-vida').style.width = `${Math.max(0, percentCaixa)}%`;
        
        document.getElementById('txt-saldo-real-calculo').innerText = `Proporção calculada para durar os próximos ${diasRestantes} dias do mês corrente.`;
    } 
    else if (tipo === 'saldo') {
        const mes = dataAncorada.getMonth();
        const ano = dataAncorada.getFullYear();
        const despMes = despesas.filter(d => {
            const dt = new Date(d.data);
            return dt.getMonth() === mes && dt.getFullYear() === ano;
        }).reduce((acc,cur) => acc + cur.valor, 0);
        const recMes = receitas.filter(r => {
            const dt = new Date(r.data);
            return dt.getMonth() === mes && dt.getFullYear() === ano;
        }).reduce((acc,cur) => acc + cur.valor, 0);

        const sobraProjetada = Math.max(0, recMes - despMes);
        document.getElementById('txt-alocacao-metas').innerText = formatarMoeda(sobraProjetada * 0.5);
        document.getElementById('txt-alocacao-reserva').innerText = formatarMoeda(sobraProjetada * 0.3);
        document.getElementById('txt-alocacao-lazer').innerText = formatarMoeda(sobraProjetada * 0.2);
    } 
    else if (tipo === 'receitas') {
        const saldoHistoricoReal = receitas.reduce((acc, r) => acc + r.valor, 0) - despesas.reduce((acc, d) => acc + d.valor, 0);
        const baseCalculo = Math.max(0, saldoHistoricoReal);

        document.getElementById('txt-ba-poupanca').innerText = formatarMoeda(baseCalculo * 0.0617);
        document.getElementById('txt-ba-cdb').innerText = formatarMoeda(baseCalculo * 0.105);
        document.getElementById('txt-ba-selic').innerText = formatarMoeda(baseCalculo * 0.1075);
    }
}

function atualizarSimuladorCortes() {
    const sliderLazer = parseFloat(document.getElementById('slider-corte-lazer').value);
    const sliderCompras = parseFloat(document.getElementById('slider-corte-compras').value);

    document.getElementById('txt-corte-lazer-porcentagem').innerText = `${sliderLazer}%`;
    document.getElementById('txt-corte-compras-porcentagem').innerText = `${sliderCompras}%`;

    const mes = dataAncorada.getMonth();
    const ano = dataAncorada.getFullYear();
    const despMes = despesas.filter(d => {
        const dt = new Date(d.data);
        return dt.getMonth() === mes && dt.getFullYear() === ano;
    });

    const gastoLazer = despMes.filter(d => d.categoria === 'Lazer').reduce((acc, cur) => acc + cur.valor, 0);
    const gastoComprasGeral = despMes.filter(d => d.categoria !== 'Moradia' && d.categoria !== 'Lazer' && d.categoria !== 'Alimentação').reduce((acc, cur) => acc + cur.valor, 0);

    const poupadoLazer = gastoLazer * (sliderLazer / 100);
    const poupadoCompras = gastoComprasGeral * (sliderCompras / 100);

    document.getElementById('txt-corte-lazer-poupado').innerText = formatarMoeda(poupadoLazer);
    document.getElementById('txt-corte-compras-poupado').innerText = formatarMoeda(poupadoCompras);
    document.getElementById('txt-corte-economia-total').innerText = formatarMoeda(poupadoLazer + poupadoCompras);
}

// --- RENDERIZAÇÃO DE TABELAS ---
function renderizarLancamentosExtrato() {
    const container = document.getElementById('tabela-extrato-unificado-corpo');
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
        container.innerHTML = `<tr><td colspan="5" class="p-6 text-center text-slate-400 dark:text-slate-600 text-[11px]">Nenhum lançamento no período filtrado.</td></tr>`;
        return;
    }

    unificada.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-100/50 dark:hover:bg-slate-900/40 transition-colors";
        
        const isDesp = item.tipoItem === 'despesa';
        
        tr.innerHTML = `
            <td class="p-3 whitespace-nowrap text-slate-400 font-medium">${formatarDataBR(item.data)}</td>
            <td class="p-3 font-bold text-slate-700 dark:text-slate-350">${item.descricao}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] text-slate-500 font-bold">${item.categoria || 'Geral'}</span></td>
            <td class="p-3 text-right font-black ${isDesp ? 'text-red-500' : 'text-emerald-500'}">${isDesp ? '-' : '+'} R$ ${item.valor.toFixed(2)}</td>
            <td class="p-3 text-center">
                <button onclick="excluirLancamento('${item.id}', '${item.tipoItem}')" class="p-1.5 hover:text-red-500 text-slate-400 dark:text-slate-600 transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        container.appendChild(tr);
    });
    lucide.createIcons();
}

function renderizarProjetos() {
    const container = document.getElementById('tabela-projetos-corpo');
    if(!container) return;
    container.innerHTML = '';

    if(projetosProjetados.length === 0) {
        container.innerHTML = `<tr><td colspan="5" class="p-4 text-center text-slate-400 text-[11px]">Nenhum projeto planejado.</td></tr>`;
        return;
    }

    projetosProjetados.forEach(p => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 dark:hover:bg-slate-900/20";
        
        const hoje = new Date();
        const target = new Date(p.dataAlvo);
        const diffMeses = Math.max(1, (target.getFullYear() - hoje.getFullYear()) * 12 + (target.getMonth() - hoje.getMonth()));
        const aporteSugerido = p.valor / diffMeses;

        tr.innerHTML = `
            <td class="p-3 font-bold">${p.nome}</td>
            <td class="p-3 text-slate-700 dark:text-slate-350 font-semibold">${formatarMoeda(p.valor)}</td>
            <td class="p-3 text-purple-600 font-bold">${formatarDataBR(p.dataAlvo)}</td>
            <td class="p-3 font-black text-slate-800 dark:text-slate-200">${formatarMoeda(aporteSugerido)}/mês</td>
            <td class="p-3 text-center">
                <button onclick="excluirProjeto('${p.id}')" class="p-1 text-slate-400 hover:text-red-500 transition-colors">
                    <i data-lucide="trash-2" class="w-4 h-4"></i>
                </button>
            </td>
        `;
        container.appendChild(tr);
    });
    lucide.createIcons();
}

function renderizarHistoricoGeral() {
    const tbody = document.getElementById('tabela-historico-geral-corpo');
    if(!tbody) return;
    tbody.innerHTML = '';

    const busca = document.getElementById('busca-historico').value.toLowerCase();
    const filtroCat = document.getElementById('filtro-cat-historico').value;

    let totalGeral = [
        ...despesas.map(d => ({...d, tipoItem: 'despesa'})),
        ...receitas.map(r => ({...r, tipoItem: 'receita'}))
    ];

    if (busca) {
        totalGeral = totalGeral.filter(t => t.descricao.toLowerCase().includes(busca));
    }
    if (filtroCat !== 'todas') {
        totalGeral = totalGeral.filter(t => t.categoria === filtroCat);
    }

    totalGeral.sort((a,b) => new Date(b.data) - new Date(a.data));

    if(totalGeral.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-slate-400 text-[11px]">Nenhum lançamento corresponde à busca.</td></tr>`;
        return;
    }

    totalGeral.forEach(item => {
        const tr = document.createElement('tr');
        tr.className = "border-b border-slate-100 dark:border-slate-800/40 hover:bg-slate-50 dark:hover:bg-slate-900/30 text-xs";
        
        const isDesp = item.tipoItem === 'despesa';

        tr.innerHTML = `
            <td class="p-3 text-slate-400">${formatarDataBR(item.data)}</td>
            <td class="p-3 font-bold">${item.descricao}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-850 text-[10px] text-slate-500 font-bold">${item.categoria}</span></td>
            <td class="p-3 text-right font-black ${isDesp ? 'text-red-500' : 'text-emerald-500'}">${isDesp ? '-' : '+'} ${formatarMoeda(item.valor)}</td>
        `;
        tbody.appendChild(tr);
    });
}

function atualizarAnalisesCalculadas() {
    const mes = dataAncorada.getMonth();
    const ano = dataAncorada.getFullYear();
    
    const despMes = despesas.filter(d => {
        const dt = new Date(d.data);
        return dt.getMonth() === mes && dt.getFullYear() === ano;
    });

    if(despMes.length === 0) {
        document.getElementById('txt-maiores-gargalos').innerText = "Sem gastos registrados neste mês para avaliar gargalos.";
        document.getElementById('container-alertas-gargalo').classList.add('hidden');
        return;
    }

    const analise = {};
    despMes.forEach(d => {
        analise[d.categoria] = (analise[d.categoria] || 0) + d.valor;
    });

    let maiorCategoria = '';
    let maiorValor = 0;
    for(const [cat, v] of Object.entries(analise)) {
        if(v > maiorValor) {
            maiorValor = v;
            maiorCategoria = cat;
        }
    }

    document.getElementById('txt-maiores-gargalos').innerText = `Seu maior foco de consumo este mês é em "${maiorCategoria}" com um total de ${formatarMoeda(maiorValor)}.`;
    
    const alertaGargalo = document.getElementById('container-alertas-gargalo');
    if (maiorValor > 1500) {
        alertaGargalo.classList.remove('hidden');
        alertaGargalo.innerHTML = `<span class="flex items-center gap-1.5"><i data-lucide="alert-triangle" class="w-4 h-4 text-red-500"></i> Alerta de Orçamento: A categoria "${maiorCategoria}" atingiu um patamar crítico de ${formatarMoeda(maiorValor)}.</span>`;
        lucide.createIcons();
    } else {
        alertaGargalo.classList.add('hidden');
    }
}

// --- GRÁFICOS (CHART.JS) ---
function renderizarGraficos() {
    const mes = dataAncorada.getMonth();
    const ano = dataAncorada.getFullYear();

    const despMes = despesas.filter(d => {
        const dt = new Date(d.data);
        return dt.getMonth() === mes && dt.getFullYear() === ano;
    });

    const recMes = receitas.filter(r => {
        const dt = new Date(r.data);
        return dt.getMonth() === mes && dt.getFullYear() === ano;
    });

    const totalDespesas = despMes.reduce((acc, cur) => acc + cur.valor, 0);
    const totalReceitas = recMes.reduce((acc, cur) => acc + cur.valor, 0);

    const dadosPizza = categoriasDisponiveis.map(cat => {
        return despMes.filter(d => d.categoria === cat).reduce((acc, cur) => acc + cur.valor, 0);
    });

    if(chart1) chart1.destroy();
    const ctx1 = document.getElementById('chartCategorias');
    if(ctx1) {
        chart1 = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: categoriasDisponiveis,
                datasets: [{
                    data: dadosPizza,
                    backgroundColor: ['#a855f7', '#3b82f6', '#10b981', '#f43f5e', '#f59e0b', '#64748b']
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } } 
            }
        });
    }

    if(chart2) chart2.destroy();
    const ctx2 = document.getElementById('chartEvolucao');
    if(ctx2) {
        const diasNoMes = new Date(ano, mes + 1, 0).getDate();
        const labelsDias = Array.from({length: diasNoMes}, (_, i) => i + 1);
        
        let acumulado = 0;
        const evolucaoCrescente = [];
        
        for(let dia = 1; dia <= diasNoMes; dia++) {
            const despDia = despMes.filter(d => {
                return new Date(d.data).getDate() === dia;
            }).reduce((acc, cur) => acc + cur.valor, 0);
            acumulado += despDia;
            evolucaoCrescente.push(acumulado);
        }

        chart2 = new Chart(ctx2, {
            type: 'line',
            data: {
                labels: labelsDias,
                datasets: [{
                    label: 'Gastos Acumulados',
                    data: evolucaoCrescente,
                    borderColor: '#a855f7',
                    backgroundColor: 'rgba(168, 85, 247, 0.08)',
                    fill: true,
                    tension: 0.35,
                    borderWidth: 2.5
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } },
                scales: { x: { grid: { display: false } } }
            }
        });
    }

    if(chart3) chart3.destroy();
    const ctx3 = document.getElementById('chartProporcao');
    if(ctx3) {
        chart3 = new Chart(ctx3, {
            type: 'bar',
            data: {
                labels: ['Entradas', 'Saídas'],
                datasets: [{
                    data: [totalReceitas, totalDespesas],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderRadius: 8
                }]
            },
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                plugins: { legend: { display: false } }, 
                scales: { y: { beginAtZero: true } } 
            }
        });
    }
}

// --- CATEGORIAS ---
function alternarNovaCategoria(mostrar) {
    if (mostrar) {
        document.getElementById('bloco-select-categoria').classList.add('hidden');
        document.getElementById('bloco-nova-categoria').classList.remove('hidden');
    } else {
        document.getElementById('bloco-select-categoria').classList.remove('hidden');
        document.getElementById('bloco-nova-categoria').classList.add('hidden');
    }
}

async function criarCategoriaRapida() {
    const nomeInput = document.getElementById('despesa-nova-categoria-nome');
    const novaCat = nomeInput.value.trim();
    if(novaCat && !categoriasDisponiveis.includes(novaCat)) {
        const { error } = await supabase.from('fin_categorias').insert([{ nome: novaCat }]);
        if(!error) {
            categoriasDisponiveis.push(novaCat);
            inicializarComponentesSelect();
            nomeInput.value = '';
            alternarNovaCategoria(false);
            
            const select = document.getElementById('despesa-categoria');
            select.value = novaCat;
            mostrarToast("Categoria criada!", "sucesso");
        }
    }
}

// --- FORMULÁRIOS ---
function configurarAbasFormulario() {
    const btnDesp = document.getElementById('tab-despesa');
    const btnRec = document.getElementById('tab-receita');
    const catBlock = document.getElementById('bloco-select-categoria');
    const tipoGastoBlock = document.getElementById('bloco-tipo-gasto');

    if(!btnDesp || !btnRec) return;

    btnDesp.onclick = () => {
        modoFormulario = "despesa";
        btnDesp.className = "flex-1 py-2.5 text-xs font-bold rounded-lg bg-red-600 text-white shadow-sm transition-all";
        btnRec.className = "flex-1 py-2.5 text-xs font-bold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900 transition-all";
        
        document.getElementById('titulo-lancamento-unificado').innerText = "📉 Nova Despesa";
        document.getElementById('btn-submit-unificado').className = "w-full bg-red-600 text-white text-xs font-bold py-3 rounded-xl hover:bg-red-700 transition-colors shadow-sm";
        document.getElementById('btn-submit-unificado').innerText = "Adicionar Lançamento";
        
        catBlock.classList.remove('hidden');
        tipoGastoBlock.classList.remove('hidden');
    };

    btnRec.onclick = () => {
        modoFormulario = "receita";
        btnRec.className = "flex-1 py-2.5 text-xs font-bold rounded-lg bg-emerald-500 text-white shadow-sm transition-all";
        btnDesp.className = "flex-1 py-2.5 text-xs font-bold rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-900 transition-all";
        
        document.getElementById('titulo-lancamento-unificado').innerText = "📈 Nova Receita";
        document.getElementById('btn-submit-unificado').className = "w-full bg-emerald-500 text-white text-xs font-bold py-3 rounded-xl hover:bg-emerald-600 transition-colors shadow-sm";
        document.getElementById('btn-submit-unificado').innerText = "Injetar Receita";
        
        catBlock.classList.add('hidden');
        tipoGastoBlock.classList.add('hidden');
        document.getElementById('bloco-validade-fixo').classList.add('hidden');
    };

    document.getElementById('despesa-tipo').onchange = (e) => {
        if(e.target.value === 'fixo') {
            document.getElementById('bloco-validade-fixo').classList.remove('hidden');
        } else {
            document.getElementById('bloco-validade-fixo').classList.add('hidden');
        }
    };
}

// --- SUBMIT E EXCLUSÃO ---
document.getElementById('form-lancamento-unificado').onsubmit = async (e) => {
    e.preventDefault();
    
    const idEdicao = document.getElementById('lancamento-id-edicao').value;
    const descricao = document.getElementById('lancamento-nome').value;
    const valor = parseFloat(document.getElementById('lancamento-valor').value);
    const data = document.getElementById('lancamento-data').value;
    const categoria = modoFormulario === 'despesa' ? document.getElementById('despesa-categoria').value : 'Receita';

    const novoItem = {
        id: idEdicao || crypto.randomUUID(),
        descricao,
        valor,
        data,
        categoria
    };

    if(modoFormulario === 'despesa') {
        const { error } = await supabase.from('fin_despesas').insert([novoItem]);
        if (!error) {
            despesas.push(novoItem);
            mostrarToast("Gasto anotado! Continue assim.", "sucesso");
        }
    } else {
        const { error } = await supabase.from('fin_receitas').insert([novoItem]);
        if (!error) {
            receitas.push(novoItem);
            mostrarToast("Receita injetada com sucesso! 🚀", "sucesso");
        }
    }

    e.target.reset();
    document.getElementById('lancamento-id-edicao').value = '';
    document.getElementById('bloco-validade-fixo').classList.add('hidden');
    
    // Configura novamente a data de hoje por conveniência de preenchimento continuado
    const hojeIso = new Date().toISOString().split('T')[0];
    document.getElementById('lancamento-data').value = hojeIso;

    atualizarInterfacePeriodo();
    
    // Efeito de Gratificação Visual nos cards principais
    piscarElemento('wrapper-saldo-real');
    piscarElemento('wrapper-saldo');
};

window.excluirLancamento = async function(id, tipo) {
    if(confirm("Tem certeza que deseja remover este lançamento?")) {
        if(tipo === 'despesa') {
            const { error } = await supabase.from('fin_despesas').delete().eq('id', id);
            if (!error) despesas = despesas.filter(d => d.id !== id);
        } else {
            const { error } = await supabase.from('fin_receitas').delete().eq('id', id);
            if (!error) receitas = receitas.filter(r => r.id !== id);
        }
        mostrarToast("Lançamento removido do extrato", "info");
        atualizarInterfacePeriodo();
    }
};

// --- PROJETOS ---
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
        e.target.reset();
        mostrarToast("Novo sonho projetado!", "sucesso");
        atualizarInterfacePeriodo();
    }
};

window.excluirProjeto = async function(id) {
    if(confirm("Deseja remover este projeto/meta?")) {
        const { error } = await supabase.from('fin_projetos').delete().eq('id', id);
        if(!error) projetosProjetados = projetosProjetados.filter(p => p.id !== id);
        mostrarToast("Meta de projeto arquivada", "info");
        atualizarInterfacePeriodo();
    }
};

// --- FILTROS ---
document.getElementById('filtro-extrato-todos').onclick = (e) => { filtroExtratoAtual = "todos"; alternarVisualFiltro(e.target); renderizarLancamentosExtrato(); };
document.getElementById('filtro-extrato-despesas').onclick = (e) => { filtroExtratoAtual = "despesas"; alternarVisualFiltro(e.target); renderizarLancamentosExtrato(); };
document.getElementById('filtro-extrato-receitas').onclick = (e) => { filtroExtratoAtual = "receitas"; alternarVisualFiltro(e.target); renderizarLancamentosExtrato(); };

function alternarVisualFiltro(elementoAtivo) {
    ['filtro-extrato-todos', 'filtro-extrato-despesas', 'filtro-extrato-receitas'].forEach(id => {
        const el = document.getElementById(id);
        el.className = "px-3 py-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-all";
    });
    elementoAtivo.className = "px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 shadow-sm text-purple-600 dark:text-purple-400 font-black transition-all";
}

document.getElementById('busca-historico').oninput = () => renderizarHistoricoGeral();
document.getElementById('filtro-cat-historico').onchange = () => renderizarHistoricoGeral();

document.getElementById('btn-mes-anterior').onclick = () => { dataAncorada.setMonth(dataAncorada.getMonth()-1); atualizarInterfacePeriodo(); };
document.getElementById('btn-mes-seguinte').onclick = () => { dataAncorada.setMonth(dataAncorada.getMonth()+1); atualizarInterfacePeriodo(); };
document.getElementById('btn-mes-atual').onclick = () => { dataAncorada = new Date(); atualizarInterfacePeriodo(); };

// --- CHATBOT ---
document.getElementById('btn-chat-trigger').onclick = () => document.getElementById('caixa-chat').classList.toggle('hidden');
document.getElementById('btn-minimizar-chat').onclick = () => document.getElementById('caixa-chat').classList.add('hidden');

document.getElementById('btn-enviar-chat').onclick = responderChat;
document.getElementById('chat-input').onkeydown = (e) => { if(e.key === 'Enter') responderChat(); };

function responderChat() {
    const input = document.getElementById('chat-input');
    const area = document.getElementById('chat-area');
    const texto = input.value.trim().toLowerCase();

    if(!texto) return;

    let resposta = "Desculpe, não entendi. Você pode perguntar sobre 'dica', 'gargalos', 'saldo' ou 'investimento'.";
    const saldoHistoricoReal = receitas.reduce((acc, r) => acc + r.valor, 0) - despesas.reduce((acc, d) => acc + d.valor, 0);

    if (texto.includes('dica') || texto.includes('ajuda')) {
        resposta = `💡 Dica rápida: Evite despesas supérfluas no final de semana. Seu saldo acumulado real hoje é de ${formatarMoeda(saldoHistoricoReal)}.`;
    } else if (texto.includes('saldo')) {
        resposta = `O seu saldo real consolidado é de ${formatarMoeda(saldoHistoricoReal)}. Se continuarmos na média atual, sua perspectiva de poupança tende a crescer de forma segura.`;
    } else if (texto.includes('investimento') || texto.includes('poupar')) {
        resposta = `Para aplicar com segurança, com seu caixa atual de ${formatarMoeda(saldoHistoricoReal)}, recomendamos investir no CDB Liquidez Diária, que oferece um retorno estável acima da inflação anual.`;
    }

    area.innerHTML = `<div><strong>Você:</strong> ${input.value}</div><div class="mt-1 text-purple-600 dark:text-purple-400"><strong>Consultor:</strong> ${resposta}</div>`;
    input.value = '';
}

// --- TEMA ---
document.getElementById('btn-tema').onclick = () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    document.getElementById('btn-tema').innerHTML = isDark ? `<i data-lucide="sun" class="w-4 h-4 text-amber-500"></i>` : `<i data-lucide="moon" class="w-4 h-4 text-slate-600"></i>`;
    lucide.createIcons();
};

// --- GATILHO DE INICIALIZAÇÃO ---
window.onload = () => {
    configurarAbasFormulario();
    carregarDadosDoSupabase();
    
    const isDark = document.documentElement.classList.contains('dark');
    document.getElementById('btn-tema').innerHTML = isDark ? `<i data-lucide="sun" class="w-4 h-4 text-amber-500"></i>` : `<i data-lucide="moon" class="w-4 h-4 text-slate-600"></i>`;
    
    // Preencher data padrão do formulário como 'hoje'
    const hojeIso = new Date().toISOString().split('T')[0];
    document.getElementById('lancamento-data').value = hojeIso;
    
    mudarAbaMobile('dashboard');
    lucide.createIcons();
};
