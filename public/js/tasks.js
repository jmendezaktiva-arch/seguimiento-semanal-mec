// public/js/tasks.js (VERSIÓN FINAL, FUSIONADA Y VERIFICADA)

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
    
    // --- FUNCIÓN RESTAURADA Y MODIFICADA ---
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
                if (!acc[capitalizedMonth]) {
                    acc[capitalizedMonth] = [];
                }
                acc[capitalizedMonth].push(task);
            }
            return acc;
        }, {});

        for (const month in tasksByMonth) {
            const monthHeader = document.createElement('h3');
            monthHeader.className = 'text-lg font-bold text-slate-600 mt-6 mb-2 cursor-pointer';
            monthHeader.textContent = month;
            taskListContainer.appendChild(monthHeader);
            
            // Se crea un contenedor para las tareas del mes para poder ocultarlo/mostrarlo
            const monthTasksContainer = document.createElement('div');
            const monthId = `tasks-${month.replace(/[^a-zA-Z0-9]/g, '-')}`;
            monthTasksContainer.id = monthId;

            tasksByMonth[month].forEach(task => {
                const taskElement = document.createElement('div');
                taskElement.className = 'flex items-center justify-between rounded-lg border bg-white p-4 mb-2 shadow-sm';
                taskElement.dataset.rowNumber = task.rowNumber;
                taskElement.dataset.status = task.status;
                
                const statusColor = task.status === 'Cumplida' ? 'bg-green-500' : 'bg-amber-500';
                const date = parseDate(task.dueDate);
                const formattedDate = date ? date.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }).replace('.', '') : 'Sin fecha';
                
                taskElement.innerHTML = `
                    <div class="flex items-center">
                        <div class="status-circle h-6 w-6 cursor-pointer rounded-full ${statusColor}" title="Cambiar estado"></div>
                        <p class="ml-4 text-slate-700">${task.description}</p>
                    </div>
                    <span class="text-sm font-medium text-slate-500">${formattedDate}</span>
                `;
                monthTasksContainer.appendChild(taskElement);
            });
            taskListContainer.appendChild(monthTasksContainer);
        }
    };
    // --- FIN DE LA FUNCIÓN ---

    const loadExpectedResult = async () => {
        const weekId = getCurrentWeekId();
        try {
            const response = await fetch(`/.netlify/functions/getResultados?scope=user&email=${userEmail}&weekId=${weekId}`);
            const results = await response.json();
            if (results.length > 0) {
                expectedResultTextarea.value = results[0].expectedResult;
            } else {
                expectedResultTextarea.value = '';
            }
        } catch (error) {
            console.error('Error al cargar resultado:', error);
        }
    };

    if (saveResultButton) {
        saveResultButton.addEventListener('click', async () => {
            const expectedResult = expectedResultTextarea.value.trim();
            if (!expectedResult) {
                alert('Por favor, describe el resultado esperado.');
                return;
            }
            const weekId = getCurrentWeekId();
            saveResultButton.disabled = true;
            saveResultButton.textContent = 'Guardando...';
            try {
                await fetch('/.netlify/functions/updateResultados', {
                    method: 'POST',
                    body: JSON.stringify({ action: 'saveResult', weekId, email: userEmail, expectedResult }),
                });
                resultStatusMessage.textContent = '¡Guardado con éxito!';
                resultStatusMessage.className = 'mt-2 text-sm text-green-600';
            } catch (error) {
                console.error('Error al guardar el resultado:', error);
                resultStatusMessage.textContent = 'Error al guardar.';
                resultStatusMessage.className = 'mt-2 text-sm text-red-600';
            } finally {
                saveResultButton.disabled = false;
                saveResultButton.textContent = 'Guardar Resultado';
                setTimeout(() => { resultStatusMessage.textContent = ''; }, 3000);
            }
        });
    }

    if (addTaskForm) {
        addTaskForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const descriptionInput = document.getElementById('description');
            const dateInput = document.getElementById('due-date');
            const submitButton = addTaskForm.querySelector('button[type="submit"]');

            const description = descriptionInput.value.trim();
            const dueDate = dateInput.value;

            if (!description || !dueDate) {
                alert('Por favor, completa todos los campos para añadir la tarea.');
                return;
            }
            
            submitButton.disabled = true;
            submitButton.textContent = 'Guardando...';

            try {
                await fetch('/.netlify/functions/updateTask', {
                    method: 'POST',
                    body: JSON.stringify({ 
                        action: 'create', 
                        description, 
                        dueDate, 
                        assignedTo: userEmail 
                    }),
                });
                
                descriptionInput.value = '';
                dateInput.value = '';
                loadTasks();
            } catch (error) {
                console.error('Error al crear la tarea:', error);
                alert('No se pudo crear la tarea.');
            } finally {
                submitButton.disabled = false;
                submitButton.textContent = 'Guardar Tarea';
            }
        });
    }

    // --- LISTENER ACTUALIZADO PARA INCLUIR AMBAS FUNCIONES ---
    if (taskListContainer) {
        taskListContainer.addEventListener('click', async (event) => {
            // Lógica para actualizar estado
            if (event.target.classList.contains('status-circle')) {
                const taskElement = event.target.closest('div[data-row-number]');
                if (!taskElement) return;
                const rowNumber = taskElement.dataset.rowNumber;
                const currentStatus = taskElement.dataset.status;
                const newStatus = currentStatus === 'Pendiente' ? 'Cumplida' : 'Pendiente';
                try {
                    await fetch('/.netlify/functions/updateTask', {
                        method: 'POST',
                        body: JSON.stringify({ action: 'updateStatus', rowNumber, newStatus }),
                    });
                    loadTasks();
                } catch (error) {
                    console.error('Error al actualizar el estado:', error);
                    alert('No se pudo actualizar la tarea.');
                }
            }

            // Lógica para desplegar y ocultar tareas por mes
            if (event.target.tagName === 'H3') {
                const month = event.target.textContent;
                const monthId = `tasks-${month.replace(/[^a-zA-Z0-9]/g, '-')}`;
                const monthTasksContainer = document.getElementById(monthId);
                if (monthTasksContainer) {
                    const isHidden = monthTasksContainer.style.display === 'none';
                    monthTasksContainer.style.display = isHidden ? 'block' : 'none';
                }
            }
        });
    }
    
    loadTasks();
    loadExpectedResult();
});

