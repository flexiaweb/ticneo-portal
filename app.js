const API_URL = 'https://script.google.com/macros/s/AKfycbwZIHaoo6BO1A57bKmd-N1IlaWHUXd5zaufzvWyuKmpyvwx9b8JH-SrahqGBFUc7AA/exec'; // Reemplaza por tu URL de Apps Script

let currentData = [];

// Cargar datos
async function loadSheetData() {
  const tbody = document.getElementById('tableBody');
  
  try {
    const response = await fetch(API_URL);
    if (!response.ok) throw new Error("Error en la conexión con la API.");
    
    currentData = await response.json();

    if (!Array.isArray(currentData) || currentData.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No hay registros en el almacén.</td></tr>`;
      return;
    }

    renderTable(currentData);
    updateKPIs(currentData);

  } catch (error) {
    console.error("Error al cargar la API:", error);
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align:center; padding: 2rem; color: #f87171;">
          ⚠️ Error al conectar con el servicio de Almacén.
        </td>
      </tr>`;
  }
}

// Renderizar tabla
function renderTable(data) {
  const tbody = document.getElementById('tableBody');
  tbody.innerHTML = '';

  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 2rem; color: var(--text-muted);">No se encontraron resultados.</td></tr>`;
    return;
  }

  data.forEach(row => {
    const id = row[0] || '-';
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

// Métricas
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

// Búsqueda / Filtro
function filterTable() {
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

  renderTable(filtered);
}

// Control del Modal
function openModal() {
  document.getElementById('fecha').valueAsDate = new Date();
  document.getElementById('movementModal').classList.add('active');
}

function closeModal() {
  document.getElementById('movementModal').classList.remove('active');
  document.getElementById('addMovementForm').reset();
}

// Enviar Nuevo Registro
async function submitForm(e) {
    e.preventDefault();
    const btnSubmit = document.getElementById('btnSubmit');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';
  
    const newRecord = {
      fecha: document.getElementById('fecha').value,
      articulo: document.getElementById('articulo').value,
      tipoMov: document.getElementById('tipoMov').value,
      cantidad: document.getElementById('cantidad').value,
      tipoSolicitante: document.getElementById('tipoSolicitante').value,
      detalleSolicitante: document.getElementById('detalleSolicitante').value,
      notas: document.getElementById('notas').value
    };
  
    try {
      // Usamos 'text/plain' para evitar preflight OPTIONS bloqueados por Google
      await fetch(API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(newRecord)
      });
  
      closeModal();
      // Esperamos 1.5 segundos para que Google Sheets termine de escribir el registro
      setTimeout(async () => {
        await loadSheetData();
        btnSubmit.disabled = false;
        btnSubmit.textContent = 'Guardar Registro';
      }, 1500);
  
    } catch (err) {
      console.error("Error guardando:", err);
      alert("Ocurrió un error al guardar el movimiento.");
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Guardar Registro';
    }
  }

window.addEventListener('DOMContentLoaded', loadSheetData);