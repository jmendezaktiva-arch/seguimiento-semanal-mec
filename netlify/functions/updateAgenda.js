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
const sheetName = 'Agenda';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const data = JSON.parse(event.body);
    const { date, moderator, topics, attendees, conclusions } = data;

    // Obtener todos los datos para verificar si la fecha ya existe
    let existingRows = [];
    try {
        const getResponse = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range: `${sheetName}!A:A`, // Solo necesitamos la columna de fechas
        });
        existingRows = getResponse.data.values || [];
    } catch(e) {
        // Ignoramos el error si la hoja no existe, la crearemos implicitamente al añadir datos.
        console.log("La hoja 'Agenda' probablemente no existe. Se creará una nueva.");
    }
    

    const rowIndex = existingRows.findIndex(row => row[0] === date);
    const newRowData = [date, moderator, topics, attendees, conclusions];

    if (rowIndex !== -1) {
      // La fecha existe, actualizamos la fila (rowIndex es 0-based, pero sheets es 1-based, y hay cabecera)
      const targetRow = rowIndex + 1; // +1 porque findIndex es 0-based
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${targetRow}:E${targetRow}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [newRowData],
        },
      });
    } else {
      // La fecha no existe, agregamos una nueva fila
      // Primero, verificamos si la hoja está vacía para agregar encabezados
      if (existingRows.length === 0) {
        await sheets.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheetName}!A1`,
          valueInputOption: 'USER_ENTERED',
          resource: {
            values: [['Fecha', 'Moderador', 'Temas', 'Asistentes', 'Conclusiones']],
          },
        });
      }
      // Ahora agregamos los datos
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:E`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [newRowData],
        },
      });
    }

    return { statusCode: 200, body: JSON.stringify({ message: 'Agenda guardada correctamente.' }) };

  } catch (error) {
    console.error('Error al guardar en la agenda:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo guardar la agenda.' }) };
  }
};
