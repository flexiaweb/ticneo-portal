// auth.js - Configuración de Firebase y Gestión de Sesiones

// 1. IMPORTACIONES DE FIREBASE DESDE CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc, 
  setDoc,
  updateDoc,
  deleteDoc,
  query, 
  where,
  serverTimestamp,
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 2. CREDENCIALES DE FIREBASE DE TICNEO PORTAL
const firebaseConfig = {
  apiKey: "AIzaSyByXU82DSNf1Blmt03m57Hw7gxSQres5Jc",
  authDomain: "ticneo-portal.firebaseapp.com",
  projectId: "ticneo-portal",
  storageBucket: "ticneo-portal.firebasestorage.app",
  messagingSenderId: "118908146607",
  appId: "1:118908146607:web:b7eb1315f9fc724205555a"
};

// 3. INICIALIZACIÓN DE FIREBASE Y FIRESTORE
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// 4. VERIFICAR SESIÓN ACTIVA AL CARGAR LA PÁGINA
function checkAuth() {
  const currentUser = JSON.parse(localStorage.getItem('ticneo_user'));
  const currentPath = window.location.pathname.toLowerCase();
  const isLoginPage = currentPath.includes('login.html') || (currentPath.endsWith('/') && currentPath.includes('login'));

  // Si no está autenticado y no está en el login, redirigir al login
  if (!currentUser && !isLoginPage) {
    window.location.href = 'login.html';
    return;
  }

  // Si ya está autenticado e intenta ir al login, redirigir al portal principal
  if (currentUser && isLoginPage) {
    window.location.href = 'index.html';
    return;
  }

  // Si el usuario fue inactivado, cerrar sesión
  if (currentUser && currentUser.activo === false) {
    alert("Tu cuenta ha sido desactivada. Contacta al administrador.");
    logout();
  }
}

// 5. INICIAR SESIÓN (Para usar en login.html)
async function loginUser(email, password) {
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

    // Validar contraseña
    if (userFound.password !== password) {
      throw new Error("Contraseña incorrecta.");
    }

    // Validar estado activo
    if (userFound.activo === false) {
      throw new Error("Esta cuenta se encuentra inactiva o bloqueada.");
    }

    // Guardar datos de sesión en localStorage
    const sessionData = {
      id: userFound.id,
      nombre: userFound.nombre,
      email: userFound.email,
      rol: userFound.rol,
      activo: userFound.activo
    };

    localStorage.setItem('ticneo_user', JSON.stringify(sessionData));
    
    // Redirigir al inicio
    window.location.href = 'index.html';

  } catch (error) {
    console.error("Error en el inicio de sesión:", error);
    alert(error.message || "Error al iniciar sesión.");
  }
}

// 6. CERRAR SESIÓN (Resuelve el error "logout is not defined" en el HTML)
function logout() {
  localStorage.removeItem('ticneo_user');
  sessionStorage.clear();
  window.location.href = 'login.html';
}

// 7. OBTENER USUARIO ACTUAL EN CUALQUIER MÓDULO
function getCurrentUser() {
  return JSON.parse(localStorage.getItem('ticneo_user')) || null;
}

// 8. ASIGNACIONES A WINDOW (Para llamar desde los onclick="" de los HTML)
window.logout = logout;
window.loginUser = loginUser;
window.getCurrentUser = getCurrentUser;

// Ejecutar la comprobación de autenticación cuando cargue la página
document.addEventListener('DOMContentLoaded', checkAuth);

// 9. EXPORTAR TODOS LOS MÓDULOS Y FUNCIONES REQUERIDOS
export { 
  app,
  db,
  auth,
  collection, 
  addDoc, 
  getDocs, 
  getDoc,
  doc, 
  setDoc,
  updateDoc,
  deleteDoc,
  query, 
  where,
  serverTimestamp,
  orderBy,
  logout,
  loginUser,
  getCurrentUser
};
