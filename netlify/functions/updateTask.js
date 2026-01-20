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
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const data = JSON.parse(event.body);

    if (data.action === 'updateStatus') {
      const { rowNumber, newStatus } = data;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!E${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[newStatus]] },
      });
      return { statusCode: 200, body: JSON.stringify({ message: 'Tarea actualizada' }) };
    }

    if (data.action === 'create') {
      const { description, dueDate, assignedTo, hitoId } = data;
      const newTaskId = Date.now().toString();
      
      // CORRECCIÓN: Incluimos hitoId en la sexta posición para que se guarde en la Columna F
      const newRow = [newTaskId, description, assignedTo, dueDate, 'Pendiente', hitoId || ''];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        // CORRECCIÓN: Cambiado de A:E a A:F
        range: `${sheetName}!A:F`, 
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [newRow] },
      });

      return { statusCode: 201, body: JSON.stringify({ message: 'Tarea creada' }) };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};