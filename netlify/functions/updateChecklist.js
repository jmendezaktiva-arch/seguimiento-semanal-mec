// netlify/functions/updateChecklist.js

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
const logSheetName = 'ChecklistLog';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { email, dateId, progress } = JSON.parse(event.body);

    // 1. Leer la hoja de logs para encontrar y borrar los registros antiguos del usuario para este día
    const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${logSheetName}!A:E`,
    });

    const rows = response.data.values || [];
    const rowsToDelete = [];
    
    // Empezamos desde el final para no afectar los índices al eliminar
    for (let i = rows.length - 1; i >= 1; i--) {
        const row = rows[i];
        if (row[0] === dateId && row[1] === email) {
            rowsToDelete.push({
                deleteDimension: {
                    range: {
                        sheetId: await getSheetId(logSheetName),
                        dimension: "ROWS",
                        startIndex: i,
                        endIndex: i + 1
                    }
                }
            });
        }
    }

    if (rowsToDelete.length > 0) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: { requests: rowsToDelete }
        });
    }

    // 2. Añadir las nuevas filas con el progreso actualizado
    const newRows = progress.map(item => [
      dateId,
      email,
      item.activityId,
      item.isPlanned,
      item.isCompleted,
    ]);

    if (newRows.length > 0) {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${logSheetName}!A:E`,
            valueInputOption: 'USER_ENTERED',
            insertDataOption: 'INSERT_ROWS',
            resource: {
                values: newRows,
            },
        });
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Checklist actualizado' }) };

  } catch (error) {
    console.error('Error al actualizar checklist:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudo guardar el progreso del checklist.' }),
    };
  }
};

// Helper para obtener el ID de una hoja por su nombre
async function getSheetId(sheetName) {
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const sheet = res.data.sheets.find(s => s.properties.title === sheetName);
    return sheet ? sheet.properties.sheetId : null;
}
