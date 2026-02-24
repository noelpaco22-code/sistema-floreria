// 1. INICIALIZACIÓN: Cargar datos guardados o empezar vacío
// Usamos window.carrito para que el script del HTML pueda acceder a los datos
window.carrito = JSON.parse(localStorage.getItem('cart_margarita')) || [];
let carrito = window.carrito; 

// 2. FUNCIÓN PARA ABRIR / CERRAR EL CARRITO
function toggleCart() {
    const sidebar = document.getElementById('cartSidebar');
    if (sidebar) {
        sidebar.classList.toggle('active');
        console.log("Carrito alternado");
    } else {
        console.error("No se encontró el elemento #cartSidebar");
    }
}

// 3. ESCUCHADOR DE CLICS GLOBAL (Para agregar productos)
document.addEventListener('click', function(e) {
    // Buscamos si el clic fue en el botón de añadir (usando closest por si hace clic en el texto del botón)
    const btn = e.target.closest('.btn-add');
    
    if (btn) {
        // Capturamos los datos que pusimos en el HTML
        const producto = {
            id: btn.getAttribute('data-id') || Date.now(), 
            nombre: btn.getAttribute('data-nombre'),
            precio: parseFloat(btn.getAttribute('data-precio')),
            imagen: btn.getAttribute('data-imagen'),
            cantidad: 1
        };

        console.log("Producto agregado:", producto.nombre);

        // Verificamos si el producto ya está en el carrito
        const existe = carrito.findIndex(item => item.nombre === producto.nombre);

        if (existe !== -1) {
            carrito[existe].cantidad++;
        } else {
            carrito.push(producto);
        }

        // Guardar y refrescar interfaz
        actualizarCarritoUI();
        
        // --- SE ELIMINÓ LA PARTE QUE ABRÍA EL CARRITO AUTOMÁTICAMENTE ---
        // Ahora el usuario puede seguir comprando sin que se abra el lateral.
    }
});

// 4. FUNCIÓN PARA DIBUJAR EL CARRITO
function actualizarCarritoUI() {
    const cartList = document.getElementById('cart-list-items');
    const totalDisplay = document.getElementById('cart-total');
    const countBadge = document.getElementById('cart-count');

    if (!cartList) return;

    // Guardar en memoria del navegador
    localStorage.setItem('cart_margarita', JSON.stringify(carrito));

    let total = 0;
    let totalItems = 0;
    cartList.innerHTML = "";

    if (carrito.length === 0) {
        cartList.innerHTML = `<p style="text-align:center; padding:50px; opacity:0.5; font-size:0.8rem; letter-spacing:2px;">TU CESTA ESTÁ VACÍA</p>`;
        if(totalDisplay) totalDisplay.innerText = "0.00 Bs";
        if(countBadge) countBadge.innerText = "0";
        return;
    }

    carrito.forEach((prod, index) => {
        total += (prod.precio * prod.cantidad);
        totalItems += prod.cantidad;

        // Estructura del item corregida para que coincida con tus estilos boutique
        cartList.innerHTML += `
            <div class="cart-item" style="display: flex; gap: 15px; margin-bottom: 20px; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 15px;">
                <div class="item-img-container" style="width: 70px; height: 90px; flex-shrink: 0; overflow: hidden; border-radius: 4px;">
                    <img src="${prod.imagen}" alt="${prod.nombre}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://via.placeholder.com/100x120?text=Flor'">
                </div>
                <div class="item-info" style="flex-grow: 1;">
                    <h4 style="font-size: 0.9rem; margin-bottom: 5px; font-family: 'Playfair Display', serif;">${prod.nombre}</h4>
                    <span class="item-price" style="color: var(--accent-green); font-size: 0.85rem;">${prod.precio.toFixed(2)} Bs</span>
                    <div class="qty-wrapper" style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                        <button class="qty-btn" onclick="cambiarCantidad(${index}, -1)" style="background:rgba(255,255,255,0.1); border:none; color:white; width:24px; height:24px; cursor:pointer;">-</button>
                        <span class="qty-num" style="font-size: 0.8rem;">${prod.cantidad}</span>
                        <button class="qty-btn" onclick="cambiarCantidad(${index}, 1)" style="background:rgba(255,255,255,0.1); border:none; color:white; width:24px; height:24px; cursor:pointer;">+</button>
                    </div>
                </div>
                <button onclick="eliminarProducto(${index})" style="background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; font-size:1.5rem; padding: 0 10px;">×</button>
            </div>
        `;
    });

    if(totalDisplay) totalDisplay.innerText = total.toFixed(2) + " Bs";
    if(countBadge) countBadge.innerText = totalItems;
}

// 5. FUNCIONES DE CONTROL
function cambiarCantidad(index, delta) {
    carrito[index].cantidad += delta;
    if (carrito[index].cantidad <= 0) {
        carrito.splice(index, 1);
    }
    actualizarCarritoUI();
}

function eliminarProducto(index) {
    carrito.splice(index, 1);
    actualizarCarritoUI();
}

// 6. PROCESAR COMPRA (Función básica - Comentada para usar la del HTML)
/* function procesarCompra() {
    // Usamos la función definida en el HTML para abrir el modal del QR
}
*/

// 7. CARGA INICIAL
document.addEventListener('DOMContentLoaded', actualizarCarritoUI);