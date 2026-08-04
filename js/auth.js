// auth.js - Gestión de Sesión, Autenticación con Bcrypt, Cambio Obligatorio de Contraseña y Permisos por Rol
import { db, collection, getDocs, doc, getDoc, updateDoc, query, where } from './firebase-config.js';
import bcrypt from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm';

// Variables globales para guardar el ID y la contraseña temporal
let pendingResetUserId = null;
let currentTempPasswordInput = '';

// HELPER: Resolver la ruta relativa correcta según el destino (index.html en raíz vs páginas en /pages/)
function getRelativePath(targetFile) {
  const path = window.location.pathname.toLowerCase();
  const isInsidePages = path.includes('/pages/');

  // Si el destino es el Login (raíz index.html)
  if (targetFile === 'index.html') {
    return isInsidePages ? '../index.html' : 'index.html';
  }
  
  // Si el destino es el Dashboard (/pages/dashboard.html)
  if (targetFile === 'dashboard.html') {
    return isInsidePages ? 'dashboard.html' : 'pages/dashboard.html';
  }

  return targetFile;
}

// 1. VERIFICAR AUTENTICACIÓN Y PERMISOS DE ACCESO AL CARGAR PÁGINA
async function checkAuth() {
  const userRaw = localStorage.getItem('ticneo_user');
  const path = window.location.pathname.toLowerCase();
  
  // La página de login ahora es la raíz (/) o index.html
  const isLoginPage = path.endsWith('/') || path.endsWith('/index.html');

  // Redirigir si no hay sesión iniciada y no está en la página de login (index.html)
  if (!userRaw && !isLoginPage) {
    window.location.href = getRelativePath('index.html');
    return;
  }

  // Redirigir al Dashboard si ya inició sesión e intenta entrar al login (index.html)
  if (userRaw && isLoginPage) {
    window.location.href = getRelativePath('dashboard.html');
    return;
  }

  // 🔒 VALIDACIÓN DE PERMISOS DINÁMICOS POR ROL EN FIRESTORE
  if (userRaw && !isLoginPage) {
    const user = JSON.parse(userRaw);
    
    // Obtener el nombre del archivo actual (ej. "dashboard.html", "camaras.html")
    let currentPage = path.split('/').pop();
    if (!currentPage || currentPage === '') currentPage = 'dashboard.html';

    const tienePermiso = await verificarPermisoRol(user.rol, currentPage);

    if (!tienePermiso) {
      alert("⚠️ No tienes permisos asignados para acceder a este módulo.");
      
      if (currentPage !== 'dashboard.html') {
        window.location.href = getRelativePath('dashboard.html');
      } else {
        logout();
      }
    }
  }
}

// FUNCIÓN AUXILIAR PARA CONSULTAR PERMISOS EN FIRESTORE
async function verificarPermisoRol(rol, paginaActual) {
  if (rol === 'admin') return true;

  try {
    const rolRef = doc(db, "roles", rol);
    const rolSnap = await getDoc(rolRef);

    if (rolSnap.exists()) {
      const permisos = rolSnap.data().permisos || [];
      return permisos.includes(paginaActual);
    }

    return false;
  } catch (error) {
    console.error("Error al verificar permisos del rol en Firestore:", error);
    return false;
  }
}

// Ejecutar la verificación inmediatamente
checkAuth();

// 2. INICIAR SESIÓN CON VERIFICACIÓN EXCLUSIVA DE BCRYPT Y CAMBIO DE CONTRASEÑA
async function loginUser(email, password) {
  const errorMsg = document.getElementById('errorMsg');
  const btnLogin = document.querySelector('button[type="submit"]');

  if (errorMsg) errorMsg.style.display = 'none';

  if (btnLogin) {
    btnLogin.disabled = true;
    btnLogin.textContent = 'Iniciando...';
  }

  try {
    const q = query(
      collection(db, "usuarios"), 
      where("email", "==", email.trim().toLowerCase())
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("El correo electrónico no está registrado.");
    }

    const docSnap = querySnapshot.docs[0];
    const userFound = { id: docSnap.id, ...docSnap.data() };

    // 🔒 VERIFICACIÓN DE CONTRASEÑA VÍA BCRYPT
    const isPasswordValid = bcrypt.compareSync(password, userFound.password);

    if (!isPasswordValid) {
      throw new Error("Contraseña incorrecta.");
    }

    if (userFound.activo === false) {
      throw new Error("Esta cuenta se encuentra inactiva o bloqueada.");
    }

    // 🔑 VERIFICAR SI REQUIERE CAMBIO OBLIGATORIO DE CONTRASEÑA
    const needsPasswordChange = userFound.mustChangePassword === true || 
                                userFound.mustChangePassword === 'true' || 
                                userFound.mustChangePassword === 1;

    if (needsPasswordChange) {
      pendingResetUserId = userFound.id;
      currentTempPasswordInput = password;
      
      const sessionDataTemp = {
        id: userFound.id,
        nombre: userFound.nombre,
        email: userFound.email,
        rol: userFound.rol
      };

      openForceChangePasswordModal(sessionDataTemp);
      return;
    }

    // Si no requiere cambio, crear sesión y redirigir al Dashboard
    saveSessionAndRedirect({
      id: userFound.id,
      nombre: userFound.nombre,
      email: userFound.email,
      rol: userFound.rol
    });

  } catch (error) {
    console.error("Error en el inicio de sesión:", error);

    if (errorMsg) {
      errorMsg.textContent = "⚠️ " + error.message;
      errorMsg.style.display = 'block';
    } else {
      alert("⚠️ " + error.message);
    }
  } finally {
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Iniciar Sesión';
    }
  }
}

