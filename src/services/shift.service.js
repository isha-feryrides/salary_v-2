const db = require('../config/firebase.config');
const moment = require('moment');

const getShiftDetails = async (partnerId, date) => {
    try {
        const attendanceRef = db.collection('Partners').doc(partnerId).collection('Attendance');
        const snapshot = await attendanceRef.where('date', '==', date).get();

        if (snapshot.empty) return null;
        return snapshot.docs[0].data(); 
    } catch (error) {
        console.error("Error fetching shift details:", error);
        return null;
    }
};

module.exports = { getShiftDetails };
