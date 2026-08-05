// usuarios.js - Gestión de usuarios y permisos por roles en Firestore con hashing bcrypt
import { 
  db, 
  collection, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  updateDoc, 
  deleteDoc, 
  addDoc,
  arrayRemove, 
  increment   
} from './firebase-config.js';
import bcrypt from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm';

let usersList = [];
let rolesList = [];

// 📌 LISTA GLOBAL DE MÓDULOS DEL SISTEMA
const MODULOS_SISTEMA = [
  { id: 'dashboard.html', nombre: 'Inicio / Dashboard' },
  { id: 'usuarios.html', nombre: 'Gestión de Usuarios' },
  { id: 'almacen.html', nombre: 'Gestión de Inventario' },
  { id: 'inventario-empresa.html', nombre: 'Inventario de Empresa' },
  { id: 'camaras.html', nombre: 'Gestión de Cámaras' }
];

// 0. CARGAR ROLES DESDE LA COLECCIÓN 'roles' DE FIRESTORE
async function loadRoles() {
  try {
    const querySnapshot = await getDocs(collection(db, "roles"));
    rolesList = [];

    querySnapshot.forEach((docSnap) => {
      rolesList.push(docSnap.id); // Guarda los IDs de los documentos (ej: "admin", "usuario")
    });

    // Fallback por si la colección está vacía en Firestore
    if (rolesList.length === 0) {
      rolesList = ['admin', 'usuario'];
    }

    renderRolesSelects();
  } catch (error) {
    console.error("Error al cargar roles de Firestore:", error);
    rolesList = ['admin', 'usuario'];
    renderRolesSelects();
  }
}

// Poblado dinámico de los desplegables de roles en el HTML
function renderRolesSelects() {
  const selectUserRole = document.getElementById('userRole');
  const selectModalRol = document.getElementById('selectRol');

  // Rellenar select del formulario de Usuario
  if (selectUserRole) {
    const currentVal = selectUserRole.value;
    selectUserRole.innerHTML = '';
    rolesList.forEach(rol => {
      const option = document.createElement('option');
      option.value = rol;
      option.textContent = rol.charAt(0).toUpperCase() + rol.slice(1);
      selectUserRole.appendChild(option);
    });
    if (currentVal && rolesList.includes(currentVal)) {
      selectUserRole.value = currentVal;
    }
  }

  // Rellenar select del modal de Configuración de Permisos
  if (selectModalRol) {
    const currentVal = selectModalRol.value;
    selectModalRol.innerHTML = '';
    rolesList.forEach(rol => {
      const option = document.createElement('option');
      option.value = rol;
      option.textContent = rol.charAt(0).toUpperCase() + rol.slice(1);
      selectModalRol.appendChild(option);
    });
    if (currentVal && rolesList.includes(currentVal)) {
      selectModalRol.value = currentVal;
    }
  }
}

// 0.1 NUEVA FUNCIÓN: CREAR NUEVO ROL EN FIRESTORE
async function createNewRole() {
  const input = document.getElementById('newRoleInput');
  if (!input) return;

  const newRoleRaw = input.value.trim().toLowerCase();
  // Normalizar slug (sin espacios ni caracteres especiales)
  const newRole = newRoleRaw.replace(/[^a-z0-9_-]/g, '');

  if (!newRole) {
    alert("Por favor ingresa un nombre válido para el nuevo rol.");
    return;
  }

  if (rolesList.includes(newRole)) {
    alert(`El rol "${newRole}" ya existe.`);
    return;
  }

  try {
    // Crear el documento del nuevo rol en Firestore con un array vacío de permisos
    await setDoc(doc(db, "roles", newRole), {
      permisos: []
    });

    alert(`✅ Rol "${newRole}" creado con éxito.`);
    input.value = '';

    // Recargar roles desde Firestore y seleccionar el rol recién creado
    await loadRoles();
    
    const selectModalRol = document.getElementById('selectRol');
    if (selectModalRol) {
      selectModalRol.value = newRole;
      cargarPermisosDelRol(newRole);
    }
  } catch (error) {
    console.error("Error al crear nuevo rol:", error);
    alert("Error al guardar el nuevo rol en Firestore.");
  }
}

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

// 2. RENDERIZAR TABLA DE USUARIOS
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

// 4. ELIMINAR USUARIO (Y LIBERAR SU LICENCIA EN FIRESTORE)
async function deleteUserDoc(uid) {
  if (confirm("¿Estás seguro de eliminar este usuario? Si tiene una licencia asignada, será liberada automáticamente.")) {
    try {
      // 1. Buscar si existe alguna licencia que tenga a este usuario registrado en su array "usuarios"
      const licenciasRef = collection(db, "licencias");
      const q = query(licenciasRef, where("usuarios", "array-contains", uid));
      const querySnap = await getDocs(q);

      // 2. Si se encuentra la licencia, la actualizamos
      if (!querySnap.empty) {
        querySnap.forEach(async (docLic) => {
          const licRef = doc(db, "licencias", docLic.id);
          const licData = docLic.data();
          
          const usosMax = licData.usosMaximos || 1;
          const nuevosUsos = Math.max(0, (licData.usosActuales || 1) - 1);

          await updateDoc(licRef, {
            usuarios: arrayRemove(uid),       // Remueve la UID del array "usuarios"
            usosActuales: increment(-1),      // Resta 1 a usosActuales
            usada: nuevosUsos >= usosMax      // Si baja del cupo máximo, pasa a false (disponible)
          });
        });
      }

      // 3. Eliminar el documento del usuario en la colección "usuarios"
      await deleteDoc(doc(db, "usuarios", uid));

      // 4. Refrescar la tabla en pantalla
      loadUsers();

    } catch (error) {
      console.error("Error al eliminar el usuario y liberar su licencia:", error);
      alert("Error al eliminar el usuario: " + error.message);
    }
  }
}

