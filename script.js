const CSV_FILE = 'log_monitorng_MacOS_25-10-25.csv';

// Função para mapear o status de texto para um valor numérico para o gráfico
function mapScore(status) {
    switch (status.toLowerCase()) {
        case 'excelente':
            return 100; // Pontuação máxima
        case 'bom':
            return 75;
        case 'ruim':
            return 25;
        default:
            return 0; // Desconhecido ou outro (opcional)
    }
}

// Função principal para carregar os dados e desenhar o gráfico
function loadAndDrawChart() {
    Papa.parse(CSV_FILE, {
        download: true, // Permite carregar o arquivo do GitHub Pages
        header: true,   // Trata a primeira linha como cabeçalhos
        skipEmptyLines: true,
        complete: function(results) {
            console.log("Dados CSV carregados:", results.data);

            const labels = [];
            const dataScores = [];
            const backgroundColors = [];

            results.data.forEach(row => {
                // Colunas de interesse: Timestamp e Connection_Health_Score
                const timestamp = row.Timestamp;
                const scoreStatus = row['Connection_Health_Status'];
                
                if (timestamp && scoreStatus) {
                    const score = mapScore(scoreStatus);
                    
                    // Formata a hora para o eixo X
                    const timeOnly = timestamp.split(' ')[1]; // Pega apenas a parte da hora (ex: 00:00:00)
                    labels.push(timeOnly);
                    
                    // Adiciona o score numérico
                    dataScores.push(score);

                    // Adiciona cores para visualização (opcional, mas ajuda a destacar)
                    if (score === 100) backgroundColors.push('rgba(75, 192, 192, 1)'); // Excelente (Verde)
                    else if (score === 75) backgroundColors.push('rgba(255, 206, 86, 1)'); // Bom (Amarelo)
                    else backgroundColors.push('rgba(255, 99, 132, 1)'); // Ruim (Vermelho)
                }
            });

            // Chama a função para criar o gráfico com os dados processados
            createChart(labels, dataScores, backgroundColors);
        },
        error: function(error) {
            console.error("Erro ao carregar o CSV:", error);
            alert("Erro ao carregar o arquivo CSV.");
        }
    });
}

// Função para criar e renderizar o gráfico Chart.js
function createChart(labels, dataScores, backgroundColors) {
    const ctx = document.getElementById('qualityChart').getContext('2d');

    new Chart(ctx, {
        type: 'line', // Gráfico de linha para séries temporais
        data: {
            labels: labels, // Horários (eixo X)
            datasets: [{
                label: 'Qualidade da Conexão (Score)',
                data: dataScores, // Valores numéricos (eixo Y)
                borderColor: 'rgba(54, 162, 235, 1)',
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                tension: 0.1, // Suaviza a linha
                pointBackgroundColor: backgroundColors, // Cor dos pontos conforme a pontuação
                pointRadius: 5,
                borderWidth: 2,
                fill: false // Não preenche a área abaixo da linha
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Horário do Monitoramento'
                    },
                    // Filtro de tempo: para selecionar o intervalo (a ser implementado com botões/inputs)
                    // Para o seu caso, ele mostrará todas as horas do arquivo
                },
                y: {
                    title: {
                        display: true,
                        text: 'Qualidade (Score: 0=Ruim, 100=Excelente)'
                    },
                    min: 0,
                    max: 100,
                    ticks: {
                        // Rótulos personalizados para os scores
                        callback: function(value, index, values) {
                            if (value === 100) return 'Excelente';
                            if (value === 75) return 'Bom';
                            if (value === 25) return 'Ruim';
                            return value;
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: true
                },
                title: {
                    display: true,
                    text: 'Evolução do Score de Qualidade da Conexão'
                }
            }
        }
    });
}

// Inicia o processo quando a página carrega
loadAndDrawChart();
