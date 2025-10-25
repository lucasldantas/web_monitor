let allData = [];
let chartInstance = null;

// Função para formatar a data atual no padrão DD-MM-YY
function getCurrentDateFormatted() {
    const today = new Date();
    // Pega o dia (DD) e adiciona um '0' se for menor que 10
    const dd = String(today.getDate()).padStart(2, '0');
    // Pega o mês (MM) e adiciona um '0' se for menor que 10
    const mm = String(today.getMonth() + 1).padStart(2, '0'); // Mês começa do 0
    // Pega o ano (YY)
    const yy = String(today.getFullYear()).slice(-2);
    
    // Retorna no formato DD-MM-YY
    return `${dd}-${mm}-${yy}`;
}

// Preenche o campo de data com a data atual ao carregar a página
window.onload = function() {
    document.getElementById('dateSelect').value = getCurrentDateFormatted();
    // Chama a inicialização para carregar os logs do dia atual (exemplo)
    initMonitor(); 
    
    // Adiciona o listener para recarregar/filtrar quando o OS muda
    document.getElementById('osSelect').addEventListener('change', initMonitor);
}

// Função para mapear o status de texto para um valor numérico para o gráfico
function mapScore(status) {
    if (!status) return 0;
    switch (status.toLowerCase()) {
        case 'excelente':
            return 100;
        case 'bom':
            return 75;
        case 'ruim':
            return 25;
        default:
            return 0; 
    }
}

// Função para construir o nome do arquivo dinamicamente
function getFileName() {
    const os = document.getElementById('osSelect').value; // 'MacOS' ou 'Windows'
    const date = document.getElementById('dateSelect').value; // 'DD-MM-YY'
    
    // O nome do arquivo AGORA segue o padrão: log_meet_monitoring_OS_DD-MM-YY.csv
    return `log_meet_monitoring_${os}_${date}.csv`;
}

// --------------------------------------------------------------------------
// Funções de Carregamento e Desenho
// --------------------------------------------------------------------------

// Função para criar e renderizar o gráfico Chart.js
function drawChart(dataToDisplay) {
    const statusElement = document.getElementById('statusMessage');

    if (chartInstance) {
        chartInstance.destroy();
    }
    
    if (dataToDisplay.length === 0) {
        statusElement.textContent = "Nenhum dado encontrado no intervalo selecionado ou Hostname.";
        return;
    }

    statusElement.textContent = ""; // Limpa a mensagem de status
    
    const labels = [];
    const dataScores = [];
    const backgroundColors = [];

    dataToDisplay.forEach(row => {
        const timestamp = row.Timestamp;
        const scoreStatus = row['Connection_Health_Status'];
        const score = mapScore(scoreStatus);
        
        const timeOnly = timestamp.split(' ')[1]; 
        labels.push(timeOnly.substring(0, 5));
        dataScores.push(score);

        // Define cores para os pontos
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
                borderColor: '#36A2EB',
                backgroundColor: 'rgba(54, 162, 235, 0.2)',
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
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Horário do Monitoramento (HH:MM)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Qualidade (Score)'
                    },
                    min: 0,
                    max: 100,
                    ticks: {
                        stepSize: 25,
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
                title: {
                    display: true,
                    // Adiciona o Hostname ao título para clareza
                    text: `Evolução do Score de Qualidade da Conexão`
                }
            }
        }
    });
}


// Função para filtrar os dados (Hora e Hostname) e redesenhar o gráfico
function filterChart() {
    const startTimeStr = document.getElementById('startTime').value;
    const endTimeStr = document.getElementById('endTime').value;
    // Pega o valor do novo campo de filtro
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
        // Se o campo de filtro estiver vazio, o filtro é ignorado (sempre true)
        const matchesHostname = hostnameFilter === '' || hostname === hostnameFilter; 
        
        // Retorna se atende a AMBAS as condições
        return isWithinTime && matchesHostname;
    });

    drawChart(filteredData);
}

// Função principal chamada pelo botão Carregar Novo Log ou no onload
function initMonitor() {
    const statusElement = document.getElementById('statusMessage');
    const fileName = getFileName();

    statusElement.textContent = `Carregando: ${fileName}...`;
    allData = []; // Limpa dados anteriores

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

            // Agora que os dados estão carregados, aplique o filtro de tempo (que agora também considera o Hostname)
            filterChart(); 
        },
        error: function(error) {
            console.error("Erro ao carregar o CSV:", error);
            statusElement.textContent = `ERRO 404: Não foi possível encontrar o arquivo ${fileName}. Verifique a data e o nome.`;
            if (chartInstance) chartInstance.destroy();
        }
    });
}
