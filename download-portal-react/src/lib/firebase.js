import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "MOCK_API_KEY_TEMP",
  authDomain: "innerorbit-mock.firebaseapp.com",
  projectId: "innerorbit-mock",
  storageBucket: "innerorbit-mock.firebasestorage.app",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:mock-id-temp",
  measurementId: "G-MOCK-TEMP"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
