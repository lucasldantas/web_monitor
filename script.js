<!DOCTYPE html>
<html lang="pt-br">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Monitoramento de Conexão - Visualização</title>
    
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js"></script>
    
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 0;
            background-color: #f4f4f9;
        }
        h1 {
            text-align: center;
            color: #333;
            margin-top: 20px;
        }
        #controls {
            text-align: center;
            margin: 20px 0;
            padding: 15px;
            background-color: #fff;
            border-bottom: 1px solid #ddd;
            /* Flexbox para melhor alinhamento em diferentes tamanhos de tela */
            display: flex; 
            flex-wrap: wrap;
            justify-content: center;
            gap: 10px; /* Espaço entre os elementos */
        }
        #controls label, #controls button, #controls select, #controls input {
            margin: 0; /* Remove margem desnecessária criada anteriormente */
            font-size: 1em;
            padding: 5px;
            border-radius: 4px;
            border: 1px solid #ccc;
        }
        #controls input[type="text"] {
            min-width: 150px; /* Garante que o campo hostname seja visível */
        }
        #controls button {
            background-color: #4CAF50;
            color: white;
            border: none;
            cursor: pointer;
            transition: background-color 0.3s;
        }
        #controls button:hover {
            background-color: #45a049;
        }
        #chart-container {
            width: 90%;
            margin: 30px auto;
            background-color: #fff;
            padding: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            border-radius: 8px;
            max-height: 500px;
        }
        #qualityChart {
            max-height: 460px;
        }
    </style>
</head>
<body>

    <h1>Qualidade da Conexão por Hora</h1>

    <div id="controls">
        <label for="osSelect">Sistema Operacional:</label>
        <select id="osSelect">
            <option value="MacOS">Mac</option>
            <option value="Windows">Windows</option>
        </select>

        <label for="dateSelect">Data do Log:</label>
        <input type="text" id="dateSelect" pattern="\d{2}-\d{2}-\d{2}" placeholder="DD-MM-YY">
        
        <label for="hostnameFilter">Hostname:</label>
        <input type="text" id="hostnameFilter" placeholder="Ex: ARCO-CD28F..." oninput="filterChart()"> <label for="startTime">Início (HH:MM):</label>
        <input type="time" id="startTime" value="00:00" onchange="filterChart()">
        
        <label for="endTime">Fim (HH:MM):</label>
        <input type="time" id="endTime" value="23:59" onchange="filterChart()">
        
        <button onclick="initMonitor()">Carregar Novo Log</button>
    </div>

    <div id="chart-container">
        <canvas id="qualityChart"></canvas>
        <p id="statusMessage" style="text-align:center; color: #cc0000; font-weight: bold;"></p>
    </div>

    <script src="script.js"></script>

</body>
</html>
