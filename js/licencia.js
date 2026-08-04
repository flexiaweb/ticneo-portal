// js/licencia.js - Control de Licencias y Expiración en Firestore
import { db, doc, getDoc, updateDoc, collection, query, where, getDocs } from './firebase-config.js';
import { logout } from './auth.js';

// 1. VERIFICAR ESTADO DE LA LICENCIA DEL USUARIO
export async function verificarLicenciaUsuario(userId) {
  try {
    const userRef = doc(db, "usuarios", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return false;

    const userData = userSnap.data();

    // Administradores exentos de licencia (Opcional, eliminar si los admin también necesitan)
    if (userData.rol === 'admin') return true;

    // Si no tiene fecha de expiración configurada
    if (!userData.licenciaExpiracion) {
      mostrarModalLicencia("No tienes una licencia activa asignada.");
      return false;
    }

    // Convertir Timestamp de Firestore a objeto Date JS
    const fechaExpiracion = userData.licenciaExpiracion.toDate ? 
                            userData.licenciaExpiracion.toDate() : 
                            new Date(userData.licenciaExpiracion);

    const ahora = new Date();

    // Comprobar si la licencia ha caducado
    if (ahora > fechaExpiracion) {
      mostrarModalLicencia(`Tu licencia expiró el ${fechaExpiracion.toLocaleDateString('es-ES')}.`);
      return false;
    }

    return true; // Licencia válida

  } catch (error) {
    console.error("Error al verificar la licencia:", error);
    return false;
  }
}

// 2. ACTIVAR UN CÓDIGO DE LICENCIA
export async function activarCodigoLicencia(codigoInput, userId) {
  const codigoLimpio = codigoInput.trim().toUpperCase();

  try {
    // Buscar la licencia en la colección 'licencias'
    const q = query(collection(db, "licencias"), where("codigo", "==", codigoLimpio));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("El código de licencia introducido no existe.");
    }

    const licenciaDoc = querySnapshot.docs[0];
    const licenciaData = licenciaDoc.data();

    if (licenciaData.usada) {
      throw new Error("Este código de licencia ya ha sido utilizado.");
    }

    // Calcular fechas
    const ahora = new Date();
    const dias = licenciaData.diasDuracion || 30;
    const fechaExpiracion = new Date();
    fechaExpiracion.setDate(ahora.getDate() + dias);

    // A. Actualizar el documento de la licencia en Firestore
    await updateDoc(doc(db, "licencias", licenciaDoc.id), {
      usada: true,
      usuarioId: userId,
      fechaActivacion: ahora,
      fechaExpiracion: fechaExpiracion
    });

    // B. Actualizar el documento del usuario con la nueva fecha de expiración
    await updateDoc(doc(db, "usuarios", userId), {
      licenciaExpiracion: fechaExpiracion
    });

    alert(`🎉 ¡Licencia activada con éxito! Acceso concedido por ${dias} días (hasta el ${fechaExpiracion.toLocaleDateString('es-ES')}).`);
    
    // Ocultar modal y recargar para aplicar cambios
    ocultarModalLicencia();
    window.location.reload();

  } catch (error) {
    throw error;
  }
}

// FUNCIONES AUXILIARES PARA EL MODAL
function mostrarModalLicencia(mensaje) {
  const modal = document.getElementById('licenciaModal');
  const statusText = document.getElementById('licenciaStatusText');
  
  if (statusText && mensaje) statusText.textContent = mensaje;
  if (modal) {
    modal.style.display = 'flex';
    modal.classList.add('active');
  }
}

function ocultarModalLicencia() {
  const modal = document.getElementById('licenciaModal');
  if (modal) {
    modal.style.display = 'none';
    modal.classList.remove('active');
  }
}

// CAPTURAR EL FORMULARIO EN EL DOM
document.addEventListener('DOMContentLoaded', () => {
  const licenciaForm = document.getElementById('licenciaForm');

  if (licenciaForm) {
    licenciaForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const input = document.getElementById('inputCodigoLicencia');
      const errorMsg = document.getElementById('licenciaErrorMsg');
      const btn = document.getElementById('btnActivarLicencia');
      const userRaw = localStorage.getItem('ticneo_user');

      if (!userRaw) return;
      const user = JSON.parse(userRaw);

      if (errorMsg) errorMsg.style.display = 'none';
      if (btn) {
        btn.disabled = true;
        btn.textContent = 'Verificando...';
      }

      try {
        await activarCodigoLicencia(input.value, user.id);
      } catch (err) {
        if (errorMsg) {
          errorMsg.textContent = "⚠️ " + err.message;
          errorMsg.style.display = 'block';
        } else {
          alert("⚠️ " + err.message);
        }
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🔓 Activar y Continuar';
        }
      }
    });
  }
});
