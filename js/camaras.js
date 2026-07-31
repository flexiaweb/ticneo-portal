// camaras.js - Módulo de Gestión de Cámaras sobre Mapa Interactivo
import { db, collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from './firebase-config.js';
import { checkAuth, logout } from './auth.js';

let map = null;
let modoAñadirCamara = false;
let tempCoords = null; // Coordenadas temporales
let marcadoresLocales = {}; // Referencias a marcadores Leaflet

// Exponer la función de Logout globalmente para el Header
window.logout = logout;

// 1. INICIALIZAR EL MAPA
function initMap() {
  const w = 1023;
  const h = 1008;
  const bounds = [[0, 0], [h, w]];

  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 2,
    bounceAtZoomLimits: false
  });

  const imageUrl = '../img/planonv1.png';
  L.imageOverlay(imageUrl, bounds).addTo(map);
  map.fitBounds(bounds);

  // Evento clic en el mapa
  map.on('click', onMapClick);

  // Cargar cámaras existentes
  cargarCamarasFirestore();
}

// 2. ACTIVAR MODO AÑADIR (Llamado desde el botón HTML)
window.activarModoAñadir = function() {
  modoAñadirCamara = true;
  const badge = document.getElementById('modeBadge');
  if (badge) badge.style.display = 'block';
  alert("👉 Por favor, haz clic sobre la zona del plano donde quieres colocar la cámara.");
};

// 3. MANEJAR CLIC EN EL MAPA
function onMapClick(e) {
  if (!modoAñadirCamara) return;

  const { lat, lng } = e.latlng;
  tempCoords = { y: Math.round(lat), x: Math.round(lng) };

  // Abrir Modal
  const inputCoords = document.getElementById('camCoordsDisplay');
  if (inputCoords) inputCoords.value = `X: ${tempCoords.x}, Y: ${tempCoords.y}`;
  
  const modal = document.getElementById('cameraModal');
  if (modal) modal.classList.add('active');
}

// 4. ABRIR / CERRAR MODAL
window.closeCameraModal = function() {
  const modal = document.getElementById('cameraModal');
  if (modal) modal.classList.remove('active');
  
  const form = document.getElementById('addCameraForm');
  if (form) form.reset();
  
  const badge = document.getElementById('modeBadge');
  if (badge) badge.style.display = 'none';

  modoAñadirCamara = false;
  tempCoords = null;
};

// 5. CARGAR CÁMARAS Y ACTUALIZAR KPIS
window.cargarCamarasFirestore = async function() {
  try {
    const querySnapshot = await getDocs(collection(db, "camaras"));
    
    // Limpiar marcadores antiguos
    Object.values(marcadoresLocales).forEach(marker => map.removeLayer(marker));
    marcadoresLocales = {};

    let total = 0;
    let activas = 0;
    let inactivas = 0;

    querySnapshot.forEach((docSnap) => {
      const cam = { id: docSnap.id, ...docSnap.data() };
      dibujarCamaraEnMapa(cam);
      
      // Conteo para KPIs
      total++;
      if (cam.estado === 'activa') activas++;
      if (cam.estado === 'inactiva') inactivas++;
    });

    // Actualizar KPIs en la UI
    document.getElementById('kpiTotalCamaras').innerText = total;
    document.getElementById('kpiCamarasActivas').innerText = activas;
    document.getElementById('kpiCamarasInactivas').innerText = inactivas;

  } catch (error) {
    console.error("Error al cargar las cámaras desde Firestore:", error);
  }
};

// 6. DIBUJAR MARCADOR EN LEAFLET
function dibujarCamaraEnMapa(cam) {
  if (marcadoresLocales[cam.id]) {
    map.removeLayer(marcadoresLocales[cam.id]);
  }

  const customIcon = L.divIcon({
    className: 'custom-div-icon',
    html: `
      <div class="camera-marker ${cam.estado}" style="transform: rotate(${cam.angulo || 0}deg);">
        <i class="fa-solid fa-video"></i>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });

  const marker = L.marker([cam.ubicacion.y, cam.ubicacion.x], { icon: customIcon }).addTo(map);

  marker.bindPopup(`
    <strong style="font-size: 1.1rem; color: #fff;">${cam.nombre}</strong><br><br>
    IP: <code style="color: var(--accent-cyan);">${cam.ip || 'N/A'}</code><br>
    Estado: <b style="text-transform: uppercase;">${cam.estado}</b><br>
    Zona: <b>${cam.zona || 'Sin asignar'}</b><br>
    Orientación: ${cam.angulo || 0}°<br><br>
    <button onclick="eliminarCamara('${cam.id}')" style="color: #f87171; background: none; border: 1px solid rgba(248, 113, 113, 0.4); padding: 4px 8px; border-radius: 4px; cursor: pointer;">
      🗑️ Eliminar Cámara
    </button>
  `);

  marcadoresLocales[cam.id] = marker;
}

// 7. GUARDAR CÁMARA (Formulario Submit)
window.submitCameraForm = async function(e) {
  e.preventDefault();

  if (!tempCoords) {
    alert("⚠️ Selecciona primero la posición en el mapa.");
    return;
  }

  const nuevaCamara = {
    nombre: document.getElementById('camNombre').value.trim(),
    ip: document.getElementById('camIp').value.trim(),
    estado: document.getElementById('camEstado').value,
    angulo: parseInt(document.getElementById('camAngulo').value) || 0,
    zona: document.getElementById('camZona').value.trim(),
    ubicacion: tempCoords,
    creadoEn: new Date()
  };

  try {
    await addDoc(collection(db, "camaras"), nuevaCamara);
    alert("✅ Cámara registrada exitosamente.");
    
    closeCameraModal();
    cargarCamarasFirestore(); // Recargar mapa e indicadores

  } catch (error) {
    console.error("Error al guardar la cámara:", error);
    alert("Ocurrió un error al guardar en Firestore.");
  }
};

// 8. ELIMINAR CÁMARA
window.eliminarCamara = async function(id) {
  if (confirm("¿Estás seguro de eliminar esta cámara?")) {
    try {
      await deleteDoc(doc(db, "camaras", id));
      cargarCamarasFirestore();
    } catch (error) {
      console.error("Error al eliminar la cámara:", error);
    }
  }
};

// 9. INICIALIZACIÓN DE PÁGINA
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initMap();
});
