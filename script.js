let allData = [];
let chartInstance = null;
let currentDataToDisplay = [];
const AUTO_UPDATE_INTERVAL = 10 * 60 * 1000;
let autoUpdateTimer = null; 
let availableHostnames = []; 

// Array de cores para Hostnames (mantido para séries individuais)
const HOST_COLORS = [
    '#00BCD4', '#E91E63', '#4CAF50', '#FF9800', '#673AB7', '#009688', '#FF5722', '#2196F3',
    '#8BC34A', '#FFC107', '#9C27B0', '#03A9F4', '#FFEB3B', '#3F51B5', '#CDDC39', '#F44336'
];

// --------------------------------------------------------------------------
// Funções Auxiliares (Mantidas)
// --------------------------------------------------------------------------
function getCurrentDateFormatted() { /* ... */ }
function mapScore(status) { /* ... */ }
function getFileName() { /* ... */ }
function toggleDarkMode() { /* ... */ }
function applySavedTheme() { /* ... */ }
function startAutoUpdate() { /* ... */ }
function displayEventDetails(dataRow) { /* ... */ }
function handleChartClick(event) { /* ... */ }
function populateHostnameFilter(data) { /* ... */ }
function updateChartTheme(isDark) { /* ... */ }

// ... (todas as funções auxiliares do script anterior permanecem as mesmas) ...

// Funções do script anterior omitidas aqui por brevidade, mas devem ser mantidas
// (getCurrentDateFormatted, mapScore, getFileName, toggleDarkMode, applySavedTheme, 
// startAutoUpdate, displayEventDetails, handleChartClick, populateHostnameFilter, updateChartTheme)


// --------------------------------------------------------------------------
// NOVO: Função para desenhar o gráfico com Média de TODOS os hosts
// --------------------------------------------------------------------------

