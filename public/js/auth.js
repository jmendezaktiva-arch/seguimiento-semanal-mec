// public/js/auth.js

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('login-form');
  const errorMessageElement = document.getElementById('error-message');
  const submitButton = loginForm.querySelector('button[type="submit"]');

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      errorMessageElement.textContent = '';
      submitButton.disabled = true;
      submitButton.textContent = 'Verificando...';

      const email = event.target.email.value.trim().toLowerCase();
      if (!email) {
        errorMessageElement.textContent = 'Por favor, introduce un correo electrónico.';
        submitButton.disabled = false;
        submitButton.textContent = 'Ingresar';
        return;
      }

      try {
        const response = await fetch('/.netlify/functions/getUsers');
        if (!response.ok) {
          throw new Error('Error al conectar con el servidor.');
        }

        const authorizedUsers = await response.json();
        // CAMBIO: Buscamos el objeto de usuario completo, no solo el email
        const currentUser = authorizedUsers.find(user => user.email === email);

        if (currentUser) {
          // CAMBIO: Guardamos el email Y el rol en localStorage
          localStorage.setItem('userEmail', currentUser.email);
          localStorage.setItem('userRole', currentUser.role);
          window.location.href = '/tasks.html';
        } else {
          errorMessageElement.textContent = 'Acceso denegado. El correo no está registrado.';
        }
      } catch (error) {
        console.error('Error en el proceso de login:', error);
        errorMessageElement.textContent = 'Ocurrió un error inesperado. Inténtalo de nuevo.';
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Ingresar';
      }
    });
  }
});
