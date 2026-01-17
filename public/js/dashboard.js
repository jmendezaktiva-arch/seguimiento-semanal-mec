// public/js/dashboard.js (Versión Corregida y Fusionada)

const getCurrentWeekId = () => {
    const date = new Date();
    const year = date.getFullYear();
    const firstDayOfYear = new Date(year, 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${year}-W${String(weekNumber).padStart(2, '0')}`;
};

const parseDate = (dateString) => {
    if (!dateString) return null;
    let parts = dateString.split(/[-/]/);
    if (parts.length < 3) return null;
    if (parts[0].length === 4) return new Date(parts[0], parts[1] - 1, parts[2]);
    if (parts[2].length === 4) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(dateString);
};

document.addEventListener('DOMContentLoaded', () => {
  const userEmail = localStorage.getItem('userEmail');
  const userRole = localStorage.getItem('userRole');

  if (!userEmail) {
    window.location.href = '/index.html';
    return;
  }

  if (userRole === 'Admin') {
    document.getElementById('admin-view').style.display = 'block';
    loadAdminDashboard();
  } else {
    document.getElementById('user-view').style.display = 'block';
    loadUserDashboard();
  }
});

// ############### FUNCIÓN DE ADMIN CORREGIDA Y REFORZADA ###############
const loadAdminDashboard = async () => {
  const userEmail = localStorage.getItem('userEmail');
  const teamListBody = document.getElementById('admin-team-list');
  const weekId = getCurrentWeekId();

  try {
    const [tasksResponse, resultsResponse, usersResponse] = await Promise.all([
        fetch(`/.netlify/functions/getTasks?email=${userEmail}&scope=all`),
        fetch(`/.netlify/functions/getResultados?email=${userEmail}&scope=all&weekId=${weekId}`),
        fetch(`/.netlify/functions/getUsers`)
    ]);

    if (!tasksResponse.ok || !resultsResponse.ok || !usersResponse.ok) throw new Error('Error al cargar datos del equipo.');
    
    const allTasks = await tasksResponse.json();
    const allResults = await resultsResponse.json();
    const allUsers = await usersResponse.json();

    const dataByUser = {};

    allUsers.forEach(user => {
        if(user.email) dataByUser[user.email] = { tasks: [], results: [] };
    });

    allTasks.forEach(task => {
        if (dataByUser[task.assignedTo]) dataByUser[task.assignedTo].tasks.push(task);
    });

    allResults.forEach(result => {
        if (dataByUser[result.assignedTo]) dataByUser[result.assignedTo].results.push(result);
    });

    teamListBody.innerHTML = '';

    for (const email in dataByUser) {
        const { tasks, results } = dataByUser[email];
        
        const result = results.length > 0 ? results[0] : null; // Tomar el primer resultado para la evaluación
        const resultadoTexto = results.map(r => r.expectedResult).join('<br>') || '<em>Sin definir</em>';

        const completed = tasks.filter(t => t.status === 'Cumplida').length;
        const total = tasks.length;
        const today = new Date(); today.setHours(0,0,0,0);
        const overdue = tasks.filter(t => t.status === 'Pendiente' && parseDate(t.dueDate) < today).length;
        const pending = total - completed;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
        let color = 'text-red-600';
        if (percentage >= 80) color = 'text-green-600';
        else if (percentage >= 60) color = 'text-yellow-600';

        const evaluationCellHtml = createEvaluationCell(result, email, weekId);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="whitespace-nowrap px-6 py-4 text-sm font-medium text-slate-900">${email}</td>
            <td class="px-6 py-4 text-sm text-slate-500">${evaluationCellHtml}</td>
            <td class="whitespace-normal px-6 py-4 text-sm text-slate-600">${resultadoTexto}</td>
            <td class="whitespace-nowrap px-6 py-4 text-sm font-bold ${color}">${percentage}%</td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-green-600">${completed}</td>
            <td class="whitespace-nowrap px-6 py-4 text-sm text-slate-500">${pending}</td>
            <td class="whitespace-nowrap px-6 py-4 text-sm font-bold text-red-500">${overdue}</td>
        `;
        teamListBody.appendChild(row);
    }

  } catch (error) {
    console.error("Error al cargar el dashboard de admin:", error);
    teamListBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500">No se pudieron cargar los datos.</td></tr>`;
  }
};

