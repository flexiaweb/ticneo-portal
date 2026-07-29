// 1. IMPORTACIONES CENTRALIZADAS DESDE TU CONFIGURACIÓN LOCAL
import { 
  db, 
  collection, 
  addDoc, 
  getDocs, 
  query, 
  orderBy, 
  serverTimestamp 
} from './firebase-config.js';

let currentData = [];
let currentView = 'history'; // 'history' o 'stock'

// 2. CARGAR DATOS DESDE FIRESTORE
async function loadSheetData() {
  const tbody = document.getElementById('tableBody');
  if (!tbody) return;

  tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">Cargando datos del almacén...</td></tr>`;

  try {
    // Consulta ordenada por lo más reciente
    const q = query(collection(db, "almacen"), orderBy("creadoEl", "desc"));
    const querySnapshot = await getDocs(q);

    currentData = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();

      // Formatear la fecha (Soporta Timestamp de Firebase y texto plano)
      let fechaFormateada = data.fecha;
      if (data.fecha && typeof data.fecha.toDate === 'function') {
        fechaFormateada = data.fecha.toDate().toISOString().split('T')[0];
      }

      currentData.push([
        docSnap.id,
        fechaFormateada || '-',
        data.articulo || '-',
        data.tipoMov || 'Entrada',
        data.cantidad || 0,
        data.tipoSolicitante || '-',
        data.detalleSolicitante || '-',
        data.notas || '-'
      ]);
    });

    if (currentData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay registros en el almacén.</td></tr>`;
      return;
    }

    renderCurrentView();
    updateKPIs(currentData);
    populateArticleDatalist();

  } catch (error) {
    console.error("Error al cargar datos desde Firestore:", error);
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #f87171;">⚠️ Error al conectar con la base de datos de Almacén. Checkea consola o reglas de Firestore.</td></tr>`;
  }
}

// 3. INVENTARIO Y BÚSQUEDA
function calculateInventory(data) {
  const inventory = {};
  data.forEach(row => {
    const articulo = row[2] ? String(row[2]).trim() : 'Sin Nombre';
    const tipoMov = row[3] ? String(row[3]).toLowerCase() : '';
    const cantidad = parseInt(row[4], 10) || 0;

    if (!inventory[articulo]) {
      inventory[articulo] = { entradas: 0, salidas: 0, stock: 0 };
    }

    if (tipoMov.includes('entrada')) {
      inventory[articulo].entradas += cantidad;
      inventory[articulo].stock += cantidad;
    } else if (tipoMov.includes('salida')) {
      inventory[articulo].salidas += cantidad;
      inventory[articulo].stock -= cantidad;
    }
  });
  return inventory;
}

function populateArticleDatalist() {
  const datalist = document.getElementById('articlesList');
  if (!datalist) return;
  datalist.innerHTML = '';
  const inventory = calculateInventory(currentData);

  Object.keys(inventory).sort().forEach(artName => {
    const stock = inventory[artName].stock;
    const option = document.createElement('option');
    option.value = artName;
    option.label = `Stock actual: ${stock} ud(s).`;
    datalist.appendChild(option);
  });
}

function setView(view) {
  currentView = view;
  const btnHist = document.getElementById('btnViewHistory');
  const btnStock = document.getElementById('btnViewStock');
  const filterCont = document.getElementById('typeFilterContainer');

  if (btnHist) btnHist.classList.toggle('active', view === 'history');
  if (btnStock) btnStock.classList.toggle('active', view === 'stock');
  if (filterCont) filterCont.style.display = view === 'history' ? 'block' : 'none';

  renderCurrentView();
}

function renderCurrentView() {
  if (currentView === 'history') {
    filterTable();
  } else {
    renderStockTable();
  }
}

