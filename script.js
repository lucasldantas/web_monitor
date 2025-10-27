let allData = [];
let chartInstance = null;
let currentDataToDisplay = [];
const AUTO_UPDATE_INTERVAL = 10 * 60 * 1000;
let autoUpdateTimer = null; 
let availableHostnames = []; 

// Array de cores para Hostnames
const HOST_COLORS = [
    '#00BCD4', '#E91E63', '#4CAF50', '#FF9800', '#673AB7', '#009688', '#FF5722', '#2196F3',
    '#8BC34A', '#FFC107', '#9C27B0', '#03A9F4', '#FFEB3B', '#3F51B5', '#CDDC39', '#F44336'
];

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
    const statusText = status.toLowerCase();
    if (statusText === 'aceitável') return 75; 

    switch (statusText) {
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
    
    // Inicializa o Select2
    $('#hostnameFilter').select2({
        placeholder: "Selecione Hostname(s)",
        allowClear: true,
        tags: true, 
        closeOnSelect: false 
    });
    
    // Adiciona listener para o Select2 e outros campos
    document.getElementById('osSelect').addEventListener('change', initMonitor);
    document.getElementById('dateSelect').addEventListener('change', initMonitor);
    $('#hostnameFilter').on('change', filterChart);
    document.getElementById('startTime').addEventListener('change', filterChart);
    document.getElementById('endTime').addEventListener('change', filterChart);

    initMonitor(); 
    startAutoUpdate();
}

// --------------------------------------------------------------------------
// Lógica de Detalhe de Evento
// --------------------------------------------------------------------------

// Sobrescreve a função displayEventDetails para aceitar um resumo opcional
function displayEventDetails(dataRow, summaryHtml = '') {
    const detailsContainer = document.getElementById('event-details');
    const content = document.getElementById('event-content');

    const primaryFields = [
        { label: "Timestamp", key: "Timestamp" },
        { label: "Hostname", key: "Hostname" },
        { label: "Usuário Logado", key: "UserLogged" },
        { label: "IP Público", key: "IP_Publico" },
        { label: "Provedor", key: "Provedor" },
        { label: "Latência TCP (ms)", key: "TCP_Latency_ms" },
        { label: "Status da Conexão", key: "Connection_Health_Status" },
    ];

    let html = summaryHtml; 
    
    // 1. Adiciona campos principais
    primaryFields.forEach(field => {
        const value = dataRow[field.key] || 'N/A';
        html += `<p><strong>${field.label}:</strong> ${value}</p>`;
    });

    // 2. Adiciona Hops Dinamicamente
    html += `<h4 style="margin-top: 15px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Detalhes do Rastreamento (Hops)</h4>`;

    let foundHops = false;
    for (let i = 1; i <= 30; i++) {
        const ipKey = `Hop_${i}_IP`;
        const latencyKey = `Hop_${i}_Latency_ms`;

        const ip = dataRow[ipKey];
        const latency = dataRow[latencyKey];
        
        if (ip || latency) {
            const ipValue = ip && ip.trim() !== '' ? ip : 'N/A';
            const latencyValue = latency && latency.trim() !== '' ? `${latency} ms` : 'N/A';
            
            if (ipValue !== 'N/A' || latencyValue !== 'N/A') {
                html += `<p style="margin-top: 5px; margin-bottom: 5px;"><strong>Hop ${i}:</strong> ${ipValue} (${latencyValue})</p>`;
                foundHops = true;
            }
        }
    }
    
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
    const timeLabel = chartInstance.data.labels[dataIndex];
    const selectedHostnames = $('#hostnameFilter').val() || [];

    // MODO 1: Média Agregada (Clique é diferente)
    if (selectedHostnames.length === 0) {
        handleChartAggregatedClick(event);
        return;
    }

    // MODO 2: Séries Individuais
    const datasetLabel = points[0].dataset.label;
    const hostname = datasetLabel.split(' - ')[1]; 
    
    if (!hostname) {
        document.getElementById('event-details').style.display = 'none';
        return;
    }
    
    // Busca o registro original
    const clickedRow = allData.find(row => 
        row.Hostname === hostname &&
        row.Timestamp && row.Timestamp.split(' ')[1].substring(0, 5) === timeLabel
    );

    if (clickedRow) {
        displayEventDetails(clickedRow);
    }
}

