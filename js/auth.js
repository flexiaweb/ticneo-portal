// auth.js
import { 
  auth, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  db, 
  doc, 
  getDoc, 
  setDoc 
} from './firebase-config.js';
import { verificarLicenciaUsuario } from './licencia.js';

function getRelativePath(targetFile) {
  const path = window.location.pathname.toLowerCase();
  const isInsidePages = path.includes('/pages/');

  if (targetFile === 'index.html') return isInsidePages ? '../index.html' : 'index.html';
  if (targetFile === 'dashboard.html') return isInsidePages ? 'dashboard.html' : 'pages/dashboard.html';
  return targetFile;
}

// 1. INICIAR SESIÓN CON GOOGLE
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user; // Objeto del usuario de Firebase Auth

    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);

    // Si el usuario no existe en Firestore, se crea su perfil base manteniendo sincronizado el ID
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        nombre: user.displayName || 'Usuario Google',
        email: user.email.toLowerCase(),
        rol: 'usuario', // Rol por defecto
        activo: true,
        creadoEl: new Date()
      });
    } else {
      const userData = userSnap.data();
      if (userData.activo === false) {
        await signOut(auth);
        alert("⚠️ Tu cuenta se encuentra inactiva o deshabilitada.");
        return;
      }
    }

    window.location.href = getRelativePath('dashboard.html');
  } catch (error) {
    console.error("Error al iniciar sesión con Google:", error);
    alert("⚠️ Error en autenticación con Google: " + error.message);
  }
}

// 2. VERIFICACIÓN CONTINUA DE ESTADO DE AUTENTICACIÓN Y ROLES
function checkAuth() {
  onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname.toLowerCase();
    const isLoginPage = path.endsWith('/') || path.endsWith('/index.html');

    if (!user && !isLoginPage) {
      window.location.href = getRelativePath('index.html');
      return;
    }

    if (user) {
      if (isLoginPage) {
        window.location.href = getRelativePath('dashboard.html');
        return;
      }

      // Validar datos desde Firestore usando user.uid
      try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists() || userSnap.data().activo === false) {
          alert("⚠️ Cuenta inactiva o no registrada.");
          logout();
          return;
        }

        const userData = userSnap.data();

        // Validar Licencia
        const tieneLicencia = await verificarLicenciaUsuario(user.uid);
        if (!tieneLicencia) return;

        // Validar Permiso del Rol
        let currentPage = path.split('/').pop() || 'dashboard.html';
        const tienePermiso = await verificarPermisoRol(userData.rol, currentPage);

        if (!tienePermiso) {
          alert("⚠️ No tienes permisos asignados para acceder a este módulo.");
          if (currentPage !== 'dashboard.html') {
            window.location.href = getRelativePath('dashboard.html');
          } else {
            logout();
          }
        } else {
          displayLoggedUser(userData.nombre || user.displayName);
        }
      } catch (err) {
        console.error("Error comprobando sesión en Firestore:", err);
      }
    }
  });
}

async function verificarPermisoRol(rol, paginaActual) {
  if (rol === 'admin') return true;
  try {
    const rolRef = doc(db, "roles", rol);
    const rolSnap = await getDoc(rolRef);
    if (rolSnap.exists()) {
      return (rolSnap.data().permisos || []).includes(paginaActual);
    }
    return false;
  } catch (error) {
    return false;
  }
}

function logout() {
  signOut(auth).then(() => {
    window.location.href = getRelativePath('index.html');
  });
}

function displayLoggedUser(nombre) {
  const userDisplay = document.getElementById('userInfoDisplay');
  if (userDisplay && nombre) {
    userDisplay.innerHTML = `<span style="color: #0b0914;">${nombre}</span>`;
  }
}

checkAuth();

window.logout = logout;
window.loginWithGoogle = loginWithGoogle;

export { logout, loginWithGoogle, checkAuth };
