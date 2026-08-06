// usuarios.js - Gestión de usuarios y permisos por roles en Firestore
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
  increment,
  query,
  where
} from './firebase-config.js';

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
      rolesList = ['Admin', 'Sistemas', 'Usuario'];
    }

    renderRolesSelects();
  } catch (error) {
    console.error("Error al cargar roles de Firestore:", error);
    rolesList = ['Admin', 'Sistemas', 'Usuario'];
    renderRolesSelects();
  }
}

// Poblado dinámico de los desplegables de roles en el HTML
function renderRolesSelects() {
  const selectUserRole = document.getElementById('userRole') || document.getElementById('usuarioRol');
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

// 0.1 CREAR NUEVO ROL EN FIRESTORE
async function createNewRole() {
  const input = document.getElementById('newRoleInput');
  if (!input) return;

  const newRoleRaw = input.value.trim();
  const newRole = newRoleRaw.replace(/[^a-zA-Z0-9_-]/g, '');

  if (!newRole) {
    alert("Por favor ingresa un nombre válido para el nuevo rol.");
    return;
  }

  if (rolesList.includes(newRole)) {
    alert(`El rol "${newRole}" ya existe.`);
    return;
  }

  try {
    await setDoc(doc(db, "roles", newRole), {
      permisos: []
    });

    alert(`✅ Rol "${newRole}" creado con éxito.`);
    input.value = '';

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
  if (!tbody) return;
  tbody.innerHTML = '';

  if (usersList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="loading-box">No hay usuarios registrados.</td></tr>`;
    return;
  }

  usersList.forEach(user => {
    const isActivo = user.estado === 'Activo' || user.activo === true;
    const statusBadge = isActivo 
      ? '<span class="badge-mov badge-entrada">Activo</span>' 
      : '<span class="badge-mov badge-salida">Inactivo</span>';

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong style="color: #fff;">${user.nombre || 'Pendiente de primer acceso'}</strong></td>
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
    const nuevoEstado = currentStatus ? 'Inactivo' : 'Activo';
    await updateDoc(userRef, { 
      estado: nuevoEstado,
      activo: !currentStatus 
    });
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
      const licenciasRef = collection(db, "licencias");
      const q = query(licenciasRef, where("usuarios", "array-contains", uid));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        for (const docLic of querySnap.docs) {
          const licRef = doc(db, "licencias", docLic.id);
          const licData = docLic.data();
          
          const usosMax = Number(licData.usosMaximos) || 1;
          const usosAct = Number(licData.usosActuales) || 1;
          const nuevosUsos = Math.max(0, usosAct - 1);

          await updateDoc(licRef, {
            usuarios: arrayRemove(uid),
            usosActuales: increment(-1),
            usada: nuevosUsos >= usosMax
          });
        }
      }

      await deleteDoc(doc(db, "usuarios", uid));
      await loadUsers();

    } catch (error) {
      console.error("Error al eliminar el usuario y liberar su licencia:", error);
      alert("Error al eliminar el usuario: " + error.message);
    }
  }
}

// 5. GUARDAR / PRE-AUTORIZAR USUARIO
async function saveUser(e) {
  e.preventDefault();
  const uid = document.getElementById('userId')?.value;
  const email = document.getElementById('userEmail')?.value || document.getElementById('usuarioEmail')?.value;
  const role = document.getElementById('userRole')?.value || document.getElementById('usuarioRol')?.value;
  const state = document.getElementById('userStatus')?.value || document.getElementById('usuarioEstado')?.value || 'Activo';

  if (!email) {
    alert("El correo electrónico es obligatorio.");
    return;
  }

  const emailClean = email.trim().toLowerCase();
  const btnSubmit = document.getElementById('btnSaveUser') || document.getElementById('btnGuardarUsuario');
  
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';
  }

  try {
    const userData = {
      email: emailClean,
      rol: role,
      estado: state,
      activo: state === 'Activo'
    };

    // Usamos el correo electrónico como ID de documento para evitar duplicados y facilitar el acceso con Google Auth
    const userDocRef = doc(db, "usuarios", uid || emailClean);
    
    if (uid) {
      await updateDoc(userDocRef, userData);
      alert("Usuario actualizado correctamente.");
    } else {
      await setDoc(userDocRef, {
        ...userData,
        nombre: "Pendiente de primer acceso",
        registrado: false,
        creadoEl: new Date()
      }, { merge: true });
      alert("Usuario pre-autorizado con éxito.");
    }

    closeUserModal();
    loadUsers();

  } catch (error) {
    console.error("Error guardando usuario:", error);
    alert("Error al guardar usuario: " + error.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Autorizar Acceso';
    }
  }
}

// 6. EDITAR USUARIO EN EL MODAL
function editUser(id) {
  const user = usersList.find(u => u.id === id);
  if (!user) return;

  const inputUserId = document.getElementById('userId');
  if (inputUserId) inputUserId.value = user.id;

  const inputEmail = document.getElementById('userEmail') || document.getElementById('usuarioEmail');
  if (inputEmail) {
    inputEmail.value = user.email || '';
    inputEmail.disabled = true; // El email no debe cambiar si es la clave de Firestore
  }

  const selectRole = document.getElementById('userRole') || document.getElementById('usuarioRol');
  if (selectRole) selectRole.value = user.rol || rolesList[0];

  const selectState = document.getElementById('userStatus') || document.getElementById('usuarioEstado');
  if (selectState) selectState.value = user.estado || (user.activo !== false ? 'Activo' : 'Inactivo');

  openUserModal(false);
}

// 8. MANEJO DE MODALES DE USUARIO
async function openUserModal(reset = true) {
  await loadRoles(); // Carga los roles antes de abrir el modal para que el <select> no esté vacío

  if (reset) {
    const form = document.getElementById('userForm');
    if (form) form.reset();

    const userId = document.getElementById('userId');
    if (userId) userId.value = '';

    const inputEmail = document.getElementById('userEmail') || document.getElementById('usuarioEmail');
    if (inputEmail) inputEmail.disabled = false;
  }

  const modal = document.getElementById('userModal');
  if (modal) modal.classList.add('active');
}

function closeUserModal() {
  const modal = document.getElementById('userModal');
  if (modal) modal.classList.remove('active');
}

// 10. GESTIÓN DE PERMISOS Y ROLES DINÁMICOS
async function openRolesModal() {
  await loadRoles(); 
  const modal = document.getElementById('rolesModal');
  if (modal) {
    modal.classList.add('active');
    const selectRol = document.getElementById('selectRol');
    const rolInicial = selectRol ? selectRol.value : (rolesList[0] || 'Admin');
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
    loadRoles(); 
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
window.createNewRole = createNewRole;

// Funciones del Modal de Roles
window.openRolesModal = openRolesModal;
window.closeRolesModal = closeRolesModal;
window.cargarPermisosDelRol = cargarPermisosDelRol;
window.guardarPermisos = guardarPermisos;

// Inicialización al cargar el documento
document.addEventListener('DOMContentLoaded', async () => {
  await loadRoles();
  await loadUsers();
});
