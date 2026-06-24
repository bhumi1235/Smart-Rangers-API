import jwt from "jsonwebtoken";

const authenticateAdmin = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        const verified = jwt.verify(token, process.env.JWT_SECRET);

        if (verified.role !== "admin") {
            return res.status(403).json({ message: "Access denied. Admins only." });
        }

        req.user = verified;
        next();
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            return res.status(401).json({ message: "Token expired. Please login again." });
        }
        res.status(403).json({ message: "Invalid token" });
    }
};

export default authenticateAdmin;
