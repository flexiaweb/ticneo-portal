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
  serverTimestamp,
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

// Inicialización
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Exportar app, db y todas las funciones de Firestore requeridas
export { 
  app,
  db,
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
};
