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

exports.handler = async (event) => {
  const userEmail = event.queryStringParameters.email;

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Cronograma!A:F', // ID, Nombre, Responsable, Inicio, Fin, Estado
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return { statusCode: 200, body: JSON.stringify([]) };

    const allHitos = rows.slice(1).map(row => ({
      id: row[0],
      nombre: row[1],
      responsable: row[2],
      fechaInicio: row[3],
      fechaFin: row[4],
      estado: row[5]
    }));

    // Si pasamos un email, filtramos solo lo que le toca a esa persona
    const filteredHitos = userEmail 
      ? allHitos.filter(h => h.responsable && h.responsable.toLowerCase() === userEmail.toLowerCase())
      : allHitos;

    return { statusCode: 200, body: JSON.stringify(filteredHitos) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};