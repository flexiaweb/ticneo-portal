// perfil.js - Gestión de perfil de usuario y cambio de contraseña
import { db, doc, getDoc, updateDoc } from './firebase-config.js';
import bcrypt from 'https://cdn.jsdelivr.net/npm/bcryptjs@2.4.3/+esm';

// 1. CARGAR DATOS DEL USUARIO LOGUEADO AL INICIAR
async function cargarDatosPerfil() {
  const sessionRaw = sessionStorage.getItem('ticneo_session') || localStorage.getItem('ticneo_user');
  
  if (!sessionRaw) {
    window.location.href = '../index.html';
    return;
  }

  const session = JSON.parse(sessionRaw);
  const userId = session.id;

  try {
    const userRef = doc(db, "usuarios", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      alert("⚠️ No se encontró la información del usuario.");
      return;
    }

    const userData = userSnap.data();

    // Rellenar campos del formulario
    document.getElementById('perfilUserId').value = userId;
    document.getElementById('perfilNombre').value = userData.nombre || '';
    document.getElementById('perfilEmail').value = userData.email || '';
    document.getElementById('perfilRol').value = userData.rol || 'usuario';

    // Rellenar información visual de la Licencia
    renderInfoLicencia(userData);

  } catch (error) {
    console.error("Error al cargar el perfil:", error);
    alert("Error al obtener los datos del perfil desde Firestore.");
  }
}

// 2. RENDERIZAR DETALLES DE LA LICENCIA DEL USUARIO
function renderInfoLicencia(userData) {
  const containerInfo = document.getElementById('perfilLicenciaInfo');
  if (!containerInfo) return;

  if (!userData.licenciaExpiracion) {
    containerInfo.innerHTML = `
      <span style="color: #f87171; font-weight: 500;">❌ Sin licencia asignada.</span>
    `;
    return;
  }

  // Convertir fecha de expiración de Timestamp de Firestore o Date
  let fechaExp;
  if (userData.licenciaExpiracion.toDate && typeof userData.licenciaExpiracion.toDate === 'function') {
    fechaExp = userData.licenciaExpiracion.toDate();
  } else {
    fechaExp = new Date(userData.licenciaExpiracion);
  }

  const ahora = new Date();
  const estaVencida = ahora > fechaExp;
  const fechaFormateada = fechaExp.toLocaleDateString('es-ES', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  const nombreLicencia = userData.licenciaNombre || 'Estándar';

  if (estaVencida) {
    containerInfo.innerHTML = `
      <span style="color: #f87171; font-weight: 600;">⚠️ Licencia Caducada (${nombreLicencia})</span><br>
      <small style="color: var(--text-muted);">Expiró el: ${fechaFormateada}</small>
    `;
  } else {
    containerInfo.innerHTML = `
      <span style="color: #4ade80; font-weight: 600;">🔑 Licencia Activa: ${nombreLicencia}</span><br>
      <small style="color: var(--text-muted);">Válida hasta el: <strong>${fechaFormateada}</strong></small>
    `;
  }
}

// 3. ACTUALIZAR DATOS DE PERFIL Y CAMBIO DE CONTRASEÑA
async function actualizarPerfil(e) {
  e.preventDefault();

  const uid = document.getElementById('perfilUserId').value;
  const nuevoNombre = document.getElementById('perfilNombre').value.trim();
  const nuevaPassword = document.getElementById('perfilPassword').value.trim();
  const confirmPassword = document.getElementById('perfilPasswordConfirm').value.trim();
  const btnSubmit = document.getElementById('btnActualizarPerfil');

  if (!uid) return;

  // Validaciones de contraseña (si el usuario intenta cambiarla)
  if (nuevaPassword !== "") {
    if (nuevaPassword.length < 6) {
      alert("⚠️ La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (nuevaPassword !== confirmPassword) {
      alert("⚠️ Las contraseñas ingresadas no coinciden.");
      return;
    }
  }

  if (btnSubmit) {
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';
  }

  try {
    const updatePayload = {
      nombre: nuevoNombre
    };

    // Si escribió una nueva contraseña, aplicar Hash Bcrypt y remover flag de reset obligatorio
    if (nuevaPassword !== "") {
      const hashedPassword = bcrypt.hashSync(nuevaPassword, 10);
      updatePayload.password = hashedPassword;
      updatePayload.mustChangePassword = false;
    }

    // Actualizar documento en Firestore
    await updateDoc(doc(db, "usuarios", uid), updatePayload);

    // Actualizar nombre en la sesión local
    const sessionRaw = sessionStorage.getItem('ticneo_session') || localStorage.getItem('ticneo_user');
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw);
      session.nombre = nuevoNombre;
      sessionStorage.setItem('ticneo_session', JSON.stringify(session));
    }

    alert("✅ ¡Perfil actualizado correctamente!");

    // Limpiar campos de contraseña
    document.getElementById('perfilPassword').value = '';
    document.getElementById('perfilPasswordConfirm').value = '';

    // Refrescar el nombre visible en el header
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

// Exponer la función globalmente para capturar el submit desde el HTML
window.actualizarPerfil = actualizarPerfil;

// Cargar la información cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  cargarDatosPerfil();
});
