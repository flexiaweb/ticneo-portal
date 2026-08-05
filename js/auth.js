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
  setDoc,
  collection,
  query,
  where,
  getDocs,
  deleteDoc
} from './firebase-config.js';
import { verificarLicenciaUsuario } from './licencia.js';

// Variable de estado para evitar que checkAuth interrumpa el proceso de creación en loginWithGoogle
let isLoggingIn = false;

function getRelativePath(targetFile) {
  const path = window.location.pathname.toLowerCase();
  const isInsidePages = path.includes('/pages/');

  if (targetFile === 'index.html') return isInsidePages ? '../index.html' : 'index.html';
  if (targetFile === 'dashboard.html') return isInsidePages ? 'dashboard.html' : 'pages/dashboard.html';
  return targetFile;
}

// 1. INICIAR SESIÓN CON GOOGLE
async function loginWithGoogle() {
  isLoggingIn = true;
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;
    const email = user.email.toLowerCase();

    // Buscar si ya existe el documento por UID en Firestore
    const userRefByUid = doc(db, "usuarios", user.uid);
    let userSnap = await getDoc(userRefByUid);

    if (!userSnap.exists()) {
      // Buscar si fue pre-registrado por email por un Admin
      const q = query(collection(db, "usuarios"), where("email", "==", email));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        // Migrar el documento antiguo (ID aleatorio) al ID basado en UID de Auth
        const oldDoc = querySnap.docs[0];
        const oldData = oldDoc.data();

        await setDoc(userRefByUid, {
          ...oldData,
          nombre: oldData.nombre || user.displayName || 'Usuario Google',
          email: email
        });

        await deleteDoc(doc(db, "usuarios", oldDoc.id));
        userSnap = await getDoc(userRefByUid);
        console.log("✅ Registro existente migrado al UID de Google Auth:", user.uid);
      } else {
        // Crear perfil nuevo en Firestore
        console.log("Usuario nuevo detectado. Creando documento en Firestore...");
        await setDoc(userRefByUid, {
          nombre: user.displayName || 'Usuario Google',
          email: email,
          rol: 'admin', // Rol por defecto
          activo: true,
          creadoEl: new Date()
        });
        userSnap = await getDoc(userRefByUid);
        console.log("✅ Documento creado con éxito en usuarios/", user.uid);
      }
    }

    // Verificar si la cuenta está activa
    const userData = userSnap.data();
    if (userData && userData.activo === false) {
      await signOut(auth);
      alert("⚠️ Tu cuenta se encuentra inactiva o deshabilitada.");
      isLoggingIn = false;
      return;
    }

    // Redirigir al dashboard una vez completada la persistencia en Firestore
    window.location.href = getRelativePath('dashboard.html');

  } catch (error) {
    console.error("Error en la autenticación/creación de usuario:", error);
    alert("⚠️ Error: " + error.message);
    isLoggingIn = false;
  }
}

// 2. GUARDIÁN CONTINUO DE RUTAS Y PERMISOS
function checkAuth() {
  onAuthStateChanged(auth, async (user) => {
    // Si estamos ejecutando loginWithGoogle(), evitamos interferir con la navegación
    if (isLoggingIn) return;

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

      try {
        const userRef = doc(db, "usuarios", user.uid);
        const userSnap = await getDoc(userRef);

        if (!userSnap.exists() || userSnap.data().activo === false) {
          alert("⚠️ Cuenta inactiva o no registrada.");
          await logout();
          return;
        }

        const userData = userSnap.data();

        // Validar Licencia de usuario
        const tieneLicencia = await verificarLicenciaUsuario(user.uid);
        if (!tieneLicencia) return;

        // Validar Permisos del Rol asignado
        let currentPage = path.split('/').pop() || 'dashboard.html';
        const tienePermiso = await verificarPermisoRol(userData.rol, currentPage);

        if (!tienePermiso) {
          alert("⚠️ No tienes permisos asignados para acceder a este módulo.");
          if (currentPage !== 'dashboard.html') {
            window.location.href = getRelativePath('dashboard.html');
          } else {
            await logout();
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
    console.error("Error al consultar rol:", error);
    return false;
  }
}

function logout() {
  return signOut(auth).then(() => {
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
