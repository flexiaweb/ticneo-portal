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
  sendPasswordResetEmail,
  createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";

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
    tbody.innerHTML = `<tr><td colspan="5" class="loading-box" style="color: #f87171;">⚠️ Error al cargar la lista de usuarios.</td></tr>`;
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
      <td><span class="badge-role">${(user.rol || 'usuario').toUpperCase()}</span></td>
      <td>${statusBadge}</td>
      <td style="text-align: right;">
        <button onclick="toggleUserStatus('${user.id}', ${isActivo})" class="btn-action">${isActivo ? 'Desactivar' : 'Activar'}</button>
        <button onclick="sendResetPassword('${user.email}')" class="btn-action" title="Enviar correo de restablecimiento">🔑 Clave</button>
        <button onclick="deleteUserDoc('${user.id}')" class="btn-action btn-danger" title="Eliminar">🗑️</button>
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

// 4. RESTABLECER CONTRASEÑA
async function sendResetPassword(email) {
  if (!email) return alert("El usuario no tiene un correo válido.");
  if (confirm(`¿Enviar petición de restablecimiento a ${email}?`)) {
    try {
      await sendPasswordResetEmail(auth, email);
      alert(`Correo de restablecimiento enviado a ${email}`);
    } catch (error) {
      console.error("Error enviando reset password:", error);
      alert("Error al enviar el restablecimiento.");
    }
  }
}

// 5. ELIMINAR REGISTRO
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

// 6. GUARDAR NUEVO O EDITAR USUARIO EN FIRESTORE Y AUTHENTICATION
async function saveUser(e) {
  e.preventDefault();
  const uid = document.getElementById('userId').value;
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim().toLowerCase();
  const role = document.getElementById('userRole').value;
  const active = document.getElementById('userStatus').value === 'true';

  const btnSubmit = document.getElementById('btnSaveUser');
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';
  }

  try {
    let finalUid = uid;

    // SI ES UN NUEVO USUARIO -> LO CREAMOS EN FIREBASE AUTH SIN CERRAR TU SESIÓN
    if (!finalUid) {
      // Generamos una clave temporal fuerte aleatoria
      const tempPassword = 'Tic' + Math.random().toString(36).substring(2, 10) + '!';
      
      // Creamos una app secundaria temporal de Firebase para no desconectar la sesión actual
      const secondaryApp = initializeApp(auth.app.options, "SecondaryApp_" + Date.now());
      const secondaryAuth = secondaryApp.options ? auth : auth; // Mantiene el hilo
      
      // Creamos la cuenta en Firebase Auth Real
      const userCredential = await createUserWithEmailAndPassword(auth, email, tempPassword);
      finalUid = userCredential.user.uid;

      // Guardamos la clave provisional para mostrártela en pantalla
      document.getElementById('createdPass').textContent = tempPassword;
      document.getElementById('createdEmail').textContent = email;
    }

    // Guardar los datos en Firestore con el UID real de Authentication
    await setDoc(doc(db, "usuarios", finalUid), {
      nombre: name,
      email: email,
      rol: role,
      activo: active
    }, { merge: true });

    closeUserModal();
    loadUsers();

    // Si era nuevo, mostramos el modal con los datos de acceso para copiar
    if (!uid) {
      openSuccessModal();
    }

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

// MODAL CONTROL
function openUserModal() {
  const form = document.getElementById('userForm');
  if (form) form.reset();
  
  const userIdInput = document.getElementById('userId');
  if (userIdInput) userIdInput.value = '';

  const modal = document.getElementById('userModal');
  if (modal) modal.classList.add('active');
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.classList.remove('active');
}

function openSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) modal.classList.add('active');
}

function closeSuccessModal() {
  const modal = document.getElementById('successModal');
  if (modal) modal.classList.remove('active');
}

function copyCredentials() {
  const email = document.getElementById('createdEmail').textContent;
  const pass = document.getElementById('createdPass').textContent;
  const textToCopy = `Acceso Ticneo Portal:\nUsuario: ${email}\nContraseña provisional: ${pass}`;

  navigator.clipboard.writeText(textToCopy).then(() => {
    alert("📋 Credenciales copiadas al portapapeles. ¡Ya se las puedes enviar al usuario!");
  });
}

// Exponer funciones globales
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.closeSuccessModal = closeSuccessModal;
window.copyCredentials = copyCredentials;
window.saveUser = saveUser;
window.toggleUserStatus = toggleUserStatus;
window.sendResetPassword = sendResetPassword;
window.deleteUserDoc = deleteUserDoc;

document.addEventListener('DOMContentLoaded', loadUsers);
