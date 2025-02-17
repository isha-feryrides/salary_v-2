module.exports = {
    BASE_WAGE: 500,
    DEDUCTION_RULES: {
        late: { "15-60": 60, ">60": 120 },
        earlyLeave: { "15-60": 60, ">60": 120 },
        halfDay: 250,
        noShow: 200,
    }
};
