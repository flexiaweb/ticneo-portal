// licencia.js
import { db, doc, getDoc, updateDoc, collection, query, where, getDocs, auth } from './firebase-config.js';

// 1. VERIFICAR LICENCIA DEL USUARIO
export async function verificarLicenciaUsuario(uid) {
  try {
    const userRef = doc(db, "usuarios", uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return false;

    const userData = userSnap.data();
    const path = window.location.pathname.toLowerCase();

    // Si no tiene fecha de expiración o ya expiró
    let expira = userData.licenciaExpiracion;
    let vencida = false;

    if (!expira) {
      vencida = true;
    } else {
      let fechaExp = expira.toDate ? expira.toDate() : new Date(expira);
      if (new Date() > fechaExp) {
        vencida = true;
      }
    }

    // Redirigir a la pantalla de licencias si no está activa y no está ya en ella
    if (vencida && !path.includes('licencias.html')) {
      const isInsidePages = path.includes('/pages/');
      window.location.href = isInsidePages ? 'licencias.html' : 'pages/licencias.html';
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error al verificar licencia:", error);
    return false;
  }
}

// 2. ACTIVAR NUEVA LICENCIA (Asociada al formulario de licencias.html)
async function activarLicencia(e) {
  if (e) e.preventDefault();

  // Obtener usuario autenticado directamente desde Firebase Auth
  const user = auth.currentUser;

  if (!user) {
    alert("⚠️ Sesión no encontrada. Por favor vuelve a iniciar sesión.");
    const path = window.location.pathname.toLowerCase();
    const isInsidePages = path.includes('/pages/');
    window.location.href = isInsidePages ? '../index.html' : 'index.html';
    return;
  }

  const codigoInput = document.getElementById('codigoLicencia') || document.querySelector('input[type="text"]');
  if (!codigoInput) return;

  const codigo = codigoInput.value.trim();
  if (!codigo) {
    alert("⚠️ Por favor, introduce un código de licencia.");
    return;
  }

  try {
    // Buscar el código en la colección 'licencias'
    const q = query(collection(db, "licencias"), where("codigo", "==", codigo));
    const querySnap = await getDocs(q);

    if (querySnap.empty) {
      alert("❌ El código de licencia no es válido.");
      return;
    }

    const licenciaDoc = querySnap.docs[0];
    const licenciaData = licenciaDoc.data();

    if (licenciaData.usada) {
      alert("⚠️ Esta licencia ya ha sido utilizada.");
      return;
    }

    // Calcular fecha de expiración según la duración de la licencia (en días)
    const dias = licenciaData.duracionDias || 30;
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(fechaExpiracion.getDate() + dias);

    // 1. Actualizar el perfil del usuario en Firestore
    const userRef = doc(db, "usuarios", user.uid);
    await updateDoc(userRef, {
      licenciaCodigo: codigo,
      licenciaNombre: licenciaData.nombre || 'Licencia Estándar',
      licenciaExpiracion: fechaExpiracion
    });

    // 2. Marcar la licencia como usada en Firestore
    await updateDoc(doc(db, "licencias", licenciaDoc.id), {
      usada: true,
      usuarioAsignado: user.uid,
      fechaActivacion: new Date()
    });

    alert("🎉 ¡Licencia activada correctamente!");

    // Redirigir al dashboard
    const path = window.location.pathname.toLowerCase();
    const isInsidePages = path.includes('/pages/');
    window.location.href = isInsidePages ? 'dashboard.html' : 'pages/dashboard.html';

  } catch (error) {
    console.error("Error al activar la licencia:", error);
    alert("⚠️ Error al procesar la licencia: " + error.message);
  }
}

// Exponer función global para el evento onclick o submit en el HTML
window.activarLicencia = activarLicencia;
