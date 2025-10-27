let allData = [];
let chartInstance = null;
let currentDataToDisplay = []; 
const AUTO_UPDATE_INTERVAL = 10 * 60 * 1000;
// 10 minutos em milissegundos
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
            const ipValue = ip && ip.trim() !== '' ?
ip : 'N/A';
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
    
    // Obter Hostnames únicos no conjunto de dados filtrado
    const uniqueHostnames = [...new Set(dataToDisplay.map(row => row.Hostname))].sort();

    const labels = [];
    // O gráfico agora será gerado por Hostname, permitindo comparação
    const datasets = []; 
    
    const isDark = document.body.classList.contains('dark-mode');
    const color = isDark ? '#f0f0f0' : '#333';
const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const latencyColor = isDark ?
'#FF6384' : '#E84A5F';

    let maxLatency = 0;

    // 1. Criar o Dataset de Qualidade (Score) para cada Hostname
    uniqueHostnames.forEach((hostname, index) => {
        const hostnameData = dataToDisplay.filter(row => row.Hostname === hostname);
        const dataScores = [];
        const scorePointColors = [];

        hostnameData.forEach(row => {
            const scoreStatus = row['Connection_Health_Status'];
            const score = mapScore(scoreStatus);
            dataScores.push(score);

            if (score === 100) scorePointColors.push('#4BC0C0');
            else if (score === 75) scorePointColors.push('#FFCD56');
            else scorePointColors.push('#FF6384'); 
        });

        // Cor para a linha do Score, baseada no Hostname
        const hostnameColor = getHostnameColor(hostname);
        const borderColor = index === 0 ? (isDark ? '#A0D8FF' : '#36A2EB') : hostnameColor;
        const backgroundColor = index === 0 ? (isDark ? 'rgba(160, 216, 255, 0.2)' : 'rgba(54, 162, 235, 0.2)') : hostnameColor + '30'; // Cor com transparência

        datasets.push({
            label: `Qualidade (Score) - ${hostname}`,
            data: dataScores,
        yAxisID: 'y-score', 
            borderColor: borderColor,
            backgroundColor: backgroundColor,
       pointBackgroundColor: scorePointColors,
            tension: 0.3, 
            pointRadius: 5,
            borderWidth: 2,
            fill: false,
             order: 1 // Garante que a linha de score esteja acima
        });
    });
    
    // 2. Criar o Dataset de Latência (Agregado - Usaremos o primeiro Hostname ou todos se for a comparação)
    // Para simplificar a comparação de latência, se houver múltiplos hostnames, vamos traçar a latência MÁXIMA entre eles para cada ponto no tempo (Timestamp).
    
    // Primeiro, criar a lista de labels (Timestamp)
    const allTimestamps = [...new Set(dataToDisplay.map(row => row.Timestamp))].sort();
    
    allTimestamps.forEach(timestamp => {
        const timeOnly = timestamp.split(' ')[1]; 
        labels.push(timeOnly.substring(0, 5));

        const latencyValues = dataToDisplay
            .filter(row => row.Timestamp === timestamp)
            .map(row => parseFloat(row['TCP_Latency_ms']) || 0);

        // Se houver mais de um hostname, Latência deve ser a média ou máxima no timestamp
        const latency = latencyValues.length > 0 ? Math.max(...latencyValues) : 0; 
        
        dataLatency.push(latency); 
        if (latency > maxLatency) maxLatency = latency;
    });

    // Se houver múltiplos hostnames, o 'dataToDisplay' já está em ordem de Hostname, mas para garantir a correspondência de Latência com o Score
    // e simplificar, vamos traçar apenas a latência MÁXIMA ou a latência do primeiro Hostname se for só um.
    const dataLatency = []; 
    // Como labels são baseados em Timestamp, a Latência deve ser a MÁXIMA de todos os Hostnames para aquele Timestamp.
    allTimestamps.forEach(timestamp => {
        const latencyValues = dataToDisplay
            .filter(row => row.Timestamp === timestamp)
            .map(row => parseFloat(row['TCP_Latency_ms']) || 0);
        
        const latency = latencyValues.length > 0 ? Math.max(...latencyValues) : 0; 
        dataLatency.push(latency);
        if (latency > maxLatency) maxLatency = latency;
    });
    
