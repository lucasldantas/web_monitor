[cite: 1] let allData = [];
let chartInstance = null;
let currentDataToDisplay = []; 
const AUTO_UPDATE_INTERVAL = 10 * 60 * 1000;
[cite: 2] // 10 minutos em milissegundos
let autoUpdateTimer = null; 

// --------------------------------------------------------------------------
// Funções Auxiliares
// --------------------------------------------------------------------------

function getCurrentDateFormatted() {
    const today = new Date();
[cite: 3] const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yy = String(today.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
[cite: 4] }

function mapScore(status) {
    if (!status) return 0;
[cite: 5] // Adicionado 'Aceitável' para mapear um valor intermediário (75)
    if (status.toLowerCase() === 'aceitável') return 75;
[cite: 6] switch (status.toLowerCase()) {
        case 'excelente': return 100;
        case 'bom': return 75;
[cite: 7] case 'ruim': return 25;
        default: return 0; 
    }
}

function getFileName() {
    const os = document.getElementById('osSelect').value;
[cite: 8] const date = document.getElementById('dateSelect').value;
    return `log_meet_monitoring_${os}_${date}.csv`;
}

// --------------------------------------------------------------------------
// Lógica de Tema e Inicialização
// --------------------------------------------------------------------------

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
[cite: 9] localStorage.setItem('darkMode', isDark);
    updateChartTheme(isDark);
}

function applySavedTheme() {
    const savedTheme = localStorage.getItem('darkMode');
    const checkbox = document.getElementById('checkbox');
[cite: 10] if (savedTheme === 'true') {
        document.body.classList.add('dark-mode');
        checkbox.checked = true;
[cite: 11] }
    
    checkbox.addEventListener('change', toggleDarkMode);
    updateChartTheme(savedTheme === 'true');
[cite: 12] }

function startAutoUpdate() {
    if (autoUpdateTimer) {
        clearInterval(autoUpdateTimer);
[cite: 13] }
    
    autoUpdateTimer = setInterval(() => {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`Autoatualizando dados em ${timestamp}...`);
        initMonitor();
    }, AUTO_UPDATE_INTERVAL);
[cite: 14] console.log(`Autoatualização configurada para cada ${AUTO_UPDATE_INTERVAL / 60000} minutos.`);
}

window.onload = function() {
    applySavedTheme();
    document.getElementById('dateSelect').value = getCurrentDateFormatted();
[cite: 15] document.getElementById('osSelect').addEventListener('change', initMonitor);
    document.getElementById('dateSelect').addEventListener('change', initMonitor);

    initMonitor(); 
    startAutoUpdate();
}

// --------------------------------------------------------------------------
// Lógica de Detalhe de Evento (CORRIGIDA)
// --------------------------------------------------------------------------

function displayEventDetails(dataRow) {
    const detailsContainer = document.getElementById('event-details');
[cite: 16] const content = document.getElementById('event-content');

    // Campos principais
    const primaryFields = [
        { label: "Timestamp", key: "Timestamp" },
        { label: "Hostname", key: "Hostname" },
        { label: "Usuário Logado", key: "UserLogged" },
        { label: "IP Público", key: "IP_Publico" },
        { label: "Provedor", key: "Provedor" },
        { label: "Latência TCP (ms)", key: "TCP_Latency_ms" },
     
[cite: 17]    { label: "Status da Conexão", key: "Connection_Health_Status" },
    ];

    let html = '';
[cite: 18] // 1. Adiciona campos principais
    primaryFields.forEach(field => {
        const value = dataRow[field.key] || 'N/A';
        html += `<p><strong>${field.label}:</strong> ${value}</p>`;
    });
[cite: 19] // 2. Adiciona Hops Dinamicamente
    html += `<h4 style="margin-top: 15px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Detalhes do Rastreamento (Hops)</h4>`;
[cite: 20] let foundHops = false;
    for (let i = 1; i <= 30; i++) { // Verifica até o Hop 30 (ajuste se necessário)
        const ipKey = `Hop_${i}_IP`;
[cite: 21] const latencyKey = `Hop_${i}_Latency_ms`;

        const ip = dataRow[ipKey];
        const latency = dataRow[latencyKey];
[cite: 22] // Verifica se o Hop tem IP ou Latência e não é um valor vazio do CSV
        if (ip || latency) {
            const ipValue = ip && ip.trim() !== '' ?
[cite: 23] ip : 'N/A';
            const latencyValue = latency && latency.trim() !== '' ? `${latency} ms` : 'N/A';
[cite: 24] // Só exibe se pelo menos um dos valores for relevante
            if (ipValue !== 'N/A' || latencyValue !== 'N/A') {
                html += `<p style="margin-top: 5px; margin-bottom: 5px;"><strong>Hop ${i}:</strong> ${ipValue} (${latencyValue})</p>`;
[cite: 25] foundHops = true;
            }
        }
    }
    
    // Se nenhum Hop foi encontrado (além da mensagem do H4), adiciona uma nota
    if (!foundHops) {
        html += `<p style="color: #999;">Nenhum dado detalhado de rastreamento de rota encontrado neste registro.</p>`;
[cite: 26] }

    content.innerHTML = html;
    detailsContainer.style.display = 'block';
[cite: 27] }

