// camaras.js - Módulo de Gestión de Cámaras y Zonas sobre Mapa Interactivo
import { db, collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from './firebase-config.js';
import { checkAuth, logout } from './auth.js';

let map = null;
let modoAñadirCamara = false;
let tempCoords = null; // Coordenadas temporales al hacer clic
let marcadoresLocales = {}; // Para guardar referencias a los marcadores dibujados en el mapa

// 1. INICIALIZAR EL MAPA CON EL PLANO DE LA EMPRESA
function initMap() {
  // Dimensiones en píxeles de la imagen de tu plano (Ejemplo: 1920x1080)
  const w = 1920;
  const h = 1080;
  const bounds = [[0, 0], [h, w]];

  // Inicializar Leaflet en sistema de coordenadas simples (CRS.Simple)
  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 2,
    bounceAtZoomLimits: false
  });

  // URL del plano de tu empresa (puedes reemplazar esta URL por la imagen real de tu plano)
  const imageUrl = '../img/planonv1.png';

  // Cargar la imagen del plano sobre las coordenadas
  L.imageOverlay(imageUrl, bounds).addTo(map);

  // Ajustar la vista para que el plano ocupe toda la pantalla
  map.fitBounds(bounds);

  // Evento al hacer clic en el plano
  map.on('click', onMapClick);

  // Cargar cámaras existentes en Firestore
  cargarCamarasFirestore();
}

// 2. MANEJAR CLICS SOBRE EL MAPA
function onMapClick(e) {
  if (!modoAñadirCamara) return;

  const { lat, lng } = e.latlng;
  tempCoords = { y: Math.round(lat), x: Math.round(lng) };

  alert(`📌 Posición seleccionada en el plano: X: ${tempCoords.x}, Y: ${tempCoords.y}`);
}

// 3. CARGAR CÁMARAS DESDE FIRESTORE Y DIBUJAR EN EL MAPA
async function cargarCamarasFirestore() {
  try {
    const querySnapshot = await getDocs(collection(db, "camaras"));
    const listaUI = document.getElementById('listaCamaras');
    if (listaUI) listaUI.innerHTML = '';

    querySnapshot.forEach((docSnap) => {
      const cam = { id: docSnap.id, ...docSnap.data() };
      dibujarCamaraEnMapa(cam);
      agregarAListaUI(cam);
    });

  } catch (error) {
    console.error("Error al cargar las cámaras desde Firestore:", error);
  }
}

// 4. DIBUJAR UN MARCADOR DE CÁMARA EN EL MAPA
function dibujarCamaraEnMapa(cam) {
  // Eliminar el marcador si ya existía para actualizarlo
  if (marcadoresLocales[cam.id]) {
    map.removeLayer(marcadoresLocales[cam.id]);
  }

  // Crear icono HTML personalizado
  const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="camera-marker ${cam.estado}" style="transform: rotate(${cam.angulo || 0}deg);">
        <i class="fa-solid fa-video"></i>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });

  // Crear el marcador en las coordenadas [Y, X]
  const marker = L.marker([cam.ubicacion.y, cam.ubicacion.x], { icon: customIcon }).addTo(map);

  // Popup con información detallada
  marker.bindPopup(`
    <strong>${cam.nombre}</strong><br>
    IP: <code>${cam.ip || 'N/A'}</code><br>
    Estado: <b>${cam.estado.toUpperCase()}</b><br>
    Orientación: ${cam.angulo || 0}°<br><br>
    <button onclick="eliminarCamara('${cam.id}')" style="color: red; border:none; background:none; cursor:pointer;">
      🗑️ Eliminar Cámara
    </button>
  `);

  // Guardar referencia
  marcadoresLocales[cam.id] = marker;
}

// 5. MSTRAR CÁMARA EN LA LISTA LATERAL
function agregarAListaUI(cam) {
  const listaUI = document.getElementById('listaCamaras');
  if (!listaUI) return;

  const li = document.createElement('li');
  li.style.cssText = "padding: 8px; border-bottom: 1px solid #e2e8f0; cursor: pointer; display: flex; justify-content: space-between;";
  li.innerHTML = `
    <span>📹 ${cam.nombre}</span>
    <small>${cam.estado}</small>
  `;

  // Al hacer clic en la lista, centrar la cámara en el mapa
  li.addEventListener('click', () => {
    map.setView([cam.ubicacion.y, cam.ubicacion.x], 1);
    if (marcadoresLocales[cam.id]) {
      marcadoresLocales[cam.id].openPopup();
    }
  });

  listaUI.appendChild(li);
}

// 6. GUARDAR NUEVA CÁMARA EN FIRESTORE
async function guardarCamara(e) {
  e.preventDefault();

  if (!tempCoords) {
    alert("⚠️ Por favor haz clic en alguna parte del plano para indicar dónde está ubicada la cámara.");
    return;
  }

  const nuevaCamara = {
    nombre: document.getElementById('camNombre').value.trim(),
    ip: document.getElementById('camIp').value.trim(),
    estado: document.getElementById('camEstado').value,
    angulo: parseInt(document.getElementById('camAngulo').value) || 0,
    ubicacion: tempCoords, // { x, y }
    creadoEn: new Date()
  };

  try {
    const docRef = await addDoc(collection(db, "camaras"), nuevaCamara);
    alert("✅ Cámara guardada correctamente.");

    // Redibujar y limpiar
    dibujarCamaraEnMapa({ id: docRef.id, ...nuevaCamara });
    agregarAListaUI({ id: docRef.id, ...nuevaCamara });

    // Resetear interfaz
    document.getElementById('cameraForm').reset();
    document.getElementById('panelFormulario').style.display = 'none';
    modoAñadirCamara = false;
    tempCoords = null;

  } catch (error) {
    console.error("Error al guardar la cámara:", error);
    alert("Error al guardar en la base de datos.");
  }
}

// 7. ELIMINAR CÁMARA (Expuesto globalmente)
window.eliminarCamara = async function(id) {
  if (confirm("¿Estás seguro de que deseas eliminar esta cámara?")) {
    try {
      await deleteDoc(doc(db, "camaras", id));
      if (marcadoresLocales[id]) {
        map.removeLayer(marcadoresLocales[id]);
        delete marcadoresLocales[id];
      }
      cargarCamarasFirestore(); // Recargar lista
    } catch (error) {
      console.error("Error al eliminar la cámara:", error);
    }
  }
};

// 8. CONFIGURACIÓN DE EVENTOS AL CARGAR EL DOM
document.addEventListener('DOMContentLoaded', () => {
  // Verificar autenticación previa
  checkAuth();

  // Inicializar Leaflet
  initMap();

  // Botón "Añadir Cámara"
  const btnNueva = document.getElementById('btnNuevaCamara');
  if (btnNueva) {
    btnNueva.addEventListener('click', () => {
      modoAñadirCamara = true;
      document.getElementById('panelFormulario').style.display = 'block';
      alert("👉 Haz clic en la zona del plano donde está instalada la cámara.");
    });
  }

  // Formulario
  const form = document.getElementById('cameraForm');
  if (form) {
    form.addEventListener('submit', guardarCamara);
  }
});
