document.addEventListener('DOMContentLoaded', () => {
    const userEmail = localStorage.getItem('userEmail');
    if (!userEmail) {
        window.location.href = '/index.html';
        return;
    }

    // Elementos del DOM
    const meetingDateInput = document.getElementById('meeting-date');
    const moderatorSelect = document.getElementById('moderator');
    const topicsTextarea = document.getElementById('topics');
    const attendeesSelect = document.getElementById('attendees');
    const conclusionsTextarea = document.getElementById('conclusions');
    const saveButton = document.getElementById('save-agenda-button');
    const statusMessage = document.getElementById('save-status-message');

    // Inicializar fecha
    const today = new Date().toISOString().split('T')[0];
    meetingDateInput.value = today;

    // --- Cargar datos iniciales ---

    const loadUsers = async () => {
        try {
            const response = await fetch('/.netlify/functions/getUsers');
            const users = await response.json();
            
            moderatorSelect.innerHTML = '<option value="">Selecciona un moderador</option>';
            attendeesSelect.innerHTML = '';

            users.forEach(user => {
                if (user.email) {
                    const option = document.createElement('option');
                    option.value = user.email;
                    option.textContent = user.email;
                    moderatorSelect.appendChild(option.cloneNode(true));
                    attendeesSelect.appendChild(option);
                }
            });
        } catch (error) {
            console.error('Error al cargar usuarios:', error);
            moderatorSelect.innerHTML = '<option>Error al cargar usuarios</option>';
        }
    };

    const loadAgenda = async (date) => {
        if (!date) return;
        
        // Limpiar formulario antes de cargar
        moderatorSelect.value = '';
        topicsTextarea.value = '';
        conclusionsTextarea.value = '';
        [...attendeesSelect.options].forEach(opt => opt.selected = false);
        statusMessage.textContent = '';

        try {
            const response = await fetch(`/.netlify/functions/getAgenda?date=${date}`);
            if (response.status === 404) {
                console.log('No hay agenda para esta fecha, se puede crear una nueva.');
                return;
            }
            const agenda = await response.json();
            
            if (agenda.moderator) {
                moderatorSelect.value = agenda.moderator;
                topicsTextarea.value = agenda.topics;
                conclusionsTextarea.value = agenda.conclusions;
                
                const attendees = agenda.attendees ? agenda.attendees.split(',').map(e => e.trim()) : [];
                [...attendeesSelect.options].forEach(opt => {
                    if (attendees.includes(opt.value)) {
                        opt.selected = true;
                    }
                });
            }
        } catch (error) {
            console.error('Error al cargar la agenda:', error);
            statusMessage.textContent = 'Error al cargar datos de la agenda.';
            statusMessage.className = 'mt-2 text-sm text-red-600 text-right';
        }
    };

    // --- Event Listeners ---

    meetingDateInput.addEventListener('change', () => {
        loadAgenda(meetingDateInput.value);
    });

    saveButton.addEventListener('click', async () => {
        const selectedAttendees = [...attendeesSelect.selectedOptions].map(opt => opt.value);

        if (!meetingDateInput.value || !moderatorSelect.value) {
            alert('Por favor, selecciona una fecha y un moderador.');
            return;
        }

        const agendaData = {
            date: meetingDateInput.value,
            moderator: moderatorSelect.value,
            topics: topicsTextarea.value,
            attendees: selectedAttendees.join(', '),
            conclusions: conclusionsTextarea.value
        };

        saveButton.disabled = true;
        saveButton.textContent = 'Guardando...';
        statusMessage.textContent = '';

        try {
            const response = await fetch('/.netlify/functions/updateAgenda', {
                method: 'POST',
                body: JSON.stringify(agendaData)
            });

            if (!response.ok) {
                throw new Error('Error en la respuesta del servidor');
            }

            statusMessage.textContent = '¡Guardado con éxito!';
            statusMessage.className = 'mt-2 text-sm text-green-600 text-right';

        } catch (error) {
            console.error('Error al guardar la agenda:', error);
            statusMessage.textContent = 'Error al guardar. Inténtalo de nuevo.';
            statusMessage.className = 'mt-2 text-sm text-red-600 text-right';
        } finally {
            saveButton.disabled = false;
            saveButton.textContent = 'Guardar Orden del Día';
            setTimeout(() => { statusMessage.textContent = ''; }, 3000);
        }
    });

    // --- Inicialización ---
    const initialize = async () => {
        await loadUsers();
        await loadAgenda(today);
    };

    initialize();
});
