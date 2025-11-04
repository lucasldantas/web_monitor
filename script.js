let allData = [];
let chartInstance = null;
let currentDataToDisplay = []; 
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
    // Adicionado 'Aceitável' para mapear um valor intermediário (75)
    if (status.toLowerCase() === 'aceitável') return 75; 

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
    
    // Adicionado listeners para os filtros de tempo e hostname
    document.getElementById('startTime').addEventListener('change', filterChart);
    document.getElementById('endTime').addEventListener('change', filterChart);
    document.getElementById('hostnameFilter').addEventListener('input', filterChart);

    initMonitor(); 
    startAutoUpdate();
}

// --------------------------------------------------------------------------
// Lógica de Detalhe de Evento (CORRIGIDA)
// --------------------------------------------------------------------------

function displayEventDetails(dataRow) {
    const detailsContainer = document.getElementById('event-details');
    const content = document.getElementById('event-content');

    // Campos principais
    const primaryFields = [
        { label: "Timestamp", key: "Timestamp" },
        { label: "Hostname", key: "Hostname" },
        { label: "Usuário Logado", key: "UserLogged" },
        { label: "IP Público", key: "IP_Publico" },
        { label: "Provedor", key: "Provedor" },
        { label: "Latência TCP (ms)", key: "TCP_Latency_ms" },
        { label: "Status da Conexão", key: "Connection_Health_Status" },
    ];

    let html = '';
    
    // 1. Adiciona campos principais
    primaryFields.forEach(field => {
        const value = dataRow[field.key] || 'N/A';
        html += `<p><strong>${field.label}:</strong> ${value}</p>`;
    });

    // 2. Adiciona Hops Dinamicamente
    html += `<h4 style="margin-top: 15px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Detalhes do Rastreamento (Hops)</h4>`;

    let foundHops = false;
    for (let i = 1; i <= 30; i++) { // Verifica até o Hop 30 (ajuste se necessário)
        const ipKey = `Hop_${i}_IP`;
        const latencyKey = `Hop_${i}_Latency_ms`;

        const ip = dataRow[ipKey];
        const latency = dataRow[latencyKey];
        
        // Verifica se o Hop tem IP ou Latência e não é um valor vazio do CSV
        if (ip || latency) {
            const ipValue = ip && ip.trim() !== '' ? ip : 'N/A';
            const latencyValue = latency && latency.trim() !== '' ? `${latency} ms` : 'N/A';
            
            // Só exibe se pelo menos um dos valores for relevante
            if (ipValue !== 'N/A' || latencyValue !== 'N/A') {
                html += `<p style="margin-top: 5px; margin-bottom: 5px;"><strong>Hop ${i}:</strong> ${ipValue} (${latencyValue})</p>`;
                foundHops = true;
            }
        }
    }
    
    // Se nenhum Hop foi encontrado (além da mensagem do H4), adiciona uma nota
    if (!foundHops) {
        html += `<p style="color: #999;">Nenhum dado detalhado de rastreamento de rota encontrado neste registro.</p>`;
    }

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
        const dataToRedraw = currentDataToDisplay;
        currentDataToDisplay = [];
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
            onClick: handleChartClick,
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
                legend: { labels: { color: color } },
                // 🚀 ADIÇÃO DA LINHA DE REFERÊNCIA DE 100MS
                annotation: {
                    annotations: {
                        line100ms: {
                            type: 'line',
                            scaleID: 'y-latency',
                            value: 100, // Valor de 100ms
                            borderColor: 'red',
                            borderWidth: 2,
                            borderDash: [6, 6], // Linha tracejada
                            label: {
                                display: true,
                                content: 'Limite 100ms',
                                position: 'end',
                                backgroundColor: 'rgba(255, 0, 0, 0.7)',
                                color: 'white',
                                font: {
                                    size: 10
                                }
                            }
                        }
                    }
                }
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
        // Corrigido para verificar se hostname existe antes de chamar toLowerCase
        const matchesHostname = hostnameFilter === '' || (hostname && hostname.toLowerCase().includes(hostnameFilter.toLowerCase())); 
        
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

    // Removida a linha de limpeza do hostnameFilter para manter o filtro após o recarregamento, se o usuário já digitou algo.
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
