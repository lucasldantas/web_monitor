let allData = [];
let chartInstance = null;
let currentDataToDisplay = []; 
const AUTO_UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutos em milissegundos
let autoUpdateTimer = null; 
let allHostnames = new Set(); // NOVO: Armazena todos os hostnames únicos

// --------------------------------------------------------------------------
// Funções Auxiliares
// --------------------------------------------------------------------------

function getCurrentDateFormatted() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
}

function mapScore(status) {
    if (!status) return 0;

    switch (status.toLowerCase()) {
        case 'excelente': return 100;
        case 'bom':
        case 'aceitável': return 75; // Trata 'aceitável' e 'bom' como 75
        case 'ruim': return 25;
        default: return 0; 
    }
}

function getFileName() {
    const os = document.getElementById('osSelect').value;
    const date = document.getElementById('dateSelect').value;
    return `log_meet_monitoring_${os}_${date}.csv`;
}

// --------------------------------------------------------------------------
// Funções de Controle de Hostname (Novas)
// --------------------------------------------------------------------------

// Preenche o datalist para o autocomplete (sugestões conforme digita)
function populateHostnameDatalist() {
    const datalist = document.getElementById('hostnameDatalist');
    datalist.innerHTML = ''; 
    
    Array.from(allHostnames).sort().forEach(hostname => {
        if (hostname && hostname.trim() !== '') {
            const option = document.createElement('option');
            option.value = hostname;
            datalist.appendChild(option);
        }
    });
}

// Adiciona o hostname digitado ao select de seleção múltipla
function addHostname() {
    const input = document.getElementById('hostnameInput');
    const select = document.getElementById('hostnameSelect');
    const hostname = input.value.trim();

    // Verifica se o hostname é válido e ainda não está na seleção
    if (hostname && allHostnames.has(hostname)) {
        
        // Verifica se já está selecionado
        if (Array.from(select.options).some(opt => opt.value === hostname && opt.selected)) {
            alert(`O Hostname '${hostname}' já está na sua seleção.`);
            input.value = '';
            return;
        }

        // Remove a opção "Todos" (valor "") se for a única selecionada, e adiciona o novo host
        const allOption = select.querySelector('option[value=""]');
        if (allOption && allOption.selected) {
            allOption.selected = false;
        }

        // Tenta encontrar a opção existente ou cria uma nova
        let option = select.querySelector(`option[value="${hostname}"]`);
        if (!option) {
             option = document.createElement('option');
             option.value = hostname;
             option.textContent = hostname;
             select.appendChild(option);
        }
        
        option.selected = true; // Seleciona o host
        
        input.value = ''; // Limpa o campo de input
        filterChart();
    } else if (hostname && !allHostnames.has(hostname)) {
        alert(`O Hostname '${hostname}' não existe nos dados carregados.`);
    }
}

// Limpa todas as seleções no select
function clearHostnameSelection() {
    const select = document.getElementById('hostnameSelect');
    // Deseleciona todas as opções
    Array.from(select.options).forEach(opt => opt.selected = false);
    
    // Assegura que a opção "Todos (Média)" esteja selecionada
    const allOption = select.querySelector('option[value=""]');
    if (allOption) {
        allOption.selected = true;
    }

    filterChart();
}

// Obtém os hostnames selecionados, excluindo a opção "Todos"
function getSelectedHostnames() {
    const select = document.getElementById('hostnameSelect');
    const selectedOptions = Array.from(select.selectedOptions);
    
    // Se a única seleção for "Todos (Média)", retorna array vazio para indicar modo Média
    if (selectedOptions.length === 1 && selectedOptions[0].value === '') {
        return [];
    }

    // Retorna apenas os hostnames válidos (excluindo a opção "Todos")
    return selectedOptions.map(option => option.value).filter(value => value !== '');
}


// --------------------------------------------------------------------------
// Funções de Processamento de Dados
// --------------------------------------------------------------------------

function displayEventDetails(row) {
    document.getElementById('detail-hostname').textContent = row.Hostname || 'N/A';
    document.getElementById('detail-timestamp').textContent = row.Timestamp || 'N/A';
    document.getElementById('detail-status').textContent = row['Connection_Health_Status'] || 'N/A';
    document.getElementById('detail-latency').textContent = (row['TCP_Latency_ms'] ? parseFloat(row['TCP_Latency_ms']).toFixed(2) + ' ms' : 'N/A');
    document.getElementById('detail-conference-status').textContent = row['Conference_Health_Status'] || 'N/A';
    
    document.getElementById('event-details').style.display = 'block';
}

