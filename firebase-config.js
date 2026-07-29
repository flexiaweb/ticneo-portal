// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query, 
  where,
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Reemplaza con los valores de tu consola de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyByXU82DSNf1Blmt03m57Hw7gxSQres5Jc",
    authDomain: "ticneo-portal.firebaseapp.com",
    projectId: "ticneo-portal",
    storageBucket: "ticneo-portal.firebasestorage.app",
    messagingSenderId: "118908146607",
    appId: "1:118908146607:web:b7eb1315f9fc724205555a"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Exportar funciones auxiliares de SDKs
export { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  collection, 
  addDoc, 
  getDocs, 
  doc, 
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query, 
  where,
  orderBy 
};
