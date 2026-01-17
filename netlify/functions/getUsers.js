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

    // CAMBIO: Leemos las columnas B (Email) y C (Rol)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Usuarios!B2:C', 
    });

    const rows = response.data.values;
    if (rows && rows.length) {
      // CAMBIO: Creamos un array de objetos de usuario con email y rol
      const users = rows.map(row => ({
        email: row[0] ? row[0].toLowerCase() : '',
        role: row[1] || 'Usuario', // Si el rol no está definido, se asume 'Usuario'
      }));
      return {
        statusCode: 200,
        body: JSON.stringify(users),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify([]),
    };

  } catch (error) {
    console.error('Error al leer la hoja de usuarios:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudo conectar con la base de datos de usuarios.' }),
    };
  }
};
