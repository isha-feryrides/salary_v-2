const db = require('../config/firebase.config');

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

module.exports = { getPartnerDetails };
