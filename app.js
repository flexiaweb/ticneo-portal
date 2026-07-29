// app.js - Gestión de Almacén con Firebase Firestore
import { db, collection, addDoc, getDocs, query, orderBy } from './firebase-config.js';

let currentData = [];
let currentView = 'history'; // 'history' o 'stock'

// 1. Cargar Datos desde Firestore
async function loadSheetData() {
  const tbody = document.getElementById('tableBody');
  
  try {
    // Consulta ordenada por fecha descendente
    const q = query(collection(db, "almacen"), orderBy("fecha", "desc"));
    const querySnapshot = await getDocs(q);

    currentData = [];
    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // Formatear al esquema matricial de la vista
      currentData.push([
        docSnap.id,
        data.fecha,
        data.articulo,
        data.tipoMov,
        data.cantidad,
        data.tipoSolicitante,
        data.detalleSolicitante,
        data.notas
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: #f87171;">⚠️ Error al conectar con la base de datos de Almacén.</td></tr>`;
  }
}

// 2. Calcular el Inventario / Stock por producto
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

// 3. Poblar la lista de sugerencias en el formulario
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

// 4. Cambiar entre vista Histórico / Inventario
function setView(view) {
  currentView = view;
  
  document.getElementById('btnViewHistory').classList.toggle('active', view === 'history');
  document.getElementById('btnViewStock').classList.toggle('active', view === 'stock');
  document.getElementById('typeFilterContainer').style.display = view === 'history' ? 'block' : 'none';

  renderCurrentView();
}

function renderCurrentView() {
  if (currentView === 'history') {
    filterTable();
  } else {
    renderStockTable();
  }
}

// 5. Renderizar vista de HISTORIAL
function renderHistoryTable(data) {
  const thead = document.getElementById('tableHeader');
  const tbody = document.getElementById('tableBody');
  
  thead.innerHTML = `
    <tr>
      <th>ID</th>
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
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron resultados.</td></tr>`;
    return;
  }

  data.forEach(row => {
    const id = row[0] ? String(row[0]).substring(0, 6) : '-';
    const fecha = row[1] ? String(row[1]).split('T')[0] : '-';
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
      <td><strong>#${id}</strong></td>
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

// 6. Renderizar vista de STOCK ACUMULADO
function renderStockTable() {
  const thead = document.getElementById('tableHeader');
  const tbody = document.getElementById('tableBody');
  const searchValue = document.getElementById('searchInput').value.toLowerCase();

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

// 7. KPIs y Filtros
function updateKPIs(data) {
  document.getElementById('kpiTotal').textContent = data.length;
  
  let entradas = 0;
  let salidas = 0;

  data.forEach(row => {
    const tipo = row[3] ? String(row[3]).toLowerCase() : '';
    const qty = parseInt(row[4], 10) || 0;

    if (tipo.includes('entrada')) entradas += qty;
    else if (tipo.includes('salida')) salidas += qty;
  });

  document.getElementById('kpiEntradas').textContent = '+' + entradas;
  document.getElementById('kpiSalidas').textContent = '-' + salidas;
}

function filterTable() {
  if (currentView === 'stock') {
    renderStockTable();
    return;
  }

  const searchValue = document.getElementById('searchInput').value.toLowerCase();
  const typeValue = document.getElementById('typeFilter').value;

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

// 8. Abrir/Cerrar Modal
function openModal() {
  document.getElementById('fecha').valueAsDate = new Date();
  populateArticleDatalist();
  document.getElementById('movementModal').classList.add('active');
}

function closeModal() {
  document.getElementById('movementModal').classList.remove('active');
  document.getElementById('addMovementForm').reset();
}

// 9. Guardar Registro en Firestore
async function submitForm(e) {
  e.preventDefault();
  const btnSubmit = document.getElementById('btnSubmit');
  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Guardando...';

  const newRecord = {
    fecha: document.getElementById('fecha').value,
    articulo: document.getElementById('articulo').value,
    tipoMov: document.getElementById('tipoMov').value,
    cantidad: parseInt(document.getElementById('cantidad').value, 10) || 0,
    tipoSolicitante: document.getElementById('tipoSolicitante').value,
    detalleSolicitante: document.getElementById('detalleSolicitante').value,
    notas: document.getElementById('notas').value,
    creadoEl: new Date().toISOString()
  };

  try {
    await addDoc(collection(db, "almacen"), newRecord);

    closeModal();
    await loadSheetData();
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Guardar Registro';

  } catch (err) {
    console.error("Error guardando en Firestore:", err);
    alert("Ocurrió un error al guardar el registro.");
    btnSubmit.disabled = false;
    btnSubmit.textContent = 'Guardar Registro';
  }
}

// Exponer funciones en window para listeners de eventos HTML
window.setView = setView;
window.filterTable = filterTable;
window.openModal = openModal;
window.closeModal = closeModal;
window.submitForm = submitForm;

window.addEventListener('DOMContentLoaded', loadSheetData);