// 3. PROCESAR EL CAMBIO OBLIGATORIO DE CONTRASEÑA
async function processForcePasswordChange(e) {
  e.preventDefault();
  const newPass = document.getElementById('newPasswordInput').value.trim();
  const confirmPass = document.getElementById('confirmPasswordInput').value.trim();
  const errorResetMsg = document.getElementById('resetErrorMsg');
  const btnReset = document.getElementById('btnSubmitReset');

  if (errorResetMsg) errorResetMsg.style.display = 'none';

  if (newPass.length < 6) {
    showResetError("La nueva contraseña debe tener al menos 6 caracteres.");
    return;
  }

  if (newPass !== confirmPass) {
    showResetError("Las contraseñas no coinciden.");
    return;
  }

  if (newPass === currentTempPasswordInput) {
    showResetError("La nueva contraseña debe ser diferente a la contraseña actual.");
    return;
  }

  if (!pendingResetUserId) {
    showResetError("Error de sesión. Por favor recarga la página e intenta de nuevo.");
    return;
  }

  if (btnReset) {
    btnReset.disabled = true;
    btnReset.textContent = 'Actualizando...';
  }

  try {
    const newHashedPassword = bcrypt.hashSync(newPass, 10);

    const userRef = doc(db, "usuarios", pendingResetUserId);
    await updateDoc(userRef, {
      password: newHashedPassword,
      mustChangePassword: false
    });

    alert("✅ ¡Contraseña actualizada con éxito! Entrando al sistema...");
    
    const tempUserRaw = sessionStorage.getItem('ticneo_temp_user');
    const tempUser = tempUserRaw ? JSON.parse(tempUserRaw) : null;
    sessionStorage.removeItem('ticneo_temp_user');

    if (tempUser) {
      saveSessionAndRedirect(tempUser);
    } else {
      window.location.href = getRelativePath('index.html');
    }

  } catch (error) {
    console.error("Error al actualizar la contraseña:", error);
    showResetError("Error al guardar la nueva contraseña: " + error.message);
  } finally {
    if (btnReset) {
      btnReset.disabled = false;
      btnReset.textContent = 'Guardar y Entrar';
    }
  }
}

// 4. FUNCIONES AUXILIARES PARA EL MODAL DE RESETEO
function openForceChangePasswordModal(userData) {
  sessionStorage.setItem('ticneo_temp_user', JSON.stringify(userData));
  
  const modal = document.getElementById('forcePasswordModal');
  if (modal) {
    modal.classList.add('active');
    modal.style.display = 'flex';
  } else {
    alert("🔒 Primer inicio de sesión detectado. Debes cambiar tu contraseña.");
    const newPassword = prompt("Introduce tu nueva contraseña (mínimo 6 caracteres):");
    if (newPassword && newPassword.trim() !== currentTempPasswordInput && newPassword.trim().length >= 6) {
      const newHashedPassword = bcrypt.hashSync(newPassword.trim(), 10);
      updateDoc(doc(db, "usuarios", userData.id), {
        password: newHashedPassword,
        mustChangePassword: false
      }).then(() => {
        saveSessionAndRedirect(userData);
      });
    } else {
      alert("Contraseña inválida o no cumple las condiciones.");
    }
  }
}

function showResetError(msg) {
  const errorResetMsg = document.getElementById('resetErrorMsg');
  if (errorResetMsg) {
    errorResetMsg.textContent = "⚠️ " + msg;
    errorResetMsg.style.display = 'block';
  } else {
    alert("⚠️ " + msg);
  }
}

// Guardar sesión y llevar al usuario al Dashboard
function saveSessionAndRedirect(sessionData) {
  localStorage.setItem('ticneo_user', JSON.stringify(sessionData));
  window.location.href = getRelativePath('dashboard.html');
}

// 5. CERRAR SESIÓN (Lleva de vuelta al Login en index.html)
function logout() {
  localStorage.removeItem('ticneo_user');
  sessionStorage.clear();
  window.location.href = getRelativePath('index.html');
}

// Renderizar únicamente el nombre del usuario logueado
function displayLoggedUser() {
  const userDisplay = document.getElementById('userInfoDisplay');
  if (!userDisplay) return;

  const userRaw = localStorage.getItem('ticneo_user');
  if (userRaw) {
    const user = JSON.parse(userRaw);
    const nombre = user.nombre || user.email || 'Usuario';

    userDisplay.innerHTML = `👤 <strong style="color: #fff;">${nombre}</strong>`;
  }
}

// 6. CAPTURA DE FORMULARIOS EN EL DOM
document.addEventListener('DOMContentLoaded', () => {
  displayLoggedUser();
  
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const emailInput = document.getElementById('username');
      const passwordInput = document.getElementById('password');

      if (emailInput && passwordInput) {
        await loginUser(emailInput.value, passwordInput.value);
      }
    });
  }

  const resetForm = document.getElementById('forcePasswordForm');
  if (resetForm) {
    resetForm.addEventListener('submit', processForcePasswordChange);
  }
});

// Exponer funciones globales
window.logout = logout;
window.loginUser = loginUser;

export { logout, loginUser, checkAuth };
