const cron = require('node-cron');
const moment = require('moment');
const db = require('../config/firebase.config');

const BASE_WAGE = 500;
const DEDUCTION_RULES = {
    late: { "15-60": 60, ">60": 120 },
    earlyLeave: { "15-60": 60, ">60": 120 },
    halfDay: 250,
    noShow: 200
};


const getPartnerDetails = async (partnerId) => {
    try {
        const partnerDoc = await db.collection('Partners').doc(partnerId).get();
        return partnerDoc.exists ? partnerDoc.data() : null;
    } catch (error) {
        console.error("Error fetching partner details:", error);
        return null;
    }
};


const getShiftDetails = async (partnerId, date) => {
    try {
        const formattedDate = moment(date, "YYYY-MM-DD").format("D MMMM YYYY");
        const attendanceRef = db.collection('Partners').doc(partnerId).collection('Attendance');
        const snapshot = await attendanceRef.where('date', '==', formattedDate).get();

        return snapshot.empty ? null : snapshot.docs[0].data();
    } catch (error) {
        console.error("Error fetching shift details:", error);
        return null;
    }
};


const calculateHolidaysLeft = (joiningDate) => {
    let joiningDay = moment(joiningDate, "YYYY-MM-DD").date();
    return joiningDay <= 1 ? 4 : joiningDay <= 3 ? 3 : joiningDay <= 15 ? 2 : joiningDay <= 21 ? 1 : 0;
};


const getDeductionAmount = (rules, minutes) => {
    return minutes > 15 && minutes <= 60 ? rules["15-60"] : minutes > 60 ? rules[">60"] : 0;
};


const getWorkDuration = (startTime, endTime, breakDuration) => {
    return moment(endTime, "HH:mm").diff(moment(startTime, "HH:mm"), 'minutes') - breakDuration;
};


const applyDeductions = (baseWage, shiftDetails, partner) => {
    let deductions = { earlyEnd: 0, halfDay: 0, late: 0, noShow: 0 };

    let expectedStartTime = moment(partner.slotStart, "HH:mm");
    let actualStartTime = moment(shiftDetails.startTimeDisplay, "HH:mm");
    let lateMinutes = actualStartTime.diff(expectedStartTime, 'minutes');

    if (lateMinutes > 0) deductions.late = getDeductionAmount(DEDUCTION_RULES.late, lateMinutes);
    if (shiftDetails.halfDay) {
        deductions.halfDay = BASE_WAGE / 2;
        baseWage = BASE_WAGE / 2;
    }

    let workDuration = getWorkDuration(shiftDetails.startTime, shiftDetails.endTime, shiftDetails.breakDuration);
    if (workDuration < 540) deductions.earlyEnd = getDeductionAmount(DEDUCTION_RULES.earlyLeave, 540 - workDuration);

    baseWage -= (deductions.late + deductions.earlyEnd);
    return { baseWage, deductions };
};


const calculateDailyWage = async (partnerId) => {
    let today = moment().format('YYYY-MM-DD');
    let baseWage = BASE_WAGE;
    let dayOfWeek = moment().day();

    let deductions = { earlyEnd: 0, halfDay: 0, late: 0, noShow: 0 };

    let partner = await getPartnerDetails(partnerId);
    if (!partner) return { dailyWage: baseWage, deductions };

    let shiftDetails = await getShiftDetails(partnerId, today);
    if (!shiftDetails) return { dailyWage: baseWage, deductions };

    let holidaysLeft = calculateHolidaysLeft(partner.dateOfJoining);

    if (shiftDetails.noShow) {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            if (holidaysLeft === 0) {
                deductions.noShow = DEDUCTION_RULES.noShow;
                baseWage -= deductions.noShow;
            }
        } else {
            deductions.noShow = DEDUCTION_RULES.noShow;
            baseWage -= deductions.noShow;
        }
    } else {
        const result = applyDeductions(baseWage, shiftDetails, partner);
        baseWage = result.baseWage;
        deductions = result.deductions;
    }

    return { dailyWage: Math.max(0, baseWage), deductions };
};


const calculateSalaries = async () => {
    try {
        const partnersSnapshot = await db.collection('Partners').get();
        const partners = partnersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        for (let partner of partners) {
            const { dailyWage, deductions } = await calculateDailyWage(partner.id);
            console.log(`Salary for Partner ${partner.id}: Rs. ${dailyWage}`);

            await db.collection('Partners').doc(partner.id).collection('DailyCheck').add({
                date: new Date().toISOString().split('T')[0],
                deduction: {
                    earlyEnd: deductions.earlyEnd || 0,
                    halfDay: deductions.halfDay || 0,
                    late: deductions.late || 0,
                    noShow: deductions.noShow || 0
                },
                earning: { dayEarning: dailyWage },
                updatedAt: new Date()
            });
        }

        console.log("Daily salary calculation completed.");
    } catch (error) {
        console.error("Error in salary calculation:", error);
    }
};


cron.schedule('0 0 * * *', () => {
    console.log("Running daily salary job...");
    calculateSalaries();
});

module.exports = { calculateSalaries };
