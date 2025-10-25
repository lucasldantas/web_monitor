let allData = [];
let chartInstance = null;
const AUTO_UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutos em milissegundos
let autoUpdateTimer = null; // Variável para armazenar o timer da autoatualização

// Função para formatar a data atual no padrão DD-MM-YY
function getCurrentDateFormatted() {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
}

// --------------------------------------------------------------------------
// Lógica de Inicialização e Tema
// --------------------------------------------------------------------------

// Gerencia o tema escuro
function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark); // Salva a preferência
    // Atualiza o Chart.js para usar cores escuras ou claras
    updateChartTheme(isDark);
}

// Aplica o tema salvo ao carregar a página
function applySavedTheme() {
    const savedTheme = localStorage.getItem('darkMode');
    const checkbox = document.getElementById('checkbox');
    
    if (savedTheme === 'true') {
        document.body.classList.add('dark-mode');
        checkbox.checked = true;
    }
    
    // Adiciona o listener para alternar o tema quando o switch é clicado
    checkbox.addEventListener('change', toggleDarkMode);
    
    // Aplica o tema inicial ao gráfico também
    updateChartTheme(savedTheme === 'true');
}

// Inicia a autoatualização
function startAutoUpdate() {
    // Limpa qualquer timer anterior para evitar múltiplos intervalos rodando
    if (autoUpdateTimer) {
        clearInterval(autoUpdateTimer);
    }
    
    // Configura um novo timer para chamar initMonitor a cada 10 minutos
    autoUpdateTimer = setInterval(() => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`Autoatualizando dados em ${timestamp}...`);
        initMonitor();
    }, AUTO_UPDATE_INTERVAL);

    console.log(`Autoatualização configurada para cada ${AUTO_UPDATE_INTERVAL / 60000} minutos.`);
}

// Preenche a data, aplica o tema e inicia o monitoramento ao carregar
window.onload = function() {
    applySavedTheme();
    document.getElementById('dateSelect').value = getCurrentDateFormatted();
    
    // Adiciona o listener para carregar um novo log quando o OS ou Data muda
    document.getElementById('osSelect').addEventListener('change', initMonitor);
    document.getElementById('dateSelect').addEventListener('change', initMonitor);

    // Inicia o carregamento inicial e a autoatualização
    initMonitor(); 
    startAutoUpdate();
}

// --------------------------------------------------------------------------
// Lógica de Dados e Gráfico
// --------------------------------------------------------------------------

function mapScore(status) {
    if (!status) return 0;
    switch (status.toLowerCase()) {
        case 'excelente': return 100;
        case 'bom': return 75;
        case 'ruim': return 25;
        default: return 0; 
    }
}

function getFileName() {
    const os = document.getElementById('osSelect').value;
    const date = document.getElementById('dateSelect').value;
    return `log_meet_monitoring_${os}_${date}.csv`;
}

// Função auxiliar para atualizar cores do gráfico (chamada ao mudar o tema)
function updateChartTheme(isDark) {
    // Esta função será melhor aplicada na criação do gráfico, mas a deixamos aqui para garantir a consistência
    if (chartInstance) {
        chartInstance.update();
    }
}


