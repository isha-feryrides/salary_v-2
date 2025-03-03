const cron = require('node-cron');
const { calculateDailyWage } = require('../utils/salaryCalculator.utils');
const db = require('../config/firebase.config');

const calculateSalaries = async () => {
    try {
        const partnersSnapshot = await db.collection('Partners').get();
        const partners = partnersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        for (let partner of partners) {
            const wageData = await calculateDailyWage(partner.id);
            

            const { dailyWage, deductions } = wageData;

            console.log(`Salary for Partner ${partner.id}: Rs. ${dailyWage}`);

            await db.collection('Partners').doc(partner.id).collection('DailyCheck').add({
                date: new Date().toISOString().split('T')[0], 
                deduction: {
                    earlyEnd: deductions.earlyEnd || 0,
                    halfDay: deductions.halfDay || 0,
                    late: deductions.late || 0,
                    noShow: deductions.noShow || 0
                },
                earning: {
                    dayEarning: dailyWage
                },
                updatedAt: new Date() 
            });
        }

        console.log("Daily salary calculation completed.");
    } catch (error) {
        console.error("Error in salary calculation:", error);
    }
};



cron.schedule('* * * * *', () => {
    console.log("Running daily salary job...");
    calculateSalaries();
});

module.exports = { calculateSalaries };
