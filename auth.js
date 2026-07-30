// auth.js - Gestión de Sesión, Autenticación con Bcrypt y Control de Permisos por Rol
import { db, collection, getDocs, doc, getDoc, query, where } from './firebase-config.js';
import bcrypt from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm';

// 1. VERIFICAR AUTENTICACIÓN Y PERMISOS DE ACCESO AL CARGAR PÁGINA
async function checkAuth() {
  const userRaw = localStorage.getItem('ticneo_user');
  const path = window.location.pathname.toLowerCase();
  const isLoginPage = path.includes('login.html') || path.endsWith('/login') || path.endsWith('/');

  // Redirigir si no hay sesión iniciada y no está en login
  if (!userRaw && !isLoginPage) {
    window.location.href = 'login.html';
    return;
  }

  // Redirigir a index si ya inició sesión e intenta entrar a login
  if (userRaw && isLoginPage) {
    window.location.href = 'index.html';
    return;
  }

  // 🔒 VALIDACIÓN DE PERMISOS DINÁMICOS POR ROL EN FIRESTORE
  if (userRaw && !isLoginPage) {
    const user = JSON.parse(userRaw);
    
    // Obtener el nombre del archivo actual (ej. "usuarios.html", "almacen.html")
    let currentPage = path.split('/').pop();
    if (!currentPage || currentPage === '') currentPage = 'index.html';

    const tienePermiso = await verificarPermisoRol(user.rol, currentPage);

    if (!tienePermiso) {
      alert("⚠️ No tienes permisos asignados para acceder al módulo: " + currentPage);
      
      // Si se le deniega el acceso y no está en index, lo regresamos al inicio
      if (currentPage !== 'index.html') {
        window.location.href = 'index.html';
      } else {
        // Si no tiene permiso ni para la página principal, cerramos sesión
        logout();
      }
    }
  }
}

// FUNCION AUXILIAR PARA CONSULTAR PERMISOS EN FIRESTORE
async function verificarPermisoRol(rol, paginaActual) {
  // El rol 'admin' siempre tiene acceso a todo por defecto
  if (rol === 'admin') return true;

  try {
    const rolRef = doc(db, "roles", rol);
    const rolSnap = await getDoc(rolRef);

    if (rolSnap.exists()) {
      const permisos = rolSnap.data().permisos || [];
      return permisos.includes(paginaActual);
    }

    // Si el rol no existe aún en Firestore, bloqueamos por seguridad
    return false;
  } catch (error) {
    console.error("Error al verificar permisos del rol en Firestore:", error);
    return false;
  }
}

// Ejecutar la verificación inmediatamente
checkAuth();

// 2. INICIAR SESIÓN CON VERIFICACIÓN EXCLUSIVA DE BCRYPT
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

    let userFound = null;
    querySnapshot.forEach((docSnap) => {
      userFound = { id: docSnap.id, ...docSnap.data() };
    });

    // 🔒 VERIFICACIÓN DE CONTRASEÑA VÍA BCRYPT
    const isPasswordValid = bcrypt.compareSync(password, userFound.password);

    if (!isPasswordValid) {
      throw new Error("Contraseña incorrecta.");
    }

    if (userFound.activo === false) {
      throw new Error("Esta cuenta se encuentra inactiva o bloqueada.");
    }

    const sessionData = {
      id: userFound.id,
      nombre: userFound.nombre,
      email: userFound.email,
      rol: userFound.rol
    };

    localStorage.setItem('ticneo_user', JSON.stringify(sessionData));

    // Redirigir al panel principal
    window.location.href = 'index.html';

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

// 3. CERRAR SESIÓN
function logout() {
  localStorage.removeItem('ticneo_user');
  sessionStorage.clear();
  window.location.href = 'login.html';
}

// 4. CAPTURA AUTOMÁTICA DEL FORMULARIO EN LOGIN.HTML
document.addEventListener('DOMContentLoaded', () => {
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
});

// Exponer funciones globales al objeto window
window.logout = logout;
window.loginUser = loginUser;

export { logout, loginUser, checkAuth };
