// public/js/dashboard.js (VERSIÓN MAESTRA FINAL - 100% VALIDADA Y CORREGIDA)

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
    loadUsersForHitos(); // Cargar responsables para el formulario
  } else {
    document.getElementById('user-view').style.display = 'block';
    loadUserDashboard(userEmail);
  }
});

// ############### DIMENSIÓN ESTRATÉGICA Y EQUIPO (ADMIN) ###############
const loadAdminDashboard = async (userEmail) => {
  const teamListBody = document.getElementById('admin-team-list');
  const ganttContainer = document.getElementById('gantt-chart');
  const weekId = getCurrentWeekId();

  try {
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

    // 1. RENDERIZAR CRONOGRAMA TIPO GANTT (NIVEL 1)
    ganttContainer.innerHTML = '';

    if (allHitos.length === 0) {
        ganttContainer.innerHTML = '<p class="p-4 text-slate-500 text-sm italic">No hay hitos estratégicos definidos.</p>';
    } else {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        
        const header = document.createElement('div');
        header.className = 'grid grid-cols-13 border-b bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-tighter';
        header.innerHTML = `<div class="p-2 border-r w-40 bg-slate-100">Hito / Mes</div>` + 
                           meses.map(m => `<div class="p-2 text-center border-r">${m}</div>`).join('');
        ganttContainer.appendChild(header);

        allHitos.forEach(hito => {
            const hitoTasks = allTasks.filter(t => t.hitoId === hito.id);
            const progress = hitoTasks.length > 0 ? Math.round((hitoTasks.filter(t => t.status === 'Cumplida').length / hitoTasks.length) * 100) : 0;

            const startMonth = parseDate(hito.fechaInicio)?.getMonth() + 1 || 1;
            const endMonth = parseDate(hito.fechaFin)?.getMonth() + 1 || startMonth;
            
            const row = document.createElement('div');
            row.className = 'grid grid-cols-13 border-b hover:bg-slate-50 relative h-12 items-center';
            
            let rowHtml = `<div class="p-2 border-r w-40 text-[11px] font-bold text-slate-700 truncate" title="${hito.nombre}">${hito.nombre}</div>`;
            for(let i=1; i<=12; i++) { rowHtml += `<div class="border-r h-full"></div>`; }
            
            const colStart = startMonth + 1;
            const colSpan = (endMonth - startMonth) + 1;
            
            rowHtml += `
                <div class="absolute h-6 rounded-full shadow-sm flex items-center px-2 text-[9px] font-bold text-white transition-all overflow-hidden" 
                     style="grid-column: ${colStart} / span ${colSpan}; 
                            background: linear-gradient(90deg, #2563eb ${progress}%, #94a3b8 ${progress}%);
                            margin-left: 4px; margin-right: 4px;">
                    ${progress}%
                </div>`;
                
            row.innerHTML = rowHtml;
            ganttContainer.appendChild(row);
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
        const resultadoTexto = results.map(r => r.expectedResult).join('<br>') || '<em>Sin compromiso</em>';

        const completed = tasks.filter(t => t.status === 'Cumplida').length;
        const today = new Date(); today.setHours(0,0,0,0);
        const overdue = tasks.filter(t => t.status === 'Pendiente' && parseDate(t.dueDate) < today).length;
        const percentage = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
    
        let colorClass = percentage >= 80 ? 'text-green-600' : (percentage >= 60 ? 'text-yellow-600' : 'text-red-600');
        const evaluationCellHtml = createEvaluationCell(result, email, weekId);

        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="px-6 py-4 text-sm font-medium text-slate-900">${email}</td>
            <td class="px-6 py-4 text-sm">${evaluationCellHtml}</td>
            <td class="px-6 py-4 text-sm text-slate-600 leading-relaxed">${resultadoTexto}</td>
            <td class="px-6 py-4 text-center text-sm font-bold ${colorClass}">${percentage}%</td>
            <td class="px-6 py-4 text-center text-sm text-green-600 font-bold">${completed}</td>
            <td class="px-6 py-4 text-center text-sm text-slate-500">${tasks.length - completed}</td>
            <td class="px-6 py-4 text-center text-sm font-bold text-red-500">${overdue}</td>
        `;
        teamListBody.appendChild(row);
    }

  } catch (error) {
    console.error("Fallo crítico en Dashboard Admin:", error);
    teamListBody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-red-500 font-bold">Error de sincronización.</td></tr>`;
  }
};

const createEvaluationCell = (result, email, weekId) => {
    const colors = { 'Verde': 'bg-green-500', 'Amarillo': 'bg-yellow-500', 'Rojo': 'bg-red-500' };
    const currentColor = colors[result?.evaluation] || 'bg-slate-300';
    const rowNumber = result ? result.rowNumber : null;

    return `
        <div class="group relative inline-block" title="${result ? result.expectedResult : ''}">
            <span class="h-4 w-4 rounded-full inline-block ${currentColor} cursor-help shadow-sm"></span>
            <div class="absolute z-10 hidden group-hover:flex bg-white border rounded shadow-xl p-2 space-x-2 -translate-y-full mb-2 border-slate-200">
                <button data-row="${rowNumber}" data-email="${email}" data-weekid="${weekId}" data-eval="Verde" class="eval-btn h-5 w-5 rounded-full bg-green-500 hover:scale-110 transition-transform"></button>
                <button data-row="${rowNumber}" data-email="${email}" data-weekid="${weekId}" data-eval="Amarillo" class="eval-btn h-5 w-5 rounded-full bg-yellow-500 hover:scale-110 transition-transform"></button>
                <button data-row="${rowNumber}" data-email="${email}" data-weekid="${weekId}" data-eval="Rojo" class="eval-btn h-5 w-5 rounded-full bg-red-500 hover:scale-110 transition-transform"></button>
            </div>
        </div>`;
};

// Listeners de Administración
document.getElementById('admin-team-list')?.addEventListener('click', async (event) => {
    if (event.target.classList.contains('eval-btn')) {
        const button = event.target;
        if (!button.dataset.row || button.dataset.row === 'null') return;
        try {
            await fetch('/.netlify/functions/updateResultados', {
                method: 'POST',
                body: JSON.stringify({ action: 'saveEvaluation', rowNumber: button.dataset.row, evaluation: button.dataset.eval })
            });
            loadAdminDashboard(localStorage.getItem('userEmail'));
        } catch (e) { console.error(e); }
    }
});

const loadUsersForHitos = async () => {
    const selector = document.getElementById('hito-responsable');
    if (!selector) return;
    try {
        const response = await fetch('/.netlify/functions/getUsers');
        const users = await response.json();
        selector.innerHTML = '<option value="">Selecciona responsable</option>';
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.email;
            option.textContent = user.email;
            selector.appendChild(option);
        });
    } catch (e) { console.error(e); }
};

document.getElementById('add-hito-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const nombre = document.getElementById('hito-nombre').value;
    const responsable = document.getElementById('hito-responsable').value;
    const fechaFin = document.getElementById('hito-fecha-fin').value;

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        await fetch('/.netlify/functions/updateCronograma', {
            method: 'POST',
            body: JSON.stringify({ nombre, responsable, fechaFin })
        });
        e.target.reset();
        alert('Estrategia actualizada.');
        loadAdminDashboard(localStorage.getItem('userEmail'));
    } catch (err) { alert('Error al guardar.'); }
    finally { btn.disabled = false; btn.textContent = 'Determinar Hito'; }
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

        const tasks = await tasksResponse.json();
        const results = await resultsResponse.json();
        const safeResults = (results || []).filter(r => r); 

        if (safeResults.length === 0) {
            resultsContainer.innerHTML = '<p class="text-slate-400 italic text-sm">Sin compromiso para esta semana.</p>';
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
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        document.getElementById('completedTasksCount').textContent = completed;
        document.getElementById('pendingTasksCount').textContent = total - completed;
        document.getElementById('performancePercentage').textContent = `${percentage}%`;

        let color = percentage >= 80 ? '#22c55e' : (percentage >= 60 ? '#f59e0b' : '#ef4444');
        const chartCanvas = document.getElementById('performanceChart');
        if(window.myPerformanceChart) window.myPerformanceChart.destroy();
        renderDoughnutChart(chartCanvas, completed, total - completed, color);

    } catch (error) { console.error(error); }
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