function drawChartAggregated(dataToDisplay) {
    const statusElement = document.getElementById('statusMessage');

    if (chartInstance) {
        chartInstance.destroy();
    }
    
    currentDataToDisplay = dataToDisplay;
    
    if (dataToDisplay.length === 0) {
        statusElement.textContent = "Nenhum dado encontrado no intervalo selecionado para calcular a média.";
        document.getElementById('event-details').style.display = 'none';
        return;
    }

    statusElement.textContent = "Média de Todos os Hostnames (Clique nos pontos para detalhes do evento).";
    
    const isDark = document.body.classList.contains('dark-mode');
    const color = isDark ? '#f0f0f0' : '#333';
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const latencyColor = isDark ? '#FF6384' : '#E84A5F';

    // 1. Agrupar e Calcular Médias por Tempo
    const groupedData = dataToDisplay.reduce((acc, row) => {
        const timeLabel = row.Timestamp.split(' ')[1].substring(0, 5);
        const score = mapScore(row['Connection_Health_Status']);
        const latency = parseFloat(row['TCP_Latency_ms']) || 0;
        
        if (!acc[timeLabel]) {
            acc[timeLabel] = { count: 0, totalScore: 0, totalLatency: 0, rows: [] };
        }
        
        acc[timeLabel].count++;
        acc[timeLabel].totalScore += score;
        acc[timeLabel].totalLatency += latency;
        acc[timeLabel].rows.push(row); // Armazena as linhas para o clique
        return acc;
    }, {});

    // 2. Extrair Dados Agregados
    const sortedTimes = Object.keys(groupedData).sort();
    const labels = sortedTimes;
    const avgScores = sortedTimes.map(time => groupedData[time].totalScore / groupedData[time].count);
    const avgLatencies = sortedTimes.map(time => groupedData[time].totalLatency / groupedData[time].count);

    let maxLatency = Math.max(...avgLatencies);
    const latencyMaxScale = Math.ceil((maxLatency + 100) / 500) * 500; 

    // 3. Modifica currentDataToDisplay para que o clique funcione
    // Para o modo agregado, currentDataToDisplay será um mapeamento Time -> [Linhas originais]
    currentDataToDisplay = groupedData;

    const ctx = document.getElementById('qualityChart').getContext('2d');

    chartInstance = new Chart(ctx, { 
        type: 'line', 
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Média Score',
                    data: avgScores,
                    yAxisID: 'y-score', 
                    borderColor: isDark ? '#A0D8FF' : '#36A2EB',
                    backgroundColor: isDark ? 'rgba(160, 216, 255, 0.2)' : 'rgba(54, 162, 235, 0.2)',
                    pointBackgroundColor: isDark ? '#A0D8FF' : '#36A2EB',
                    tension: 0.3, pointRadius: 5, borderWidth: 2, fill: false, order: 1
                },
                {
                    label: 'Média Latência (ms)',
                    data: avgLatencies,
                    yAxisID: 'y-latency', 
                    borderColor: latencyColor,
                    backgroundColor: 'rgba(0, 0, 0, 0)',
                    borderDash: [5, 5], 
                    tension: 0.3, pointRadius: 3, borderWidth: 2, fill: false, order: 2
                }
            ]
        },
        options: {
            responsive: true, maintainAspectRatio: false, color: color, 
            interaction: { mode: 'index', intersect: false, },
            onClick: handleChartAggregatedClick, // NOVO: Manipulador de clique para a média
            scales: {
                x: { title: { display: true, text: 'Horário do Monitoramento (HH:MM)', color: color }, grid: { color: gridColor }, ticks: { color: color } },
                'y-score': { 
                    type: 'linear', position: 'left', title: { display: true, text: 'Média Score', color: color }, min: 0, max: 100, grid: { color: gridColor }, 
                    ticks: { stepSize: 25, color: color, callback: (v) => v === 100 ? 'Excelente' : v === 75 ? 'Bom' : v === 25 ? 'Ruim' : v === 0 ? 'Falha/Outro' : '', }
                },
                'y-latency': { 
                    type: 'linear', position: 'right', title: { display: true, text: 'Média Latência TCP (ms)', color: latencyColor }, min: 0, max: latencyMaxScale, 
                    grid: { drawOnChartArea: false, color: gridColor }, ticks: { color: latencyColor }
                }
            },
            plugins: {
                title: { display: true, text: `Média de Qualidade e Latência (Todos os Hosts)`, color: color },
                legend: { labels: { color: color } }
            }
        }
    });
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
    
    const aggregatedGroup = currentDataToDisplay[timeLabel];

    if (aggregatedGroup && aggregatedGroup.rows.length > 0) {
        // Encontra o registro com a pior latência para exibir (Exemplo de melhor registro de troubleshooting)
        const worstRow = aggregatedGroup.rows.reduce((worst, current) => {
            const currentLatency = parseFloat(current['TCP_Latency_ms']) || 0;
            const worstLatency = parseFloat(worst['TCP_Latency_ms']) || 0;
            return currentLatency > worstLatency ? current : worst;
        }, aggregatedGroup.rows[0]);

        // Cria um HTML de resumo para todas as linhas
        let htmlSummary = `<p><strong>${aggregatedGroup.rows.length} eventos registrados em ${timeLabel}.</strong></p>`;
        
        // Adiciona um aviso sobre o registro exibido
        htmlSummary += `<p style="color: ${worstRow['Connection_Health_Status'].toLowerCase().includes('ruim') || parseFloat(worstRow['TCP_Latency_ms']) > 200 ? 'red' : 'green'}; margin-bottom: 10px;">Exibindo detalhes do evento com **MAIOR LATÊNCIA** (${worstRow.Hostname}).</p>`;
        
        // Exibe os detalhes da linha com a maior latência (usando a função existente)
        displayEventDetails(worstRow, htmlSummary);
        
    } else {
        document.getElementById('event-details').style.display = 'none';
    }
}

// Sobrescreve a função displayEventDetails para aceitar um resumo opcional
function displayEventDetails(dataRow, summaryHtml = '') {
    const detailsContainer = document.getElementById('event-details');
    const content = document.getElementById('event-content');

    const primaryFields = [
        { label: "Timestamp", key: "Timestamp" },
        // ... (o restante dos primaryFields) ...
        { label: "Hostname", key: "Hostname" },
        { label: "Usuário Logado", key: "UserLogged" },
        { label: "IP Público", key: "IP_Publico" },
        { label: "Provedor", key: "Provedor" },
        { label: "Latência TCP (ms)", key: "TCP_Latency_ms" },
        { label: "Status da Conexão", key: "Connection_Health_Status" },
    ];

    let html = summaryHtml; // Começa com o resumo (se houver)
    
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


// --------------------------------------------------------------------------
// Lógica de Filtro (PONTO DE DECISÃO)
// --------------------------------------------------------------------------

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
