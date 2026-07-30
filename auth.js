// auth.js - Gestión de Sesión y Autenticación con Bcrypt
import { db, collection, getDocs, query, where } from './firebase-config.js';
import bcrypt from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm';

// 1. VERIFICAR AUTENTICACIÓN AL CARGAR CUALQUIER PÁGINA
function checkAuth() {
  const user = localStorage.getItem('ticneo_user');
  const path = window.location.pathname.toLowerCase();
  const isLoginPage = path.includes('login.html') || path.endsWith('/login') || path.endsWith('/');

  if (!user && !isLoginPage) {
    window.location.href = 'login.html';
    return;
  }

  if (user && isLoginPage) {
    window.location.href = 'index.html';
    return;
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

export { logout, loginUser };
