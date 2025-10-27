let allData = [];
let chartInstance = null;
let currentDataToDisplay = []; // Dados atualmente visíveis no gráfico
const AUTO_UPDATE_INTERVAL = 10 * 60 * 1000; // 10 minutos em milissegundos
let autoUpdateTimer = null; 

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
        case 'bom': return 75;
        case 'ruim': return 25;
        default: return 0; 
    }
}

function getFileName() {
    const os = document.getElementById('osSelect').value;
    const date = document.getElementById('dateSelect').value;
    // Padrão do nome do seu arquivo: log_meet_monitoring_OS_DD-MM-YY.csv
    return `log_meet_monitoring_${os}_${date}.csv`;
}

// --------------------------------------------------------------------------
// Lógica de Tema e Inicialização
// --------------------------------------------------------------------------

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('darkMode', isDark);
    updateChartTheme(isDark);
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('darkMode');
    const checkbox = document.getElementById('checkbox');
    
    if (savedTheme === 'true') {
        document.body.classList.add('dark-mode');
        checkbox.checked = true;
    }
    
    checkbox.addEventListener('change', toggleDarkMode);
    updateChartTheme(savedTheme === 'true');
}

function startAutoUpdate() {
    if (autoUpdateTimer) {
        clearInterval(autoUpdateTimer);
    }
    
    autoUpdateTimer = setInterval(() => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`Autoatualizando dados em ${timestamp}...`);
        initMonitor();
    }, AUTO_UPDATE_INTERVAL);

    console.log(`Autoatualização configurada para cada ${AUTO_UPDATE_INTERVAL / 60000} minutos.`);
}

window.onload = function() {
    applySavedTheme();
    document.getElementById('dateSelect').value = getCurrentDateFormatted();
    
    document.getElementById('osSelect').addEventListener('change', initMonitor);
    document.getElementById('dateSelect').addEventListener('change', initMonitor);

    initMonitor(); 
    startAutoUpdate();
}

// --------------------------------------------------------------------------
// Lógica de Detalhe de Evento (NOVA)
// --------------------------------------------------------------------------

function displayEventDetails(dataRow) {
    const detailsContainer = document.getElementById('event-details');
    const content = document.getElementById('event-content');

    // Mapeamento dos campos que queremos exibir para troubleshooting
    const troubleshootingFields = [
        { label: "Timestamp", key: "Timestamp" },
        { label: "Hostname", key: "Hostname" },
        { label: "Usuário Logado", key: "UserLogged" },
        { label: "IP Público", key: "IP_Publico" },
        { label: "Provedor", key: "Provedor" },
        { label: "Latência TCP (ms)", key: "TCP_Latency_ms" },
        { label: "Status da Conexão", key: "Connection_Health_Status" },
        { label: "Hop 1 Latência", key: "Hop 1 Latency ms" },
        { label: "Hop 2 Latência", key: "Hop 2 Latency ms" },
        { label: "Hop 3 Latência", key: "Hop 3 Latency ms" },
        { label: "Hop 4 Latência", key: "Hop 4 Latency ms" }
    ];

    let html = '';
    troubleshootingFields.forEach(field => {
        const value = dataRow[field.key] || 'N/A';
        html += `<p><strong>${field.label}:</strong> ${value}</p>`;
    });

    content.innerHTML = html;
    detailsContainer.style.display = 'block';
}

function handleChartClick(event) {
    const points = chartInstance.getElementsAtEventForMode(event, 'index', { intersect: true }, false);

    if (points.length === 0) {
        document.getElementById('event-details').style.display = 'none';
        return;
    }

    const dataIndex = points[0].index;
    const clickedRow = currentDataToDisplay[dataIndex];

    if (clickedRow) {
        displayEventDetails(clickedRow);
    }
}

// --------------------------------------------------------------------------
// Lógica de Gráfico
// --------------------------------------------------------------------------

function updateChartTheme(isDark) {
    if (chartInstance) {
        // Força a recriação do gráfico para aplicar as cores do tema corretamente
        // (método mais confiável do que apenas usar chartInstance.update())
        const dataToRedraw = currentDataToDisplay;
        currentDataToDisplay = []; // Limpa para evitar loops
        drawChart(dataToRedraw); 
    }
}


function drawChart(dataToDisplay) {
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
    
    const labels = [];
    const dataScores = [];
    const dataLatency = []; 
    const scorePointColors = [];
    
    const isDark = document.body.classList.contains('dark-mode');
    const color = isDark ? '#f0f0f0' : '#333';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const latencyColor = isDark ? '#FF6384' : '#E84A5F';

    let maxLatency = 0;

    dataToDisplay.forEach(row => {
        const timestamp = row.Timestamp;
        const scoreStatus = row['Connection_Health_Status'];
        const score = mapScore(scoreStatus);
        const latency = parseFloat(row['TCP_Latency_ms']) || 0; 
        
        const timeOnly = timestamp.split(' ')[1]; 
        labels.push(timeOnly.substring(0, 5));
        dataScores.push(score);
        dataLatency.push(latency); 

        if (latency > maxLatency) maxLatency = latency;

        if (score === 100) scorePointColors.push('#4BC0C0');
        else if (score === 75) scorePointColors.push('#FFCD56');
        else scorePointColors.push('#FF6384'); 
    });

    const latencyMaxScale = Math.ceil((maxLatency + 100) / 500) * 500; 

    const ctx = document.getElementById('qualityChart').getContext('2d');

    chartInstance = new Chart(ctx, { 
        type: 'line', 
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Qualidade (Score)',
                    data: dataScores,
                    yAxisID: 'y-score', 
                    borderColor: isDark ? '#A0D8FF' : '#36A2EB',
                    backgroundColor: isDark ? 'rgba(160, 216, 255, 0.2)' : 'rgba(54, 162, 235, 0.2)',
                    pointBackgroundColor: scorePointColors,
                    tension: 0.3, 
                    pointRadius: 5,
                    borderWidth: 2,
                    fill: false,
                    order: 1
                },
                {
                    label: 'Latência (ms)',
                    data: dataLatency,
                    yAxisID: 'y-latency', 
                    borderColor: latencyColor,
                    backgroundColor: 'rgba(255, 99, 132, 0.1)',
                    tension: 0.3,
                    pointRadius: 3,
                    borderWidth: 2,
                    fill: false,
                    order: 2
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
            onClick: handleChartClick, // Manipulador de clique
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
    const hostnameFilter = document.getElementById('hostnameFilter').value.trim();

    if (!allData || allData.length === 0) {
        currentDataToDisplay = [];
        return; 
    }

    const filteredData = allData.filter(row => {
        const timestamp = row.Timestamp;
        if (!timestamp) return false;
        
        const timeOnly = timestamp.split(' ')[1]; 
        const filterStart = startTimeStr + ':00';
        const filterEnd = endTimeStr + ':59';
        const isWithinTime = timeOnly >= filterStart && timeOnly <= filterEnd;

        const hostname = row.Hostname;
        const matchesHostname = hostnameFilter === '' || hostname === hostnameFilter; 
        
        return isWithinTime && matchesHostname;
    });

    document.getElementById('event-details').style.display = 'none';

    drawChart(filteredData);
}

function initMonitor() {
    const statusElement = document.getElementById('statusMessage');
    const fileName = getFileName();

    statusElement.textContent = `Carregando: ${fileName}...`;
    allData = []; 

    document.getElementById('hostnameFilter').value = ""; 
    document.getElementById('event-details').style.display = 'none';

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
            document.getElementById('event-details').style.display = 'none';
        }
    });
}
