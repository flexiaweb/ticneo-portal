// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
  arrayRemove, 
  increment,
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyByXU82DSNf1Blmt03m57Hw7gxSQres5Jc",
  authDomain: "ticneo-portal.firebaseapp.com",
  projectId: "ticneo-portal",
  storageBucket: "ticneo-portal.firebasestorage.app",
  messagingSenderId: "118908146607",
  appId: "1:118908146607:web:b7eb1315f9fc724205555a"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { 
  app,
  db,
  auth,
  googleProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
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
  arrayRemove,
  increment,
  orderBy 
};