const latencyMaxScale = Math.ceil((maxLatency + 100) / 500) * 500; 

    // Adiciona o dataset de Latência
    datasets.push({
        label: 'Latência Máxima (ms)',
        data: dataLatency,
         yAxisID: 'y-latency', 
        borderColor: latencyColor,
        backgroundColor: 'rgba(255, 99, 132, 0.1)',
        tension: 0.3,
        pointRadius: 3,
                  borderWidth: 2,
        fill: false,
        order: 2 // Garante que a linha de latência esteja abaixo do score (visualização)
    });

    const ctx = document.getElementById('qualityChart').getContext('2d');
chartInstance = new Chart(ctx, { 
        type: 'line', 
        data: {
            labels: labels,
            datasets: datasets
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
                    grid: 
{ color: gridColor },
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

// NOVO: Constrói a lista de Hostnames na sidebar
function buildHostnameSidebar(hostnames) {
    const listContainer = document.getElementById('hostnameList');
    listContainer.innerHTML = ''; // Limpa a lista existente

    // Ordenar para melhor visualização
    hostnames.sort();

    hostnames.forEach(hostname => {
        const div = document.createElement('div');
        div.innerHTML = `
            <label>
                <input type="checkbox" class="hostname-checkbox" value="${hostname}" checked>
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
    
    // NOVO: Obter Hostnames selecionados da sidebar
    const selectedHostnames = Array.from(document.querySelectorAll('.hostname-checkbox:checked'))
                                   .map(cb => cb.value);

if (!allData || allData.length === 0) {
        currentDataToDisplay = [];
        return;
}
    
    // Se nenhum hostname estiver selecionado, não mostra nada
    if (selectedHostnames.length === 0) {
        document.getElementById('statusMessage').textContent = "Selecione pelo menos um Hostname para exibir o gráfico.";
        drawChart([]);
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
        // NOVO: Verifica se o Hostname está na lista de selecionados
        const matchesHostname = selectedHostnames.includes(hostname); 
        
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

    // Removido a limpeza do hostnameFilter, pois ele não existe mais como input de texto único
    document.getElementById('event-details').style.display = 'none';
Papa.parse(fileName, {
        download: true, 
        header: true,   
        skipEmptyLines: true,
        complete: function(results) {
            
            allData = results.data.filter(row => row.Timestamp && row.Hostname && row['Connection_Health_Status'] && row['TCP_Latency_ms']); 

            if (allData.length === 0) {
         
       statusElement.textContent = `Erro: Nenhuma linha de dados válida em ${fileName}.`;
                if (chartInstance) chartInstance.destroy();
                // Limpa a sidebar de hostnames
                document.getElementById('hostnameList').innerHTML = '';
                return;
            }
            
            statusElement.textContent = `Sucesso! Carregado ${allData.length} registros de ${fileName}.`;
            
            // NOVO: Extrai Hostnames únicos e constrói a sidebar
            const uniqueHostnames = [...new Set(allData.map(row => row.Hostname))];
            buildHostnameSidebar(uniqueHostnames);

       
     filterChart(); 
        },
        error: function(error) {
            console.error("Erro ao carregar o CSV:", error);
            statusElement.textContent = `ERRO 404: Não foi possível encontrar o arquivo ${fileName}. Verifique a data e o nome.`;
            if (chartInstance) chartInstance.destroy();
            document.getElementById('event-details').style.display = 'none';
            // Limpa a sidebar de hostnames em caso de erro
            document.getElementById('hostnameList').innerHTML = '';
}
    });
}
