const moment = require('moment');
const { BASE_WAGE, DEDUCTION_RULES } = require('../config/constants.config');
const { getPartnerDetails } = require('../services/partner.service');
const { getShiftDetails } = require('../services/shift.service');

const calculateDailyWage = async (partnerId) => {
    let today = moment().format('YYYY-MM-DD');
    let baseWage = BASE_WAGE;
    let dayOfWeek = moment().day();

    let partner = await getPartnerDetails(partnerId);
    if (!partner) return baseWage;

    let shiftDetails = await getShiftDetails(partnerId, today);
    if (!shiftDetails) return baseWage;

    let holidaysLeft = calculateHolidaysLeft(partner.dateOfJoining);

    if (shiftDetails.noShow) {
        if (dayOfWeek === 0 || dayOfWeek === 6) {
            if (holidaysLeft === 0) baseWage -= DEDUCTION_RULES.noShow;
        } else {
            baseWage -= DEDUCTION_RULES.noShow;
        }
    } else {
        baseWage = applyDeductions(baseWage, shiftDetails);
    }

    return baseWage;
};

const applyDeductions = (baseWage, shiftDetails) => {
    let lateMinutes = getMinutesLate(shiftDetails.shiftStart, shiftDetails.startTime);
    baseWage -= getDeductionAmount(DEDUCTION_RULES.late, lateMinutes);

    let workDuration = getWorkDuration(shiftDetails.startTime, shiftDetails.endTime, shiftDetails.breakDuration);
    if (workDuration <= 300) baseWage = DEDUCTION_RULES.halfDay;

    baseWage -= getDeductionAmount(DEDUCTION_RULES.earlyLeave, 540 - workDuration);
    return baseWage;
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

const getMinutesLate = (shiftStart, startTime) => moment(startTime, "HH:mm").diff(moment(shiftStart, "HH:mm"), 'minutes');
const getWorkDuration = (startTime, endTime, breakDuration) => moment(endTime, "HH:mm").diff(moment(startTime, "HH:mm"), 'minutes') - breakDuration;

module.exports = { calculateDailyWage };
