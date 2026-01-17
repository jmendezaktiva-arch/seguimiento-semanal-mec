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
const sheetName = 'Agenda'; // La nueva hoja donde se guardarán los datos

exports.handler = async (event) => {
  const { date } = event.queryStringParameters;

  if (!date) {
    return { statusCode: 400, body: JSON.stringify({ error: 'La fecha es requerida.' }) };
  }

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:E`, // Columnas: Fecha, Moderador, Temas, Asistentes, Conclusiones
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) {
      return { statusCode: 404, body: JSON.stringify({ message: 'No hay datos de agenda.' }) };
    }

    // Busca la fila que coincida con la fecha
    const agendaRow = rows.slice(1).find(row => row[0] === date);

    if (agendaRow) {
      const agendaData = {
        date: agendaRow[0],
        moderator: agendaRow[1] || '',
        topics: agendaRow[2] || '',
        attendees: agendaRow[3] || '',
        conclusions: agendaRow[4] || '',
      };
      return { statusCode: 200, body: JSON.stringify(agendaData) };
    } else {
      return { statusCode: 404, body: JSON.stringify({ message: 'No se encontró agenda para esa fecha.' }) };
    }
  } catch (error) {
    // Si la hoja no existe, Google API devuelve un error específico que podemos manejar
    if (error.code === 400 && error.errors[0].message.includes('Unable to parse range')) {
        return { statusCode: 404, body: JSON.stringify({ message: 'La hoja de Agenda no existe o está vacía.' }) };
    }
    console.error('Error al leer la agenda:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo obtener la agenda.' }) };
  }
};
