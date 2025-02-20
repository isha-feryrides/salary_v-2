const moment = require('moment');
const db = require('../config/firebase.config');

const getShiftDetails = async (partnerId, date) => {
    try {
        const formattedDate = moment(date, "YYYY-MM-DD").format("D MMMM YYYY"); 
        const attendanceRef = db.collection('Partners').doc(partnerId).collection('Attendance');

      
        const snapshot = await attendanceRef.where('date', '==', formattedDate).get();

        if (snapshot.empty) {
            return null;
        }

        return snapshot.docs[0].data();
    } catch (error) {
        console.error("Error fetching shift details:", error);
        return null;
    }
};

module.exports ={getShiftDetails};