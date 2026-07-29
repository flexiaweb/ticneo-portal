// auth.js - Gestión de Sesión
import { db, collection, getDocs, query, where } from './firebase-config.js';

// 1. INICIAR SESIÓN (Para login.html)
async function loginUser(email, password) {
  try {
    console.log("Intentando iniciar sesión con:", email);
    
    const q = query(
      collection(db, "usuarios"), 
      where("email", "==", email.trim().toLowerCase())
    );

    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      alert("⚠️ El correo electrónico no está registrado.");
      return;
    }

    let userFound = null;
    querySnapshot.forEach((docSnap) => {
      userFound = { id: docSnap.id, ...docSnap.data() };
    });

    // Validar contraseña
    if (userFound.password !== password) {
      alert("⚠️ Contraseña incorrecta.");
      return;
    }

    // Validar si está activo
    if (userFound.activo === false) {
      alert("⚠️ Esta cuenta se encuentra inactiva o bloqueada.");
      return;
    }

    // Guardar sesión en localStorage
    const sessionData = {
      id: userFound.id,
      nombre: userFound.nombre,
      email: userFound.email,
      rol: userFound.rol
    };

    localStorage.setItem('ticneo_user', JSON.stringify(sessionData));
    console.log("Sesión guardada con éxito:", sessionData);
    
    // Redirigir al panel principal
    window.location.href = 'index.html';

  } catch (error) {
    console.error("Error en el inicio de sesión:", error);
    alert("Error al intentar iniciar sesión: " + error.message);
  }
}

// 2. CERRAR SESIÓN
function logout() {
  localStorage.removeItem('ticneo_user');
  sessionStorage.clear();
  window.location.href = 'login.html';
}

// Exportar a window para uso en botones HTML
window.logout = logout;
window.loginUser = loginUser;

export { logout, loginUser };
