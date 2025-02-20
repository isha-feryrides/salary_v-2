const moment = require('moment');
const { BASE_WAGE, DEDUCTION_RULES } = require('../config/constants.config');
const { getPartnerDetails } = require('../services/partner.service');
const { getShiftDetails } = require('../services/shift.service');

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
        deductions = result.deductions || deductions; 
    }

    return { dailyWage: Math.max(0, baseWage), deductions }; 
};


const applyDeductions = (baseWage, shiftDetails, partner) => {
    let deductions = {
        earlyEnd: 0,
        halfDay: 0,
        late: 0,
        noShow: 0
    };

    let expectedStartTime = moment(partner.slotStart, "HH:mm");
    let actualStartTime = moment(shiftDetails.startTimeDisplay, "HH:mm");
    let lateMinutes = actualStartTime.diff(expectedStartTime, 'minutes');

   
    if (lateMinutes > 0) {
        deductions.late = getDeductionAmount(DEDUCTION_RULES.late, lateMinutes);
    }

   
    if (shiftDetails.halfDay) {
        deductions.halfDay = BASE_WAGE / 2; 
        baseWage = BASE_WAGE / 2;
    }

 
    let workDuration = getWorkDuration(shiftDetails.startTime, shiftDetails.endTime, shiftDetails.breakDuration);


    if (workDuration < 540) {
        deductions.earlyEnd = getDeductionAmount(DEDUCTION_RULES.earlyLeave, 540 - workDuration);
    }

 
    baseWage -= (deductions.late + deductions.earlyEnd);

    return { baseWage, deductions };
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
    if (minutes > 15 && minutes <= 60) return rules["15-60"]; 
    if (minutes > 60) return rules[">60"]; 
    return 0;
};


const getWorkDuration = (startTime, endTime, breakDuration) => moment(endTime, "HH:mm").diff(moment(startTime, "HH:mm"), 'minutes') - breakDuration;

module.exports = { calculateDailyWage };
