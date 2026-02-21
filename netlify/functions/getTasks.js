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
      // RANGO EXPANDIDO: Leemos hasta la columna K (11 columnas)
      range: `${sheetName}!A:K`, 
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return { statusCode: 200, body: JSON.stringify([]) };

    const allTasks = rows.slice(1).map((row, index) => ({
      rowNumber: index + 2,
      id: row[0],
      description: row[1],
      assignedTo: row[2],
      startDate: row[3] || '',
      dueDate: row[4] || '',      // E: Esta sigue siendo nuestra "Fecha Original"
      status: row[5] || '',
      hitoId: row[6] || '',
      area: row[7] || '',
      proyecto: row[8] || '',
      asignadoPor: row[9] || '',
      rescheduledDate: row[10] || '' // K: Nueva columna para reprogramación
    }));

    // Capturamos el rol desde los parámetros (por defecto es 'Usuario' para mayor seguridad)
    const userRole = event.queryStringParameters.role || 'Usuario';

    let filteredTasks;

    // REGLA DE NEGOCIO: Solo un Admin con el scope 'all' puede ver todo.
    if (userRole === 'Admin' && scope === 'all') {
      filteredTasks = allTasks;
    } else {
      // En cualquier otro caso (es Usuario o el Admin quiere ver solo lo suyo), filtramos por email.
      filteredTasks = allTasks.filter(t => 
        t.assignedTo && t.assignedTo.toLowerCase() === (userEmail ? userEmail.toLowerCase() : '')
      );
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify(filteredTasks) 
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};