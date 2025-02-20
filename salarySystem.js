const cron = require('node-cron');
const moment = require('moment');

const db = require('./src/config/firebase.config');

// Constants 
const BASE_WAGE = 500;
const DEDUCTION_RULES = {
    late: { "15-60": 60, ">60": 120 },
    earlyLeave: { "15-60": 60, ">60": 120 },
    halfDay: 250,
    noShow: 200,
};


const getPartnerDetails = async (partnerId) => {
    try {
        const partnerDoc = await db.collection('Partners').doc(partnerId).get();
        if (!partnerDoc.exists) return null;
        return partnerDoc.data();
    } catch (error) {
        console.error("Error fetching partner details:", error);
        return null;
    }
};


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


const calculateHolidaysLeft = (joiningDate) => {
    let joiningDay = moment(joiningDate, "YYYY-MM-DD").date();
    if (joiningDay <= 1) return 4;
    if (joiningDay <= 3) return 3;
    if (joiningDay <= 15) return 2;
    if (joiningDay <= 21) return 1;
    return 0;
};

const getDeductionAmount = (rules, minutes) => {
    if (minutes <= 0) return 0;
    if (minutes > 15 && minutes <= 60) return rules["15-60"];
    if (minutes > 60) return rules[">60"];
    return 0;
};

const getMinutesLate = (shiftStart, startTime) => {
    if (!shiftStart || !startTime) return 0;
    return moment(startTime, "HH:mm").diff(moment(shiftStart, "HH:mm"), 'minutes');
};

const getWorkDuration = (startTime, endTime, breakDuration = 0) => {
    if (!startTime || !endTime) return 0;
    return moment(endTime, "HH:mm").diff(moment(startTime, "HH:mm"), 'minutes') - breakDuration;
};

const applyDeductions = (baseWage, shiftDetails) => {
    let deductions = {
        earlyEnd: 0,
        halfDay: 0,
        late: 0,
        noShow: 0
    };
    
    // late deduction
    let lateMinutes = getMinutesLate(shiftDetails.shiftStart, shiftDetails.startTime);
    deductions.late = getDeductionAmount(DEDUCTION_RULES.late, lateMinutes);
    baseWage -= deductions.late;

    // half day deduction
    let workDuration = getWorkDuration(shiftDetails.startTime, shiftDetails.endTime, shiftDetails.breakDuration || 0);
    if (workDuration <= 300) {
        deductions.halfDay = BASE_WAGE - DEDUCTION_RULES.halfDay;
        baseWage = DEDUCTION_RULES.halfDay;
    }
    //early leaving deduction
    else if (workDuration < 540) {
        deductions.earlyEnd = getDeductionAmount(DEDUCTION_RULES.earlyLeave, 540 - workDuration);
        baseWage -= deductions.earlyEnd;
    }
    
    return { baseWage, deductions };
};


const calculateDailyWage = async (partnerId) => {
    let today = moment().format('YYYY-MM-DD');
    let baseWage = BASE_WAGE;
    let dayOfWeek = moment().day();
    

    let deductions = {
        earlyEnd: 0,
        halfDay: 0,
        late: 0,
        noShow: 0
    };

    let partner = await getPartnerDetails(partnerId);
    if (!partner) {
        return { dailyWage: baseWage, deductions };
    }

    let shiftDetails = await getShiftDetails(partnerId, today);
    if (!shiftDetails) {
        return { dailyWage: baseWage, deductions };
    }

    let holidaysLeft = calculateHolidaysLeft(partner.dateOfJoining);
 

    if (shiftDetails.noShow) {
       
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            if (holidaysLeft === 0) {
                deductions.noShow = DEDUCTION_RULES.noShow;
                baseWage -= deductions.noShow;
              
            } else {
                console.log(`Weekend no-show with holidays available, no deduction applied`);
            }
        } else {
            deductions.noShow = DEDUCTION_RULES.noShow;
            baseWage -= deductions.noShow;
            
        }
    } else {
        console.log(`Calculating deductions for partner ${partnerId}`);
        const result = applyDeductions(baseWage, shiftDetails);
        baseWage = result.baseWage;
        deductions = result.deductions;
        console.log(`Applied deductions: ${JSON.stringify(deductions)}`);
    }

    return { dailyWage: baseWage, deductions };
};


const calculateSalaries = async () => {
    try {
        console.log("Starting daily salary calculation...");
        const partnersSnapshot = await db.collection('Partners').get();
        const partners = partnersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
       

        for (let partner of partners) {
            try {
                const { dailyWage, deductions } = await calculateDailyWage(partner.id);
                console.log(`Calculated salary for Partner ${partner.id}: Rs. ${dailyWage}`);

            
                const formattedDate = moment().format('DD MMMM YYYY');
                
              
                await db.collection('Partners').doc(partner.id).collection('DailyCheck').add({
                    date: formattedDate,
                    deduction: {
                        earlyEnd: deductions.earlyEnd || 0,
                        halfDay: deductions.halfDay || 0,
                        late: deductions.late || 0,
                        noShow: deductions.noShow || 0
                    },
                    earning: {
                        dayEarning: dailyWage
                    },
                    updatedAt: new Date().toISOString()
                });
                
              
            } catch (partnerError) {
                console.error(`Error processing partner ${partner.id}:`, partnerError);
              
            }
        }

        console.log("Daily salary calculation completed successfully");
    } catch (error) {
        console.error("Error in salary calculation process:", error);
    }
};



cron.schedule('0 0 * * *', () => {
    console.log("Running scheduled daily salary job at", new Date().toISOString());
    calculateSalaries();
});


if (process.argv.includes('--run-manual')) {
    console.log("Running manual salary calculation");
    calculateSalaries()
        .then(() => {
            console.log("Manual calculation completed, exiting");
            process.exit(0);
        })
        .catch(err => {
            console.error("Manual calculation failed:", err);
            process.exit(1);
        });
}

