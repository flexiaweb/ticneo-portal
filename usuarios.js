// usuarios.js - Gestión de usuarios basada 100% en Firestore
import { 
  db, 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc 
} from './firebase-config.js';

let usersList = [];

// 1. CARGAR USUARIOS
async function loadUsers() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  try {
    const querySnapshot = await getDocs(collection(db, "usuarios"));
    usersList = [];

    querySnapshot.forEach((docSnap) => {
      usersList.push({ id: docSnap.id, ...docSnap.data() });
    });

    renderUsersTable();
  } catch (error) {
    console.error("Error al cargar usuarios:", error);
    tbody.innerHTML = `<tr><td colspan="5" class="loading-box" style="color: #f87171;">⚠️ Error al cargar la lista de usuarios. Revisa las reglas de Firestore.</td></tr>`;
  }
}

// 2. RENDERIZAR TABLA
function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';

  if (usersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-box">No hay usuarios registrados.</td></tr>`;
    return;
  }

  usersList.forEach(user => {
    const isActivo = user.activo !== false;
    const statusBadge = isActivo 
      ? '<span class="badge-mov badge-entrada">Activo</span>' 
      : '<span class="badge-mov badge-salida">Inactivo</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color: #fff;">${user.nombre || 'Sin Nombre'}</strong></td>
      <td>${user.email || '-'}</td>
      <td><span class="badge-role">${user.rol || 'usuario'}</span></td>
      <td>${statusBadge}</td>
      <td style="text-align: right;">
        <button onclick="editUser('${user.id}')" class="btn-action" title="Editar">✏️ Editar</button>
        <button onclick="toggleUserStatus('${user.id}', ${isActivo})" class="btn-action">${isActivo ? 'Desactivar' : 'Activar'}</button>
        <button onclick="deleteUserDoc('${user.id}')" class="btn-action btn-danger" title="Eliminar">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. CAMBIAR ESTADO (ACTIVAR / DESACTIVAR)
async function toggleUserStatus(uid, currentStatus) {
  try {
    const userRef = doc(db, "usuarios", uid);
    await updateDoc(userRef, { activo: !currentStatus });
    loadUsers();
  } catch (error) {
    console.error("Error al cambiar estado:", error);
    alert("No se pudo cambiar el estado del usuario.");
  }
}

// 4. ELIMINAR USUARIO
async function deleteUserDoc(uid) {
  if (confirm("¿Estás seguro de eliminar este usuario?")) {
    try {
      await deleteDoc(doc(db, "usuarios", uid));
      loadUsers();
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      alert("Error al eliminar el usuario.");
    }
  }
}

// 5. GUARDAR / EDITAR USUARIO EN FIRESTORE
async function saveUser(e) {
  e.preventDefault();
  const uid = document.getElementById('userId').value;
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim().toLowerCase();
  const password = document.getElementById('userPassword').value; 
  const role = document.getElementById('userRole').value;
  const active = document.getElementById('userStatus').value === 'true';

  const btnSubmit = document.getElementById('btnSaveUser');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';
  }

  try {
    const userData = {
      nombre: name,
      email: email,
      rol: role,
      activo: active
    };

    // Si se escribió contraseña, la agregamos
    if (password) {
      userData.password = password;
    }

    if (uid) {
      // Editar usuario existente
      await updateDoc(doc(db, "usuarios", uid), userData);
    } else {
      // Crear usuario nuevo (si no se especifica contraseña, se asigna una por defecto)
      if (!password) userData.password = "123456";
      await addDoc(collection(db, "usuarios"), userData);
    }

    closeUserModal();
    loadUsers();
    alert(uid ? "Usuario actualizado correctamente." : "Usuario creado en Firestore correctamente.");

  } catch (error) {
    console.error("Error guardando usuario:", error);
    alert("Error al guardar usuario: " + error.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Guardar Usuario';
    }
  }
}

// 6. EDITAR USUARIO EN EL MODAL
function editUser(id) {
  const user = usersList.find(u => u.id === id);
  if (!user) return;

  document.getElementById('userId').value = user.id;
  document.getElementById('userName').value = user.nombre || '';
  document.getElementById('userEmail').value = user.email || '';
  document.getElementById('userPassword').value = user.password || '';
  document.getElementById('userRole').value = user.rol || 'usuario';
  document.getElementById('userStatus').value = (user.activo !== false).toString();

  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = "Editar Usuario";
  
  openUserModal(false);
}

// MANEJO DE MODALES
function openUserModal(reset = true) {
  if (reset) {
    const form = document.getElementById('userForm');
    if (form) form.reset();
    
    const userId = document.getElementById('userId');
    if (userId) userId.value = '';
    
    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = "Nuevo Usuario";
  }

  const modal = document.getElementById('userModal');
  if (modal) modal.classList.add('active');
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.classList.remove('active');
}

// Funciones globales para invocarlas desde HTML
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.editUser = editUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteUserDoc = deleteUserDoc;

document.addEventListener('DOMContentLoaded', loadUsers);
