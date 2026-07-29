// auth.js - Gestión de Sesión y Autenticación directa en Firestore
import { db, collection, getDocs, query, where } from './firebase-config.js';

// 1. INICIAR SESIÓN
async function loginUser(email, password) {
  const errorMsg = document.getElementById('errorMsg');
  const btnLogin = document.querySelector('button[type="submit"]');

  // Ocultar mensaje de error previo si existe
  if (errorMsg) errorMsg.style.display = 'none';

  // Cambiar estado del botón a cargando
  if (btnLogin) {
    btnLogin.disabled = true;
    btnLogin.textContent = 'Iniciando...';
  }

  try {
    console.log("Intentando iniciar sesión con:", email);

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

    // Validar contraseña
    if (userFound.password !== password) {
      throw new Error("Contraseña incorrecta.");
    }

    // Validar si la cuenta está activa
    if (userFound.activo === false) {
      throw new Error("Esta cuenta se encuentra inactiva o bloqueada.");
    }

    // Guardar la sesión activa en localStorage
    const sessionData = {
      id: userFound.id,
      nombre: userFound.nombre,
      email: userFound.email,
      rol: userFound.rol
    };

    localStorage.setItem('ticneo_user', JSON.stringify(sessionData));
    console.log("Sesión guardada con éxito:", sessionData);

    // Redirigir al panel principal (index.html)
    window.location.href = 'index.html';

  } catch (error) {
    console.error("Error en el inicio de sesión:", error);

    // Si existe la etiqueta #errorMsg en el HTML, muestra el mensaje ahí; si no, lanza alerta.
    if (errorMsg) {
      errorMsg.textContent = "⚠️ " + error.message;
      errorMsg.style.display = 'block';
    } else {
      alert("⚠️ " + error.message);
    }
  } finally {
    // Restaurar estado del botón
    if (btnLogin) {
      btnLogin.disabled = false;
      btnLogin.textContent = 'Iniciar Sesión';
    }
  }
}

// 2. CERRAR SESIÓN
function logout() {
  localStorage.removeItem('ticneo_user');
  sessionStorage.clear();
  window.location.href = 'login.html';
}

// 3. CAPTURA AUTOMÁTICA DEL FORMULARIO EN LOGIN.HTML
document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault(); // 🛑 Detiene la recarga nativa de la página por HTML

      const emailInput = document.getElementById('username');
      const passwordInput = document.getElementById('password');

      if (emailInput && passwordInput) {
        await loginUser(emailInput.value, passwordInput.value);
      }
    });
  }
});

// Exponer funciones globales al objeto window para botones HTML (onclick)
window.logout = logout;
window.loginUser = loginUser;

export { logout, loginUser };
