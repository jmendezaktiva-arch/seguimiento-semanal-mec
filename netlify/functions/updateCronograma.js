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
    // LÓGICA QUIRÚRGICA: Capturamos la fecha de inicio enviada por el front (si existe)
    const { nombre, responsable, fechaInicio, fechaFin, area, proyecto } = JSON.parse(event.body);
    
    // Si no viene fecha de inicio (ej. desde el creador de proyectos), usamos HOY en formato ISO universal
    const finalStartDate = fechaInicio || new Date().toISOString().split('T')[0];
    
    const idHito = `H-${Date.now().toString().slice(-4)}`;

    const newRow = [
      idHito, 
      nombre, 
      responsable, 
      finalStartDate, 
      fechaFin, 
      'En Proceso',
      area || '',
      proyecto || ''
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      // AMPLIADO: El rango de escritura ahora abarca hasta la columna H
      range: 'Cronograma!A:H',
      valueInputOption: 'USER_ENTERED',
      resource: { values: [newRow] },
    });

    // --- DISPARO DE NOTIFICACIÓN PARA HITOS ---
    try {
      const protocol = event.headers.host.includes('localhost') ? 'http' : 'https';
      const notificationUrl = `${protocol}://${event.headers.host}/.netlify/functions/sendNotification`;
      
      fetch(notificationUrl, {
        method: 'POST',
        body: JSON.stringify({ 
          description: `HITO ESTRATÉGICO: ${nombre}`, 
          dueDate: fechaFin, 
          assignedTo: responsable, 
          asignadoPor: 'Dirección (Admin)', // O capturar el email del admin
          area: area || 'General', 
          proyecto: proyecto || 'Cronograma Maestro' 
        })
      }).catch(err => console.error("Error en notificación de hito:", err));
    } catch (e) { console.error(e); }
    // --- FIN DISPARO ---

    return { statusCode: 200, body: JSON.stringify({ message: 'Hito creado con éxito' }) };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};