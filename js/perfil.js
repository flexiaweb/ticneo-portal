// perfil.js
import { db, doc, getDoc, updateDoc, auth, onAuthStateChanged } from './firebase-config.js';

function cargarDatosPerfil() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      window.location.href = '../index.html';
      return;
    }

    try {
      const userRef = doc(db, "usuarios", user.uid);
      const userSnap = await getDoc(userRef);

      if (!userSnap.exists()) {
        alert("⚠️ No se encontró la información del usuario.");
        return;
      }

      const userData = userSnap.data();

      document.getElementById('perfilUserId').value = user.uid;
      document.getElementById('perfilNombre').value = userData.nombre || user.displayName || '';
      document.getElementById('perfilEmail').value = userData.email || user.email || '';
      document.getElementById('perfilRol').value = userData.rol || 'usuario';

      renderInfoLicencia(userData);

    } catch (error) {
      console.error("Error al cargar el perfil:", error);
    }
  });
}

function renderInfoLicencia(userData) {
  const containerInfo = document.getElementById('perfilLicenciaInfo');
  if (!containerInfo) return;

  if (!userData.licenciaExpiracion) {
    containerInfo.innerHTML = `<span style="color: #f87171; font-weight: 500;">❌ Sin licencia asignada.</span>`;
    return;
  }

  let fechaExp = userData.licenciaExpiracion.toDate ? userData.licenciaExpiracion.toDate() : new Date(userData.licenciaExpiracion);
  const ahora = new Date();
  const estaVencida = ahora > fechaExp;
  const fechaFormateada = fechaExp.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' });
  const nombreLicencia = userData.licenciaNombre || 'Estándar';

  if (estaVencida) {
    containerInfo.innerHTML = `
      <span style="color: #f87171; font-weight: 600;">⚠️ Licencia Caducada (${nombreLicencia})</span><br>
      <small style="color: var(--text-muted);">Expiró el: ${fechaFormateada}</small>`;
  } else {
    containerInfo.innerHTML = `
      <span style="color: #4ade80; font-weight: 600;">🔑 Licencia Activa: ${nombreLicencia}</span><br>
      <small style="color: var(--text-muted);">Válida hasta el: <strong>${fechaFormateada}</strong></small>`;
  }
}

async function actualizarPerfil(e) {
  e.preventDefault();
  const uid = document.getElementById('perfilUserId').value;
  const nuevoNombre = document.getElementById('perfilNombre').value.trim();
  const btnSubmit = document.getElementById('btnActualizarPerfil');

  if (!uid) return;

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';
  }

  try {
    await updateDoc(doc(db, "usuarios", uid), { nombre: nuevoNombre });
    alert("✅ ¡Perfil actualizado correctamente!");

    const userDisplay = document.getElementById('userInfoDisplay');
    if (userDisplay) {
      userDisplay.innerHTML = `<span style="color: #0b0914;">${nuevoNombre}</span>`;
    }
  } catch (error) {
    console.error("Error al actualizar el perfil:", error);
    alert("⚠️ Error al actualizar los datos: " + error.message);
  } finally {
    if (btnSubmit) {
      btnSubmit.disabled = false;
      btnSubmit.textContent = '💾 Guardar Cambios';
    }
  }
}

window.actualizarPerfil = actualizarPerfil;

document.addEventListener('DOMContentLoaded', () => {
  cargarDatosPerfil();
});
