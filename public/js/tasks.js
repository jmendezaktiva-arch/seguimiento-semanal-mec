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
            option.textContent = `${hito.id} - ${hito.nombre}`;
            hitoSelector.appendChild(option);
        });
    } catch (error) {
        console.error("Error cargando hitos:", error);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        window.location.href = '/index.html';
        return;
    }

    const taskListContainer = document.getElementById('task-list');
    const addTaskForm = document.getElementById('add-task-form');
    const saveResultButton = document.getElementById('save-result-button');
    const expectedResultTextarea = document.getElementById('expected-result-textarea');
    const resultStatusMessage = document.getElementById('result-status-message');

    let userTasks = [];

    const loadTasks = async () => {
        try {
            const response = await fetch(`/.netlify/functions/getTasks?email=${userEmail}`);
            userTasks = await response.json();
            renderTasks();
        } catch (error) {
            console.error('Error al cargar las tareas:', error);
            taskListContainer.innerHTML = '<p class="text-red-500">No se pudieron cargar las tareas.</p>';
        }
    };
    
    const renderTasks = () => {
        taskListContainer.innerHTML = '';
        if (userTasks.length === 0) {
            taskListContainer.innerHTML = '<p class="text-slate-500">No tienes tareas asignadas.</p>';
            return;
        }

        userTasks.sort((a, b) => {
            const dateA = parseDate(a.dueDate) || 0;
            const dateB = parseDate(b.dueDate) || 0;
            if (a.status === b.status) return dateA - dateB;
            return a.status === 'Pendiente' ? -1 : 1;
        });

        const tasksByMonth = userTasks.reduce((acc, task) => {
            const date = parseDate(task.dueDate);
            if (date) {
                const monthName = date.toLocaleString('es-ES', { month: 'long', year: 'numeric' });
                const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);
                if (!acc[capitalizedMonth]) acc[capitalizedMonth] = [];
                acc[capitalizedMonth].push(task);
            }
            return acc;
        }, {});

        for (const month in tasksByMonth) {
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'text-lg font-bold text-slate-600 mt-6 mb-2 cursor-pointer hover:text-blue-600';
            monthHeader.textContent = month;
            taskListContainer.appendChild(monthHeader);
            
            const monthTasksContainer = document.createElement('div');
            const monthId = `tasks-${month.replace(/[^a-zA-Z0-9]/g, '-')}`;
            monthTasksContainer.id = monthId;

            tasksByMonth[month].forEach(task => {
                const isCompleted = task.status === 'Cumplida';
                const taskElement = document.createElement('div');
                taskElement.className = `flex items-center justify-between rounded-lg border bg-white p-4 mb-2 shadow-sm ${isCompleted ? 'opacity-50 grayscale' : ''}`;
                taskElement.dataset.rowNumber = task.rowNumber;
                taskElement.dataset.status = task.status;
                
                const statusColor = isCompleted ? 'bg-green-500' : 'bg-amber-500';
                const date = parseDate(task.dueDate);
                const formattedDate = date ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '') : 'Sin fecha';
                
                taskElement.innerHTML = `
                    <div class="flex items-center">
                        <div class="status-circle h-6 w-6 cursor-pointer rounded-full ${statusColor}" title="Cambiar estado"></div>
                        <div class="ml-4">
                            <p class="text-slate-700 font-medium">${task.description}</p>
                            ${task.hitoId ? `<span class="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-bold">🎯 ${task.hitoId}</span>` : ''}
                        </div>
                    </div>
                    <span class="text-sm font-medium text-slate-500">${formattedDate}</span>
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

            submitButton.disabled = true;
            submitButton.textContent = 'Guardando...';

            try {
                await fetch('/.netlify/functions/updateTask', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'create', description: descriptionInput.value, dueDate: dateInput.value, assignedTo: userEmail, hitoId }),
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

            // RESTAURADO: Desplegar y ocultar tareas por mes al hacer clic en H3
            if (event.target.tagName === 'H3') {
                const month = event.target.textContent;
                const monthId = `tasks-${month.replace(/[^a-zA-Z0-9]/g, '-')}`;
                const container = document.getElementById(monthId);
                if (container) {
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
});