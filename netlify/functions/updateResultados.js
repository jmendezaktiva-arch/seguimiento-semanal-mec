// netlify/functions/updateResultados.js

const { google } = require('googleapis');

// Configuración de autenticación (sin cambios)
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const sheets = google.sheets({ version: 'v4', auth });
const spreadsheetId = process.env.GOOGLE_SHEET_ID;
const sheetName = 'Resultados';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    // 1. Extraemos TODOS los posibles datos, incluyendo el 'email' antiguo.
    const { action, userEmail, email, weekId, expectedResult, rowNumber, evaluation } = JSON.parse(event.body);

    // 2. Acción para guardar un nuevo resultado (CORREGIDA)
    if (action === 'saveResult') {
      
      // ---- INICIO DE LA SOLUCIÓN ----
      // Verificamos si 'userEmail' existe; si no, usamos la variable 'email' antigua.
      const emailParaGuardar = userEmail || email;
      // ---- FIN DE LA SOLUCIÓN ----

      // Creamos la fila usando la variable correcta que ahora sí contiene el correo.
      const newRow = [weekId, emailParaGuardar, expectedResult, '']; 

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:D`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [newRow] },
      });
      
      return { statusCode: 200, body: JSON.stringify({ message: 'Resultado guardado correctamente.' }) };
    }

    // 3. Acción para guardar una evaluación (sin cambios)
    if (action === 'saveEvaluation') {
        if (!rowNumber) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Número de fila no encontrado para evaluar.'}) };
        }
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${sheetName}!D${rowNumber}`,
            valueInputOption: 'USER_ENTERED',
            resource: { values: [[evaluation]] },
        });
        return { statusCode: 200, body: JSON.stringify({ message: 'Evaluación guardada.' }) };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Acción no válida.' }) };

  } catch (error) {
    console.error('Error en la función de resultados:', error);
    return { statusCode: 500, body: JSON.stringify({ error: 'No se pudo actualizar la hoja de resultados.' }) };
  }
};