function handleChartClick(event) {
    const points = chartInstance.getElementsAtEventForMode(event, 'index', { intersect: true }, false);
[cite: 28] if (points.length === 0) {
        document.getElementById('event-details').style.display = 'none';
        return;
[cite: 29] }

    const dataIndex = points[0].index;
    const clickedRow = currentDataToDisplay[dataIndex];
[cite: 30] if (clickedRow) {
        displayEventDetails(clickedRow);
[cite: 31] }
}

// --------------------------------------------------------------------------
// Lógica de Gráfico
// --------------------------------------------------------------------------

function updateChartTheme(isDark) {
    if (chartInstance) {
        const dataToRedraw = currentDataToDisplay;
[cite: 32] currentDataToDisplay = [];
        drawChart(dataToRedraw); 
    }
}

// Função para obter uma cor consistente para um Hostname específico (para comparação)
function getHostnameColor(hostname) {
    // Simples hashing para uma cor baseada no Hostname (para múltiplos Hostnames)
    let hash = 0;
    for (let i = 0; i < hostname.length; i++) {
        hash = hostname.charCodeAt(i) + ((hash << 5) - hash);
    }
    let color = '#';
    for (let i = 0; i < 3; i++) {
        let value = (hash >> (i * 8)) & 0xFF;
        color += ('00' + value.toString(16)).substr(-2);
    }
    return color;
}