// 5. GUARDAR / EDITAR USUARIO EN FIRESTORE (CON BCRYPT Y CAMBIO DE CONTRASEÑA OBLIGATORIO)
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
      if (password !== "") {
        const hashedPassword = bcrypt.hashSync(password, 10);
        userData.password = hashedPassword;
        // 🔒 Si el administrador le resetea la contraseña, obligar a cambiarla en su próximo acceso
        userData.mustChangePassword = true;
      }

      await updateDoc(doc(db, "usuarios", uid), userData);
      closeUserModal();
      loadUsers();

      alert("Usuario actualizado correctamente.");

    } else {
      // --- MODO CREAR NUEVO ---
      const plainPassword = password !== "" ? password : generateRandomPassword();
      
      // 🔒 Aplicar Hash Bcrypt
      const hashedPassword = bcrypt.hashSync(plainPassword, 10);
      userData.password = hashedPassword;

      // 🔒 Obligar al usuario a cambiar la contraseña en su primer login
      userData.mustChangePassword = true;

      await addDoc(collection(db, "usuarios"), userData);

      closeUserModal();
      loadUsers();

      // Mostrar modal de éxito
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

  document.getElementById('userPassword').value = '';
  document.getElementById('userPassword').placeholder = 'Escribe nueva clave para resetear';
  
  const lblPassword = document.getElementById('lblPassword');
  if (lblPassword) lblPassword.textContent = 'Resetear Contraseña';

  const passwordHelp = document.getElementById('passwordHelp');
  if (passwordHelp) passwordHelp.textContent = '⚠️ Deja en blanco para mantener la contraseña actual. Si la reseteas, se obligará al usuario a cambiarla al entrar.';

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

// 8. MANEJO DE MODALES DE USUARIO
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
    if (passwordHelp) passwordHelp.textContent = 'Si se deja en blanco, se creará una contraseña automática. Se requerirá cambio de contraseña en el primer acceso.';
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

// 10. GESTIÓN DE PERMISOS Y ROLES DINÁMICOS
async function openRolesModal() {
  await loadRoles(); // Garantiza que los roles del desplegable estén sincronizados
  const modal = document.getElementById('rolesModal');
  if (modal) {
    modal.classList.add('active');
    const selectRol = document.getElementById('selectRol');
    const rolInicial = selectRol ? selectRol.value : (rolesList[0] || 'admin');
    cargarPermisosDelRol(rolInicial);
  }
}

function closeRolesModal() {
  const modal = document.getElementById('rolesModal');
  if (modal) modal.classList.remove('active');
}

function renderizarListaModulos() {
  const contenedor = document.getElementById('contenedorCheckboxes');
  if (!contenedor) return;

  contenedor.innerHTML = '';
  
  MODULOS_SISTEMA.forEach(modulo => {
    const div = document.createElement('div');
    div.style.padding = '0.4rem 0';
    div.innerHTML = `
      <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; color: #fff;">
        <input type="checkbox" name="permisos" value="${modulo.id}" style="width: 16px; height: 16px; cursor: pointer;">
        <span>${modulo.nombre}</span>
        <small style="color: var(--text-muted, #94a3b8); font-size: 0.75rem;">(${modulo.id})</small>
      </label>
    `;
    contenedor.appendChild(div);
  });
}

async function cargarPermisosDelRol(rol) {
  renderizarListaModulos();

  try {
    const rolRef = doc(db, "roles", rol);
    const rolSnap = await getDoc(rolRef);

    if (rolSnap.exists()) {
      const permisos = rolSnap.data().permisos || [];
      const checkboxes = document.querySelectorAll('input[name="permisos"]');

      checkboxes.forEach(chk => {
        chk.checked = permisos.includes(chk.value);
      });
    }
  } catch (error) {
    console.error("Error al cargar permisos del rol:", error);
  }
}

async function guardarPermisos(e) {
  e.preventDefault();
  const rol = document.getElementById('selectRol').value;
  const checkboxes = document.querySelectorAll('input[name="permisos"]:checked');
  const permisosSeleccionados = Array.from(checkboxes).map(chk => chk.value);

  try {
    await setDoc(doc(db, "roles", rol), {
      permisos: permisosSeleccionados
    }, { merge: true });

    alert(`✅ Permisos actualizados correctamente para el rol: ${rol}`);
    closeRolesModal();
    loadRoles(); // Refrescar en memoria
  } catch (error) {
    console.error("Error al guardar permisos:", error);
    alert("Error al actualizar permisos en Firestore.");
  }
}

// 11. EXPORTACIÓN DE FUNCIONES AL ÁMBITO GLOBAL (window)
window.openUserModal = openUserModal;
window.closeUserModal = closeUserModal;
window.saveUser = saveUser;
window.editUser = editUser;
window.toggleUserStatus = toggleUserStatus;
window.deleteUserDoc = deleteUserDoc;
window.resetPasswordGenerator = resetPasswordGenerator;
window.closeSuccessModal = closeSuccessModal;
window.copyCredentials = copyCredentials;

// Funciones del Modal de Roles
window.openRolesModal = openRolesModal;
window.closeRolesModal = closeRolesModal;
window.cargarPermisosDelRol = cargarPermisosDelRol;
window.guardarPermisos = guardarPermisos;
window.createNewRole = createNewRole; // Exposición para el botón "➕ Crear Rol"

// Inicialización al cargar el documento
document.addEventListener('DOMContentLoaded', async () => {
  await loadRoles();
  await loadUsers();
});
