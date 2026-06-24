import https from 'https';

export const sendPushNotification = async (playerIds, title, message, data = {}) => {
    const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID;
    const ONESIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

    // DEBUG LOGS
    console.log(`[OneSignal] Init - APP_ID present: ${!!ONESIGNAL_APP_ID}`);
    console.log(`[OneSignal] Init - API_KEY present: ${!!ONESIGNAL_API_KEY}`);
    if (ONESIGNAL_APP_ID) console.log(`[OneSignal] APP_ID Start: ${ONESIGNAL_APP_ID.substring(0, 5)}...`);

    return new Promise((resolve, reject) => {
        if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
            console.warn("OneSignal App ID or API Key is missing. Notification skipped.");
            return resolve({ error: "Missing Credentials" });
        }

        if (!playerIds || playerIds.length === 0) {
            console.warn("No player IDs provided for notification.");
            return resolve({ error: "No Targets" });
        }

        const headers = {
            "Content-Type": "application/json; charset=utf-8",
            "Authorization": `Basic ${ONESIGNAL_API_KEY}`
        };

        const payload = {
            app_id: ONESIGNAL_APP_ID,
            include_player_ids: playerIds,
            headings: { en: title },
            contents: { en: message },
            data: data
        };

        const options = {
            host: "onesignal.com",
            port: 443,
            path: "/api/v1/notifications",
            method: "POST",
            headers: headers
        };

        const req = https.request(options, function (res) {
            let responseData = "";

            res.on("data", function (chunk) {
                responseData += chunk;
            });

            res.on("end", function () {
                try {
                    const parsed = JSON.parse(responseData);
                    console.log("[OneSignal] Notification Sent:", parsed);
                    resolve(parsed);
                } catch (e) {
                    console.error("[OneSignal] Error parsing response:", responseData);
                    resolve({ error: "Parse Error", raw: responseData });
                }
            });
        });

        req.on("error", function (e) {
            console.error("[OneSignal] HTTP Error:", e);
            reject(e);
        });

        req.write(JSON.stringify(payload));
        req.end();
    });
};
