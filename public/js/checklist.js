// public/js/checklist.js

document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        window.location.href = '/index.html';
        return;
    }

    const checklistContainer = document.getElementById('checklist-container');
    const saveButton = document.getElementById('save-checklist-button');
    const saveStatusMessage = document.getElementById('save-status-message');
    const currentDateElement = document.getElementById('current-date');

    const today = new Date();
    const dateString = today.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
    const dateId = today.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    currentDateElement.textContent = dateString;
    
    let activities = [];

    // [INICIO DE MODIFICACIÓN - Funciones de Persistencia Local]

    // Generamos una clave única para guardar los datos de HOY de ESTE usuario
    const getStorageKey = () => `checklist_backup_${userEmail}_${dateId}`;

    // Función para guardar el estado actual de 'activities' en el navegador
    const saveToLocalStorage = () => {
        const dataToSave = activities.map(a => ({
            activityId: a.id,
            isPlanned: a.isPlanned, // Guardamos estado actual
            isCompleted: a.isCompleted
        }));
        localStorage.setItem(getStorageKey(), JSON.stringify(dataToSave));
    };

    // Función para combinar datos del servidor con la copia local
    const mergeWithLocalData = (serverActivities) => {
        const localDataString = localStorage.getItem(getStorageKey());
        if (!localDataString) return serverActivities;

        try {
            const localData = JSON.parse(localDataString);
            // Creamos un mapa para búsqueda rápida
            const localMap = new Map(localData.map(item => [item.activityId, item]));

            return serverActivities.map(serverActivity => {
                const localActivity = localMap.get(serverActivity.id);
                if (localActivity) {
                    // Si existe en local, usamos los valores locales (son más recientes)
                    return {
                        ...serverActivity,
                        isPlanned: localActivity.isPlanned,
                        isCompleted: localActivity.isCompleted
                    };
                }
                return serverActivity;
            });
        } catch (e) {
            console.error("Error al leer datos locales:", e);
            return serverActivities;
        }
    };
// [FIN DE MODIFICACIÓN]

    // [INICIO MODIFICACIÓN: public/js/checklist.js - renderChecklist]

    // [INICIO MODIFICACIÓN: public/js/checklist.js]

    const renderChecklist = () => {
        checklistContainer.innerHTML = '';
        if (activities.length === 0) {
            checklistContainer.innerHTML = '<p class="text-center text-slate-500">No hay actividades definidas.</p>';
            return;
        }

        // 1. Definir el orden de los bloques
        const blockOrder = ['Apertura', 'Durante el día', 'Cierre'];
        
        // 2. Agrupar actividades por bloque
        const groupedActivities = {
            'Apertura': [],
            'Durante el día': [],
            'Cierre': [],
            'Otros': [] // Por si alguna no tiene bloque definido
        };

        activities.forEach(activity => {
            // Normalizamos el texto para evitar errores por mayúsculas/minúsculas
            const blockName = activity.block ? activity.block.trim() : 'Otros';
            // Buscamos la clave correcta ignorando mayúsculas
            const targetKey = Object.keys(groupedActivities).find(k => k.toLowerCase() === blockName.toLowerCase()) || 'Otros';
            groupedActivities[targetKey].push(activity);
        });

        // [INICIO MODIFICACIÓN: public/js/checklist.js]

        // 3. Renderizar cada bloque
        blockOrder.forEach(blockName => {
            const blockActivities = groupedActivities[blockName];
            if (blockActivities && blockActivities.length > 0) {
                
                // --- CAMBIO DE ESTILO AQUÍ ---
                // Transformamos el título en una barra sólida
                const blockHeader = document.createElement('div');
                blockHeader.className = 'mt-8 mb-0 rounded-t-lg bg-slate-600 px-4 py-3 shadow-sm';
                blockHeader.innerHTML = `
                    <h3 class="text-base font-bold text-white uppercase tracking-wide">
                        ${blockName}
                    </h3>
                `;
                checklistContainer.appendChild(blockHeader);
                // -----------------------------

                // Crear tabla para este bloque
                // NOTA: Quitamos el margen superior (mt-6) de la tabla anterior y 
                // agregamos 'rounded-b-lg' para que encaje con el header
                const table = document.createElement('table');
                table.className = 'w-full divide-y divide-slate-200 border-x border-b border-slate-200 rounded-b-lg mb-6 overflow-hidden'; // Bordes para cerrar la caja
                table.innerHTML = `
                    <thead class="bg-slate-50">
                        <tr>
                            <th class="px-3 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Actividad</th>
                            <th class="hidden sm:table-cell px-2 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500 w-24">Frecuencia</th>
                            <th class="px-2 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500 w-20">¿Aplica?</th>
                            <th class="px-2 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500 w-20">Listo</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-slate-200 bg-white">
                    </tbody>
                `;
                
                const tbody = table.querySelector('tbody');

                // (El resto del bucle forEach de actividades se mantiene igual)
                blockActivities.forEach(activity => {
                    const row = document.createElement('tr');
                    row.dataset.activityId = activity.id;
                    row.innerHTML = `
                        <td class="whitespace-normal px-3 py-4 text-sm font-medium text-slate-900 break-words max-w-[150px] sm:max-w-none">
                            ${activity.description}
                        </td>
                        <td class="hidden sm:table-cell whitespace-nowrap px-2 py-4 text-center text-sm text-slate-500">
                            ${activity.frequency}
                        </td>
                        <td class="px-2 py-4 text-center">
                            <input type="checkbox" class="h-6 w-6 rounded border-slate-300 text-blue-600 focus:ring-blue-500 custom-checkbox cursor-pointer" data-type="planned" ${activity.isPlanned ? 'checked' : ''}>
                        </td>
                        <td class="px-2 py-4 text-center">
                            <input type="checkbox" class="h-6 w-6 rounded border-slate-300 text-blue-600 focus:ring-blue-500 custom-checkbox cursor-pointer" data-type="completed" ${activity.isCompleted ? 'checked' : ''}>
                        </td>
                    `;
                    tbody.appendChild(row);
                });

                checklistContainer.appendChild(table);
            }
        });

// [FIN MODIFICACIÓN]
        
        // Manejo de actividades sin bloque (Opcional, si quieres ver las huerfanas)
        if (groupedActivities['Otros'].length > 0) {
             // ... (Lógica similar para renderizar 'Otros' si es necesario)
        }
    };