function handleChartClick(event) {
    const points = chartInstance.getElementsAtEventForMode(event, 'index', { intersect: true }, false);
    if (points.length === 0) {
        document.getElementById('event-details').style.display = 'none';
        return;
    }

    const dataIndex = points[0].index;
    
    const selectedHostnames = getSelectedHostnames();
    const isSingleHost = selectedHostnames.length === 1;

    if (isSingleHost) {
        const timeLabel = chartInstance.data.labels[dataIndex];
        
        // Encontra o registro bruto mais próximo
        const clickedRow = currentDataToDisplay.find(row => 
            row.Timestamp && 
            row.Timestamp.split(' ')[1].substring(0, 5) === timeLabel && 
            row.Hostname === selectedHostnames[0]
        );

        if (clickedRow) {
            displayEventDetails(clickedRow);
        } else {
            document.getElementById('event-details').style.display = 'none';
        }
    }
}

// Função auxiliar para gerar cores distintas para cada Hostname
function getDistinctColor(index, isDark) {
    const colors = [
        '#36A2EB', // Azul
        '#FF6384', // Vermelho/Rosa
        '#4BC0C0', // Ciano
        '#FFCD56', // Amarelo
        '#9966FF', // Roxo
        '#C9CBCE', // Cinza
        '#FF9F40'  // Laranja
    ];
    // Se for modo escuro, clareia um pouco as cores primárias
    if (isDark) {
        const darkColors = ['#5b9ffc', '#ff8eab', '#6dd6d6', '#ffd673', '#b388ff', '#e0e0e0', '#ffb969'];
        return darkColors[index % darkColors.length];
    }
    return colors[index % colors.length];
}