function drawChart(dataToDisplay) {
    const statusElement = document.getElementById('statusMessage');

    if (chartInstance) {
        chartInstance.destroy();
    }
    
    if (dataToDisplay.length === 0) {
        statusElement.textContent = "Nenhum dado encontrado no intervalo ou Hostname selecionado.";
        return;
    }

    statusElement.textContent = ""; 
    
    const labels = [];
    const dataScores = [];
    const dataLatency = []; // Novo array para os dados de Latência
    const scorePointColors = [];
    
    const isDark = document.body.classList.contains('dark-mode');
    const color = isDark ? '#f0f0f0' : '#333';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    // Determina a Latência Máxima no conjunto de dados para definir o eixo Y (opcional, mas bom para visualização)
    let maxLatency = 0;

    dataToDisplay.forEach(row => {
        const timestamp = row.Timestamp;
        const scoreStatus = row['Connection_Health_Status'];
        const score = mapScore(scoreStatus);
        const latency = parseFloat(row['TCP_Latency_ms']) || 0; // Pega o valor de Latência
        
        const timeOnly = timestamp.split(' ')[1]; 
        labels.push(timeOnly.substring(0, 5));
        dataScores.push(score);
        dataLatency.push(latency); // Adiciona o valor de latência

        if (latency > maxLatency) maxLatency = latency;

        if (score === 100) scorePointColors.push('#4BC0C0');
        else if (score === 75) scorePointColors.push('#FFCD56');
        else scorePointColors.push('#FF6384'); 
    });

    // Garante que o eixo Y de Latência tenha uma escala visualmente útil
    const latencyMaxScale = Math.ceil((maxLatency + 100) / 500) * 500; // Arredonda para o próximo múltiplo de 500

    const ctx = document.getElementById('qualityChart').getContext('2d');

    chartInstance = new Chart(ctx, { 
        type: 'line', 
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Qualidade (Score)',
                    data: dataScores,
                    yAxisID: 'y-score', // Eixo Y PRIMÁRIO (Esquerda)
                    borderColor: isDark ? '#A0D8FF' : '#36A2EB',
                    backgroundColor: isDark ? 'rgba(160, 216, 255, 0.2)' : 'rgba(54, 162, 235, 0.2)',
                    pointBackgroundColor: scorePointColors,
                    tension: 0.3, 
                    pointRadius: 5,
                    borderWidth: 2,
                    fill: false,
                    order: 1 // Desenha primeiro
                },
                {
                    label: 'Latência (ms)',
                    data: dataLatency,
                    yAxisID: 'y-latency', // Eixo Y SECUNDÁRIO (Direita)
                    borderColor: isDark ? '#FF6384' : '#E84A5F', // Cor contrastante para Latência
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.3,
                    pointRadius: 3,
                    borderWidth: 2,
                    fill: false,
                    order: 2 // Desenha por cima
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            color: color, 
            interaction: {
                mode: 'index',
                intersect: false,
            },
            scales: {
                x: {
                    title: { display: true, text: 'Horário do Monitoramento (HH:MM)', color: color },
                    grid: { color: gridColor },
                    ticks: { color: color }
                },
                // Eixo Y Esquerdo (Score)
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
                // Eixo Y Direito (Latência)
                'y-latency': { 
                    type: 'linear',
                    position: 'right', // Coloca o eixo à direita
                    title: { display: true, text: 'Latência TCP (ms)', color: isDark ? '#FF6384' : '#E84A5F' },
                    min: 0,
                    max: latencyMaxScale, // Usa a escala dinâmica para Latência
                    grid: { 
                        drawOnChartArea: false, // Oculta as linhas de grade para o eixo direito
                        color: gridColor
                    },
                    ticks: {
                        color: isDark ? '#FF6384' : '#E84A5F' // Cor dos ticks em destaque
                    }
                }
            },
            plugins: {
                title: { display: true, text: `Evolução da Qualidade e Latência`, color: color },
                legend: { labels: { color: color } }
            }
        }
    });
    updateChartTheme(isDark);
}


function filterChart() {
    const startTimeStr = document.getElementById('startTime').value;
    const endTimeStr = document.getElementById('endTime').value;
    const hostnameFilter = document.getElementById('hostnameFilter').value.trim();

    if (!allData || allData.length === 0) {
        return; 
    }

    const filteredData = allData.filter(row => {
        const timestamp = row.Timestamp;
        if (!timestamp) return false;
        
        // 1. Filtragem por Hora
        const timeOnly = timestamp.split(' ')[1]; 
        const filterStart = startTimeStr + ':00';
        const filterEnd = endTimeStr + ':59';
        const isWithinTime = timeOnly >= filterStart && timeOnly <= filterEnd;

        // 2. Filtragem por Hostname
        const hostname = row.Hostname;
        const matchesHostname = hostnameFilter === '' || hostname === hostnameFilter; 
        
        return isWithinTime && matchesHostname;
    });

    drawChart(filteredData);
}

function initMonitor() {
    const statusElement = document.getElementById('statusMessage');
    const fileName = getFileName();

    statusElement.textContent = `Carregando: ${fileName}...`;
    allData = []; 

    document.getElementById('hostnameFilter').value = ""; 

    Papa.parse(fileName, {
        download: true, 
        header: true,   
        skipEmptyLines: true,
        complete: function(results) {
            
            allData = results.data.filter(row => row.Timestamp && row['Connection_Health_Status'] && row['TCP_Latency_ms']); 

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
}
