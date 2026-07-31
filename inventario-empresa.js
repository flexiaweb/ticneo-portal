import { db } from './firebase-config.js';
import { 
  collection, 
  getDocs, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  query,
  orderBy
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// Variable global para almacenar los registros cargados
let inventoryData = [];

// Colección en Firestore
const INVENTORY_COLLECTION = 'inventario_empresa';

// Al cargar el DOM
document.addEventListener('DOMContentLoaded', () => {
  loadInventory();
  
  // Asignar funciones al objeto global window para invocarlas desde el HTML
  window.openFormModal = openFormModal;
  window.closeFormModal = closeFormModal;
  window.closeDetailModal = closeDetailModal;
  window.toggleScreensInputs = toggleScreensInputs;
  window.saveEquipment = saveEquipment;
  window.editRecord = editRecord;
  window.deleteRecord = deleteRecord;
  window.viewDetail = viewDetail;
  window.filterTable = filterTable;
});

/**
 * Carga los registros de Firestore ordenados por fecha de creación
 */
async function loadInventory() {
  const tbody = document.getElementById('inventoryTableBody');
  tbody.innerHTML = `<tr><td colspan="7" class="loading-box">Cargando inventario de empresa...</td></tr>`;

  try {
    const q = query(collection(db, INVENTORY_COLLECTION), orderBy('createdAt', 'desc'));
    const querySnapshot = await getDocs(q);
    
    inventoryData = [];
    querySnapshot.forEach((docSnap) => {
      inventoryData.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderTable(inventoryData);
  } catch (error) {
    console.error('Error al cargar inventario:', error);
    tbody.innerHTML = `<tr><td colspan="7" style="color: #f87171; text-align: center; padding: 1.5rem;">Error al cargar datos. Verifique los permisos de Firestore.</td></tr>`;
  }
}

/**
 * Renderiza la tabla principal con los datos proporcionados
 */
function renderTable(data) {
  const tbody = document.getElementById('inventoryTableBody');
  tbody.innerHTML = '';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 1.5rem;">No se encontraron registros de equipamiento.</td></tr>`;
    return;
  }

  data.forEach(item => {
    const tr = document.createElement('tr');

    // Badge de Estado
    const isStock = item.estadoRegistro === 'En stock';
    const statusBadgeClass = isStock ? 'badge-role role-admin' : 'badge-role role-user';
    const statusText = isStock ? '📦 En stock (Almacén)' : '💻 En uso';

    // Construir texto de pantallas de forma dinámica
    const numPantallasStr = String(item.pantallasNum || "0");
    let pantallasDisplay = 'Sin pantallas';
    if (numPantallasStr === "1") {
      pantallasDisplay = item.p1Modelo ? `1x (${item.p1Modelo})` : '1 Pantalla';
    } else if (numPantallasStr === "2") {
      pantallasDisplay = `2x (${item.p1Modelo || ''} / ${item.p2Modelo || ''})`;
    }

    // Formatear periféricos con color diferenciado si es PERSONAL
    const tecladoBadge = getPeripheralBadge(item.monTeclado || 'USB', 'Tcl');
    const ratonBadge = getPeripheralBadge(item.monRaton || 'USB', 'Rat');

    tr.innerHTML = `
      <td>
        <div style="font-weight: 600; color: #fff;">${escapeHTML(item.empNombre || 'Sin asignar')}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(item.empEmail || '')}</div>
      </td>
      <td>
        <div>${escapeHTML(item.empDpto || 'N/A')}</div>
        <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHTML(item.empZona || '')}</div>
      </td>
      <td><strong style="color: var(--primary-light);">${escapeHTML(item.pcId || 'N/A')}</strong></td>
      <td>${escapeHTML(item.pcModelo || 'N/A')}</td>
      <td style="font-size: 0.85rem;">
        <div>${escapeHTML(pantallasDisplay)}</div>
        <div style="margin-top: 0.2rem; display: flex; gap: 0.3rem;">
          ${tecladoBadge}
          ${ratonBadge}
        </div>
      </td>
      <td><span class="${statusBadgeClass}">${statusText}</span></td>
      <td style="text-align: right; whitespace: nowrap;">
        <button onclick="viewDetail('${item.id}')" class="btn-action" title="Ver Ficha Completa">👁️</button>
        <button onclick="editRecord('${item.id}')" class="btn-action" title="Editar">✏️</button>
        <button onclick="deleteRecord('${item.id}')" class="btn-action danger" title="Eliminar">🗑️</button>
      </td>
    `;

    tbody.appendChild(tr);
  });
}

/**
 * Retorna un HTML con badge formateado. Si es PERSONAL resalta en color naranja/amarillo
 */
function getPeripheralBadge(tipo, label) {
  const isPersonal = String(tipo).toUpperCase() === 'PERSONAL';
  const style = isPersonal 
    ? 'background: rgba(245, 158, 11, 0.2); color: #fbbf24; border: 1px solid rgba(245, 158, 11, 0.4);' 
    : 'background: rgba(255, 255, 255, 0.05); color: var(--text-muted); border: 1px solid var(--border-color);';
  
  return `<span style="font-size: 0.7rem; padding: 0.15rem 0.4rem; border-radius: 4px; ${style}">${label}: ${escapeHTML(tipo)}</span>`;
}

/**
 * Controla la visibilidad de las cajas de pantalla según pantallasNum ("0", "1", "2")
 */
function toggleScreensInputs() {
  const val = document.getElementById('pantallasNum').value; // Retorna "0", "1", "2"
  const block1 = document.getElementById('pantalla1Block');
  const block2 = document.getElementById('pantalla2Block');

  if (val === "0") {
    block1.style.display = 'none';
    block2.style.display = 'none';
  } else if (val === "1") {
    block1.style.display = 'block';
    block2.style.display = 'none';
  } else if (val === "2") {
    block1.style.display = 'block';
    block2.style.display = 'block';
  }
}

/**
 * Abrir Modal de Formulario (Crear)
 */
function openFormModal() {
  document.getElementById('equipForm').reset();
  document.getElementById('recordId').value = '';
  document.getElementById('modalTitle').innerText = 'Nuevo Registro de Equipamiento';
  toggleScreensInputs();
  document.getElementById('formModal').classList.add('active');
}

/**
 * Cerrar Modales
 */
function closeFormModal() {
  document.getElementById('formModal').classList.remove('active');
}

function closeDetailModal() {
  document.getElementById('detailModal').classList.remove('active');
}

/**
 * Muestra el modal con los detalles completos del registro
 */
function viewDetail(id) {
  const item = inventoryData.find(rec => rec.id === id);
  if (!item) return;

  const detailTitle = document.getElementById('detailTitle');
  const detailBody = document.getElementById('detailBody');

  detailTitle.innerText = `Ficha de Puesto: ${item.empNombre || item.pcId}`;

  // Lógica para renderizar pantallas únicamente si existen según pantallasNum ("1" o "2")
  const numP = String(item.pantallasNum || "0");
  let pantallasHTML = '<span style="color: var(--text-muted);">Sin pantallas de empresa asignadas</span>';

  if (numP === "1") {
    pantallasHTML = `<div><strong>Pantalla 1:</strong> ${escapeHTML(item.p1Modelo || 'N/A')}</div>`;
  } else if (numP === "2") {
    pantallasHTML = `
      <div><strong>Pantalla 1:</strong> ${escapeHTML(item.p1Modelo || 'N/A')}</div>
      ${item.p2Modelo ? `<div><strong>Pantalla 2:</strong> ${escapeHTML(item.p2Modelo)}</div>` : ''}
    `;
  }

  // Estilos de teclado y ratón
  const tecladoEstilo = String(item.monTeclado).toUpperCase() === 'PERSONAL' 
    ? 'color: #fbbf24; font-weight: bold;' 
    : '';
  const ratonEstilo = String(item.monRaton).toUpperCase() === 'PERSONAL' 
    ? 'color: #fbbf24; font-weight: bold;' 
    : '';

  detailBody.innerHTML = `
    <div style="grid-column: 1 / -1; background: rgba(255,255,255,0.03); padding: 0.8rem; border-radius: 8px;">
      <h4 style="color: var(--primary-light); margin-bottom: 0.4rem;">👤 Datos del Empleado</h4>
      <div><strong>Nombre:</strong> ${escapeHTML(item.empNombre || 'N/A')}</div>
      <div><strong>Email:</strong> ${escapeHTML(item.empEmail || 'N/A')}</div>
      <div><strong>Departamento:</strong> ${escapeHTML(item.empDpto || 'N/A')}</div>
      <div><strong>Ubicación/Mesa:</strong> ${escapeHTML(item.empZona || 'N/A')}</div>
    </div>

    <div style="grid-column: 1 / -1; background: rgba(255,255,255,0.03); padding: 0.8rem; border-radius: 8px;">
      <h4 style="color: var(--primary-light); margin-bottom: 0.4rem;">💻 Ordenador Principal</h4>
      <div><strong>ID Inventario PC:</strong> ${escapeHTML(item.pcId || 'N/A')}</div>
      <div><strong>Modelo:</strong> ${escapeHTML(item.pcModelo || 'N/A')}</div>
      <div><strong>Nº de Serie PC:</strong> ${escapeHTML(item.pcSerie || 'N/A')}</div>
    </div>

    <div style="grid-column: 1 / -1; background: rgba(255,255,255,0.03); padding: 0.8rem; border-radius: 8px;">
      <h4 style="color: var(--primary-light); margin-bottom: 0.4rem;">🖥️ Monitores (${numP})</h4>
      ${pantallasHTML}
    </div>

    <div style="grid-column: 1 / -1; background: rgba(255,255,255,0.03); padding: 0.8rem; border-radius: 8px;">
      <h4 style="color: var(--primary-light); margin-bottom: 0.4rem;">⌨️ Periféricos y Estado</h4>
      <div><strong>Teclado:</strong> <span style="${tecladoEstilo}">${escapeHTML(item.monTeclado || 'USB')}</span></div>
      <div><strong>Ratón:</strong> <span style="${ratonEstilo}">${escapeHTML(item.monRaton || 'USB')}</span></div>
      <div><strong>Accesorios:</strong> ${escapeHTML(item.accesorios || 'Ninguno')}</div>
      <div style="margin-top: 0.4rem;"><strong>Estado:</strong> ${escapeHTML(item.estadoRegistro)}</div>
      ${item.notasRegistro ? `<div style="margin-top: 0.4rem; font-style: italic; color: var(--text-muted);"><strong>Notas:</strong> ${escapeHTML(item.notasRegistro)}</div>` : ''}
    </div>
  `;

  document.getElementById('detailModal').classList.add('active');
}

/**
 * Guardar o Actualizar Registro en Firestore
 */
async function saveEquipment(e) {
  e.preventDefault();
  const btnSave = document.getElementById('btnSaveRecord');
  btnSave.disabled = true;
  btnSave.innerText = 'Guardando...';

  const recordId = document.getElementById('recordId').value;
  const pantallasNumStr = document.getElementById('pantallasNum').value; // Recibe "0", "1" o "2"

  // Construir objeto base
  const payload = {
    empEmail: document.getElementById('empEmail').value.trim(),
    empNombre: document.getElementById('empNombre').value.trim(),
    empDpto: document.getElementById('empDpto').value.trim(),
    empZona: document.getElementById('empZona').value.trim(),
    pcId: document.getElementById('pcId').value.trim(),
    pcModelo: document.getElementById('pcModelo').value.trim(),
    pcSerie: document.getElementById('pcSerie').value.trim(),
    pantallasNum: pantallasNumStr, // Siempre String ("0", "1", "2")
    monTeclado: document.getElementById('monTeclado').value,
    monRaton: document.getElementById('monRaton').value,
    accesorios: document.getElementById('accesorios').value.trim(),
    estadoRegistro: document.getElementById('estadoRegistro').value,
    notasRegistro: document.getElementById('notasRegistro').value.trim(),
    updatedAt: serverTimestamp()
  };

  // Asignar condicionalmente los campos de pantallas según el String seleccionado
  if (pantallasNumStr === "1") {
    payload.p1Modelo = document.getElementById('p1Modelo').value.trim();
    payload.p2Modelo = ""; // Limpiar si antes tenía 2
  } else if (pantallasNumStr === "2") {
    payload.p1Modelo = document.getElementById('p1Modelo').value.trim();
    payload.p2Modelo = document.getElementById('p2Modelo').value.trim();
  } else {
    // Si es "0", no guardamos o limpiamos modelos
    payload.p1Modelo = "";
    payload.p2Modelo = "";
  }

  try {
    if (recordId) {
      // Actualización
      const docRef = doc(db, INVENTORY_COLLECTION, recordId);
      await updateDoc(docRef, payload);
    } else {
      // Creación
      payload.createdAt = serverTimestamp();
      await addDoc(collection(db, INVENTORY_COLLECTION), payload);
    }

    closeFormModal();
    await loadInventory();
  } catch (error) {
    console.error('Error al guardar el equipo:', error);
    alert('Ocurrió un error al guardar el registro en Firestore.');
  } finally {
    btnSave.disabled = false;
    btnSave.innerText = 'Guardar Registro';
  }
}

/**
 * Cargar datos en el formulario para Editar
 */
function editRecord(id) {
  const item = inventoryData.find(rec => rec.id === id);
  if (!item) return;

  document.getElementById('recordId').value = item.id;
  document.getElementById('empEmail').value = item.empEmail || '';
  document.getElementById('empNombre').value = item.empNombre || '';
  document.getElementById('empDpto').value = item.empDpto || '';
  document.getElementById('empZona').value = item.empZona || '';
  
  document.getElementById('pcId').value = item.pcId || '';
  document.getElementById('pcModelo').value = item.pcModelo || '';
  document.getElementById('pcSerie').value = item.pcSerie || '';

  // Asegurar formato String para pantallasNum
  const numPStr = String(item.pantallasNum || "0");
  document.getElementById('pantallasNum').value = numPStr;
  toggleScreensInputs();

  document.getElementById('p1Modelo').value = item.p1Modelo || '';
  document.getElementById('p2Modelo').value = item.p2Modelo || '';

  document.getElementById('monTeclado').value = item.monTeclado || 'USB';
  document.getElementById('monRaton').value = item.monRaton || 'USB';
  document.getElementById('accesorios').value = item.accesorios || '';
  document.getElementById('estadoRegistro').value = item.estadoRegistro || 'En uso';
  document.getElementById('notasRegistro').value = item.notasRegistro || '';

  document.getElementById('modalTitle').innerText = 'Editar Registro de Equipamiento';
  document.getElementById('formModal').classList.add('active');
}

/**
 * Eliminar Registro
 */
async function deleteRecord(id) {
  const item = inventoryData.find(rec => rec.id === id);
  if (!item) return;

  if (confirm(`¿Estás seguro de que deseas eliminar la asignación de ${item.empNombre || item.pcId}?`)) {
    try {
      await deleteDoc(doc(db, INVENTORY_COLLECTION, id));
      await loadInventory();
    } catch (error) {
      console.error('Error al eliminar registro:', error);
      alert('No se pudo eliminar el registro.');
    }
  }
}

/**
 * Filtro de Búsqueda y Estado en tiempo real
 */
function filterTable() {
  const searchValue = document.getElementById('searchInput').value.toLowerCase().trim();
  const statusValue = document.getElementById('statusFilter').value;

  const filtered = inventoryData.filter(item => {
    const matchesSearch = 
      (item.empNombre && item.empNombre.toLowerCase().includes(searchValue)) ||
      (item.empEmail && item.empEmail.toLowerCase().includes(searchValue)) ||
      (item.pcId && item.pcId.toLowerCase().includes(searchValue)) ||
      (item.pcModelo && item.pcModelo.toLowerCase().includes(searchValue)) ||
      (item.empDpto && item.empDpto.toLowerCase().includes(searchValue));

    const matchesStatus = (statusValue === 'Todos') || (item.estadoRegistro === statusValue);

    return matchesSearch && matchesStatus;
  });

  renderTable(filtered);
}

/**
 * Utilidad de Sanitización básica para evitar inyecciones XSS en el HTML
 */
function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
