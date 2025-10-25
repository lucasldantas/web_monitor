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

// NOVO: Função auxiliar para atualizar cores do gráfico (chamada ao mudar o tema)
function updateChartTheme(isDark) {
    if (chartInstance) {
        // Define as cores do texto e grade do Chart.js
        const color = isDark ? '#f0f0f0' : '#333';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
        
        chartInstance.options.color = color;
        chartInstance.options.scales.x.grid.color = gridColor;
        chartInstance.options.scales.x.ticks.color = color;
        chartInstance.options.scales.y.grid.color = gridColor;
        chartInstance.options.scales.y.ticks.color = color;
        chartInstance.options.plugins.title.color = color;
        chartInstance.options.plugins.legend.labels.color = color;
        
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
    const backgroundColors = [];
    
    const isDark = document.body.classList.contains('dark-mode');
    const color = isDark ? '#f0f0f0' : '#333';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

    dataToDisplay.forEach(row => {
        const timestamp = row.Timestamp;
        const scoreStatus = row['Connection_Health_Status'];
        const score = mapScore(scoreStatus);
        
        const timeOnly = timestamp.split(' ')[1]; 
        labels.push(timeOnly.substring(0, 5));
        dataScores.push(score);

        if (score === 100) backgroundColors.push('#4BC0C0');
        else if (score === 75) backgroundColors.push('#FFCD56');
        else backgroundColors.push('#FF6384'); 
    });

    const ctx = document.getElementById('qualityChart').getContext('2d');

    chartInstance = new Chart(ctx, { 
        type: 'line', 
        data: {
            labels: labels,
            datasets: [{
                label: 'Qualidade da Conexão (Score)',
                data: dataScores,
                borderColor: isDark ? '#A0D8FF' : '#36A2EB', // Azul mais claro no tema escuro
                backgroundColor: isDark ? 'rgba(160, 216, 255, 0.2)' : 'rgba(54, 162, 235, 0.2)',
                tension: 0.3, 
                pointBackgroundColor: backgroundColors,
                pointRadius: 5,
                borderWidth: 2,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            // Configurações de tema incluídas aqui
            color: color, 
            scales: {
                x: {
                    title: { display: true, text: 'Horário do Monitoramento (HH:MM)', color: color },
                    grid: { color: gridColor },
                    ticks: { color: color }
                },
                y: {
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
                }
            },
            plugins: {
                title: { display: true, text: `Evolução do Score de Qualidade da Conexão`, color: color },
                legend: { labels: { color: color } } // Cor da legenda
            }
        }
    });
    // Aplica o tema ao novo gráfico (garante que as cores da grade sejam aplicadas)
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
        // Se o campo de filtro estiver vazio, o filtro é ignorado.
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

    // Limpa o Hostname ao carregar um novo log, para que o gráfico não fique vazio
    document.getElementById('hostnameFilter').value = ""; 

    Papa.parse(fileName, {
        download: true, 
        header: true,   
        skipEmptyLines: true,
        complete: function(results) {
            
            allData = results.data.filter(row => row.Timestamp && row['Connection_Health_Status']); 

            if (allData.length === 0) {
                statusElement.textContent = `Erro: Nenhuma linha de dados válida em ${fileName}.`;
                if (chartInstance) chartInstance.destroy();
                return;
            }
            
            statusElement.textContent = `Sucesso! Carregado ${allData.length} registros de ${fileName}.`;

            // Aplica o filtro de tempo e hostname
            filterChart(); 
        },
        error: function(error) {
            console.error("Erro ao carregar o CSV:", error);
            statusElement.textContent = `ERRO 404: Não foi possível encontrar o arquivo ${fileName}. Verifique a data e o nome.`;
            if (chartInstance) chartInstance.destroy();
        }
    });
}
