// auth.js
import { 
  auth, 
  db, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  getDoc 
} from './firebase-config.js';

// Iniciar sesión contra Firebase Auth
export async function loginUser(email, password) {
  const errorMsg = document.getElementById('errorMsg');
  if (errorMsg) errorMsg.style.display = 'none';

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Obtener información adicional del usuario (Rol y Nombre) desde Firestore
    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
    
    if (userDoc.exists()) {
    const userData = userDoc.data();
    
    // 1. VALIDAR SI EL USUARIO ESTÁ INACTIVO/BLOQUEADO
    if (userData.activo === false) {
      await signOut(auth); // Desloguear
      if (errorMsg) {
        errorMsg.textContent = "⚠️ Tu cuenta está desactivada. Contacta con el administrador.";
        errorMsg.style.display = 'block';
      }
      return;
  }

  // 2. GUARDAR ROL Y NOMBRE EN SESSION
  sessionStorage.setItem('ticneo_role', userData.rol || 'usuario');
  sessionStorage.setItem('ticneo_name', userData.nombre || user.email);
}

    window.location.href = 'index.html';
  } catch (error) {
    console.error("Error al autenticar:", error);
    if (errorMsg) {
      errorMsg.textContent = "⚠️ Correo o contraseña incorrectos.";
      errorMsg.style.display = 'block';
    }
  }
}

// Proteger acceso a páginas privadas
export function checkAuth(requiredRole = null) {
  onAuthStateChanged(auth, async (user) => {
    const isLoginPage = window.location.pathname.endsWith('login.html');

    if (!user && !isLoginPage) {
      window.location.href = 'login.html';
      return;
    }

    if (user && isLoginPage) {
      window.location.href = 'index.html';
      return;
    }

    if (user && requiredRole) {
      const userRole = sessionStorage.getItem('ticneo_role');
      if (userRole !== requiredRole && userRole !== 'admin') {
        alert("No tienes permisos suficientes para acceder a esta sección.");
        window.location.href = 'index.html';
      }
    }
  });
}

// Cerrar Sesión
export async function logout() {
  try {
    await signOut(auth);
    sessionStorage.clear();
    window.location.href = 'login.html';
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  }
}

// Ejecutar verificación en la carga de la página
if (!window.location.pathname.endsWith('login.html')) {
  checkAuth();
}

// Exponer la función logout globalmente para usar en botones onclick HTML
window.logout = logout;
window.handleLogin = function(e) {
  e.preventDefault();
  const email = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value;
  loginUser(email, pass);
};