const createEvaluationCell = (result, email, weekId) => {
    const rowNumber = result ? result.rowNumber : null;
    const tooltipText = result ? `"${result.expectedResult}"` : "El usuario no ha definido un resultado para esta semana.";

    const colors = { 'Verde': 'bg-green-500', 'Amarillo': 'bg-yellow-500', 'Rojo': 'bg-red-500' };
    const currentColor = colors[result?.evaluation] || 'bg-slate-300';

    return `<div class="group relative" title="${tooltipText}"><div class="flex items-center"><span class="h-4 w-4 rounded-full ${currentColor}"></span></div><div class="absolute z-10 hidden group-hover:flex bg-white border rounded shadow-lg p-2 space-x-2 -translate-x-1/2 left-1/2"><button data-row="${rowNumber}" data-email="${email}" data-weekid="${weekId}" data-eval="Verde" class="eval-btn h-6 w-6 rounded-full bg-green-500 hover:ring-2 ring-offset-1 ring-green-500"></button><button data-row="${rowNumber}" data-email="${email}" data-weekid="${weekId}" data-eval="Amarillo" class="eval-btn h-6 w-6 rounded-full bg-yellow-500 hover:ring-2 ring-offset-1 ring-yellow-500"></button><button data-row="${rowNumber}" data-email="${email}" data-weekid="${weekId}" data-eval="Rojo" class="eval-btn h-6 w-6 rounded-full bg-red-500 hover:ring-2 ring-offset-1 ring-red-500"></button></div></div>`;
};

document.getElementById('admin-team-list')?.addEventListener('click', async (event) => {
    if (event.target.classList.contains('eval-btn')) {
        const button = event.target;
        if (button.dataset.row === 'null' || !button.dataset.row) {
            alert("No se puede evaluar un resultado que no ha sido definido por el usuario.");
            return;
        }
        try {
            await fetch('/.netlify/functions/updateResultados', {
                method: 'POST',
                body: JSON.stringify({ action: 'saveEvaluation', rowNumber: button.dataset.row, evaluation: button.dataset.eval })
            });
            loadAdminDashboard();
        } catch (error) {
            console.error('Error al guardar evaluación:', error);
            alert('No se pudo guardar la evaluación.');
        }
    }
});

// ############### FUNCIÓN DE USUARIO RESTAURADA Y FUSIONADA ###############
// En public/js/dashboard.js
const loadUserDashboard = async () => {
    const userEmail = localStorage.getItem('userEmail');
    const weekId = getCurrentWeekId();
    const resultsContainer = document.getElementById('user-results-container');
    
    try {
        const [tasksResponse, resultsResponse] = await Promise.all([
            fetch(`/.netlify/functions/getTasks?email=${userEmail}&scope=user`),
            fetch(`/.netlify/functions/getResultados?email=${userEmail}&weekId=${weekId}&scope=user`)
        ]);

        if (!tasksResponse.ok || !resultsResponse.ok) throw new Error('No se pudieron cargar los datos del dashboard.');

        const tasks = await tasksResponse.json();
        const results = await resultsResponse.json();

        // ---- INICIO DE LA SOLUCIÓN DE ROBUSTEZ ----
        // Filtramos el array para quitar cualquier elemento nulo o indefinido.
        const safeResults = (results || []).filter(result => result); 
        // ---- FIN DE LA SOLUCIÓN ----

        if (safeResults.length === 0) {
            resultsContainer.innerHTML = '<p class="text-slate-500">Aún no has definido resultados para esta semana.</p>';
        } else {
            // Ahora es seguro que safeResults[0] es un objeto válido.
            const result = safeResults[0];
            const colors = { 'Verde': 'bg-green-500', 'Amarillo': 'bg-yellow-500', 'Rojo': 'bg-red-500' };
            const currentColor = colors[result.evaluation] || 'bg-slate-300';
            resultsContainer.innerHTML = `<div class="flex-grow"><p class="text-slate-700 text-base">"${result.expectedResult}"</p></div><div class="flex-shrink-0"><p class="text-sm font-medium text-slate-500 mb-1 text-center">Evaluación</p><span class="h-6 w-6 rounded-full inline-block ${currentColor}" title="Evaluación: ${result.evaluation || 'Pendiente'}"></span></div>`;
        }

        // El resto de la lógica para las tareas ahora se ejecutará sin problemas.
        const completed = tasks.filter(t => t.status === 'Cumplida').length;
        const total = tasks.length;
        const pending = total - completed;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        document.getElementById('completedTasksCount').textContent = completed;
        document.getElementById('pendingTasksCount').textContent = pending;
        document.getElementById('performancePercentage').textContent = `${percentage}%`;

        let color = '#ef4444';
        if (percentage >= 80) color = '#22c55e';
        else if (percentage >= 60) color = '#f59e0b';

        const chartCanvas = document.getElementById('performanceChart');
        if(window.myPerformanceChart) window.myPerformanceChart.destroy();
        renderDoughnutChart(chartCanvas, completed, pending, color);

    } catch (error) {
        console.error("Error al cargar dashboard de usuario:", error);
        resultsContainer.innerHTML = '<p class="text-red-500">Ocurrió un error al cargar tus datos.</p>';
    }
};

const renderDoughnutChart = (canvasElement, completed, pending, color) => {
    if (!canvasElement) return;
    const data = {
        datasets: [{
            data: [completed, pending],
            backgroundColor: [color, '#e2e8f0'],
            borderWidth: 0,
            cutout: '80%',
        }],
    };
    window.myPerformanceChart = new Chart(canvasElement, { type: 'doughnut', data: data, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } } });
};