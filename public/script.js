let productos = [];
let cantidades = {};



let nombreCajero = "";

window.addEventListener("DOMContentLoaded", () => {
  nombreCajero = localStorage.getItem("cajero");

  // Si no hay nombre guardado, pedirlo hasta que ingresen uno válido
  while (!nombreCajero || nombreCajero.trim() === "") {
    nombreCajero = prompt("¿Nombre del cajero?");
  }

  localStorage.setItem("cajero", nombreCajero);
});





window.onload = async () => {
  const res = await fetch("/productos");
  productos = await res.json();

  const contenedor = document.getElementById("productos");

  productos.forEach(p => {
    cantidades[p.id] = 0;

    const card = document.createElement("div");
    card.style.border = "1px solid #ccc";
    card.style.margin = "10px";
    card.style.padding = "10px";
    card.style.borderRadius = "10px";
    card.style.maxWidth = "300px";

    card.className = "card"; // importante para que el CSS funcione

    card.innerHTML = `
      <img src="${p.imagen}" alt="${p.nombre}">
      <h3>${p.nombre}</h3>
      <p><strong>${p.precio} COP</strong></p>
      <div class="cantidad-control">
        <button onclick="cambiarCantidad(${p.id}, -1)">−</button>
        <span id="cantidad-${p.id}">0</span>
        <button onclick="cambiarCantidad(${p.id}, 1)">+</button>
      </div>
    `;

    contenedor.appendChild(card);
  });

};

function cambiarCantidad(id, delta) {
  cantidades[id] = Math.max(0, cantidades[id] + delta);
  document.getElementById(`cantidad-${id}`).textContent = cantidades[id];
  calcularTotal();
}

function calcularTotal() {
  let total = 0;
  const resumenContenedor = document.getElementById("resumen-productos");
  resumenContenedor.innerHTML = "";

  const productosSeleccionados = productos.filter(p => cantidades[p.id] > 0);

  if (productosSeleccionados.length > 0) {
    const titulo = document.createElement("h4");
    titulo.textContent = "Detalle del Pedido:";
    resumenContenedor.appendChild(titulo);

    productosSeleccionados.forEach(p => {
      const item = document.createElement("div");
      item.className = "producto-resumen";
      item.innerHTML = `
        <span>${p.nombre}</span>
        <span class="cantidad-resumen">${cantidades[p.id]} × $${p.precio.toLocaleString()}</span>
      `;
      resumenContenedor.appendChild(item);

      total += p.precio * cantidades[p.id];
    });
  }

  document.getElementById("total").textContent = total;
}


function calcularCambio() {
    const total = parseInt(document.getElementById("total").textContent);
    const pago = parseInt(document.getElementById("pago").value);
    const btnConfirmar = document.getElementById("btnConfirmar");
  
    if (isNaN(pago) || pago < total) {
      document.getElementById("cambio").textContent = "Pago insuficiente.";
      document.getElementById("bonos").textContent = "";
      btnConfirmar.disabled = true;  // Desactivar botón Confirmar
      return;
    }
  
    const cambio = pago - total;
    document.getElementById("cambio").textContent = `Cambio: ${cambio} COP`;
  
    const denominaciones = [20000, 10000, 5000, 2000, 1000, 500];
    const contenedorBonos = document.getElementById("bonos");

    // Limpiamos el contenido anterior
    contenedorBonos.innerHTML = "<h4>Bonos Sugeridos :</h4>";
    contenedorBonos.classList.add("bono-lista");

    let neto = total;

    for (const d of denominaciones) {
      const cantidad = Math.floor(neto / d);
      if (cantidad > 0) {
        const item = document.createElement("div");
        item.className = "bono-item";
        item.innerHTML = `
          <span class="bono-cantidad">${cantidad} ×</span>
          <span class="bono-denominacion">$${d.toLocaleString()}</span>
        `;
        contenedorBonos.appendChild(item);
        neto %= d;
      }
    }

  
    btnConfirmar.disabled = false; // Activar botón Confirmar
  }
  

function confirmarPedido() {
    const btnConfirmar = document.getElementById("btnConfirmar");
    const total = parseInt(document.getElementById("total").textContent);
    
    if (total === 0) {
      alert("No hay productos seleccionados.");
      btnConfirmar.disabled = true; // Desactivar botón Confirmar
      return;
    }
  
    const confirmado = confirm(nombreCajero+" ¿Estas segura de Confirmar y Guardar? Recuerda que el pedido se registra en la base de datos y se contabiliza para el inventario y las ganancias.");
    if (!confirmado) return;
  
    const productosSeleccionados = productos
      .filter(p => cantidades[p.id] > 0)
      .map(p => ({
        nombre: p.nombre,
        cantidad: cantidades[p.id]
      }));
  
    fetch("/guardar-pedido", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productosSeleccionados, total, cajero: nombreCajero })
    })
      .then(res => res.json())
      .then(data => {
        alert("Pedido guardado con éxito.");
        // Limpiar cantidades
        for (const id in cantidades) {
          cantidades[id] = 0;
          document.getElementById(`cantidad-${id}`).textContent = 0;
        }
        calcularTotal();
        document.getElementById("pago").value = "";
        document.getElementById("cambio").textContent = "";
        document.getElementById("bonos").textContent = "";
      })
      .catch(err => {
        alert("Error al guardar pedido.");
        console.error(err);
      });
      btnConfirmar.disabled = true; // Activar botón Confirmar

  }
