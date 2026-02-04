// netlify/functions/updateTask.js
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
const sheetName = 'Tareas';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const data = JSON.parse(event.body);

    if (data.action === 'updateStatus') {
      const { rowNumber, newStatus } = data;
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        // CORRECCIÓN QUIRÚRGICA: El estatus se movió de la E a la F por la nueva columna de inicio
        range: `${sheetName}!F${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [[newStatus]] },
      });
      return { statusCode: 200, body: JSON.stringify({ message: 'Tarea actualizada' }) };
    }

    if (data.action === 'create') {
      // INTEGRIDAD DE DATOS: Extraemos startDate del paquete recibido
      const { description, startDate, dueDate, assignedTo, hitoId, area, proyecto, asignadoPor } = data;
      const newTaskId = Date.now().toString();
      
      // MAPEO QUIRÚRGICO: Re-alineamos las columnas para incluir la nueva columna D
      const newRow = [
        newTaskId,        // A: ID
        description,      // B: Descripción
        assignedTo,       // C: Responsable
        startDate || '',  // D: Fecha Inicio (NUEVA)
        dueDate,          // E: Fecha Fin / Entrega
        'Pendiente',      // F: Estatus
        hitoId || '',     // G: ID Hito
        area || '',       // H: Área
        proyecto || '',   // I: Proyecto
        asignadoPor || '' // J: Quién asignó la tarea
      ];

      await sheets.spreadsheets.values.append({
        spreadsheetId,
        // ACTUALIZADO: El rango ahora llega hasta la columna J para cubrir todas las dimensiones
        range: `${sheetName}!A:J`, 
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        resource: { values: [newRow] },
      });

      // --- INICIO DISPARO DE NOTIFICACIÓN ---
      try {
        // Llamada asíncrona a la función de notificación (No bloqueamos la respuesta al usuario)
        // Usamos la URL local o de producción según corresponda
        const protocol = event.headers.host.includes('localhost') ? 'http' : 'https';
        const notificationUrl = `${protocol}://${event.headers.host}/.netlify/functions/sendNotification`;
        
        fetch(notificationUrl, {
          method: 'POST',
          body: JSON.stringify({ description, dueDate, assignedTo, asignadoPor, area, proyecto })
        }).catch(err => console.error("Error silencioso en notificación:", err));
        
      } catch (notifError) {
        console.error("Fallo al intentar disparar notificación:", notifError);
      }
      // --- FIN DISPARO DE NOTIFICACIÓN ---

      return { statusCode: 201, body: JSON.stringify({ message: 'Tarea creada y notificada' }) };

      return { statusCode: 201, body: JSON.stringify({ message: 'Tarea creada con éxito' }) };
    }

    if (data.action === 'updateFull') {
      // RE-ALINEACIÓN QUIRÚRGICA: Extraemos startDate e incluimos la columna J
      const { rowNumber, description, assignedTo, startDate, dueDate, status, hitoId, area, proyecto, asignadoPor } = data;
      
      const updatedValues = [
        description,      // B: Descripción
        assignedTo,       // C: Responsable
        startDate || '',  // D: Fecha Inicio
        dueDate,          // E: Fecha Fin / Entrega
        status,           // F: Estatus
        hitoId || '',     // G: ID Hito
        area || '',       // H: Área
        proyecto || '',   // I: Proyecto
        asignadoPor || '' // J: Quién asignó
      ];

      await sheets.spreadsheets.values.update({
        spreadsheetId,
        // RANGO EXPANDIDO: Ahora actualizamos desde B hasta J para cubrir la nueva estructura
        range: `${sheetName}!B${rowNumber}:J${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        resource: { values: [updatedValues] },
      });

      return { statusCode: 200, body: JSON.stringify({ message: 'Tarea modificada íntegramente' }) };
    }
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};