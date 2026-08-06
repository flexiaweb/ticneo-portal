import { auth, db } from './firebase-config.js';
import { updatePassword } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { doc, updateDoc } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export async function processPasswordChange(currentTempPassword, newPassword, confirmPassword) {
  const user = auth.currentUser;
  
  if (!user) {
    alert("Sesión no válida. Por favor, inicie sesión de nuevo.");
    window.location.href = '../login.html';
    return;
  }

  // 1. Validar que la nueva contraseña y la confirmación coincidan
  if (newPassword !== confirmPassword) {
    alert("Las contraseñas no coinciden.");
    return;
  }

  // 2. Validar que la nueva contraseña NO sea la misma que la actual/temporal
  if (newPassword === currentTempPassword) {
    alert("La nueva contraseña debe ser diferente a la contraseña temporal actual.");
    return;
  }

  // 3. Validar longitud mínima
  if (newPassword.length < 6) {
    alert("La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  try {
    // 4. Actualizar contraseña en Firebase Authentication
    await updatePassword(user, newPassword);

    // 5. Desmarcar la obligación en Firestore
    const userRef = doc(db, 'usuarios', user.uid);
    await updateDoc(userRef, {
      mustChangePassword: false
    });

    alert("¡Contraseña actualizada con éxito! Ya puedes acceder al portal.");
    window.location.href = '../index.html';

  } catch (error) {
    console.error("Error al actualizar la contraseña:", error);
    
    // Si el usuario lleva mucho tiempo conectado, Firebase puede solicitar que re-autentique
    if (error.code === 'auth/requires-recent-login') {
      alert("Por motivos de seguridad, debe volver a iniciar sesión antes de cambiar la contraseña.");
      window.location.href = '../login.html';
    } else {
      alert("Error al cambiar la contraseña: " + error.message);
    }
  }
}
