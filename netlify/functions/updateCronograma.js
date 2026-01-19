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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { nombre, responsable, fechaFin } = JSON.parse(event.body);
    const fechaInicio = new Date().toLocaleDateString('es-ES'); // Fecha de hoy automática
    
    // Generamos un ID basado en el tiempo para que sea único
    const idHito = `H-${Date.now().toString().slice(-4)}`;

    const newRow = [idHito, nombre, responsable, fechaInicio, fechaFin, 'En Proceso'];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: 'Cronograma!A:F',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newRow] },
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'Hito creado con éxito' }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};