// [FIN MODIFICACIÓN]

// [FIN MODIFICACIÓN]

    // [MODIFICACIÓN EN loadChecklist]
    const loadChecklist = async () => {
        try {
            const response = await fetch(`/.netlify/functions/getChecklist?email=${userEmail}&dateId=${dateId}`);
            if (!response.ok) throw new Error('No se pudo cargar el checklist.');
            
            const serverData = await response.json(); //
            
            // AQUÍ ESTÁ EL CAMBIO CLAVE:
            // Antes de asignar a 'activities', combinamos con lo que haya en LocalStorage
            activities = mergeWithLocalData(serverData);
            
            renderChecklist();

        } catch (error) {
            console.error(error);
            checklistContainer.innerHTML = '<p class="text-center text-red-500">Error al cargar las actividades.</p>';
        }
    };

    // [INICIO DE NUEVO BLOQUE DE CÓDIGO - Listener de Cambios]
    
    // Escuchar cambios en cualquier checkbox dentro de la tabla
    checklistContainer.addEventListener('change', (event) => {
        if (event.target.classList.contains('custom-checkbox')) {
            const row = event.target.closest('tr');
            const activityId = row.dataset.activityId;
            const type = event.target.dataset.type; // 'planned' o 'completed'
            const isChecked = event.target.checked;

            // 1. Actualizar el array en memoria (variable global 'activities')
            const activity = activities.find(a => a.id === activityId);
            if (activity) {
                if (type === 'planned') activity.isPlanned = isChecked;
                if (type === 'completed') activity.isCompleted = isChecked;
                
                // 2. Guardar inmediatamente en LocalStorage
                saveToLocalStorage();
            }
        }
    });

// [FIN DE NUEVO BLOQUE]

    saveButton.addEventListener('click', async () => {
        saveButton.disabled = true;
        saveButton.textContent = 'Guardando...';
        saveStatusMessage.textContent = '';

        const progressToSave = activities.map(activity => {
             const row = checklistContainer.querySelector(`tr[data-activity-id='${activity.id}']`);
             if (!row) return null;

             const isPlanned = row.querySelector('input[data-type="planned"]').checked;
             const isCompleted = row.querySelector('input[data-type="completed"]').checked;
             
             return {
                 activityId: activity.id,
                 isPlanned,
                 isCompleted
             };
        }).filter(Boolean); // Filtrar nulos si alguna fila no se encontrara

        try {
            await fetch('/.netlify/functions/updateChecklist', {
                method: 'POST',
                body: JSON.stringify({
                    email: userEmail,
                    dateId: dateId,
                    progress: progressToSave
                }),
            });
            saveStatusMessage.textContent = '¡Avance guardado con éxito!';
            saveStatusMessage.className = 'mt-2 text-sm text-green-600 text-right';

        } catch (error) {
            console.error('Error al guardar:', error);
            saveStatusMessage.textContent = 'No se pudo guardar el avance.';
            saveStatusMessage.className = 'mt-2 text-sm text-red-600 text-right';
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Guardar Avance';
            setTimeout(() => { saveStatusMessage.textContent = ''; }, 3000);
        }
    });

    loadChecklist();
});
