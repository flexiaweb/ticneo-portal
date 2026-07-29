// firebase-config.js - Configuración e inicialización de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
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
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Credenciales de Firebase de Ticneo Portal
const firebaseConfig = {
  apiKey: "AIzaSyByXU82DSNf1Blmt03m57Hw7gxSQres5Jc",
  authDomain: "ticneo-portal.firebaseapp.com",
  projectId: "ticneo-portal",
  storageBucket: "ticneo-portal.firebasestorage.app",
  messagingSenderId: "118908146607",
  appId: "1:118908146607:web:b7eb1315f9fc724205555a"
};

// Inicializar la aplicación de Firebase
const app = initializeApp(firebaseConfig);

// Instancia principal de Firestore Database
export const db = getFirestore(app);

// Exportar todas las funciones de Firestore requeridas por los módulos
export { 
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
  orderBy 
};