function drawChart(dataToDisplay) {
    const statusElement = document.getElementById('statusMessage');
[cite: 33] if (chartInstance) {
        chartInstance.destroy();
[cite: 34] }
    
    currentDataToDisplay = dataToDisplay;
[cite: 35] if (dataToDisplay.length === 0) {
        statusElement.textContent = "Nenhum dado encontrado no intervalo ou Hostname selecionado.";
[cite: 36] document.getElementById('event-details').style.display = 'none';
        return;
    }

    statusElement.textContent = ""; 
    
    // Obter Hostnames únicos no conjunto de dados filtrado
    const uniqueHostnames = [...new Set(dataToDisplay.map(row => row.Hostname))].sort();

    const labels = [];
    // O gráfico agora será gerado por Hostname, permitindo comparação
    const datasets = []; 
    
    const isDark = document.body.classList.contains('dark-mode');
    const color = isDark ? '#f0f0f0' : '#333';
[cite: 38] const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const latencyColor = isDark ?
[cite: 39] '#FF6384' : '#E84A5F';

    let maxLatency = 0;
    const dataLatency = []; // Inicializa dataLatency aqui

    // Primeiro, criar a lista de labels (Timestamp) e calcular a Latência Máxima por Timestamp
    const allTimestamps = [...new Set(dataToDisplay.map(row => row.Timestamp))].sort();
    
    allTimestamps.forEach(timestamp => {
        const timeOnly = timestamp.split(' ')[1]; 
        labels.push(timeOnly.substring(0, 5));

        const latencyValues = dataToDisplay
            .filter(row => row.Timestamp === timestamp)
            .map(row => parseFloat(row['TCP_Latency_ms']) || 0);

        // Latência deve ser a MÁXIMA entre todos os Hostnames para aquele Timestamp.
        const latency = latencyValues.length > 0 ? Math.max(...latencyValues) : 0; 
        
        dataLatency.push(latency); 
        if (latency > maxLatency) maxLatency = latency;
    });


    // 1. Criar o Dataset de Qualidade (Score) para cada Hostname
    uniqueHostnames.forEach((hostname, index) => {
        const hostnameData = dataToDisplay.filter(row => row.Hostname === hostname);
        const dataScores = [];
        const scorePointColors = [];

        // Mapeia os scores para a lista de labels (timestamps)
        allTimestamps.forEach(timestamp => {
            const row = hostnameData.find(r => r.Timestamp === timestamp);
            if (row) {
                const scoreStatus = row['Connection_Health_Status'];
                const score = mapScore(scoreStatus);
                dataScores.push(score);

                if (score === 100) scorePointColors.push('#4BC0C0');
                else if (score === 75) scorePointColors.push('#FFCD56');
                else scorePointColors.push('#FF6384');
            } else {
                // Se o Hostname não tiver dado para este timestamp, preenche com null para quebrar a linha
                dataScores.push(null);
                scorePointColors.push('transparent');
            }
        });
        
        // Cor para a linha do Score, baseada no Hostname
        const hostnameColor = getHostnameColor(hostname);
        const borderColor = hostnameColor;
        const backgroundColor = hostnameColor + '30'; 

        datasets.push({
            label: `Qualidade (Score) - ${hostname}`,
            data: dataScores,
[cite: 43]         yAxisID: 'y-score', 
            borderColor: borderColor,
            backgroundColor: backgroundColor,
[cite: 44]        pointBackgroundColor: scorePointColors,
            tension: 0.3, 
            pointRadius: 5,
            borderWidth: 2,
            fill: false,
[cite: 45]              order: 1 // Garante que a linha de score esteja acima
        });
    });
    
    // 2. Criar o Dataset de Latência (Máxima entre todos os Hostnames no Timestamp)
    
[cite: 41] const latencyMaxScale = Math.ceil((maxLatency + 100) / 500) * 500; 

    // Adiciona o dataset de Latência
    datasets.push({
        label: 'Latência Máxima (ms)',
        data: dataLatency,
[cite: 46]          yAxisID: 'y-latency', 
        borderColor: latencyColor,
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        tension: 0.3,
        pointRadius: 3,
[cite: 47]                   borderWidth: 2,
        fill: false,
        order: 2 // Garante que a linha de latência esteja abaixo do score (visualização)
    });

    const ctx = document.getElementById('qualityChart').getContext('2d');
[cite: 42] chartInstance = new Chart(ctx, { 
        type: 'line', 
        data: {
            labels: labels,
            datasets: datasets
        },
   
[cite: 48]      options: {
            responsive: true,
            maintainAspectRatio: false,
            color: color, 
            interaction: {
                mode: 'index',
                intersect: false,
       
[cite: 49]      },
            onClick: handleChartClick,
            scales: {
                x: {
                    title: { display: true, text: 'Horário do Monitoramento (HH:MM)', color: color },
                    grid: 
[cite: 50] { color: gridColor },
                    ticks: { color: color }
                },
                'y-score': { 
                    type: 'linear',
                  
[cite: 51]   position: 'left',
                    title: { display: true, text: 'Qualidade (Score)', color: color },
                    min: 0,
                    max: 100,
                    grid: { color: gridColor },
  
[cite: 52]                   ticks: { 
                        stepSize: 25, 
                        color: color,
                        callback: function(value) {
   
[cite: 53]                          if (value === 100) return 'Excelente';
[cite: 54] if (value === 75) return 'Bom';
                            if (value === 25) return 'Ruim';
                            if (value === 0) return 'Falha/Outro';
                            return '';
[cite: 55] }
                    }
                },
                'y-latency': { 
                    type: 'linear',
                    position: 'right', 
   
[cite: 56]                  title: { display: true, text: 'Latência TCP (ms)', color: latencyColor },
                    min: 0,
                    max: latencyMaxScale, 
                    grid: { 
        
[cite: 57]                 drawOnChartArea: false, 
                        color: gridColor
                    },
                    ticks: {
                
[cite: 58]         color: latencyColor
                    }
                }
            },
            plugins: {
                title: { display: true, text: `Evolução da Qualidade e Latência`, color: color },
  
[cite: 59]               legend: { labels: { color: color } }
            }
        }
    });
[cite: 60] }

// NOVO: Constrói a lista de Hostnames na sidebar
function buildHostnameSidebar(hostnames) {
    const listContainer = document.getElementById('hostnameList');
    listContainer.innerHTML = ''; // Limpa a lista existente

    // Ordenar para melhor visualização
    hostnames.sort();

    hostnames.forEach(hostname => {
        const div = document.createElement('div');
        // REMOVIDO o atributo 'checked' para que não venham pré-selecionados
        div.innerHTML = `
            <label>
                <input type="checkbox" class="hostname-checkbox" value="${hostname}">
                ${hostname}
            </label>
        `;
        listContainer.appendChild(div);
    });
    
    // Adiciona o listener para a pesquisa na lista
    document.getElementById('hostnameSearch').value = '';
    document.getElementById('hostnameSearch').oninput = filterHostnameList;
}

