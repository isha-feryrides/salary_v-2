const admin = require('firebase-admin');
const serviceAccount = require('./salary-a1466-firebase-adminsdk-fbsvc-e085927aca.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://salary-a1466.firebaseio.com" 
});

const db = admin.firestore();
module.exports = db;