// NOVO: Manipulador de Clique para o modo AGREGADO
function handleChartAggregatedClick(event) {
    const points = chartInstance.getElementsAtEventForMode(event, 'index', { intersect: true }, false);

    if (points.length === 0) {
        document.getElementById('event-details').style.display = 'none';
        return;
    }

    const dataIndex = points[0].index;
    const timeLabel = chartInstance.data.labels[dataIndex];
    
    // currentDataToDisplay no modo agregado é o objeto agrupado {timeLabel: {rows: [...]}}
    const aggregatedGroup = currentDataToDisplay[timeLabel];

    if (aggregatedGroup && aggregatedGroup.rows.length > 0) {
        // Encontra o registro com a pior latência para exibir (o melhor para troubleshooting)
        const worstRow = aggregatedGroup.rows.reduce((worst, current) => {
            const currentLatency = parseFloat(current['TCP_Latency_ms']) || 0;
            const worstLatency = parseFloat(worst['TCP_Latency_ms']) || 0;
            return currentLatency > worstLatency ? current : worst;
        }, aggregatedGroup.rows[0]);

        // Cria um HTML de resumo para todas as linhas
        let htmlSummary = `<p><strong>${aggregatedGroup.rows.length} eventos registrados em ${timeLabel}.</strong></p>`;
        
        htmlSummary += `<p style="color: ${mapScore(worstRow['Connection_Health_Status']) < 75 || parseFloat(worstRow['TCP_Latency_ms']) > 200 ? 'red' : 'green'}; margin-bottom: 10px;">Exibindo detalhes do evento com **MAIOR LATÊNCIA** (${worstRow.Hostname}).</p>`;
        
        displayEventDetails(worstRow, htmlSummary);
        
    } else {
        document.getElementById('event-details').style.display = 'none';
    }
}


// --------------------------------------------------------------------------
// Lógica de População de Filtro
// --------------------------------------------------------------------------

function populateHostnameFilter(data) {
    const hostnameSet = new Set();
    data.forEach(row => {
        if (row.Hostname) {
            hostnameSet.add(row.Hostname);
        }
    });

    availableHostnames = Array.from(hostnameSet).sort();
    
    const filterElement = $('#hostnameFilter');
    filterElement.empty(); 
    
    availableHostnames.forEach(hostname => {
        filterElement.append(new Option(hostname, hostname, false, false));
    });
    
    filterElement.trigger('change');
}


// --------------------------------------------------------------------------
// Lógica de Gráfico (Séries Individuais)
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
    const selectedHostnames = $('#hostnameFilter').val() || [];

    if (chartInstance) {
        chartInstance.destroy();
    }
    
    currentDataToDisplay = dataToDisplay;
    
    if (dataToDisplay.length === 0 || selectedHostnames.length === 0) {
        statusElement.textContent = "Selecione um Hostname para visualizar séries individuais, ou deixe o campo vazio para ver a Média de Todos.";
        document.getElementById('event-details').style.display = 'none';
        return;
    }

    statusElement.textContent = ""; 
    
    const timestamps = new Set();
    const datasets = []; 
    
    const isDark = document.body.classList.contains('dark-mode');
    const color = isDark ? '#f0f0f0' : '#333';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const latencyColor = isDark ? '#FF6384' : '#E84A5F';

    let maxLatency = 0;

    dataToDisplay.forEach(row => {
        if (row.Timestamp) {
            timestamps.add(row.Timestamp.split(' ')[1].substring(0, 5));
        }
        const latency = parseFloat(row['TCP_Latency_ms']) || 0;
        if (latency > maxLatency) maxLatency = latency;
    });
    
    const sortedTimestamps = Array.from(timestamps).sort();
    
    // Cria datasets para CADA HOSTNAME selecionado
    selectedHostnames.forEach((hostname, index) => {
        const hostData = dataToDisplay.filter(row => row.Hostname === hostname);
        
        const baseColor = HOST_COLORS[index % HOST_COLORS.length];
        
        const hostScoreData = [];
        const hostLatencyData = [];
        
        sortedTimestamps.forEach(timeLabel => {
            const row = hostData.find(d => d.Timestamp && d.Timestamp.split(' ')[1].substring(0, 5) === timeLabel);
            
            if (row) {
                hostScoreData.push(mapScore(row['Connection_Health_Status']));
                hostLatencyData.push(parseFloat(row['TCP_Latency_ms']) || 0);
            } else {
                hostScoreData.push(null);
                hostLatencyData.push(null);
            }
        });
        
        // Dataset de QUALIDADE
        datasets.push({
            label: `Score - ${hostname}`,
            data: hostScoreData,
            yAxisID: 'y-score', 
            borderColor: baseColor,
            backgroundColor: baseColor,
            pointBackgroundColor: baseColor,
            tension: 0.3, 
            pointRadius: 5,
            borderWidth: 2,
            fill: false,
            order: 1
        });
        
        // Dataset de LATÊNCIA
        datasets.push({
            label: `Latência - ${hostname}`,
            data: hostLatencyData,
            yAxisID: 'y-latency',
            borderColor: baseColor,
            backgroundColor: 'rgba(0, 0, 0, 0)', 
            borderDash: [5, 5], // Linha tracejada
            tension: 0.3,
            pointRadius: 3,
            borderWidth: 2,
            fill: false,
            order: 2
        });
    });

    const latencyMaxScale = Math.ceil((maxLatency + 100) / 500) * 500; 
    const ctx = document.getElementById('qualityChart').getContext('2d');

    chartInstance = new Chart(ctx, { 
        type: 'line', 
        data: { labels: sortedTimestamps, datasets: datasets },
        options: {
            responsive: true, maintainAspectRatio: false, color: color, 
            interaction: { mode: 'index', intersect: false, },
            onClick: handleChartClick,
            scales: {
                x: { title: { display: true, text: 'Horário do Monitoramento (HH:MM)', color: color }, grid: { color: gridColor }, ticks: { color: color } },
                'y-score': { 
                    type: 'linear', position: 'left', title: { display: true, text: 'Qualidade (Score)', color: color }, min: 0, max: 100, grid: { color: gridColor }, 
                    ticks: { stepSize: 25, color: color, callback: (v) => v === 100 ? 'Excelente' : v === 75 ? 'Bom' : v === 25 ? 'Ruim' : v === 0 ? 'Falha/Outro' : '', }
                },
                'y-latency': { 
                    type: 'linear', position: 'right', title: { display: true, text: 'Latência TCP (ms)', color: latencyColor }, min: 0, max: latencyMaxScale, 
                    grid: { drawOnChartArea: false, color: gridColor }, ticks: { color: latencyColor }
                }
            },
            plugins: {
                title: { display: true, text: `Evolução da Qualidade e Latência por Host`, color: color },
                legend: { labels: { color: color } }
            }
        }
    });
}


