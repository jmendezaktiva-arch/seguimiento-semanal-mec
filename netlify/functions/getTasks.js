// netlify/functions/getTasks.js
const { google } = require('googleapis');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetName = 'Tareas';

exports.handler = async (event) => {
  const userEmail = event.queryStringParameters.email;
  const scope = event.queryStringParameters.scope || 'user';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      // CORRECCIÓN: Cambiado de A:E a A:F para incluir el ID del Hito
      range: `${sheetName}!A:F`, 
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return { statusCode: 200, body: JSON.stringify([]) };

    const allTasks = rows.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      id: row[0],
      description: row[1],
      assignedTo: row[2],
      dueDate: row[3],
      status: row[4],
      // CORRECCIÓN: Ahora mapeamos la sexta columna (F)
      hitoId: row[5] || '' 
    }));

    if (scope === 'all') {
      return { statusCode: 200, body: JSON.stringify(allTasks) };
    } else {
      const userTasks = allTasks.filter(task => task.assignedTo && task.assignedTo.toLowerCase() === userEmail.toLowerCase());
      return { statusCode: 200, body: JSON.stringify(userTasks) };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};