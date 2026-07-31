// camaras.js - Módulo de Gestión de Cámaras Multi-Nave
import { db, collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from './firebase-config.js';
import { checkAuth, logout } from './auth.js';

// Exponer logout
window.logout = logout;

// Configuración de las Naves / Planos
const NAVES_CONFIG = {
  nave1: {
    nombre: 'Nave 1',
    url: '../img/planonv1.png', // Ruta de la Nave 1
    w: 1023, // Ancho en píxeles de la imagen 1
    h: 1008  // Alto en píxeles de la imagen 1
  },
  nave2: {
    nombre: 'Nave 2',
    url: '../img/planonv2.png', // 👈 Ruta de la imagen de tu Nave 2
    w: 1176, // 👈 Ajusta el ancho real en píxeles de la Nave 2
    h: 1078   // 👈 Ajusta el alto real en píxeles de la Nave 2
  }
};

let map = null;
let imageOverlay = null;
let naveActual = 'nave1'; // Nave seleccionada por defecto
let modoAñadirCamara = false;
let tempCoords = null;
let marcadoresLocales = {};
let camarasCache = []; // Caché local de cámaras cargadas desde Firestore

// 1. INICIALIZAR MAPA CON LA NAVE SELECCIONADA
function initMap() {
  const config = NAVES_CONFIG[naveActual];
  const bounds = [[0, 0], [config.h, config.w]];

  map = L.map('map', {
    crs: L.CRS.Simple,
    minZoom: -1,
    maxZoom: 2,
    bounceAtZoomLimits: false
  });

  imageOverlay = L.imageOverlay(config.url, bounds).addTo(map);
  map.fitBounds(bounds);

  map.on('click', onMapClick);
  cargarCamarasFirestore();
}

// 2. CAMBIAR ENTRE NAVES / PLANOS
window.cambiarNave = function(idNave) {
  if (naveActual === idNave || !NAVES_CONFIG[idNave]) return;

  naveActual = idNave;

  // Actualizar botones UI
  document.querySelectorAll('.btn-nave').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');

  // Cancelar modo añadir si estaba activo
  modoAñadirCamara = false;
  const badge = document.getElementById('modeBadge');
  if (badge) badge.style.display = 'none';

  // Cambiar plano en Leaflet
  const config = NAVES_CONFIG[naveActual];
  const bounds = [[0, 0], [config.h, config.w]];

  map.removeLayer(imageOverlay);
  imageOverlay = L.imageOverlay(config.url, bounds).addTo(map);
  map.fitBounds(bounds);

  // Redibujar las cámaras de la nueva nave
  renderizarCamarasNaveActual();
};

// 3. ACTIVAR MODO AÑADIR CÁMARA
window.activarModoAñadir = function() {
  modoAñadirCamara = true;
  const badge = document.getElementById('modeBadge');
  if (badge) badge.style.display = 'block';
  alert(`👉 Haz clic sobre el plano de la ${NAVES_CONFIG[naveActual].nombre} para colocar la cámara.`);
};

// 4. MANEJAR CLIC EN EL MAPA
function onMapClick(e) {
  if (!modoAñadirCamara) return;

  const { lat, lng } = e.latlng;
  tempCoords = { y: Math.round(lat), x: Math.round(lng) };

  const inputCoords = document.getElementById('camCoordsDisplay');
  if (inputCoords) inputCoords.value = `X: ${tempCoords.x}, Y: ${tempCoords.y}`;
  
  const modal = document.getElementById('cameraModal');
  if (modal) modal.classList.add('active');
}

// 5. CERRAR MODAL
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

// 6. CARGAR CÁMARAS DESDE FIRESTORE
window.cargarCamarasFirestore = async function() {
  try {
    const querySnapshot = await getDocs(collection(db, "camaras"));
    camarasCache = [];

    querySnapshot.forEach((docSnap) => {
      camarasCache.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderizarCamarasNaveActual();

  } catch (error) {
    console.error("Error al cargar cámaras desde Firestore:", error);
  }
};

// 7. RENDERIZAR CÁMARAS Y ACTUALIZAR KPIS SEGÚN LA NAVE ACTIVA
function renderizarCamarasNaveActual() {
  // Limpiar marcadores previos del mapa
  Object.values(marcadoresLocales).forEach(marker => map.removeLayer(marker));
  marcadoresLocales = {};

  let total = 0;
  let activas = 0;
  let inactivas = 0;

  camarasCache.forEach((cam) => {
    // Si la cámara no tiene asignada nave (registros antiguos), se asigna 'nave1' por defecto
    const naveCamara = cam.nave || 'nave1';

    if (naveCamara === naveActual) {
      dibujarCamaraEnMapa(cam);
      
      total++;
      if (cam.estado === 'activa') activas++;
      if (cam.estado === 'inactiva') inactivas++;
    }
  });

  // Actualizar KPIs
  document.getElementById('kpiTotalCamaras').innerText = total;
  document.getElementById('kpiCamarasActivas').innerText = activas;
  document.getElementById('kpiCamarasInactivas').innerText = inactivas;
}

// 8. DIBUJAR MARCADOR EN MAPA
function dibujarCamaraEnMapa(cam) {
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
    Nave: <b style="color: var(--accent-cyan);">${NAVES_CONFIG[cam.nave || 'nave1'].nombre}</b><br>
    IP: <code>${cam.ip || 'N/A'}</code><br>
    Estado: <b style="text-transform: uppercase;">${cam.estado}</b><br>
    Zona: <b>${cam.zona || 'Sin asignar'}</b><br>
    Orientación: ${cam.angulo || 0}°<br><br>
    <button onclick="eliminarCamara('${cam.id}')" style="color: #f87171; background: none; border: 1px solid rgba(248, 113, 113, 0.4); padding: 4px 8px; border-radius: 4px; cursor: pointer;">
      🗑️ Eliminar Cámara
    </button>
  `);

  marcadoresLocales[cam.id] = marker;
}

// 9. GUARDAR CÁMARA (Formulario Submit)
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
    nave: naveActual, // 👈 Guarda automáticamente en qué Nave se creó
    ubicacion: tempCoords,
    creadoEn: new Date()
  };

  try {
    await addDoc(collection(db, "camaras"), nuevaCamara);
    alert(`✅ Cámara registrada en ${NAVES_CONFIG[naveActual].nombre}.`);
    
    closeCameraModal();
    cargarCamarasFirestore();

  } catch (error) {
    console.error("Error al guardar la cámara:", error);
    alert("Ocurrió un error al guardar en Firestore.");
  }
};

// 10. ELIMINAR CÁMARA
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

// INICIALIZACIÓN
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  initMap();
});