// NOVO: Filtra a lista de Hostnames exibida na sidebar
function filterHostnameList() {
    const search = document.getElementById('hostnameSearch').value.toLowerCase();
    const checkboxes = document.querySelectorAll('#hostnameList > div');
    
    checkboxes.forEach(div => {
        const hostname = div.querySelector('input').value.toLowerCase();
        if (hostname.includes(search)) {
            div.style.display = 'block';
        } else {
            div.style.display = 'none';
        }
    });
}

// NOVO: Função para ser chamada pelos filtros (tempo e botão Aplicar)
function applyHostnameFilter() {
    filterChart();
}


function filterChart() {
    const startTimeStr = document.getElementById('startTime').value;
    const endTimeStr = document.getElementById('endTime').value;
    
    // Obter Hostnames selecionados da sidebar
    let selectedHostnames = Array.from(document.querySelectorAll('.hostname-checkbox:checked'))
                                   .map(cb => cb.value);

[cite: 61] if (!allData || allData.length === 0) {
        currentDataToDisplay = [];
        return;
[cite: 62] }
    
    // CORREÇÃO: Se nenhum Hostname for selecionado, use TODOS os Hostnames únicos para mostrar o gráfico padrão (comportamento original)
    if (selectedHostnames.length === 0) {
        const allUniqueHostnames = [...new Set(allData.map(row => row.Hostname))].filter(h => h); // Garante que não é null/undefined
        selectedHostnames = allUniqueHostnames;
        
        // Se ainda for zero (log vazio ou sem hostname), exibe a mensagem de erro
        if (selectedHostnames.length === 0) {
            document.getElementById('statusMessage').textContent = "Nenhum Hostname válido encontrado no log carregado.";
            drawChart([]);
            return;
        }
    }
    // FIM CORREÇÃO

    const filteredData = allData.filter(row => {
        const timestamp = row.Timestamp;
        if (!timestamp) return false;
        
        const timeOnly = timestamp.split(' ')[1]; 
        const filterStart = startTimeStr + ':00';
        const filterEnd = endTimeStr + ':59';
        const isWithinTime = timeOnly >= filterStart && timeOnly <= filterEnd;

     
[cite: 63]    const hostname = row.Hostname;
        // Verifica se o Hostname está na lista de selecionados
        const matchesHostname = selectedHostnames.includes(hostname); 
        
        return isWithinTime && matchesHostname;
    });
[cite: 64] document.getElementById('event-details').style.display = 'none';

    drawChart(filteredData);
}

function initMonitor() {
    const statusElement = document.getElementById('statusMessage');
    const fileName = getFileName();
[cite: 65] statusElement.textContent = `Carregando: ${fileName}...`;
    allData = []; 

    // Removido a limpeza do hostnameFilter, pois ele não existe mais como input de texto único
    document.getElementById('event-details').style.display = 'none';
[cite: 66] Papa.parse(fileName, {
        download: true, 
        header: true,   
        skipEmptyLines: true,
        complete: function(results) {
            
            allData = results.data.filter(row => row.Timestamp && row.Hostname && row['Connection_Health_Status'] && row['TCP_Latency_ms']); 

            if (allData.length === 0) {
         
[cite: 67]        statusElement.textContent = `Erro: Nenhuma linha de dados válida em ${fileName}.`;
                if (chartInstance) chartInstance.destroy();
                // Limpa a sidebar de hostnames
                document.getElementById('hostnameList').innerHTML = '';
                return;
            }
            
            statusElement.textContent = `Sucesso! Carregado ${allData.length} registros de ${fileName}.`;
            
            // NOVO: Extrai Hostnames únicos e constrói a sidebar
            const uniqueHostnames = [...new Set(allData.map(row => row.Hostname))].filter(h => h);
            buildHostnameSidebar(uniqueHostnames);

       
[cite: 68]      filterChart(); 
        },
        error: function(error) {
            console.error("Erro ao carregar o CSV:", error);
            statusElement.textContent = `ERRO 404: Não foi possível encontrar o arquivo ${fileName}. Verifique a data e o nome.`;
            if (chartInstance) chartInstance.destroy();
            document.getElementById('event-details').style.display = 'none';
            // Limpa a sidebar de hostnames em caso de erro
            document.getElementById('hostnameList').innerHTML = '';
[cite: 69] }
    });
}
