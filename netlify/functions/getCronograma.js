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

    const headers = rows[0]; 
    
    // ÚNICA FUENTE DE VERDAD PARA EL MAPEO
    const findCol = (name) => headers.findIndex(h => h && h.toLowerCase().trim().includes(name.toLowerCase()));

    const col = {
      id: findCol('id'),
      nombre: findCol('nombre'),
      resp: findCol('responsable'),
      ini: findCol('inicio'),
      fin: findCol('fin'),
      est: findCol('estado'),
      area: findCol('area'),
      proy: findCol('proyecto')
    };

    const allHitos = rows.slice(1).map(row => ({
      id: col.id !== -1 ? (row[col.id] || '') : '',
      nombre: col.nombre !== -1 ? (row[col.nombre] || '') : '',
      responsable: col.resp !== -1 ? (row[col.resp] || '') : '',
      fechaInicio: col.ini !== -1 ? (row[col.ini] || '') : '',
      fechaFin: col.fin !== -1 ? (row[col.fin] || '') : '',
      estado: col.est !== -1 ? (row[col.est] || '') : '',
      area: col.area !== -1 ? (row[col.area] || '') : '',
      proyecto: col.proy !== -1 ? (row[col.proy] || '') : ''
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