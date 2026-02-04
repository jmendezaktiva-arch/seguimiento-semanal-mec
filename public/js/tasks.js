// public/js/tasks.js (VERSIÓN MAESTRA TOTALMENTE INTEGRADA)

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

const loadHitosForSelector = async (userEmail) => {
    const hitoSelector = document.getElementById('hito-selector');
    if (!hitoSelector) return;
    try {
        const response = await fetch(`/.netlify/functions/getCronograma?email=${userEmail}`);
        const hitos = await response.json();
        hitoSelector.innerHTML = '<option value="">-- Tarea Operativa (Sin hito) --</option>';
        hitos.forEach(hito => {
            const option = document.createElement('option');
            option.value = hito.id;
            // Inyección Quirúrgica: Almacenamos el Área y Proyecto como metadatos en el HTML
            option.dataset.area = hito.area || '';
            option.dataset.proyecto = hito.proyecto || '';
            option.textContent = `${hito.id} - ${hito.nombre}`;
            hitoSelector.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando hitos:", error);
    }
};

const loadUsersForAssignment = async () => {
    const selector = document.getElementById('assigned-to');
    const container = document.getElementById('admin-assignee-container');
    if (!selector || !container) return;

    try {
        const response = await fetch('/.netlify/functions/getUsers');
        const data = await response.json();
        const users = data.users || []; // Adaptación quirúrgica: extraemos solo los usuarios del nuevo paquete
        selector.innerHTML = ''; // Limpiamos el mensaje de carga
        
        const currentUserEmail = localStorage.getItem('userEmail');
        
        users.forEach(user => {
            if (user.email) {
                const option = document.createElement('option');
                option.value = user.email;
                option.textContent = user.email;
                // Marcamos por defecto al usuario actual para facilitar la auto-asignación
                if (user.email === currentUserEmail) option.selected = true;
                selector.appendChild(option);
            }
        });
        // Una vez cargados los usuarios, mostramos el contenedor solo al Admin
        container.style.display = 'block';
    } catch (e) { console.error("Error al cargar lista de usuarios:", e); }
};

document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('userEmail');
    const userRole = localStorage.getItem('userRole'); // Recuperamos el rol del usuario

    if (!userEmail) {
        window.location.href = '/index.html';
        return;
    }

    // SI ES ADMIN: Activamos la Barra de Control Estratégico y la Asignación
    if (userRole === 'Admin') {
        loadUsersForAssignment();
        const filterBar = document.getElementById('admin-filter-bar');
        const headerTitle = document.getElementById('tasks-header-title');
        
        // Removemos la clase 'hidden' para mostrar la barra de filtros
        if (filterBar) filterBar.classList.remove('hidden');
        // Cambiamos el título para reflejar la visión global del Admin
        if (headerTitle) headerTitle.textContent = 'Panel de Control de Tareas del Equipo';
    }

    const taskListContainer = document.getElementById('task-list');
    const addTaskForm = document.getElementById('add-task-form');
    const saveResultButton = document.getElementById('save-result-button');
    const expectedResultTextarea = document.getElementById('expected-result-textarea');
    const resultStatusMessage = document.getElementById('result-status-message');

    let userTasks = [];

    const loadTasks = async () => {
        const userRole = localStorage.getItem('userRole');
        const scope = userRole === 'Admin' ? 'all' : 'user';

        try {
            const response = await fetch(`/.netlify/functions/getTasks?email=${userEmail}&scope=${scope}&role=${userRole}`);
            userTasks = await response.json();
            
            // Si es Admin, poblamos los filtros con los datos únicos recibidos
            if (userRole === 'Admin') populateFilters(userTasks);
            
            renderTasks(userTasks);
        } catch (error) {
            console.error('Error al cargar las tareas:', error);
            taskListContainer.innerHTML = '<p class="text-red-500">No se pudieron cargar las tareas.</p>';
        }
    };

    const populateFilters = (tasks) => {
        const areaSel = document.getElementById('filter-area');
        const projectSel = document.getElementById('filter-project');
        const assigneeSel = document.getElementById('filter-assignee');
        if (!areaSel || !projectSel || !assigneeSel) return;

        // Extraemos valores únicos y ordenamos
        const areas = [...new Set(tasks.map(t => t.area).filter(Boolean))].sort();
        const projects = [...new Set(tasks.map(t => t.proyecto).filter(Boolean))].sort();
        const assignees = [...new Set(tasks.map(t => t.assignedTo).filter(Boolean))].sort();

        const fill = (selector, values, label) => {
            const current = selector.value;
            selector.innerHTML = `<option value="">${label}</option>`;
            values.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                if (v === current) opt.selected = true;
                selector.appendChild(opt);
            });
        };

        fill(areaSel, areas, 'Todas');
        fill(projectSel, projects, 'Todos');
        fill(assigneeSel, assignees, 'Todos');
    };

    const applyFilters = () => {
        const area = document.getElementById('filter-area').value;
        const project = document.getElementById('filter-project').value;
        const assignee = document.getElementById('filter-assignee').value;
        const status = document.getElementById('filter-status').value;

        const filtered = userTasks.filter(t => {
            const matchArea = !area || t.area === area;
            const matchProject = !project || t.proyecto === project;
            const matchAssignee = !assignee || t.assignedTo === assignee;
            const matchStatus = !status || t.status === status;
            return matchArea && matchProject && matchAssignee && matchStatus;
        });

        renderTasks(filtered);
    };
    
    const renderTasks = (tasksToRender = userTasks) => {
        taskListContainer.innerHTML = '';
        
        if (tasksToRender.length === 0) {
            taskListContainer.innerHTML = '<p class="text-slate-500 italic text-center p-4">No hay tareas que coincidan con estos criterios.</p>';
            return;
        }

        // 1. Ordenar tareas: Pendientes primero, luego por fecha
        const sortedTasks = [...tasksToRender].sort((a, b) => {
            const dateA = parseDate(a.dueDate) || 0;
            const dateB = parseDate(b.dueDate) || 0;
            if (a.status === b.status) return dateA - dateB;
            return a.status === 'Pendiente' ? -1 : 1;
        });

        // 2. Agrupar por Mes
        const tasksByMonth = sortedTasks.reduce((acc, task) => {
            const date = parseDate(task.dueDate);
            const monthName = date 
                ? date.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
                : 'Sin Fecha';
            const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
            if (!acc[capitalizedMonth]) acc[capitalizedMonth] = [];
            acc[capitalizedMonth].push(task);
            return acc;
        }, {});

        // 3. Renderizar Grupos
        for (const month in tasksByMonth) {
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'text-lg font-bold text-slate-600 mt-6 mb-2 cursor-pointer hover:text-blue-600 flex items-center';
            monthHeader.innerHTML = `<span>${month}</span> <span class="ml-2 text-[10px] bg-slate-200 px-2 rounded-full">${tasksByMonth[month].length}</span>`;
            taskListContainer.appendChild(monthHeader);
            
            const monthTasksContainer = document.createElement('div');
            const monthId = `tasks-${month.replace(/[^a-zA-Z0-9]/g, '-')}`;
            monthTasksContainer.id = monthId;
            monthTasksContainer.style.display = 'none'; // Iniciamos colapsado

            tasksByMonth[month].forEach(task => {
                const isCompleted = task.status === 'Cumplida';
                const taskElement = document.createElement('div');
                taskElement.className = `flex items-center justify-between rounded-lg border bg-white p-4 mb-2 shadow-sm hover:border-blue-300 transition-colors ${isCompleted ? 'opacity-50 grayscale' : ''}`;
                taskElement.dataset.rowNumber = task.rowNumber;
                taskElement.dataset.status = task.status;
                
                const statusColor = isCompleted ? 'bg-green-500' : 'bg-amber-500';
                const date = parseDate(task.dueDate);
                const formattedDate = date ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }) : '---';
                
                taskElement.innerHTML = `
                    <div class="flex items-center flex-1">
                        <div class="status-circle h-6 w-6 cursor-pointer rounded-full ${statusColor} shrink-0"></div>
                        <div class="ml-4">
                            <p class="text-slate-700 font-medium leading-tight">${task.description}</p>
                            <div class="flex gap-2 mt-1">
                                ${task.hitoId ? `<span class="text-[9px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">🎯 ${task.hitoId}</span>` : ''}
                                ${task.area ? `<span class="text-[9px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full font-bold uppercase">${task.area}</span>` : ''}
                            </div>
                        </div>
                    </div>
                    <span class="text-xs font-bold text-slate-400 ml-4">${formattedDate}</span>
                `;
                monthTasksContainer.appendChild(taskElement);
            });
            taskListContainer.appendChild(monthTasksContainer);
        }
    };

    const loadExpectedResult = async () => {
        const weekId = getCurrentWeekId();
        try {
            const response = await fetch(`/.netlify/functions/getResultados?scope=user&email=${userEmail}&weekId=${weekId}`);
            const results = await response.json();
            if (results && results.length > 0) expectedResultTextarea.value = results[0].expectedResult;
            else expectedResultTextarea.value = '';
        } catch (error) {
            console.error('Error al cargar resultado:', error);
        }
    };

    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const descriptionInput = document.getElementById('description');
            const dateInput = document.getElementById('due-date');
            const hitoSelector = document.getElementById('hito-selector');
            const submitButton = addTaskForm.querySelector('button[type="submit"]');

            const hitoId = hitoSelector ? hitoSelector.value : '';
            
            // Extracción Quirúrgica de Metadatos: Heredamos Área y Proyecto del Hito seleccionado
            const selectedHitoOption = hitoSelector.options[hitoSelector.selectedIndex];
            const area = selectedHitoOption ? (selectedHitoOption.dataset.area || '') : '';
            const proyecto = selectedHitoOption ? (selectedHitoOption.dataset.proyecto || '') : '';

            // DETERMINAR RESPONSABLE:
            const assigneeSelector = document.getElementById('assigned-to');
            const finalAssignedTo = (assigneeSelector && assigneeSelector.value) ? assigneeSelector.value : userEmail;

            submitButton.disabled = true;
            submitButton.textContent = 'Guardando...';

            try {
                await fetch('/.netlify/functions/updateTask', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        action: 'create', 
                        description: descriptionInput.value, 
                        dueDate: dateInput.value, 
                        assignedTo: finalAssignedTo, 
                        asignadoPor: userEmail,      
                        hitoId,
                        area: area,     // Trazabilidad Automática
                        proyecto: proyecto // Trazabilidad Automática
                    }),
                });
                addTaskForm.reset();
                loadTasks();
            } catch (error) {
                alert('No se pudo crear la tarea.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Guardar Tarea';
            }
        });
    }

    if (taskListContainer) {
        taskListContainer.addEventListener('click', async (event) => {
            // Cambio de estado
            if (event.target.classList.contains('status-circle')) {
                const taskElement = event.target.closest('div[data-row-number]');
                const rowNumber = taskElement.dataset.rowNumber;
                const newStatus = taskElement.dataset.status === 'Pendiente' ? 'Cumplida' : 'Pendiente';
                try {
                    await fetch('/.netlify/functions/updateTask', {
                        method: 'POST',
                        body: JSON.stringify({ action: 'updateStatus', rowNumber, newStatus }),
                    });
                    loadTasks();
                } catch (error) { console.error('Error al actualizar:', error); }
            }

            // MEJORA QUIRÚRGICA: Toggle de meses sensible a clics en el encabezado completo
            const monthHeader = event.target.closest('h3');
            if (monthHeader && taskListContainer.contains(monthHeader)) {
                // Buscamos el contenedor de tareas que está inmediatamente después del encabezado
                const container = monthHeader.nextElementSibling;
                if (container && container.id.startsWith('tasks-')) {
                    container.style.display = container.style.display === 'none' ? 'block' : 'none';
                }
            }
        });
    }

    if (saveResultButton) {
        saveResultButton.addEventListener('click', async () => {
            const expectedResult = expectedResultTextarea.value.trim();
            const weekId = getCurrentWeekId();
            try {
                await fetch('/.netlify/functions/updateResultados', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'saveResult', weekId, email: userEmail, expectedResult }),
                });
                resultStatusMessage.textContent = '¡Guardado con éxito!';
                resultStatusMessage.className = 'mt-2 text-sm text-green-600';
                setTimeout(() => { resultStatusMessage.textContent = ''; }, 3000);
            } catch (error) { console.error('Error al guardar:', error); }
        });
    }
    
    loadTasks();
    loadExpectedResult();
    loadHitosForSelector(userEmail);

    // Listeners para la Barra de Control Estratégico
    ['filter-area', 'filter-project', 'filter-assignee', 'filter-status'].forEach(id => {
        document.getElementById(id)?.addEventListener('change', applyFilters);
    });

    document.getElementById('reset-filters')?.addEventListener('click', () => {
        ['filter-area', 'filter-project', 'filter-assignee', 'filter-status'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        renderTasks(userTasks);
    });
});