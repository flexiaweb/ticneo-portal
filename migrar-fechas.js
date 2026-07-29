// migrar-fechas.js - Script de conversión de fechas a Timestamp en Firestore
import { db } from './firebase-config.js';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  Timestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export async function migrarFechasATimestamp() {
  console.log("🔄 Iniciando migración de fechas a Timestamp en Firestore...");
  
  try {
    const querySnapshot = await getDocs(collection(db, "almacen"));
    let convertidos = 0;
    let omitidos = 0;
    let errores = 0;

    for (const docSnap of querySnapshot.docs) {
      const data = docSnap.data();
      const updates = {};

      // 1. Convertir el campo 'fecha'
      if (data.fecha) {
        if (typeof data.fecha === 'string') {
          // Si viene como string tipo "2026-03-15" o "15/03/2026"
          const parsedDate = new Date(data.fecha);
          if (!isNaN(parsedDate.getTime())) {
            updates.fecha = Timestamp.fromDate(parsedDate);
          }
        }
      }

      // 2. Convertir el campo 'creadoEl'
      if (data.creadoEl) {
        if (typeof data.creadoEl === 'string') {
          const parsedCreado = new Date(data.creadoEl);
          if (!isNaN(parsedCreado.getTime())) {
            updates.creadoEl = Timestamp.fromDate(parsedCreado);
          }
        }
      } else {
        // Si no tenía el campo creadoEl, asignamos la misma fecha del registro
        if (data.fecha) {
          const fallbackDate = typeof data.fecha === 'string' ? new Date(data.fecha) : data.fecha.toDate();
          if (!isNaN(fallbackDate.getTime())) {
            updates.creadoEl = Timestamp.fromDate(fallbackDate);
          }
        }
      }

      // Si hay campos que actualizar en este documento
      if (Object.keys(updates).length > 0) {
        try {
          const docRef = doc(db, "almacen", docSnap.id);
          await updateDoc(docRef, updates);
          convertidos++;
          console.log(`✅ Documento #${docSnap.id.substring(0, 6)} actualizado correctamente.`);
        } catch (err) {
          errores++;
          console.error(`❌ Error actualizando documento #${docSnap.id}:`, err);
        }
      } else {
        omitidos++;
      }
    }

    console.log(`\n🎉 ¡Migración de fechas completada!`);
    console.log(` Total procesados: ${querySnapshot.size}`);
    console.log(` Actualizados a Timestamp: ${convertidos}`);
    console.log(` Ya estaban en formato correcto: ${omitidos}`);
    console.log(` Errores: ${errores}`);

  } catch (error) {
    console.error("⚠️ Error general durante la conversión de fechas:", error);
  }
}

// Exponer la función en la consola global para poder invocarla manualmente
window.migrarFechasATimestamp = migrarFechasATimestamp;