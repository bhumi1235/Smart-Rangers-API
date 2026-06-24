import jwt from "jsonwebtoken";
import "dotenv/config";

const SECRET = process.env.JWT_SECRET;

export const generateToken = (payload, expiresIn = "90d") => {
    // Payload should include { id, phone, role }
    return jwt.sign(payload, SECRET, { expiresIn });
};

export const verifyToken = (token) => {
    try {
        return jwt.verify(token, SECRET);
    } catch (error) {
        return null; // Invalid token
    }
};
