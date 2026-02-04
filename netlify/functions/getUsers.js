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

    // CONSULTA INDIVIDUAL (Más segura): Primero los usuarios
    const userRes = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Usuarios!B2:D', 
    });

    const userRows = userRes.data.values || [];
    const users = userRows.map(row => ({
      email: row[0] ? row[0].toLowerCase() : '',
      role: row[1] || 'Usuario',
      area: row[2] || 'General'
    }));

    // CONSULTA OPCIONAL: Áreas (Si falla, el sistema sigue funcionando)
    let areas = [];
    try {
      const areaRes = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEET_ID,
        range: 'Config_Areas!A2:A',
      });
      areas = (areaRes.data.values || []).map(row => row[0]).filter(Boolean);
    } catch (e) {
      console.warn("Aviso: No se encontró la pestaña 'Config_Areas'. Usando áreas de usuarios.");
      areas = [...new Set(users.map(u => u.area))];
    }

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