// netlify/functions/updateTask.js

const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetName = 'Tareas';

exports.handler = async (event) => {
  // Solo permitimos peticiones POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    console.log('Función updateTask iniciada.');
    console.log('Datos recibidos (body):', event.body);

    const data = JSON.parse(event.body);
    console.log('Datos parseados:', data);

    // --- Lógica para ACTUALIZAR una tarea existente ---
    if (data.action === 'updateStatus') {
      console.log('Acción detectada: updateStatus');
      const { rowNumber, newStatus } = data;
      const range = `${sheetName}!E${rowNumber}`;
      console.log(`Actualizando rango ${range} a "${newStatus}"`);

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[newStatus]],
        },
      });
      
      console.log('Respuesta de la API de Google (update):', response.data);
      return { statusCode: 200, body: JSON.stringify({ message: 'Tarea actualizada' }) };
    }

    // --- Lógica para CREAR una nueva tarea ---
    if (data.action === 'create') {
      console.log('Acción detectada: create');
      const { description, dueDate, assignedTo } = data;
      const newTaskId = Date.now().toString();
      const newRow = [newTaskId, description, assignedTo, dueDate, 'Pendiente'];
      console.log('Creando nueva fila:', newRow);

      const response = await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:E`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: {
          values: [newRow],
        },
      });

      console.log('Respuesta de la API de Google (append):', response.data);
      return { statusCode: 201, body: JSON.stringify({ message: 'Tarea creada' }) };
    }

    console.warn('Acción no reconocida:', data.action);
    return { statusCode: 400, body: JSON.stringify({ error: 'Acción no válida' }) };

  } catch (error) {
    console.error('--- ERROR EN LA FUNCIÓN updateTask ---');
    console.error('Error:', error);
    console.error('Stack:', error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudo actualizar la tarea. Revisa el log de la función en Netlify.' }),
    };
  }
};
