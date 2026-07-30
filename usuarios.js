// usuarios.js - Gestión de usuarios basada 100% en Firestore con hashing de contraseñas
import { 
  db, 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  deleteDoc, 
  addDoc 
} from './firebase-config.js';
import bcrypt from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm';

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

// 5. GUARDAR / EDITAR USUARIO EN FIRESTORE (CON BCRYPT)
async function saveUser(e) {
  e.preventDefault();
  const uid = document.getElementById('userId').value;
  const name = document.getElementById('userName').value.trim();
  const email = document.getElementById('userEmail').value.trim().toLowerCase();
  const password = document.getElementById('userPassword').value.trim(); 
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

    if (uid) {
      // --- MODO EDITAR ---
      // Solo actualizamos y hasheamos la contraseña si se ingresó algo nuevo
      if (password !== "") {
        const hashedPassword = bcrypt.hashSync(password, 10);
        userData.password = hashedPassword;
      }

      await updateDoc(doc(db, "usuarios", uid), userData);
      closeUserModal();
      loadUsers();

      if (password !== "") {
        // Muestra la clave en texto plano al admin solo para copiado/confirmación
        showSuccessModal(email, password);
      } else {
        alert("Usuario actualizado correctamente.");
      }

    } else {
      // --- MODO CREAR NUEVO ---
      // Si la contraseña se dejó en blanco, se genera una automática
      const plainPassword = password !== "" ? password : generateRandomPassword();
      
      // 🔒 Aplicar Hash Bcrypt antes de guardar en Firestore
      const hashedPassword = bcrypt.hashSync(plainPassword, 10);
      userData.password = hashedPassword;

      await addDoc(collection(db, "usuarios"), userData);

      closeUserModal();
      loadUsers();

      // Mostrar modal de éxito mostrando la contraseña plana generada/ingresada
      showSuccessModal(email, plainPassword);
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

// 6. EDITAR USUARIO EN EL MODAL
function editUser(id) {
  const user = usersList.find(u => u.id === id);
  if (!user) return;

  document.getElementById('userId').value = user.id;
  document.getElementById('userName').value = user.nombre || '';
  document.getElementById('userEmail').value = user.email || '';
  document.getElementById('userRole').value = user.rol || 'usuario';
  document.getElementById('userStatus').value = (user.activo !== false).toString();

  // Dejamos la contraseña en blanco y ajustamos textos explicativos
  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').placeholder = 'Escribe nueva clave para resetear';
  
  const lblPassword = document.getElementById('lblPassword');
  if (lblPassword) lblPassword.textContent = 'Resetear Contraseña';

  const passwordHelp = document.getElementById('passwordHelp');
  if (passwordHelp) passwordHelp.textContent = '⚠️ Deja en blanco para mantener la contraseña actual.';

  const modalTitle = document.getElementById('modalTitle');
  if (modalTitle) modalTitle.textContent = "Editar Usuario";

  openUserModal(false);
}

// 7. GENERADOR DE CONTRASEÑA ALEATORIA (Botón 🎲)
function resetPasswordGenerator() {
  const pass = generateRandomPassword();
  document.getElementById('userPassword').value = pass;
}

function generateRandomPassword() {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%';
  let pass = '';
  for (let i = 0; i < 10; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return pass;
}

// 8. MANEJO DE MODALES
function openUserModal(reset = true) {
  if (reset) {
    const form = document.getElementById('userForm');
    if (form) form.reset();

    const userId = document.getElementById('userId');
    if (userId) userId.value = '';

    const modalTitle = document.getElementById('modalTitle');
    if (modalTitle) modalTitle.textContent = "Nuevo Usuario";

    const lblPassword = document.getElementById('lblPassword');
    if (lblPassword) lblPassword.textContent = 'Contraseña';

    const userPassword = document.getElementById('userPassword');
    if (userPassword) userPassword.placeholder = 'Ej. Pass1234!';

    const passwordHelp = document.getElementById('passwordHelp');
    if (passwordHelp) passwordHelp.textContent = 'Si se deja en blanco, se creará una contraseña automática.';
  }

  const modal = document.getElementById('userModal');
  if (modal) modal.classList.add('active');
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.classList.remove('active');
}

// 9. MODAL DE ÉXITO Y COPIADO DE CREDENCIALES
function showSuccessModal(email, password) {
  const emailSpan = document.getElementById('createdEmail');
  const passSpan = document.getElementById('createdPass');

  if (emailSpan) emailSpan.textContent = email;
  if (passSpan) passSpan.textContent = password;

  const successModal = document.getElementById('successModal');
  if (successModal) successModal.classList.add('active');
}

function closeSuccessModal() {
  const successModal = document.getElementById('successModal');
  if (successModal) successModal.classList.remove('active');
}

function copyCredentials() {
  const email = document.getElementById('createdEmail')?.textContent || '';
  const pass = document.getElementById('createdPass')?.textContent || '';
  const textToCopy = `Credenciales de Acceso Ticneo Portal:\nEmail: ${email}\nContraseña: ${pass}`;

  navigator.clipboard.writeText(textToCopy).then(() => {
    alert("📋 Credenciales copiadas al portapapeles.");
  }).catch(err => {
    console.error("Error al copiar credenciales:", err);
    alert("No se pudo copiar automáticamente. Por favor selecciónalas manualmente.");
  });
}

// Exportar funciones globales para invocarlas desde el HTML
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.editUser = editUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteUserDoc = deleteUserDoc;
window.resetPasswordGenerator = resetPasswordGenerator;
window.closeSuccessModal = closeSuccessModal;
window.copyCredentials = copyCredentials;

// Inicialización al cargar el documento
document.addEventListener('DOMContentLoaded', loadUsers);
