import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC8e8WcAcnB_QNdeqZuJcgigGUOaIhc0ng",
  authDomain: "commission-check-28311.firebaseapp.com",
  projectId: "commission-check-28311",
  storageBucket: "commission-check-28311.firebasestorage.app",
  messagingSenderId: "110414934112",
  appId: "1:110414934112:web:9676ac65e71f3d91411305",
  measurementId: "G-2EQPHR2H0V"
};

const app = initializeApp(firebaseConfig);
export const firestore = getFirestore(app);
