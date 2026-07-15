const { initializeApp } = require('firebase/app');
const { getAuth, signInWithEmailAndPassword } = require('firebase/auth');
const { getDatabase, ref, set } = require('firebase/database');

const firebaseConfig = {
  apiKey: "AIzaSyDGdecWngN_zZFlJyq_L0_BLD8KEMcBpgI",
  authDomain: "theironpalace-ffb85.firebaseapp.com",
  databaseURL: "https://theironpalace-ffb85-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "theironpalace-ffb85",
  storageBucket: "theironpalace-ffb85.firebasestorage.app",
  messagingSenderId: "708398928493",
  appId: "1:708398928493:web:cf4698cc7d3ba69ff9a564"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

async function run() {
  const email = `test_${Date.now()}@example.com`;
  const password = "Password123!";
  
  console.log("Registering/Logging in test user:", email);
  const { createUserWithEmailAndPassword } = require('firebase/auth');
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCred.user.uid;
  console.log("Logged in successfully. UID:", uid);

  // Attempt write to users
  try {
    console.log("Writing to users...");
    await set(ref(db, `users/${uid}`), {
      uid,
      email,
      name: "Test User",
      role: "athlete"
    });
    console.log("Successfully wrote to users!");
  } catch (err) {
    console.error("Failed to write to users:", err.message);
  }

  // Attempt write to workouts
  try {
    console.log("Writing to workouts...");
    await set(ref(db, `workouts/${uid}/test-workout`), {
      uid,
      date: Date.now(),
      duration: 30,
      caloriesBurned: 150
    });
    console.log("Successfully wrote to workouts!");
  } catch (err) {
    console.error("Failed to write to workouts:", err.message);
  }
}

run().catch(console.error);
