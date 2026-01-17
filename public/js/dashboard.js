// public/js/dashboard.js (VERSIÓN MAESTRA FINAL - 100% VALIDADA)

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
    loadAdminDashboard(userEmail); 
  } else {
    document.getElementById('user-view').style.display = 'block';
    loadUserDashboard(userEmail);
  }
});

// ############### DIMENSIÓN ESTRATÉGICA Y EQUIPO (ADMIN) ###############
const loadAdminDashboard = async (userEmail) => {
  const teamListBody = document.getElementById('admin-team-list');
  const hitosContainer = document.getElementById('admin-hitos-container');
  const weekId = getCurrentWeekId();

  try {
    // PETICIÓN MÚLTIPLE: Sincroniza todos los niveles de la app
    const [tasksResponse, resultsResponse, usersResponse, hitosResponse] = await Promise.all([
        fetch(`/.netlify/functions/getTasks?email=${userEmail}&scope=all`),
        fetch(`/.netlify/functions/getResultados?email=${userEmail}&scope=all&weekId=${weekId}`),
        fetch(`/.netlify/functions/getUsers`),
        fetch(`/.netlify/functions/getCronograma`)
    ]);

    if (!tasksResponse.ok || !resultsResponse.ok || !usersResponse.ok || !hitosResponse.ok) {
        throw new Error('Error en la comunicación con el servidor.');
    }
    
    const allTasks = await tasksResponse.json();
    const allResults = await resultsResponse.json();
    const allUsers = await usersResponse.json();
    const allHitos = await hitosResponse.json();

    // 1. RENDERIZAR CRONOGRAMA (NIVEL 1)
    hitosContainer.innerHTML = '';
    if (allHitos.length === 0) {
        hitosContainer.innerHTML = '<p class="text-slate-500 text-sm">No hay hitos estratégicos definidos.</p>';
    } else {
        allHitos.forEach(hito => {
            const hitoTasks = allTasks.filter(t => t.hitoId === hito.id);
            const total = hitoTasks.length;
            const completed = hitoTasks.filter(t => t.status === 'Cumplida').length;
            const progress = total > 0 ? Math.round((completed / total) * 100) : 0;

            const card = document.createElement('div');
            card.className = 'border rounded-lg p-4 bg-slate-50 shadow-sm';
            card.innerHTML = `
                <div class="flex justify-between items-start mb-2">
                    <h4 class="font-bold text-slate-800 text-sm">${hito.nombre}</h4>
                    <span class="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-100 text-blue-700">${hito.id}</span>
                </div>
                <div class="w-full bg-slate-200 rounded-full h-1.5 mb-2">
                    <div class="bg-blue-600 h-1.5 rounded-full" style="width: ${progress}%"></div>
                </div>
                <div class="flex justify-between items-center text-[10px]">
                    <span class="font-bold text-slate-600">${progress}% completado</span>
                    <span class="text-slate-400">Responsable: ${hito.responsable || 'N/A'}</span>
                </div>
            `;
            hitosContainer.appendChild(card);
        });
    }

    // 2. RENDERIZAR TABLA DE EQUIPO (NIVEL 2 Y 3)
    const dataByUser = {};
    allUsers.forEach(user => { if(user.email) dataByUser[user.email] = { tasks: [], results: [] }; });
    allTasks.forEach(task => { if (dataByUser[task.assignedTo]) dataByUser[task.assignedTo].tasks.push(task); });
    allResults.forEach(result => { if (dataByUser[result.assignedTo]) dataByUser[result.assignedTo].results.push(result); });

    teamListBody.innerHTML = '';

    for (const email in dataByUser) {
        const { tasks, results } = dataByUser[email];
        const result = results.length > 0 ? results[0] : null;
        const resultadoTexto = results.map(r => r.expectedResult).join('<br>') || '<em>Sin definir</em>';

        const completed = tasks.filter(t => t.status === 'Cumplida').length;
        const today = new Date(); today.setHours(0,0,0,0);
        const overdue = tasks.filter(t => t.status === 'Pendiente' && parseDate(t.dueDate) < today).length;
        const pending = tasks.length - completed;
        const percentage = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    
        let colorClass = 'text-red-600';
        if (percentage >= 80) colorClass = 'text-green-600';
        else if (percentage >= 60) colorClass = 'text-yellow-600';

        const evaluationCellHtml = createEvaluationCell(result, email, weekId);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-slate-900">${email}</td>
            <td class="px-6 py-4 text-sm">${evaluationCellHtml}</td>
            <td class="px-6 py-4 text-sm text-slate-600 leading-relaxed">${resultadoTexto}</td>
            <td class="px-6 py-4 text-center text-sm font-bold ${colorClass}">${percentage}%</td>
            <td class="px-6 py-4 text-center text-sm text-green-600 font-bold">${completed}</td>
            <td class="px-6 py-4 text-center text-sm text-slate-500">${pending}</td>
            <td class="px-6 py-4 text-center text-sm font-bold text-red-500">${overdue}</td>
        `;
        teamListBody.appendChild(row);
    }

  } catch (error) {
    console.error("Fallo crítico en Dashboard Admin:", error);
    teamListBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500 font-bold">Error de conexión con la base de datos.</td></tr>`;
  }
};

const createEvaluationCell = (result, email, weekId) => {
    const rowNumber = result ? result.rowNumber : null;
    // Restauramos el tooltip original que muestra el resultado al pasar el mouse
    const tooltipText = result ? `Resultado: "${result.expectedResult}"` : "Usuario sin compromiso definido.";

    const colors = { 'Verde': 'bg-green-500', 'Amarillo': 'bg-yellow-500', 'Rojo': 'bg-red-500' };
    const currentColor = colors[result?.evaluation] || 'bg-slate-300';

    return `
        <div class="group relative inline-block" title="${tooltipText}">
            <span class="h-4 w-4 rounded-full inline-block ${currentColor} cursor-help shadow-sm"></span>
            <div class="absolute z-10 hidden group-hover:flex bg-white border rounded shadow-xl p-2 space-x-2 -translate-y-full mb-2 border-slate-200">
                <button data-row="${rowNumber}" data-email="${email}" data-weekid="${weekId}" data-eval="Verde" class="eval-btn h-5 w-5 rounded-full bg-green-500 hover:scale-110 transition-transform"></button>
                <button data-row="${rowNumber}" data-email="${email}" data-weekid="${weekId}" data-eval="Amarillo" class="eval-btn h-5 w-5 rounded-full bg-yellow-500 hover:scale-110 transition-transform"></button>
                <button data-row="${rowNumber}" data-email="${email}" data-weekid="${weekId}" data-eval="Rojo" class="eval-btn h-5 w-5 rounded-full bg-red-500 hover:scale-110 transition-transform"></button>
            </div>
        </div>`;
};

// Listener para capturar clics en evaluaciones
document.getElementById('admin-team-list')?.addEventListener('click', async (event) => {
    if (event.target.classList.contains('eval-btn')) {
        const button = event.target;
        if (!button.dataset.row || button.dataset.row === 'null') {
            alert("Acción inválida: No se puede evaluar un compromiso que no existe.");
            return;
        }
        try {
            await fetch('/.netlify/functions/updateResultados', {
                method: 'POST',
                body: JSON.stringify({ action: 'saveEvaluation', rowNumber: button.dataset.row, evaluation: button.dataset.eval })
            });
            loadAdminDashboard(localStorage.getItem('userEmail'));
        } catch (error) {
            console.error('Error al guardar evaluación:', error);
        }
    }
});

// ############### DIMENSIÓN OPERATIVA (USUARIO) ###############
const loadUserDashboard = async (userEmail) => {
    const weekId = getCurrentWeekId();
    const resultsContainer = document.getElementById('user-results-container');
    
    try {
        const [tasksResponse, resultsResponse] = await Promise.all([
            fetch(`/.netlify/functions/getTasks?email=${userEmail}&scope=user`),
            fetch(`/.netlify/functions/getResultados?email=${userEmail}&weekId=${weekId}&scope=user`)
        ]);

        if (!tasksResponse.ok || !resultsResponse.ok) throw new Error('Error al cargar datos individuales.');

        const tasks = await tasksResponse.json();
        const results = await resultsResponse.json();
        const safeResults = (results || []).filter(r => r); 

        if (safeResults.length === 0) {
            resultsContainer.innerHTML = '<p class="text-slate-400 italic text-sm">Aún no has definido tu compromiso para esta semana.</p>';
        } else {
            const result = safeResults[0];
            const colors = { 'Verde': 'bg-green-500', 'Amarillo': 'bg-yellow-500', 'Rojo': 'bg-red-500' };
            const currentColor = colors[result.evaluation] || 'bg-slate-300';
            resultsContainer.innerHTML = `
                <p class="text-slate-700 text-sm leading-relaxed">"${result.expectedResult}"</p>
                <div class="mt-3 flex items-center text-[10px] font-bold text-slate-500 uppercase">
                    <span class="h-2 w-2 rounded-full ${currentColor} mr-2"></span>
                    Estatus: ${result.evaluation || 'Pendiente de revisión'}
                </div>`;
        }

        const completed = tasks.filter(t => t.status === 'Cumplida').length;
        const total = tasks.length;
        const pending = total - completed;
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        document.getElementById('completedTasksCount').textContent = completed;
        document.getElementById('pendingTasksCount').textContent = pending;
        document.getElementById('performancePercentage').textContent = `${percentage}%`;

        let chartColor = '#ef4444'; // Rojo por defecto
        if (percentage >= 80) chartColor = '#22c55e';
        else if (percentage >= 60) chartColor = '#f59e0b';

        const chartCanvas = document.getElementById('performanceChart');
        if(window.myPerformanceChart) window.myPerformanceChart.destroy();
        renderDoughnutChart(chartCanvas, completed, pending, chartColor);

    } catch (error) {
        console.error("Error en Dashboard de Usuario:", error);
        resultsContainer.innerHTML = '<p class="text-red-500 text-xs font-bold">Error al sincronizar datos operativos.</p>';
    }
};

const renderDoughnutChart = (canvasElement, completed, pending, color) => {
    if (!canvasElement) return;
    window.myPerformanceChart = new Chart(canvasElement, { 
        type: 'doughnut', 
        data: {
            datasets: [{
                data: [completed, pending],
                backgroundColor: [color, '#f1f5f9'],
                borderWidth: 0,
                cutout: '80%',
            }],
        }, 
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { enabled: false } } } 
    });
};