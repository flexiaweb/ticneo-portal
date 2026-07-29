// auth.js - Autenticación basada 100% en Firestore
import { db, collection, query, where, getDocs } from './firebase-config.js';

// 1. INICIAR SESIÓN VALIDANDO CONTRA FIRESTORE
export async function loginUser(email, password) {
  const errorMsg = document.getElementById('errorMsg');
  if (errorMsg) errorMsg.style.display = 'none';

  try {
    // Buscar en Firestore si existe un usuario con ese correo
    const q = query(collection(db, "usuarios"), where("email", "==", email.toLowerCase()));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      if (errorMsg) {
        errorMsg.textContent = "⚠️ Correo o contraseña incorrectos.";
        errorMsg.style.display = 'block';
      }
      return;
    }

    let userDocData = null;
    let userId = null;

    querySnapshot.forEach((docSnap) => {
      userDocData = docSnap.data();
      userId = docSnap.id;
    });

    // 1. Validar si la cuenta está activa
    if (userDocData.activo === false) {
      if (errorMsg) {
        errorMsg.textContent = "⚠️ Tu cuenta está desactivada. Contacta con el administrador.";
        errorMsg.style.display = 'block';
      }
      return;
    }

    // 2. Validar contraseña
    if (userDocData.password !== password) {
      if (errorMsg) {
        errorMsg.textContent = "⚠️ Correo o contraseña incorrectos.";
        errorMsg.style.display = 'block';
      }
      return;
    }

    // 3. Guardar datos de sesión en sessionStorage
    const sessionData = {
      id: userId,
      nombre: userDocData.nombre || userDocData.email,
      email: userDocData.email,
      rol: userDocData.rol || 'usuario'
    };

    sessionStorage.setItem('ticneo_user', JSON.stringify(sessionData));
    sessionStorage.setItem('ticneo_role', sessionData.rol);
    sessionStorage.setItem('ticneo_name', sessionData.nombre);

    // Redirigir al inicio
    window.location.href = 'index.html';

  } catch (error) {
    console.error("Error al autenticar:", error);
    if (errorMsg) {
      errorMsg.textContent = "⚠️ Ocurrió un error al intentar iniciar sesión.";
      errorMsg.style.display = 'block';
    }
  }
}

// 2. PROTEGER ACCESO A PÁGINAS PRIVADAS
export function checkAuth(requiredRole = null) {
  const isLoginPage = window.location.pathname.endsWith('login.html');
  const userSession = sessionStorage.getItem('ticneo_user');

  // Si no está logueado y pretende entrar a una página privada -> a login.html
  if (!userSession && !isLoginPage) {
    window.location.href = 'login.html';
    return;
  }

  // Si ya está logueado y entra a login.html -> a index.html
  if (userSession && isLoginPage) {
    window.location.href = 'index.html';
    return;
  }

  // Validar rol si se requiere uno específico
  if (userSession && requiredRole) {
    const userRole = sessionStorage.getItem('ticneo_role');
    if (userRole !== requiredRole && userRole !== 'admin') {
      alert("No tienes permisos suficientes para acceder a esta sección.");
      window.location.href = 'index.html';
    }
  }
}

// 3. CERRAR SESIÓN
export function logout() {
  sessionStorage.clear();
  window.location.href = 'login.html';
}

// Verificar autenticación al cargar
if (!window.location.pathname.endsWith('login.html')) {
  checkAuth();
}

// Funciones globales para eventos HTML
window.logout = logout;
window.handleLogin = function(e) {
  e.preventDefault();
  const emailInput = document.getElementById('username') || document.getElementById('email');
  const passInput = document.getElementById('password');

  if (emailInput && passInput) {
    loginUser(emailInput.value.trim(), passInput.value);
  }
};