function drawChart(dataToDisplay, selectedHostnames) {
    const statusElement = document.getElementById('statusMessage');
    if (chartInstance) {
        chartInstance.destroy();
    }
    
    currentDataToDisplay = dataToDisplay; 
    if (dataToDisplay.length === 0) {
        statusElement.textContent = "Nenhum dado encontrado no intervalo ou Hostname selecionado.";
        document.getElementById('event-details').style.display = 'none';
        return;
    }

    statusElement.textContent = ""; 
    
    const isDark = document.body.classList.contains('dark-mode');
    const color = isDark ? '#f0f0f0' : '#333';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const latencyColor = isDark ? '#FF6384' : '#E84A5F'; // Cor padrão para Latência
    
    let maxLatency = 0;
    
    // --- Lógica de Geração de Datasets ---
    const datasets = [];
    const labels = [];
    let processingHostnames = selectedHostnames;
    const isAverageMode = processingHostnames.length === 0;
    
    // 1. Determinar os labels de tempo únicos (eixos X)
    const timeLabels = new Set(dataToDisplay.map(row => row.Timestamp.split(' ')[1].substring(0, 5)));
    const sortedTimeLabels = Array.from(timeLabels).sort();
    labels.push(...sortedTimeLabels);
    
    // Se nenhum host foi selecionado, processamos a média
    if (isAverageMode) {
        processingHostnames = ['__AVERAGE__']; 
    }
    
    // 2. Criar os datasets de Qualidade e Latência para cada Hostname ou para a Média
    processingHostnames.forEach((hostname, index) => {
        const isAverage = hostname === '__AVERAGE__';
        const labelBase = isAverage ? 'Média Geral' : hostname;
        
        const hostData = isAverage ? dataToDisplay : dataToDisplay.filter(row => row.Hostname === hostname);
        
        // Cores e estilos
        const scoreColor = isAverage ? '#FF9F40' : getDistinctColor(index, isDark); 
        const lineWeight = isAverage ? 3 : 2;
        const pointRadius = isAverage ? 4 : 3;
        
        const dataScores = [];
        const dataLatency = []; 

        sortedTimeLabels.forEach(timeLabel => {
            // Filtra os dados no período de 1 minuto
            const currentPeriodData = hostData.filter(row => row.Timestamp.split(' ')[1].substring(0, 5) === timeLabel);
            
            if (currentPeriodData.length > 0) {
                
                const scores = currentPeriodData.map(row => mapScore(row['Connection_Health_Status']))
                                                .filter(s => s !== null);
                const latencies = currentPeriodData.map(row => parseFloat(row['TCP_Latency_ms']))
                                                    .filter(l => !isNaN(l)); // Filtra valores não-numéricos (NaN)
                
                // Média para o score e latência
                const score = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
                const latency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null; 
                
                dataScores.push(score);
                dataLatency.push(latency);
                
                if (latency !== null && latency > maxLatency) maxLatency = latency;
                
            } else {
                dataScores.push(null); // Sem dados neste período
                dataLatency.push(null); // Sem dados neste período
            }
        });
        
        // Adicionar dataset de Qualidade (Score)
        datasets.push({
            label: `${labelBase} (Qualidade)`,
            data: dataScores,
            yAxisID: 'y-score', 
            borderColor: scoreColor,
            backgroundColor: `${scoreColor}33`, 
            pointBackgroundColor: scoreColor,
            tension: 0.3, 
            pointRadius: pointRadius,
            borderWidth: lineWeight,
            fill: false,
            order: 1 
        });
        
        // Adicionar dataset de Latência
        datasets.push({
            label: `${labelBase} (Latência)`,
            data: dataLatency,
            yAxisID: 'y-latency', 
            // CORREÇÃO: Usa a cor padrão de latência para a linha se for a média
            borderColor: isAverage ? latencyColor : scoreColor,
            backgroundColor: isAverage ? 'rgba(255, 99, 132, 0.1)' : `${scoreColor}33`,
            tension: 0.3,
            pointRadius: pointRadius,
            borderWidth: lineWeight,
            fill: false,
            // CORREÇÃO: No modo Média, a Latência DEVE ser visível.
            hidden: !isAverage, 
            order: 2
        });
    });
    // --- Fim da Lógica de Geração de Datasets ---

    // Escala máxima para o eixo Y de Latência (arredondado para o próximo múltiplo de 500)
    const latencyMaxScale = Math.ceil((maxLatency + 100) / 500) * 500; 
    
    // Se a latência for 0, garante que o max seja um valor razoável (ex: 500)
    if (latencyMaxScale === 0) {
        latencyMaxScale = 500;
    }

    const ctx = document.getElementById('qualityChart').getContext('2d');
    chartInstance = new Chart(ctx, { 
        type: 'line', 
        data: {
            labels: labels,
            datasets: datasets, 
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            color: color, 
            interaction: {
                mode: 'index',
                intersect: false,
            },
            // Desativa o clique em modo multi-host ou média
            onClick: selectedHostnames.length === 1 ? handleChartClick : null, 
            scales: {
                x: {
                    title: { display: true, text: 'Horário do Monitoramento (HH:MM)', color: color },
                    grid: { color: gridColor },
                    ticks: { color: color }
                },
                'y-score': { 
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: 'Qualidade (Score)', color: color },
                    min: 0,
                    max: 100,
                    grid: { color: gridColor },
                    ticks: { 
                        stepSize: 25, 
                        color: color,
                        callback: function(value) {
                            if (value === 100) return 'Excelente';
                            if (value === 75) return 'Bom';
                            if (value === 25) return 'Ruim';
                            if (value === 0) return 'Falha/Outro';
                            return '';
                        }
                    }
                },
                'y-latency': { 
                    type: 'linear',
                    position: 'right', 
                    title: { display: true, text: 'Latência TCP (ms)', color: latencyColor },
                    min: 0,
                    max: latencyMaxScale, 
                    grid: { 
                        drawOnChartArea: false, 
                        color: gridColor
                    },
                    ticks: {
                        color: latencyColor
                    }
                }
            },
            plugins: {
                title: { display: true, text: `Evolução da Qualidade e Latência`, color: color },
                legend: { labels: { color: color } }
            }
        }
    });
}

