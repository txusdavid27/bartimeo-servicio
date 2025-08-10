const express = require("express");
const path = require("path");
const { google } = require("googleapis");
const QRCode = require("qrcode");
const os = require("os");

const fs = require("fs");

// Usa la ruta del Secret File en Render
const credencialesPath = process.env.GOOGLE_CREDENTIALS_PATH || "/etc/secrets/credenciales.json";
const credenciales = JSON.parse(fs.readFileSync(credencialesPath, "utf8"));

const SHEET_ID = "1mhsGZUQNHTTTiAk0Z4KV14Y_JfYv62HewgUE0eTxnNc";

const auth = new google.auth.GoogleAuth({
  credentials: credenciales,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const app = express();
const PORT = 3000;

app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());

// Ruta: Obtener productos desde Google Sheets
app.get("/productos", async (req, res) => {
  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Productos!A1:D",
    });

    const rows = result.data.values;
    if (!rows || rows.length < 2) return res.status(200).json([]);

    const headers = rows[0];
    const productos = rows.slice(1).map(row => {
      const producto = {};
      headers.forEach((key, i) => {
        producto[key] = row[i] ?? null;
      });
      return producto;
    });

    res.json(productos);
  } catch (error) {
    console.error("❌ Error al leer productos desde Google Sheets:", error);
    res.status(500).json({ error: "No se pudo leer productos" });
  }
});

// Ruta: Guardar pedido en Google Sheets
app.post("/guardar-pedido", async (req, res) => {
  try {
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const { productosSeleccionados, total, cajero } = req.body;
    const ahora = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota" });

    // Obtener encabezados actuales de la hoja
    const headerResult = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Facturas!1:1",
    });

    let encabezadosActuales = headerResult.data.values?.[0] || [];
    const encabezadosFijos = ["Tiempo", "Pedido", "Cajero", "Total Productos", "Ganancia Total"];
    const productosYaEnHoja = encabezadosActuales.filter(h => !encabezadosFijos.includes(h));

    // Obtener productos desde Google Sheets
    const productosSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Productos!B2:B", // Asume que los nombres de productos están en la columna A
    });

    const nombresProductos = productosSheet.data.values?.map(row => row[0]) || [];
    const productosNuevos = nombresProductos.filter(nombre => !productosYaEnHoja.includes(nombre));

    if (productosNuevos.length > 0) {
      const productosCompletos = [...productosYaEnHoja, ...productosNuevos];
      encabezadosActuales = [...encabezadosFijos, ...productosCompletos];

      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: "Facturas!1:1",
        valueInputOption: "RAW",
        requestBody: {
          values: [encabezadosActuales],
        },
      });
    } else {
      const productosCompletos = encabezadosActuales.filter(h => !encabezadosFijos.includes(h));
      encabezadosActuales = [...encabezadosFijos, ...productosCompletos];
    }

    // Obtener número de pedido
    const hoja = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Facturas!A:A",
    });

    const numFilas = hoja.data.values ? hoja.data.values.length : 1;
    const numeroPedido = numFilas;

    // Preparar fila
    const cantidadPorProducto = {};
    encabezadosActuales.forEach(nombre => {
      if (!encabezadosFijos.includes(nombre)) cantidadPorProducto[nombre] = 0;
    });

    productosSeleccionados.forEach(p => {
      cantidadPorProducto[p.nombre] = p.cantidad;
    });

    const fila = encabezadosActuales.map(nombre => {
      if (nombre === "Tiempo") return ahora;
      if (nombre === "Pedido") return numeroPedido;
      if (nombre === "Cajero") return cajero;
      if (nombre === "Total Productos") return productosSeleccionados.reduce((acc, p) => acc + p.cantidad, 0);
      if (nombre === "Ganancia Total") return total;
      return cantidadPorProducto[nombre] || 0;
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Facturas!A1",
      valueInputOption: "USER_ENTERED",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [fila],
      },
    });

    res.json({ status: "ok" });
  } catch (error) {
    console.error("❌ Error al guardar pedido en Sheets:", error);
    res.status(500).json({ status: "error", error: error.message });
  }
});

app.get("/qr", async (req, res) => {
  try {
    // Detecta si está en Render por la variable de entorno o el dominio del request
    const isRender = process.env.RENDER === "true" || req.headers.host.includes("onrender.com");

    let fullURL;
    if (isRender) {
      fullURL = "https://bartimeo-servicio.onrender.com";
    } else {
      const ip = getLocalIP();
      fullURL = `http://${ip}:${PORT}`;
    }

    const qr = await QRCode.toDataURL(fullURL);
    const img = Buffer.from(qr.split(",")[1], "base64");

    res.writeHead(200, {
      "Content-Type": "image/png",
      "Content-Length": img.length,
    });
    res.end(img);
  } catch (err) {
    console.error(err);
    res.status(500).send("Error generando QR");
  }
});


app.get("/ip", (req, res) => {
  const ip = getLocalIP();
  const fullURL = `http://${ip}:${PORT}`;
  res.send(fullURL);
});

// === SERVIDOR ===
app.listen(PORT, () => {
  const ip = getLocalIP();
  const fullURL = `http://${ip}:${PORT}`;
  const localURL = `http://localhost:${PORT}`;
  console.log("✅ Servidor corriendo en:");
  console.log(`👉 ${localURL}`);
  console.log(`👉 En red local: ${fullURL}`);
  // abrirNavegador(localURL); // opcional
});

// === FUNCIONES AUXILIARES ===
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "localhost";
}

function abrirNavegador(url) {
  const plataforma = process.platform;
  if (plataforma === "win32") {
    exec(`start ${url}`);
  } else if (plataforma === "darwin") {
    exec(`open ${url}`);
  } else {
    exec(`xdg-open ${url}`);
  }
}