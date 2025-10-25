const CSV_FILE = 'log_monitorng_MacOS_25-10-25.csv';
let allData = []; // Variável global para armazenar todos os dados brutos do CSV
let chartInstance = null; // Variável para armazenar a instância do gráfico

// Função para mapear o status de texto para um valor numérico para o gráfico
function mapScore(status) {
    if (!status) return 0;
    switch (status.toLowerCase()) {
        case 'excelente':
            return 100; // Pontuação máxima
        case 'bom':
            return 75;
        case 'ruim':
            return 25;
        default:
            return 0; 
    }
}

// Função para criar e renderizar o gráfico Chart.js
function drawChart(dataToDisplay) {
    // Se o gráfico já existe, destrua-o para redesenhar
    if (chartInstance) {
        chartInstance.destroy();
    }

    const labels = [];
    const dataScores = [];
    const backgroundColors = [];

    dataToDisplay.forEach(row => {
        const timestamp = row.Timestamp;
        const scoreStatus = row['Connection_Health_Status'];
        const score = mapScore(scoreStatus);
        
        // Pega apenas a hora (ex: 00:00:00)
        const timeOnly = timestamp.split(' ')[1]; 
        labels.push(timeOnly.substring(0, 5)); // Mostra apenas HH:MM
        dataScores.push(score);

        // Define cores para os pontos
        if (score === 100) backgroundColors.push('#4BC0C0'); // Excelente (Teal)
        else if (score === 75) backgroundColors.push('#FFCD56'); // Bom (Amarelo)
        else backgroundColors.push('#FF6384'); // Ruim (Vermelho)
    });

    const ctx = document.getElementById('qualityChart').getContext('2d');

    chartInstance = new Chart(ctx, { // Armazena a nova instância
        type: 'line', // Gráfico de linha para séries temporais
        data: {
            labels: labels, // Horários (eixo X)
            datasets: [{
                label: 'Qualidade da Conexão (Score)',
                data: dataScores, // Valores numéricos (eixo Y)
                borderColor: '#36A2EB', // Azul da linha
                backgroundColor: 'rgba(54, 162, 235, 0.2)', // Preenchimento suave
                tension: 0.3, // Suaviza a linha
                pointBackgroundColor: backgroundColors, // Cor dos pontos conforme a pontuação
                pointRadius: 5,
                borderWidth: 2,
                fill: false // Define como false para não preencher a área
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
                        // Rótulos personalizados
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
                    text: 'Evolução do Score de Qualidade da Conexão no Intervalo'
                }
            }
        }
    });
}

// Função para filtrar os dados e redesenhar o gráfico
function filterChart() {
    const startTimeStr = document.getElementById('startTime').value; // Ex: 00:00
    const endTimeStr = document.getElementById('endTime').value;     // Ex: 23:59

    if (!allData || allData.length === 0) {
        alert("Dados não carregados. Aguarde ou verifique o arquivo CSV.");
        return;
    }

    // Filtra os dados com base na hora (assumindo que o CSV tem a data no formato 'YYYY-MM-DD HH:MM:SS')
    const filteredData = allData.filter(row => {
        const timestamp = row.Timestamp;
        if (!timestamp) return false;
        
        // Pega a parte da hora, assumindo que está no formato HH:MM:SS
        const timeOnly = timestamp.split(' ')[1]; 

        // Compara as strings de tempo, garantindo que a comparação inclua os segundos
        // Adicionamos ':00' ao filtro de hora para ter uma string comparável (HH:MM:SS)
        const filterStart = startTimeStr + ':00';
        const filterEnd = endTimeStr + ':59'; // Pega até o último segundo do minuto final

        return timeOnly >= filterStart && timeOnly <= filterEnd;
    });

    if (filteredData.length === 0) {
        alert("Nenhum dado encontrado no intervalo selecionado. Tente expandir o filtro.");
    }
    
    // Redesenha o gráfico com os dados filtrados
    drawChart(filteredData);
}


// Função principal para carregar o CSV
function loadAndDrawChart() {
    Papa.parse(CSV_FILE, {
        download: true, 
        header: true,   
        skipEmptyLines: true,
        complete: function(results) {
            // Filtra e armazena apenas as linhas que são válidas
            allData = results.data.filter(row => row.Timestamp && row['Connection_Health_Status']); 

            if (allData.length === 0) {
                console.error("Nenhuma linha de dados válida encontrada no CSV.");
                document.getElementById('chart-container').innerHTML = "<p style='text-align:center;'>Erro: Nenhuma linha de dados válida encontrada.</p>";
                return;
            }
            
            // Desenha o gráfico inicial com todos os dados
            drawChart(allData); 
        },
        error: function(error) {
            console.error("Erro ao carregar o CSV:", error);
            document.getElementById('chart-container').innerHTML = "<p style='text-align:center;'>Erro ao carregar o arquivo CSV. Verifique o console para detalhes.</p>";
        }
    });
}

// Inicia o processo quando a página carrega
loadAndDrawChart();
