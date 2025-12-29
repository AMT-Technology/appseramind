// Configuración Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCEMOAiEhDC-Z5nS4_yB-a1s3T_61PrHF4",
  authDomain: "appwebs-8b23f.firebaseapp.com",
  projectId: "appwebs-8b23f",
  storageBucket: "appwebs-8b23f.firebaseapp.com",
  messagingSenderId: "986164552498",
  appId: "1:986164552498:web:04262bde6fa35e5efced2b",
  measurementId: "G-63HNLTNVY0"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

// Servicios
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();
