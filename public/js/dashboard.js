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
                // LÓGICA DE AGREGACIÓN: Obtenemos todas las tareas de todos los hitos de este proyecto
                const projectHitosIds = hierarchy[area][proyecto].map(h => h.id);
                const projectTasks = allTasks.filter(t => projectHitosIds.includes(t.hitoId));
                
                const totalTasks = projectTasks.length;
                const completedTasks = projectTasks.filter(t => t.status === 'Cumplida').length;
                const projectProgress = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

                // Definimos color según avance para facilitar lectura rápida
                const badgeColor = projectProgress >= 80 ? 'bg-green-100 text-green-800' : (projectProgress >= 40 ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-600');

                const projectRow = document.createElement('div');
                projectRow.className = 'grid grid-cols-13 bg-slate-50 border-b font-semibold text-[10px] text-blue-900 items-center shadow-inner';
                projectRow.innerHTML = `
                    <div class="p-2 pl-4 border-r w-80 whitespace-normal break-words shrink-0 flex justify-between items-center bg-blue-50/50">
                        <span>📁 ${proyecto}</span>
                        <div class="flex items-center gap-2 mr-2">
                            <span class="text-[8px] text-slate-400 uppercase font-bold">Avance:</span>
                            <span class="${badgeColor} px-2 py-0.5 rounded-full text-[9px] font-black border border-current/10 shadow-sm">
                                ${projectProgress}%
                            </span>
                        </div>
                    </div>` + Array(12).fill('<div class="border-r h-full"></div>').join('');
                ganttContainer.appendChild(projectRow);

                hierarchy[area][proyecto].forEach(hito => {
                    const hitoTasks = allTasks.filter(t => t.hitoId === hito.id);
                    const progress = hitoTasks.length > 0 ? Math.round((hitoTasks.filter(t => t.status === 'Cumplida').length / hitoTasks.length) * 100) : 0;
                    
                    const dStart = parseDate(hito.fechaInicio);
                    const dEnd = parseDate(hito.fechaFin);
                    const curYear = new Date().getFullYear();
                    
                    const row = document.createElement('div');
                    row.className = 'grid grid-cols-13 border-b hover:bg-slate-50 relative min-h-[40px] items-center group';
                    
                    // [PULIDO QUIRÚRGICO: UI CON CONTADOR E INTERACTIVIDAD]
                    const totalTasks = hitoTasks.length;
                    const completedTasks = hitoTasks.filter(t => t.status === 'Cumplida').length;

                    let rowHtml = `
                        <div class="p-2 pl-6 border-r w-80 text-[10px] text-slate-600 italic whitespace-normal break-words shrink-0 cursor-pointer hover:text-blue-600 flex items-center justify-between group/title" 
                             onclick="const el = document.getElementById('tasks-for-${hito.id}'); el.classList.toggle('hidden'); this.querySelector('.symbol').textContent = el.classList.contains('hidden') ? '▶' : '▼';"
                             title="Click para ver desglose">
                            <div class="flex items-center">
                                <span class="symbol mr-1 text-[8px] transition-transform">▶</span> ${hito.nombre}
                            </div>
                            <span class="text-[8px] font-bold bg-slate-100 px-1.5 rounded-full text-slate-400 group-hover/title:bg-blue-100 group-hover/title:text-blue-500 transition-colors">
                                ${completedTasks}/${totalTasks}
                            </span>
                        </div>`;

                    for(let i=1; i<=12; i++) { rowHtml += `<div class="border-r h-full"></div>`; }
                    
                    let colStart = null;
                    if (dStart) {
                        if (dStart.getFullYear() < curYear) colStart = 2;
                        else if (dStart.getFullYear() === curYear) colStart = dStart.getMonth() + 2;
                        else colStart = 14;
                    }

                    let colEnd = null;
                    if (dEnd) {
                        if (dEnd.getFullYear() > curYear) colEnd = 13;
                        else if (dEnd.getFullYear() === curYear) colEnd = dEnd.getMonth() + 2;
                        else colEnd = 1;
                    }

                    if (colStart === null && colEnd !== null) colStart = colEnd;
                    if (colEnd === null && colStart !== null) colEnd = colStart;

                    if (colStart !== null && colEnd !== null && colStart <= 13 && colEnd >= 2 && colStart <= colEnd) {
                        const colSpan = (colEnd - colStart) + 1;
                        rowHtml += `
                            <div class="absolute h-5 rounded-full shadow-sm flex items-center justify-center text-[8px] font-bold text-white transition-all overflow-hidden z-10" 
                                 style="grid-column: ${colStart} / span ${colSpan}; 
                                        background: linear-gradient(90deg, #3b82f6 ${progress}%, #cbd5e1 ${progress}%);
                                        width: calc(100% - 8px);
                                        left: 4px;">
                                ${progress}%
                            </div>`;
                    }
                    row.innerHTML = rowHtml;
                    ganttContainer.appendChild(row);

                    // [MODIFICACIÓN QUIRÚRGICA: INTEGRACIÓN LIMPIA DEL DESGLOSE]
                    const taskContainer = document.createElement('div');
                    taskContainer.id = `tasks-for-${hito.id}`;
                    taskContainer.className = 'hidden bg-slate-50 border-b text-[9px] text-slate-500 shadow-inner';
                    taskContainer.style.gridColumn = "1 / span 13";
                    
                    if (totalTasks === 0) {
                        taskContainer.innerHTML = `<div class="p-2 pl-12 italic">No hay tareas operativas vinculadas a este hito.</div>`;
                    } else {
                        taskContainer.innerHTML = hitoTasks.map(t => `
                            <div class="flex items-center justify-between p-2 pl-12 border-b border-slate-100 hover:bg-white transition-colors group/task">
                                <div class="flex items-center gap-2">
                                    <span class="status-circle-dashboard h-3 w-3 rounded-full cursor-pointer shadow-sm hover:scale-110 transition-transform ${t.status === 'Cumplida' ? 'bg-green-500' : 'bg-amber-500'}"
                                          data-row="${t.rowNumber}" 
                                          data-status="${t.status}"
                                          title="Cambiar estatus"></span>
                                    <span class="${t.status === 'Cumplida' ? 'line-through opacity-50' : 'text-slate-700 font-medium'}">${t.description}</span>
                                </div>
                                <div class="flex gap-4 pr-4 items-center">
                                    <span class="text-[8px] bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-400 font-bold uppercase">${t.assignedTo.split('@')[0]}</span>
                                    <span class="font-mono text-[8px] text-slate-400">${t.dueDate}</span>
                                </div>
                            </div>
                        `).join('');
                    }
                    ganttContainer.appendChild(taskContainer);
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

    // --- MODIFICACIÓN QUIRÚRGICA: INDICADORES DE AVANCE ESTRATÉGICO ---
    const globalProgressContainer = document.getElementById('global-progress-container');
    const projectsStatsGrid = document.getElementById('projects-stats-grid');

    if (globalProgressContainer && projectsStatsGrid) {
        // 1. Cálculo del Avance Global (Toda la Empresa)
        const globalTotal = allTasks.length;
        const globalCompleted = allTasks.filter(t => t.status === 'Cumplida').length;
        const globalPercent = globalTotal > 0 ? Math.round((globalCompleted / globalTotal) * 100) : 0;

        globalProgressContainer.innerHTML = `
            <div class="bg-slate-800 rounded-xl p-6 text-white shadow-lg border-l-8 border-blue-500 transition-all hover:scale-[1.01]">
                <div class="flex justify-between items-center mb-4">
                    <div>
                        <p class="text-slate-400 text-xs uppercase tracking-widest font-bold">Salud Estratégica Global</p>
                        <h4 class="text-4xl font-black">${globalPercent}%</h4>
                    </div>
                    <div class="text-right">
                        <p class="text-2xl font-bold">${globalCompleted} <span class="text-slate-500">/</span> ${globalTotal}</p>
                        <p class="text-slate-400 text-[10px] uppercase font-bold tracking-tighter">Total Tareas Ejecutadas</p>
                    </div>
                </div>
                <div class="w-full bg-slate-700 rounded-full h-4 overflow-hidden border border-slate-600 shadow-inner">
                    <div class="bg-blue-500 h-full transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(59,130,246,0.6)]" 
                         style="width: ${globalPercent}%"></div>
                </div>
            </div>`;

        // 2. Cálculo y Renderizado por Proyecto Individual
        let projectsHtml = '';
        Object.keys(hierarchy).forEach(area => {
            Object.keys(hierarchy[area]).forEach(proyecto => {
                const projectHitoIds = hierarchy[area][proyecto].map(h => h.id);
                const pTasks = allTasks.filter(t => projectHitoIds.includes(t.hitoId));
                const pTotal = pTasks.length;
                const pCompleted = pTasks.filter(t => t.status === 'Cumplida').length;
                const pPercent = pTotal > 0 ? Math.round((pCompleted / pTotal) * 100) : 0;
                
                // Color semafórico dinámico
                const accentColor = pPercent >= 80 ? 'border-green-500' : (pPercent >= 40 ? 'border-blue-500' : 'border-amber-500');
                const barColor = pPercent >= 80 ? 'bg-green-500' : (pPercent >= 40 ? 'bg-blue-500' : 'bg-amber-500');

                projectsHtml += `
                    <div class="bg-white p-5 rounded-lg shadow-sm border-t-4 ${accentColor} hover:shadow-md transition-all group">
                        <div class="flex justify-between items-start mb-3">
                            <div class="max-w-[75%]">
                                <p class="text-[9px] text-slate-400 uppercase font-black truncate tracking-tighter">${area}</p>
                                <h5 class="text-sm font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors">${proyecto}</h5>
                            </div>
                            <span class="text-xl font-black text-slate-700">${pPercent}%</span>
                        </div>
                        <div class="w-full bg-slate-100 rounded-full h-2.5 mb-3 shadow-inner">
                            <div class="h-full rounded-full ${barColor} transition-all duration-700 shadow-sm" style="width: ${pPercent}%"></div>
                        </div>
                        <div class="flex justify-between text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                            <span class="flex items-center gap-1">
                                <span class="h-1.5 w-1.5 rounded-full bg-slate-300"></span>
                                ${pCompleted}/${pTotal} Tareas
                            </span>
                            <span>${hierarchy[area][proyecto].length} Hitos</span>
                        </div>
                    </div>`;
            });
        });
        projectsStatsGrid.innerHTML = projectsHtml;
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

// [MODIFICACIÓN QUIRÚRGICA: INTERACTIVIDAD DE TAREAS EN GANTT]
document.getElementById('gantt-chart')?.addEventListener('click', async (event) => {
    if (event.target.classList.contains('status-circle-dashboard')) {
        const circle = event.target;
        const rowNumber = circle.dataset.row;
        const currentStatus = circle.dataset.status;
        const newStatus = currentStatus === 'Pendiente' ? 'Cumplida' : 'Pendiente';

        // Feedback visual inmediato (UX de alta respuesta)
        circle.style.opacity = "0.5";
        circle.style.cursor = "wait";

        try {
            const response = await fetch('/.netlify/functions/updateTask', {
                method: 'POST',
                body: JSON.stringify({ 
                    action: 'updateStatus', 
                    rowNumber: rowNumber, 
                    newStatus: newStatus 
                })
            });

            if (response.ok) {
                // RECARGA ESTRATÉGICA: Al actualizar la tarea, recalculamos 
                // automáticamente el progreso del Hito en el Gantt.
                loadAdminDashboard(localStorage.getItem('userEmail'));
            } else {
                throw new Error('Error en la actualización');
            }
        } catch (error) {
            console.error("Fallo al actualizar tarea desde Dashboard:", error);
            circle.style.opacity = "1";
            circle.style.cursor = "pointer";
            alert('No se pudo actualizar el estatus. Verifica tu conexión.');
        }
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
        // LÓGICA QUIRÚRGICA: Definimos una estampa de tiempo ISO única para inicio y fin
        const todayISO = new Date().toISOString().split('T')[0];
        
        const response = await fetch('/.netlify/functions/updateCronograma', {
            method: 'POST',
            body: JSON.stringify({
                nombre: `INICIO: ${proyecto}`, 
                responsable: userEmail,
                fechaInicio: todayISO, // Enviamos inicio explícito
                fechaFin: todayISO,    // El hito de apertura es puntual (mismo día)
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