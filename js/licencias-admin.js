// licencias-admin.js - Módulo Administrador de Licencias
import { 
  db, 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  serverTimestamp 
} from './firebase-config.js';

let licenciasCache = [];

// 1. CARGAR LICENCIAS DESDE FIRESTORE
async function cargarLicencias() {
  const tbody = document.getElementById('tablaLicenciasBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">Cargando licencias...</td></tr>`;

  try {
    const querySnapshot = await getDocs(collection(db, "licencias"));
    licenciasCache = [];

    querySnapshot.forEach((docSnap) => {
      licenciasCache.push({
        id: docSnap.id,
        ...docSnap.data()
      });
    });

    renderizarTabla(licenciasCache);
    actualizarKPIs(licenciasCache);

  } catch (error) {
    console.error("Error al cargar licencias:", error);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: #f87171; padding: 2rem;">⚠️ Error al cargar licencias desde Firestore.</td></tr>`;
  }
}

// 2. RENDERIZAR TABLA DE LICENCIAS
function renderizarTabla(lista) {
  const tbody = document.getElementById('tablaLicenciasBody');
  if (!tbody) return;

  tbody.innerHTML = '';

  if (lista.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem;">No se encontraron licencias.</td></tr>`;
    return;
  }

  lista.forEach((lic) => {
    const usosMax = lic.usosMaximos ?? 1;
    const usosAct = lic.usosActuales ?? 0;
    const restantes = Math.max(0, usosMax - usosAct);
    const estaAgotada = lic.usada === true || usosAct >= usosMax;

    const badgeClass = estaAgotada ? 'badge-salida' : 'badge-entrada';
    const badgeText = estaAgotada ? 'Agotada / Inactiva' : 'Disponible';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#fff; font-weight: 600;">
        ${lic.id}<br>
        <small style="color: var(--text-muted); font-weight: normal;">Código: ${lic.codigo || '-'}</small>
      </td>
      <td>${lic.diasDuracion || 30} días</td>
      <td><strong>${usosAct}</strong> / ${usosMax}</td>
      <td><strong style="color: ${restantes > 0 ? '#4ade80' : '#f87171'};">${restantes}</strong></td>
      <td><span class="badge-mov ${badgeClass}">${badgeText}</span></td>
      <td>
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="verUsuariosLicencia('${lic.id}')">
          <i class="fa-solid fa-users"></i> Usuarios (${(lic.usuarios || []).length})
        </button>
        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="cambiarEstadoLicencia('${lic.id}', ${!lic.usada})">
          <i class="fa-solid fa-power-off"></i> ${lic.usada ? 'Activar' : 'Desactivar'}
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. ACTUALIZAR KPIS
function actualizarKPIs(lista) {
  const total = lista.length;
  let activas = 0;
  let agotadas = 0;

  lista.forEach((lic) => {
    const usosMax = lic.usosMaximos ?? 1;
    const usosAct = lic.usosActuales ?? 0;
    if (lic.usada === true || usosAct >= usosMax) {
      agotadas++;
    } else {
      activas++;
    }
  });

  document.getElementById('kpiTotalLicencias').textContent = total;
  document.getElementById('kpiLicenciasActivas').textContent = activas;
  document.getElementById('kpiLicenciasAgotadas').textContent = agotadas;
}

// 4. BÚSQUEDA Y FILTRADO
window.filtrarLicencias = function() {
  const text = document.getElementById('searchInputLicencias').value.toLowerCase();
  const filtradas = licenciasCache.filter(l => 
    l.id.toLowerCase().includes(text) || 
    (l.codigo && l.codigo.toLowerCase().includes(text))
  );
  renderizarTabla(filtradas);
};

// 5. MODALES Y CREACIÓN
window.abrirModalCrearLicencia = function() {
  document.getElementById('modalCrearLicencia').classList.add('active');
};

window.cerrarModalCrearLicencia = function() {
  document.getElementById('modalCrearLicencia').classList.remove('active');
  document.getElementById('formNuevaLicencia').reset();
};

window.generarCodigoAleatorio = function() {
  const num = Math.floor(1000000000000000 + Math.random() * 9000000000000000);
  document.getElementById('inputCodigo').value = num.toString();
};

// SUBMIT DE NUEVA LICENCIA
document.getElementById('formNuevaLicencia')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('btnGuardarLicencia');
  btn.disabled = true;

  const docId = document.getElementById('inputDocId').value.trim().toUpperCase();
  const codigo = document.getElementById('inputCodigo').value.trim();
  const dias = parseInt(document.getElementById('inputDias').value, 10) || 30;
  const usosMax = parseInt(document.getElementById('inputUsosMax').value, 10) || 1;

  try {
    const docRef = doc(db, "licencias", docId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      alert("⚠️ Ya existe una licencia con ese ID. Elige otro nombre.");
      btn.disabled = false;
      return;
    }

    await setDoc(docRef, {
      codigo: codigo,
      diasDuracion: dias,
      usosMaximos: usosMax,
      usosActuales: 0,
      usada: false,
      usuarios: [],
      fechaActivacion: null,
      fechaExpiracion: null,
      creadoEl: serverTimestamp()
    });

    alert("✅ Licencia creada con éxito.");
    cerrarModalCrearLicencia();
    await cargarLicencias();

  } catch (err) {
    console.error("Error al crear licencia:", err);
    alert("⚠️ Ocurrió un error: " + err.message);
  } finally {
    btn.disabled = false;
  }
});

// 6. DETALLE DE USUARIOS QUE USARON LA LICENCIA
window.verUsuariosLicencia = async function(licenciaId) {
  const modal = document.getElementById('modalVerUsuarios');
  const container = document.getElementById('listaUsuariosContainer');
  document.getElementById('tituloModalUsuarios').textContent = `Usuarios: ${licenciaId}`;
  
  modal.classList.add('active');
  container.innerHTML = `<p>Cargando usuarios...</p>`;

  const lic = licenciasCache.find(l => l.id === licenciaId);
  if (!lic || !lic.usuarios || lic.usuarios.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted);">Ningún usuario ha activado esta licencia todavía.</p>`;
    return;
  }

  let html = '<ul style="list-style: none; padding: 0;">';
  
  for (const userId of lic.usuarios) {
    try {
      const userSnap = await getDoc(doc(db, "usuarios", userId));
      if (userSnap.exists()) {
        const u = userSnap.data();
        let expira = '-';
        if (u.licenciaExpiracion && typeof u.licenciaExpiracion.toDate === 'function') {
          expira = u.licenciaExpiracion.toDate().toLocaleDateString('es-ES');
        }
        html += `
          <li style="padding: 0.5rem; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
            <div>
              <strong>${u.nombre || 'Usuario'}</strong> (${u.email || userId})
            </div>
            <span style="color: var(--text-muted); font-size: 0.85rem;">Expira: ${expira}</span>
          </li>`;
      } else {
        html += `<li style="padding: 0.5rem;">ID de usuario: ${userId} (No encontrado)</li>`;
      }
    } catch (e) {
      html += `<li style="padding: 0.5rem;">Error al leer usuario ${userId}</li>`;
    }
  }
  
  html += 'ul>';
  container.innerHTML = html;
};

window.cerrarModalUsuarios = function() {
  document.getElementById('modalVerUsuarios').classList.remove('active');
};

// 7. DESACTIVAR / ACTIVAR MANUALMENTE
window.cambiarEstadoLicencia = async function(licenciaId, nuevoEstadoUsada) {
  const confirmacion = confirm(`¿Deseas ${nuevoEstadoUsada ? 'desactivar' : 'activar'} la licencia ${licenciaId}?`);
  if (!confirmacion) return;

  try {
    await updateDoc(doc(db, "licencias", licenciaId), {
      usada: nuevoEstadoUsada
    });
    await cargarLicencias();
  } catch (error) {
    alert("Error al actualizar la licencia: " + error.message);
  }
};

// INICIALIZAR EN DOM
document.addEventListener('DOMContentLoaded', () => {
  cargarLicencias();
});
