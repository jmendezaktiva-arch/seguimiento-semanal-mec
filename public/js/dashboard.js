// public/js/dashboard.js

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

  // Recuperamos el rol para la "Aduana de Seguridad" del backend
  const userRole = localStorage.getItem('userRole');

  try {
    const [tasksResponse, resultsResponse, usersResponse, hitosResponse] = await Promise.all([
        fetch(`/.netlify/functions/getTasks?email=${userEmail}&scope=all&role=${userRole}`),
        fetch(`/.netlify/functions/getResultados?email=${userEmail}&scope=all&weekId=${weekId}&role=${userRole}`),
        fetch(`/.netlify/functions/getUsers`),
        // ACTUALIZADO: Enviamos email, scope y role para que el Admin vea todo el cronograma
        fetch(`/.netlify/functions/getCronograma?email=${userEmail}&scope=all&role=${userRole}`)
    ]);

    if (!tasksResponse.ok || !resultsResponse.ok || !usersResponse.ok || !hitosResponse.ok) {
        throw new Error('Error en la comunicación con el servidor.');
    }
    
    const allTasks = await tasksResponse.json();
    const allResults = await resultsResponse.json();
    const usersData = await usersResponse.json();
    const allUsers = usersData.users || [];
    const allAreas = usersData.areas || [];
    const rawHitos = await hitosResponse.json();

    // NORMALIZACIÓN QUIRÚRGICA: Garantiza que el frontend encuentre las propiedades 
    // sin importar si vienen como "Area", "area", "Proyecto" o "proyecto" desde el Excel.
    const allHitos = rawHitos.map(h => ({
        ...h,
        id: h.id || h.ID || '',
        area: (h.area || h.Area || '').trim(),
        proyecto: (h.proyecto || h.Proyecto || '').trim(),
        nombre: h.nombre || h.Nombre || '',
        fechaInicio: h.fechaInicio || h.FechaInicio || h['Fecha Inicio'] || '',
        fechaFin: h.fechaFin || h.FechaFin || h['Fecha Fin'] || ''
    }));

    // MODIFICACIÓN QUIRÚRGICA: Poblar selector de áreas desde la Fuente de Verdad (Excel)
    const projectAreaSelector = document.getElementById('project-area-selector');
    const hitoAreaSelector = document.getElementById('hito-area-selector');
    const hitoProjectSelector = document.getElementById('hito-proyecto-selector');

    if (projectAreaSelector) {
        projectAreaSelector.innerHTML = '<option value="">-- Seleccionar Área --</option>' + 
            allAreas.map(area => `<option value="${area}">${area}</option>`).join('');
    }

    // Lógica encadenada para el Formulario de Hitos
    if (hitoAreaSelector && hitoProjectSelector) {
        // 1. Poblamos el selector de áreas del Hito
        hitoAreaSelector.innerHTML = '<option value="">-- Seleccionar Área --</option>' + 
            allAreas.map(area => `<option value="${area}">${area}</option>`).join('');

        // 2. Listener para filtrar proyectos (con Normalización Quirúrgica)
        const newHitoAreaSelector = hitoAreaSelector.cloneNode(true);
        hitoAreaSelector.parentNode.replaceChild(newHitoAreaSelector, hitoAreaSelector);

        newHitoAreaSelector.addEventListener('change', () => {
            const selectedArea = newHitoAreaSelector.value.trim().toLowerCase();
            
            if (!selectedArea) {
                hitoProjectSelector.innerHTML = '<option value="">-- Seleccionar Proyecto --</option>';
                return;
            }

            // --- BLOQUE DE AUDITORÍA QUIRÚRGICA ---
            console.group("🔎 AUDITORÍA DE PROYECTOS");
            console.log("1. Área seleccionada por usuario:", selectedArea);
            console.log("2. Total de hitos recibidos del servidor:", allHitos.length);
            
            // Verificamos si al menos un hito tiene el campo proyecto
            const hitosConDatos = allHitos.filter(h => h.proyecto && h.proyecto.trim() !== "");
            console.log("3. Hitos que SÍ tienen nombre de proyecto:", hitosConDatos.length);
            
            if(allHitos.length > 0) {
                console.log("4. Ejemplo de estructura del primer hito:", allHitos[0]);
            }

            const projectsInArea = [...new Set(allHitos
                .filter(h => {
                    const match = (h.area || '').trim().toLowerCase() === selectedArea;
                    return match;
                })
                .map(h => (h.proyecto || '').trim())
                .filter(Boolean)
            )].sort();

            console.log("5. Proyectos encontrados tras filtrar por área:", projectsInArea);
            console.groupEnd();
            // --- FIN BLOQUE DE AUDITORÍA ---

            hitoProjectSelector.innerHTML = '<option value="">-- Seleccionar Proyecto --</option>' + 
                projectsInArea.map(p => `<option value="${p}">${p}</option>`).join('');
        });
    }

    // 1. RENDERIZAR CRONOGRAMA TIPO GANTT (NIVEL 1)
    ganttContainer.innerHTML = '';

    if (allHitos.length === 0) {
        ganttContainer.innerHTML = '<p class="p-4 text-slate-500 text-sm italic">No hay hitos estratégicos definidos.</p>';
    } else {
        const meses = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const header = document.createElement('div');
        header.className = 'grid grid-cols-13 border-b bg-slate-50 font-bold text-[10px] text-slate-500 uppercase tracking-tighter sticky top-0 z-20';
        // SINCRONIZACIÓN: Usamos w-80 (320px) para coincidir con la cuadrícula del CSS
        header.innerHTML = `<div class="p-2 border-r w-80 bg-slate-100 shrink-0">Jerarquía / Mes</div>` + 
                           meses.map(m => `<div class="p-2 text-center border-r min-w-[40px]">${m}</div>`).join('');
        ganttContainer.appendChild(header);

        // AGRUPACIÓN JERÁRQUICA
        const hierarchy = allHitos.reduce((acc, hito) => {
            const area = (hito.area || '').trim() || 'Sin Área';
            const proyecto = (hito.proyecto || '').trim() || 'Proyecto General';
            if (!acc[area]) acc[area] = {};
            if (!acc[area][proyecto]) acc[area][proyecto] = [];
            acc[area][proyecto].push(hito);
            return acc;
        }, {});

        Object.keys(hierarchy).forEach(area => {
            const areaRow = document.createElement('div');
            areaRow.className = 'grid grid-cols-13 bg-slate-200 border-b font-bold text-[11px] text-slate-800 uppercase italic';
            // LÓGICA QUIRÚRGICA: Eliminamos 'truncate' y permitimos saltos de línea (whitespace-normal)
            areaRow.innerHTML = `<div class="p-2 border-r w-80 whitespace-normal break-words shrink-0">📍 Área: ${area}</div>` + Array(12).fill('<div class="border-r h-full"></div>').join('');
            ganttContainer.appendChild(areaRow);

            Object.keys(hierarchy[area]).forEach(proyecto => {
                const projectRow = document.createElement('div');
                projectRow.className = 'grid grid-cols-13 bg-slate-50 border-b font-semibold text-[10px] text-blue-700 items-center';
                projectRow.innerHTML = `<div class="p-2 pl-4 border-r w-80 whitespace-normal break-words shrink-0">📁 ${proyecto}</div>` + Array(12).fill('<div class="border-r h-full"></div>').join('');
                ganttContainer.appendChild(projectRow);

                hierarchy[area][proyecto].forEach(hito => {
                    const hitoTasks = allTasks.filter(t => t.hitoId === hito.id);
                    const progress = hitoTasks.length > 0 ? Math.round((hitoTasks.filter(t => t.status === 'Cumplida').length / hitoTasks.length) * 100) : 0;
                    
                    const dStart = parseDate(hito.fechaInicio);
                    const dEnd = parseDate(hito.fechaFin);
                    const curYear = new Date().getFullYear();
                    
                    const row = document.createElement('div');
                    row.className = 'grid grid-cols-13 border-b hover:bg-slate-50 relative min-h-[40px] items-center group';
                    
                    let rowHtml = `<div class="p-2 pl-6 border-r w-80 text-[10px] text-slate-600 italic whitespace-normal break-words shrink-0" title="${hito.nombre}">${hito.nombre}</div>`;
                    for(let i=1; i<=12; i++) { rowHtml += `<div class="border-r h-full"></div>`; }
                    
                    // LÓGICA DE NORMALIZACIÓN TEMPORAL (Gantt Multi-año)
                    let colStart = null;
                    if (dStart) {
                        if (dStart.getFullYear() < curYear) colStart = 2; // Inició antes de este año (Enero)
                        else if (dStart.getFullYear() === curYear) colStart = dStart.getMonth() + 2;
                        else colStart = 14; // Inicia el próximo año (Fuera de rango)
                    }

                    let colEnd = null;
                    if (dEnd) {
                        if (dEnd.getFullYear() > curYear) colEnd = 13; // Termina después de este año (Diciembre)
                        else if (dEnd.getFullYear() === curYear) colEnd = dEnd.getMonth() + 2;
                        else colEnd = 1; // Terminó el año pasado (Fuera de rango)
                    }

                    // Fallbacks de seguridad para asegurar visibilidad si existe al menos una fecha
                    if (colStart === null && colEnd !== null) colStart = colEnd;
                    if (colEnd === null && colStart !== null) colEnd = colStart;

                    // Solo renderizamos el indicador si el hito toca algún mes del año actual
                    if (colStart !== null && colEnd !== null && colStart <= 13 && colEnd >= 2 && colStart <= colEnd) {
                        const colSpan = (colEnd - colStart) + 1;
                        rowHtml += `
                            <div class="absolute h-5 rounded-full shadow-sm flex items-center px-2 text-[8px] font-bold text-white transition-all overflow-hidden z-10" 
                                 style="grid-column: ${colStart} / span ${colSpan}; 
                                        background: linear-gradient(90deg, #3b82f6 ${progress}%, #cbd5e1 ${progress}%);
                                        margin-left: 4px; margin-right: 4px;">
                                ${progress}%
                            </div>`;
                    }
                    row.innerHTML = rowHtml;
                    ganttContainer.appendChild(row);
                });
            });
        });
    }

    // 2. RENDERIZAR TABLA DE EQUIPO POR ÁREA (JERARQUÍA ESTRATÉGICA)
    const usersByArea = {};
    
    // Agrupamos usuarios por área (asumiendo que el objeto user tiene una propiedad area)
    allUsers.forEach(user => {
        const area = user.area || 'General';
        if (!usersByArea[area]) usersByArea[area] = [];
        usersByArea[area].push(user);
    });

    teamListBody.innerHTML = '';

    Object.keys(usersByArea).sort().forEach(area => {
        // FILA DE ENCABEZADO DE ÁREA
        const areaRow = document.createElement('tr');
        areaRow.className = 'bg-slate-100 border-y-2 border-slate-200';
        areaRow.innerHTML = `
            <td colspan="7" class="px-6 py-2 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                📍 ÁREA: ${area}
            </td>`;
        teamListBody.appendChild(areaRow);

        usersByArea[area].forEach(user => {
            const email = user.email;
            const tasks = allTasks.filter(t => t.assignedTo === email);
            const results = allResults.filter(r => r.assignedTo === email);
            
            const result = results.length > 0 ? results[0] : null;
            const resultadoTexto = results.map(r => r.expectedResult).join('<br>') || '<em>Sin compromiso</em>';

            const completed = tasks.filter(t => t.status === 'Cumplida').length;
            const today = new Date(); today.setHours(0,0,0,0);
            const overdue = tasks.filter(t => t.status === 'Pendiente' && parseDate(t.dueDate) < today).length;
            const percentage = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
        
            let colorClass = percentage >= 80 ? 'text-green-600' : (percentage >= 60 ? 'text-yellow-600' : 'text-red-600');
            const evaluationCellHtml = createEvaluationCell(result, email, weekId);

            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 transition-colors border-b border-slate-100';
            row.innerHTML = `
                <td class="px-6 py-4 text-sm font-medium text-slate-900 pl-10">${email}</td>
                <td class="px-6 py-4 text-sm text-center">${evaluationCellHtml}</td>
                <td class="px-6 py-4 text-sm text-slate-600 leading-tight">${resultadoTexto}</td>
                <td class="px-6 py-4 text-center text-sm font-bold ${colorClass}">${percentage}%</td>
                <td class="px-6 py-4 text-center text-sm text-green-600 font-bold">${completed}</td>
                <td class="px-6 py-4 text-center text-sm text-slate-400">${tasks.length - completed}</td>
                <td class="px-6 py-4 text-center text-sm font-bold text-red-500">${overdue}</td>
            `;
            teamListBody.appendChild(row);
        });
    });

    // Nota Quirúrgica: Bloque de re-declaración eliminado. 
    // El selector ya se pobló correctamente en la línea 53 usando la Fuente de Verdad (Excel).

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
        const data = await response.json();
        
        // Ajuste Quirúrgico: Extraemos solo la lista de usuarios del objeto de respuesta
        const users = data.users || [];
        
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
    
    // Captura de datos de jerarquía estratégica y temporal
    const area = document.getElementById('hito-area-selector').value;
    const proyecto = document.getElementById('hito-proyecto-selector').value;
    const nombre = document.getElementById('hito-nombre').value;
    const responsable = document.getElementById('hito-responsable').value;
    const fechaInicio = document.getElementById('hito-fecha-inicio').value;
    const fechaFin = document.getElementById('hito-fecha-fin').value;

    if (!area || !proyecto || !fechaInicio || !fechaFin) {
        alert('Por favor, completa todos los campos, incluyendo las fechas de Inicio y Fin.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Guardando...';

    try {
        // Enviamos el objeto completo incluyendo la nueva Fecha de Inicio
        await fetch('/.netlify/functions/updateCronograma', {
            method: 'POST',
            body: JSON.stringify({ area, proyecto, nombre, responsable, fechaInicio, fechaFin })
        });
        
        e.target.reset();
        alert('Hito registrado con éxito en el cronograma estratégico.');
        
        // Recarga el Dashboard para ver el hito en su nueva jerarquía
        loadAdminDashboard(localStorage.getItem('userEmail'));
    } catch (err) { 
        console.error(err);
        alert('Error al guardar el hito.'); 
    }
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

// LÓGICA QUIRÚRGICA: Escuchar el envío del nuevo formulario de proyectos
document.getElementById('project-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button');
    const area = document.getElementById('project-area-selector').value;
    const proyecto = document.getElementById('project-name').value;
    const userEmail = localStorage.getItem('userEmail');

    if (!area || !proyecto) {
        alert('Por favor, selecciona un área y escribe un nombre para el proyecto.');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Registrando...';

    try {
        // Aprovechamos la función updateCronograma que ya creamos
        const response = await fetch('/.netlify/functions/updateCronograma', {
            method: 'POST',
            body: JSON.stringify({
                nombre: `INICIO: ${proyecto}`, // Hito automático de apertura
                responsable: userEmail,
                fechaFin: new Date().toISOString().split('T')[0], // Fecha de hoy
                area: area,
                proyecto: proyecto
            })
        });

        if (!response.ok) throw new Error('Error en el servidor');

        e.target.reset();
        alert(`Proyecto "${proyecto}" registrado con éxito en el Área ${area}.`);
        
        // Recargamos el Dashboard para ver el nuevo proyecto en el Gantt
        loadAdminDashboard(userEmail);
    } catch (err) {
        console.error(err);
        alert('Error al registrar el proyecto. Revisa la conexión.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Registrar Proyecto';
    }
});