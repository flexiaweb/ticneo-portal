// usuarios.js - Módulo de administración de usuarios
import { db, auth } from './firebase-config.js';
import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let usersList = [];

// 1. CARGAR USUARIOS DESDE FIRESTORE
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
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: red;">Error al cargar lista de usuarios.</td></tr>`;
  }
}

// 2. RENDERIZAR TABLA
function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  tbody.innerHTML = '';

  if (usersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">No hay usuarios registrados.</td></tr>`;
    return;
  }

  usersList.forEach(user => {
    const isActivo = user.activo !== false; // Por defecto activo
    const statusBadge = isActivo 
      ? '<span class="badge-mov badge-entrada">Activo</span>' 
      : '<span class="badge-mov badge-salida">Inactivo</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${user.nombre || 'Sin Nombre'}</strong></td>
      <td>${user.email || '-'}</td>
      <td><span class="badge-role">${(user.rol || 'usuario').toUpperCase()}</span></td>
      <td>${statusBadge}</td>
      <td>
        <button onclick="toggleUserStatus('${user.id}', ${isActivo})" class="btn-sm">${isActivo ? 'Desactivar' : 'Activar'}</button>
        <button onclick="sendResetPassword('${user.email}')" class="btn-sm" title="Enviar correo de cambio de contraseña">🔑 Clave</button>
        <button onclick="deleteUserDoc('${user.id}')" class="btn-sm btn-danger">🗑️</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 3. ACTIVAR / DESACTIVAR USUARIO
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

// 4. CAMBIO DE CONTRASEÑA (Enviar enlace oficial de restablecimiento)
async function sendResetPassword(email) {
  if (!email) return alert("El usuario no tiene un correo válido.");
  if (confirm(`¿Enviar un correo a ${email} para que reestablezca su contraseña?`)) {
    try {
      await sendPasswordResetEmail(auth, email);
      alert(` Correo enviado con éxito a ${email}`);
    } catch (error) {
      console.error("Error enviando reset password:", error);
      alert("Error al enviar el correo de recuperación.");
    }
  }
}

// 5. ELIMINAR REGISTRO DE USUARIO DE FIRESTORE
async function deleteUserDoc(uid) {
  if (confirm("¿Estás seguro de eliminar el registro de este usuario?")) {
    try {
      await deleteDoc(doc(db, "usuarios", uid));
      loadUsers();
    } catch (error) {
      console.error("Error al eliminar usuario:", error);
      alert("Error al eliminar el usuario.");
    }
  }
}

// 6. GUARDAR NUEVO O EDITAR USUARIO EN FIRESTORE
async function saveUser(e) {
  e.preventDefault();
  const uid = document.getElementById('userId').value;
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim().toLowerCase();
  const role = document.getElementById('userRole').value;
  const active = document.getElementById('userStatus').value === 'true';

  try {
    // Si no tenemos UID, generamos un documento en Firestore usando el correo como ID o auto-id
    const targetDocId = uid || email.replace(/[^a-zA-Z0-9]/g, "_");
    
    await setDoc(doc(db, "usuarios", targetDocId), {
      nombre: name,
      email: email,
      rol: role,
      activo: active
    }, { merge: true });

    closeUserModal();
    loadUsers();
    alert("Usuario guardado correctamente.");
  } catch (error) {
    console.error("Error guardando usuario:", error);
    alert("Ocurrió un error al guardar los datos.");
  }
}

// FUNCIONES DE MODAL
function openUserModal() {
  document.getElementById('userForm').reset();
  document.getElementById('userId').value = '';
  document.getElementById('userModal').classList.add('active');
}

function closeUserModal() {
  document.getElementById('userModal').classList.remove('active');
}

// Exponer funciones globales para eventos en HTML
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.toggleUserStatus = toggleUserStatus;
window.sendResetPassword = sendResetPassword;
window.deleteUserDoc = deleteUserDoc;

// Cargar la lista al iniciar
document.addEventListener('DOMContentLoaded', loadUsers);
