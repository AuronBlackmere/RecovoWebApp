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

async function testPath(name, reference) {
  try {
    await set(reference, { test: true, timestamp: Date.now() });
    console.log(`[PASS] Write to ${name} succeeded!`);
  } catch (err) {
    console.log(`[FAIL] Write to ${name} failed: ${err.message}`);
  }
}

async function run() {
  const email = `test_paths_${Date.now()}@example.com`;
  const password = "Password123!";
  
  const { createUserWithEmailAndPassword } = require('firebase/auth');
  const userCred = await createUserWithEmailAndPassword(auth, email, password);
  const uid = userCred.user.uid;
  console.log("Logged in UID:", uid);

  await testPath("users", ref(db, `users/${uid}`));
  await testPath("workouts", ref(db, `workouts/${uid}/test`));
  await testPath("recovery", ref(db, `recovery/${uid}/test`));
  await testPath("daily_status", ref(db, `daily_status/${uid}/test`));
  await testPath("injuries", ref(db, `injuries/${uid}/test`));
  await testPath("feedback", ref(db, `feedback/${uid}/test`));
  await testPath("legions", ref(db, `legions/test_legion`));
}

run().catch(console.error);
