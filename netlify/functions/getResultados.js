// netlify/functions/getResultados.js

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
const sheetName = 'Resultados';

exports.handler = async (event) => {
  const scope = event.queryStringParameters.scope || 'user';
  const email = event.queryStringParameters.email;
  const weekId = event.queryStringParameters.weekId;

  if (!email || !weekId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email y weekId son requeridos.' }) };
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:D`,
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }

    const results = rows.slice(1).map((row, index) => ({
        rowNumber: index + 2,
        weekId: row[0],
        assignedTo: row[1],
        expectedResult: row[2],
        evaluation: row[3] || '',
    }));

    const weekResults = results.filter(r => r.weekId === weekId);

    if (scope === 'all') {
      return { statusCode: 200, body: JSON.stringify(weekResults) };
    } else {
      // ---- INICIO DE LA CORRECCIÓN ----
      // Usamos .filter() en lugar de .find() para que la respuesta SIEMPRE sea un array.
      const userResults = weekResults.filter(r => r.assignedTo && r.assignedTo.toLowerCase() === email.toLowerCase());
      return { statusCode: 200, body: JSON.stringify(userResults) };
      // ---- FIN DE LA CORRECCIÓN ----
    }

  } catch (error) {
    console.error('Error al leer los resultados:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudieron obtener los resultados.' }) };
  }
};