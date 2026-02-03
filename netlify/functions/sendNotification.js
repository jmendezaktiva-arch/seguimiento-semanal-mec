const nodemailer = require('nodemailer');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  try {
    const { description, dueDate, assignedTo, asignadoPor, area, proyecto } = JSON.parse(event.body);

    // 1. Configuración del "Transporte" (Tu correo organizacional)
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com', // O el host de tu correo organizacional
      port: 465,
      secure: true, // true para puerto 465
      auth: {
        user: process.env.EMAIL_USER, // Tu correo: ej. info@miempresacrece.com.mx
        pass: process.env.EMAIL_PASS  // Tu "Contraseña de Aplicación" de Google
      },
    });

    // 2. Construir el archivo .ics
    const dateFormatted = new Date(dueDate).toISOString().replace(/-|:|\.\d+/g, '').split('T')[0];
    const icsContent = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'BEGIN:VEVENT',
      `SUMMARY:📌 Tarea: ${description}`,
      `DTSTART;VALUE=DATE:${dateFormatted}`,
      `DESCRIPTION:Proyecto: ${proyecto}\\nÁrea: ${area}\\nAsignado por: ${asignadoPor}`,
      'END:VEVENT', 'END:VCALENDAR'
    ].join('\r\n');

    // 3. Enviar el correo
    await transporter.sendMail({
      from: `"Sistema Estratégico Mi Empresa Crece" <${process.env.EMAIL_USER}>`,
      to: assignedTo,
      subject: `🚀 Nueva Tarea: ${description.substring(0, 30)}...`,
      html: `<p>Se te ha asignado una nueva tarea estratégica.</p>
             <p><strong>Tarea:</strong> ${description}</p>
             <p><strong>Fecha:</strong> ${dueDate}</p>`,
      attachments: [
        {
          filename: 'invitacion.ics',
          content: icsContent,
          contentType: 'text/calendar'
        }
      ]
    });

    return { statusCode: 200, body: JSON.stringify({ message: 'Enviado con éxito' }) };
  } catch (error) {
    console.error(error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};