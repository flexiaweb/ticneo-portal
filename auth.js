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

// 1. Iniciar sesión contra Firebase Auth
export async function loginUser(email, password) {
  const errorMsg = document.getElementById('errorMsg');
  const btnSubmit = document.getElementById('btnLogin');

  if (errorMsg) errorMsg.style.display = 'none';
  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Iniciando sesión...';
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Obtener información adicional del usuario (Rol y Nombre) desde Firestore
    try {
      const userDoc = await getDoc(doc(db, "usuarios", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        sessionStorage.setItem('ticneo_role', userData.rol || 'usuario');
        sessionStorage.setItem('ticneo_name', userData.nombre || user.email);
      } else {
        sessionStorage.setItem('ticneo_role', 'usuario');
        sessionStorage.setItem('ticneo_name', user.email);
      }
    } catch (e) {
      console.warn("No se pudo obtener el perfil ampliado de Firestore:", e);
      sessionStorage.setItem('ticneo_role', 'usuario');
      sessionStorage.setItem('ticneo_name', user.email);
    }

    // Redirección inmediata sin guardar login.html en el historial
    window.location.replace('index.html');

  } catch (error) {
    console.error("Error al autenticar:", error);
    if (errorMsg) {
      errorMsg.textContent = "⚠️ Correo o contraseña incorrectos.";
      errorMsg.style.display = 'block';
    }
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Iniciar Sesión';
    }
  }
}

// 2. Proteger acceso a páginas privadas
export function checkAuth(requiredRole = null) {
  onAuthStateChanged(auth, async (user) => {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('login.html');

    // CASO A: No está logueado y pretende entrar a una página privada
    if (!user && !isLoginPage) {
      document.body.style.display = 'none'; // Evita mostrar la interfaz
      window.location.replace('login.html');
      return;
    }

    // CASO B: Ya está logueado e intenta ir a login.html
    if (user && isLoginPage) {
      window.location.replace('index.html');
      return;
    }

    // CASO C: Usuario con permisos suficientes en página privada
    if (user && !isLoginPage) {
      if (requiredRole) {
        const userRole = sessionStorage.getItem('ticneo_role');
        if (userRole !== requiredRole && userRole !== 'admin') {
          alert("No tienes permisos suficientes para acceder a esta sección.");
          window.location.replace('index.html');
          return;
        }
      }
      // Si todo es correcto, hacemos visible la página
      document.body.style.opacity = '1';
    }
  });
}

// 3. Cerrar Sesión instantáneo
export async function logout() {
  try {
    // Ocultar pantalla para respuesta táctil/visual inmediata
    document.body.style.opacity = '0';
    sessionStorage.clear();
    await signOut(auth);
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
  } finally {
    window.location.replace('login.html');
  }
}

// 4. Estilo previo para evitar el parpadeo visual antes de verificar la sesión
if (!window.location.pathname.endsWith('login.html')) {
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.15s ease-in-out';
  checkAuth();
}

// 5. Exponer funciones globalmente para eventos HTML onclick / onsubmit
window.logout = logout;
window.handleLogin = function(e) {
  if (e) e.preventDefault();
  const emailInput = document.getElementById('username') || document.getElementById('email');
  const passInput = document.getElementById('password');

  if (!emailInput || !passInput) return;

  const email = emailInput.value.trim();
  const pass = passInput.value;
  loginUser(email, pass);
};