function filterChart() {
    const startTimeStr = document.getElementById('startTime').value;
    const endTimeStr = document.getElementById('endTime').value;
    
    const selectedHostnames = getSelectedHostnames(); 
    const isFilteringByHost = selectedHostnames.length > 0;
    
    if (!allData || allData.length === 0) {
        currentDataToDisplay = [];
        // Chamar drawChart() aqui garante que o statusMessage seja atualizado se necessário.
        drawChart([], selectedHostnames);
        return;
    }

    let dataForDisplay;
    
    if (isFilteringByHost) {
        // Se hosts foram selecionados, filtramos por tempo E pelos hosts
        dataForDisplay = allData.filter(row => {
            const timestamp = row.Timestamp;
            if (!timestamp) return false;
            
            const timeOnly = timestamp.split(' ')[1]; 
            const filterStart = startTimeStr + ':00';
            const filterEnd = endTimeStr + ':59';
            const isWithinTime = timeOnly >= filterStart && timeOnly <= filterEnd;

            const hostname = row.Hostname;
            const matchesHostname = selectedHostnames.includes(hostname);
            
            return isWithinTime && matchesHostname;
        });
    } else {
        // Se NENHUM host foi selecionado (MÉDIA GERAL), filtramos APENAS por tempo
        dataForDisplay = allData.filter(row => {
            const timestamp = row.Timestamp;
            if (!timestamp) return false;
            
            const timeOnly = timestamp.split(' ')[1]; 
            const filterStart = startTimeStr + ':00';
            const filterEnd = endTimeStr + ':59';
            const isWithinTime = timeOnly >= filterStart && timeOnly <= filterEnd;

            return isWithinTime;
        });
    }
    
    document.getElementById('event-details').style.display = 'none';

    drawChart(dataForDisplay, selectedHostnames); 
}


// --------------------------------------------------------------------------
// Funções de Inicialização e Dark Mode
// --------------------------------------------------------------------------

function initMonitor() {
    const statusElement = document.getElementById('statusMessage');
    const fileName = getFileName();

    statusElement.textContent = `Carregando: ${fileName}...`;
    allData = []; 

    document.getElementById('hostnameInput').value = ""; // Limpa o input de autocomplete
    // Não chama clearHostnameSelection() aqui para manter a seleção de hostnames após a atualização
    // clearHostnameSelection(); 
    document.getElementById('event-details').style.display = 'none';

    Papa.parse(fileName, {
        download: true, 
        header: true,   
        skipEmptyLines: true,
        complete: function(results) {
            
            allData = results.data.filter(row => row.Timestamp && row['Connection_Health_Status'] && row['TCP_Latency_ms'] && row.Hostname); 
            
            // NOVO: Extrair hostnames únicos e preencher o datalist
            allHostnames = new Set(allData.map(row => row.Hostname).filter(h => h && h.trim() !== ''));
            populateHostnameDatalist(); 
            
            // Verifica se a opção "Todos (Média)" existe e a adiciona/mantém se a lista estiver vazia
            const select = document.getElementById('hostnameSelect');
            if (!select.querySelector('option[value=""]')) {
                const allOption = document.createElement('option');
                allOption.value = '';
                allOption.textContent = 'Todos (Média)';
                select.prepend(allOption);
                allOption.selected = true; // Seleciona por padrão
            }

            // Remove hostnames que não existem mais no arquivo CSV
            Array.from(select.options).forEach(option => {
                if (option.value !== '' && !allHostnames.has(option.value)) {
                    option.remove();
                }
            });


            if (allData.length === 0) {
                statusElement.textContent = `Erro: Nenhuma linha de dados válida em ${fileName}.`;
                if (chartInstance) chartInstance.destroy();
                return;
            }
            
            statusElement.textContent = `Sucesso! Carregado ${allData.length} registros de ${fileName}.`;

            filterChart(); 
        },
        error: function(error) {
            console.error("Erro ao carregar o CSV:", error);
            statusElement.textContent = `ERRO 404: Não foi possível encontrar o arquivo ${fileName}. Verifique a data e o nome.`;
            if (chartInstance) chartInstance.destroy();
        }
    });

    if (autoUpdateTimer) clearInterval(autoUpdateTimer);
    autoUpdateTimer = setInterval(initMonitor, AUTO_UPDATE_INTERVAL); 
}

function toggleDarkMode() {
    const body = document.body;
    body.classList.toggle('dark-mode');
    
    // Armazena a preferência no Local Storage
    localStorage.setItem('darkMode', body.classList.contains('dark-mode'));

    // Redesenha o gráfico para aplicar as novas cores
    if (chartInstance) {
        filterChart(); 
    }
}

function init() {
    // Define a data atual
    const dateInput = document.getElementById('dateSelect');
    if (!dateInput.value) {
        dateInput.value = getCurrentDateFormatted();
    }

    // Carrega a preferência de dark mode
    if (localStorage.getItem('darkMode') === 'true') {
        document.body.classList.add('dark-mode');
        document.getElementById('darkModeToggle').checked = true;
    }
    
    // Adiciona o listener para o botão de toggle
    const checkbox = document.getElementById('darkModeToggle');
    checkbox.addEventListener('change', toggleDarkMode);

    // Inicia o monitoramento (carrega o log do dia)
    initMonitor(); 
}

window.onload = init;