function renderHistoryTable(data) {
  const thead = document.getElementById('tableHeader');
  const tbody = document.getElementById('tableBody');
  if (!thead || !tbody) return;

  thead.innerHTML = `
    <tr>
      <th>Fecha</th>
      <th>Artículo</th>
      <th>Tipo Mov.</th>
      <th>Cantidad</th>
      <th>Tipo Solicitante</th>
      <th>Detalle Solicitante</th>
      <th>Notas</th>
    </tr>`;

  tbody.innerHTML = '';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron resultados.</td></tr>`;
    return;
  }

  data.forEach(row => {
    const fecha = row[1] || '-';
    const articulo = row[2] || '-';
    const tipoMov = row[3] || 'Entrada';
    const cantidad = row[4] || '0';
    const tipoSolicitante = row[5] || '-';
    const detalleSolicitante = row[6] || '-';
    const notas = row[7] || '-';

    const isEntrada = String(tipoMov).toLowerCase().includes('entrada');
    const badgeClass = isEntrada ? 'badge-entrada' : 'badge-salida';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fecha}</td>
      <td style="color:#fff; font-weight: 500;">${articulo}</td>
      <td><span class="badge-mov ${badgeClass}">${tipoMov}</span></td>
      <td><strong>${cantidad}</strong></td>
      <td>${tipoSolicitante}</td>
      <td>${detalleSolicitante}</td>
      <td style="color: var(--text-muted); font-size: 0.85rem;">${notas}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderStockTable() {
  const thead = document.getElementById('tableHeader');
  const tbody = document.getElementById('tableBody');
  const searchInput = document.getElementById('searchInput');
  const searchValue = searchInput ? searchInput.value.toLowerCase() : '';

  if (!thead || !tbody) return;

  thead.innerHTML = `
    <tr>
      <th>Artículo / Insumo</th>
      <th>Total Entradas</th>
      <th>Total Salidas</th>
      <th>Stock Actual</th>
      <th>Estado</th>
    </tr>`;

  tbody.innerHTML = '';
  const inventory = calculateInventory(currentData);
  const filteredItems = Object.keys(inventory).filter(item => item.toLowerCase().includes(searchValue));

  if (filteredItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron artículos.</td></tr>`;
    return;
  }

  filteredItems.sort().forEach(artName => {
    const item = inventory[artName];
    const isAvailable = item.stock > 0;
    const badgeClass = isAvailable ? 'badge-entrada' : 'badge-salida';
    const statusText = isAvailable ? 'Disponible' : 'Agotado';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td style="color:#fff; font-weight: 600; font-size: 1rem;">📦 ${artName}</td>
      <td style="color: #4ade80;">+${item.entradas}</td>
      <td style="color: #f87171;">-${item.salidas}</td>
      <td style="font-size: 1.1rem;"><strong>${item.stock} ud(s).</strong></td>
      <td><span class="badge-mov ${badgeClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

function updateKPIs(data) {
  const kpiTotal = document.getElementById('kpiTotal');
  const kpiEntradas = document.getElementById('kpiEntradas');
  const kpiSalidas = document.getElementById('kpiSalidas');

  if (kpiTotal) kpiTotal.textContent = data.length;
  
  let entradas = 0;
  let salidas = 0;

  data.forEach(row => {
    const tipo = row[3] ? String(row[3]).toLowerCase() : '';
    const qty = parseInt(row[4], 10) || 0;

    if (tipo.includes('entrada')) entradas += qty;
    else if (tipo.includes('salida')) salidas += qty;
  });

  if (kpiEntradas) kpiEntradas.textContent = '+' + entradas;
  if (kpiSalidas) kpiSalidas.textContent = '-' + salidas;
}

function filterTable() {
  if (currentView === 'stock') {
    renderStockTable();
    return;
  }

  const searchInput = document.getElementById('searchInput');
  const typeFilter = document.getElementById('typeFilter');

  const searchValue = searchInput ? searchInput.value.toLowerCase() : '';
  const typeValue = typeFilter ? typeFilter.value : 'Todos';

  const filtered = currentData.filter(row => {
    const matchesSearch = row.some(cell => cell && String(cell).toLowerCase().includes(searchValue));
    const tipoMov = row[3] ? String(row[3]).toLowerCase() : '';
    let matchesType = true;

    if (typeValue === 'Entrada') matchesType = tipoMov.includes('entrada');
    if (typeValue === 'Salida') matchesType = tipoMov.includes('salida');

    return matchesSearch && matchesType;
  });

  renderHistoryTable(filtered);
}

// 4. MODAL Y GUARDADO DE NUEVOS MOVIMIENTOS
function openModal() {
  const fechaInput = document.getElementById('fecha');
  if (fechaInput) fechaInput.valueAsDate = new Date();
  populateArticleDatalist();
  document.getElementById('movementModal').classList.add('active');
}

function closeModal() {
  document.getElementById('movementModal').classList.remove('active');
  document.getElementById('addMovementForm').reset();
}

async function submitForm(e) {
  e.preventDefault();
  const btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Guardando...';

  const fechaVal = document.getElementById('fecha').value;

  const newRecord = {
    fecha: fechaVal ? new Date(fechaVal) : new Date(),
    articulo: document.getElementById('articulo').value,
    tipoMov: document.getElementById('tipoMov').value,
    cantidad: parseInt(document.getElementById('cantidad').value, 10) || 0,
    tipoSolicitante: document.getElementById('tipoSolicitante').value,
    detalleSolicitante: document.getElementById('detalleSolicitante').value,
    notas: document.getElementById('notas').value,
    creadoEl: serverTimestamp()
  };

  try {
    await addDoc(collection(db, "almacen"), newRecord);
    closeModal();
    await loadSheetData();
  } catch (err) {
    console.error("Error guardando en Firestore:", err);
    alert("Ocurrió un error al guardar el registro.");
  } finally {
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Guardar Registro';
  }
}

// Exponer funciones necesarias globalmente
window.setView = setView;
window.filterTable = filterTable;
window.openModal = openModal;
window.closeModal = closeModal;
window.submitForm = submitForm;

// 5. INICIALIZACIÓN DIRECTA (Sin depender de Firebase Auth)
document.addEventListener('DOMContentLoaded', () => {
  loadSheetData();
});
