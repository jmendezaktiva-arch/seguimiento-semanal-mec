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

  // Capturamos parámetros necesarios para la lógica de seguridad y visualización
  const userRole = event.queryStringParameters.role || 'Usuario';
  const scope = event.queryStringParameters.scope || 'user';

  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      // AMPLIADO: Rango A:H para capturar Área (G) y Proyecto (H)
      range: 'Cronograma!A:H', 
    });

    const rows = response.data.values;
    if (!rows || rows.length <= 1) return { statusCode: 200, body: JSON.stringify([]) };

    const headers = rows[0]; // Capturamos la primera fila (encabezados)
    
    // Mapeo dinámico: Buscamos en qué posición está cada columna
    const getIdx = (name) => headers.findIndex(h => h.toLowerCase().includes(name.toLowerCase()));
    
    const idx = {
      id: getIdx('ID'),
      nombre: getIdx('Nombre'),
      responsable: getIdx('Responsable'),
      inicio: getIdx('Inicio'),
      fin: getIdx('Fin'),
      estado: getIdx('Estado'),
      area: getIdx('Area'),
      proyecto: getIdx('Proyecto')
    };

    const allHitos = rows.slice(1).map(row => ({
      id: row[idx.id] || '',
      nombre: row[idx.nombre] || '',
      responsable: row[idx.responsable] || '',
      fechaInicio: row[idx.inicio] || '',
      fechaFin: row[idx.fin] || '',
      estado: row[idx.estado] || '',
      area: row[idx.area] || '',
      proyecto: row[idx.proyecto] || '' // Ahora lo busca por nombre, no por posición 7
    }));

    let filteredHitos;

    // ADUANA DE SEGURIDAD: 
    // Si es Admin y pide todo, entregamos todo.
    // En cualquier otro caso, filtramos estrictamente por el email del responsable.
    if (userRole === 'Admin' && scope === 'all') {
      filteredHitos = allHitos;
    } else {
      filteredHitos = allHitos.filter(h => 
        h.responsable && h.responsable.toLowerCase() === (userEmail ? userEmail.toLowerCase() : '')
      );
    }

    return { 
      statusCode: 200, 
      body: JSON.stringify(filteredHitos) 
    };
  } catch (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};