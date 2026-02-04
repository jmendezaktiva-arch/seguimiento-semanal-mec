// netlify/functions/getUsers.js

const { google } = require('googleapis');

exports.handler = async (event, context) => {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    // CONSULTA MULTI-HOJA: Recuperamos Usuarios (B:D) y Configuración de Áreas (A2:A)
    const response = await sheets.spreadsheets.batchGet({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      ranges: ['Usuarios!B2:D', 'Config_Areas!A2:A'],
    });

    const userRows = response.data.valueRanges[0].values || [];
    const areaRows = response.data.valueRanges[1].values || [];

    // Mapeo de Usuarios con su Área correspondiente
    const users = userRows.map(row => ({
      email: row[0] ? row[0].toLowerCase() : '',
      role: row[1] || 'Usuario',
      area: row[2] || 'General' // Recuperamos la columna D
    }));

    // Mapeo de Áreas maestras desde Config_Areas
    const areas = areaRows.map(row => row[0]).filter(Boolean);

    return {
      statusCode: 200,
      body: JSON.stringify({ users, areas }),
    };

  } catch (error) {
    console.error('Error al leer la hoja de usuarios:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudo conectar con la base de datos de usuarios.' }),
    };
  }
};