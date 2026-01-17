// netlify/functions/getChecklist.js

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
const activitiesSheetName = 'Checklist'; // Nueva hoja para definir actividades
const logSheetName = 'ChecklistLog';      // Nueva hoja para guardar el progreso

exports.handler = async (event) => {
  const { email, dateId } = event.queryStringParameters;

  if (!email || !dateId) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Email y dateId son requeridos.' }) };
  }

  try {
    // 1. Obtener todas las actividades definidas
    const activitiesResponse = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${activitiesSheetName}!A:Z`, // ID, Actividad, Frecuencia
    });
    const activityRows = activitiesResponse.data.values;
    if (!activityRows || activityRows.length <= 1) {
      return { statusCode: 200, body: JSON.stringify([]) };
    }
    // --- INICIO DE LA MODIFICACIÓN ---
    const headerRow = activityRows[0];
    const userEmailColumnIndex = headerRow.findIndex(headerCell => headerCell.toLowerCase() === email.toLowerCase());

    // Si no encontramos una columna para el email del usuario, no tendrá actividades.
    if (userEmailColumnIndex === -1) {
        console.warn(`No se encontró una columna para el usuario: ${email}`);
        return { statusCode: 200, body: JSON.stringify([]) };
    }

    // [INICIO MODIFICACIÓN: netlify/functions/getChecklist.js]

    const allActivities = activityRows.slice(1).map(row => {
        // La actividad solo se incluye si tiene una marca ('X') en la columna del usuario
        const isAssigned = row[userEmailColumnIndex] && row[userEmailColumnIndex].trim() !== '';
        
        if (isAssigned) {
            return {
                id: row[0],             // Columna A: ID
                description: row[1],    // Columna B: Actividad
                block: row[2],          // [NUEVO] Columna C: Bloque (Apertura, Día, Cierre)
                frequency: row[3],      // Columna D: Frecuencia (ajustado por la nueva columna)
            };
        }
        return null;
    }).filter(Boolean);

// [FIN MODIFICACIÓN]

    // 2. Obtener el registro de hoy para este usuario
    const logResponse = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${logSheetName}!A:E`
    });
    const logRows = logResponse.data.values || [];
    const userLogToday = logRows.slice(1).filter(row => row[0] === dateId && row[1] === email);
    
    const progressMap = new Map();
    userLogToday.forEach(row => {
        // row[2] = activityId, row[3] = isPlanned, row[4] = isCompleted
        progressMap.set(row[2], {
            isPlanned: row[3] === 'TRUE',
            isCompleted: row[4] === 'TRUE',
        });
    });

    // 3. Combinar la definición de actividades con el progreso guardado
    const result = allActivities.map(activity => {
        const progress = progressMap.get(activity.id) || { isPlanned: false, isCompleted: false };
        return {
            ...activity,
            ...progress,
        };
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };

  } catch (error) {
    console.error('Error al leer el checklist:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'No se pudieron obtener los datos del checklist.' }),
    };
  }
};
