// js/licencia.js - Control de Licencias, Expiración e Inyección Dinámica del Modal
import { db, doc, getDoc, updateDoc, collection, query, where, getDocs } from './firebase-config.js';
import { logout } from './auth.js';

// 1. INYECCIÓN DINÁMICA DEL MODAL EN EL DOM
function asegurarModalEnDOM() {
  if (document.getElementById('licenciaModal')) return; // Evitar duplicar si ya existe

  const modalHTML = `
    <div id="licenciaModal" class="modal-overlay" style="display: none; background: rgba(5, 3, 10, 0.92); backdrop-filter: blur(8px); z-index: 9999; position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; align-items: center; justify-content: center;">
      <div class="modal-card" style="max-width: 420px; text-align: center; border-color: var(--accent-violet, #8b5cf6);">
        <div style="font-size: 3rem; margin-bottom: 0.5rem;">🔑</div>
        <h3 style="color: #fff; margin-bottom: 0.5rem;">Licencia requerida</h3>
        <p id="licenciaStatusText" style="color: var(--text-muted, #94a3b8); font-size: 0.88rem; margin-bottom: 1.5rem;">
          Tu periodo de acceso ha expirado o tu cuenta no dispone de una licencia activa. Introduce un código válido para continuar.
        </p>

        <div id="licenciaErrorMsg" style="display: none; color: #f87171; background: rgba(248, 113, 113, 0.1); padding: 0.6rem; border-radius: 8px; font-size: 0.85rem; margin-bottom: 1rem;"></div>

        <form id="licenciaForm" style="display: flex; flex-direction: column; gap: 1rem;">
          <div class="form-group" style="text-align: left;">
            <label style="color: #ccc; font-size: 0.85rem;">Código de Licencia *</label>
            <input type="text" id="inputCodigoLicencia" placeholder="Ej: TICNEO-2026-TRIAL" required style="text-align: center; font-weight: bold; letter-spacing: 2px; text-transform: uppercase;">
          </div>

          <button type="submit" id="btnActivarLicencia" class="btn-primary" style="width: 100%; justify-content: center;">
            🔓 Activar y Continuar
          </button>
        </form>

        <div style="margin-top: 1.5rem;">
          <button id="btnLicenciaLogout" style="background: none; border: none; color: #f87171; cursor: pointer; font-size: 0.85rem;">Cerrar Sesión</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHTML);
  escucharEventosModal();
}

// 2. VERIFICAR ESTADO DE LA LICENCIA DEL USUARIO
export async function verificarLicenciaUsuario(userId) {
  try {
    const userRef = doc(db, "usuarios", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return false;

    const userData = userSnap.data();

    // Descomentar si deseas eximir a los administradores de requerir licencia:
    // if (userData.rol === 'admin') return true;

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

// ACTIVAR UN CÓDIGO DE LICENCIA
export async function activarCodigoLicencia(codigoInput, userId) {
  const codigoLimpio = codigoInput.trim().toUpperCase();

  try {
    const q = query(collection(db, "licencias"), where("codigo", "==", codigoLimpio));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      throw new Error("El código de licencia introducido no existe.");
    }

    const licenciaDoc = querySnapshot.docs[0];
    const licenciaData = licenciaDoc.data();

    const usosMaximos = licenciaData.usosMaximos !== undefined ? Number(licenciaData.usosMaximos) : 1;
    const usosActuales = Number(licenciaData.usosActuales) || 0;
    const usuariosUso = licenciaData.usuarios || [];

    if (usuariosUso.includes(userId)) {
      throw new Error("Ya has activado este código de licencia en tu cuenta anteriormente.");
    }

    if (usosMaximos === 0) {
      throw new Error("Este código de licencia está desactivado.");
    }

    if (usosActuales >= usosMaximos || licenciaData.usada === true) {
      throw new Error(`Este código ha alcanzado el límite máximo de usuarios (${usosMaximos}).`);
    }

    // --- CÁLCULO DE FECHAS DEFINIDAS CORRECTAMENTE ---
    const ahora = new Date();
    const dias = Number(licenciaData.diasDuracion) || 30;

    // 1. Fecha de expiración para este usuario
    const fechaExpiracionUsuario = new Date();
    fechaExpiracionUsuario.setDate(ahora.getDate() + dias);

    // 2. Fechas para el documento global de licencia
    const fechaActivacionGlobal = licenciaData.fechaActivacion ? licenciaData.fechaActivacion : ahora;
    const fechaExpiracionGlobal = licenciaData.fechaExpiracion ? licenciaData.fechaExpiracion : fechaExpiracionUsuario;

    const nuevosUsos = usosActuales + 1;
    const estaAgotada = nuevosUsos >= usosMaximos;

    // A. Actualizar documento en 'licencias'
    await updateDoc(doc(db, "licencias", licenciaDoc.id), {
      usosActuales: nuevosUsos,
      usada: estaAgotada,
      usuarios: [...usuariosUso, userId],
      fechaActivacion: fechaActivacionGlobal,
      fechaExpiracion: fechaExpiracionGlobal,
      ultimaActivacion: ahora
    });

    // B. Actualizar documento en 'usuarios'
    await updateDoc(doc(db, "usuarios", userId), {
      licenciaExpiracion: fechaExpiracionUsuario,
      licenciaNombre: licenciaDoc.id
    });

    alert(`🎉 ¡Licencia activada con éxito! Acceso concedido por ${dias} días.`);
    
    if (typeof ocultarModalLicencia === "function") {
      ocultarModalLicencia();
    }
    window.location.reload();

  } catch (error) {
    throw error;
  }
}

// 4. FUNCIONES AUXILIARES DE CONTROL DEL MODAL
function mostrarModalLicencia(mensaje) {
  asegurarModalEnDOM();
  
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

// 5. ESCUCHAR EVENTOS DEL FORMULARIO Y CERRAR SESIÓN
function escucharEventosModal() {
  const licenciaForm = document.getElementById('licenciaForm');
  const btnLogout = document.getElementById('btnLicenciaLogout');

  if (btnLogout) {
    btnLogout.addEventListener('click', () => logout());
  }

  if (licenciaForm) {
    licenciaForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const input = document.getElementById('inputCodigoLicencia');
      const errorMsg = document.getElementById('licenciaErrorMsg');
      const btn = document.getElementById('btnActivarLicencia');
      
      // 🔄 Obtener sesión de forma segura desde sessionStorage
      const sessionRaw = sessionStorage.getItem('ticneo_session') || localStorage.getItem('ticneo_user');
      const user = sessionRaw ? JSON.parse(sessionRaw) : null;

      if (!user || !user.id) {
        alert("⚠️ Sesión no encontrada. Por favor vuelve a iniciar sesión.");
        logout();
        return;
      }

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
}