function filterChart() {
    const startTimeStr = document.getElementById('startTime').value;
    const endTimeStr = document.getElementById('endTime').value;
    const selectedHostnames = $('#hostnameFilter').val() || [];

    if (!allData || allData.length === 0) {
        currentDataToDisplay = [];
        return; 
    }

    const filteredDataByTime = allData.filter(row => {
        const timestamp = row.Timestamp;
        if (!timestamp) return false;
        
        const timeOnly = timestamp.split(' ')[1]; 
        const filterStart = startTimeStr + ':00';
        const filterEnd = endTimeStr + ':59';
        
        return timeOnly >= filterStart && timeOnly <= filterEnd;
    });

    document.getElementById('event-details').style.display = 'none';

    // PONTO DE DECISÃO: Média de Todos ou Séries Individuais
    if (selectedHostnames.length === 0) {
        // MODO 1: Desenhar a Média de Todos os hosts
        drawChartAggregated(filteredDataByTime);
    } else {
        // MODO 2: Desenhar Séries Individuais (filtrando por hostname e tempo)
        const filteredData = filteredDataByTime.filter(row => selectedHostnames.includes(row.Hostname));
        drawChart(filteredData);
    }
}

function initMonitor() {
    const statusElement = document.getElementById('statusMessage');
    const fileName = getFileName();

    statusElement.textContent = `Carregando: ${fileName}...`;
    allData = []; 

    $('#hostnameFilter').val(null).trigger('change');
    document.getElementById('event-details').style.display = 'none';

    Papa.parse(fileName, {
        download: true, 
        header: true,   
        skipEmptyLines: true,
        complete: function(results) {
            
            allData = results.data.filter(row => row.Timestamp && row['Connection_Health_Status'] && row['TCP_Latency_ms'] && row.Hostname); 

            if (allData.length === 0) {
                statusElement.textContent = `Erro: Nenhuma linha de dados válida em ${fileName}.`;
                if (chartInstance) chartInstance.destroy();
                populateHostnameFilter([]);
                return;
            }
            
            populateHostnameFilter(allData);

            statusElement.textContent = `Sucesso! Carregado ${allData.length} registros de ${fileName}.`;

            // Chama o filtro para desenhar o gráfico inicial (que será a Média de Todos)
            filterChart(); 
        },
        error: function(error) {
            console.error("Erro ao carregar o CSV:", error);
            statusElement.textContent = `ERRO 404: Não foi possível encontrar o arquivo ${fileName}. Verifique a data e o nome.`;
            if (chartInstance) chartInstance.destroy();
            document.getElementById('event-details').style.display = 'none';
            populateHostnameFilter([]);
        }
    });
}
