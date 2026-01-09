import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';



export interface AuthRequest extends Request {
    user?: {
        id: number;
        role: string;
    };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: number; role: string };
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token.' });
    }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== 'ADMIN') {
        console.log('Access denied. User role:', req.user?.role);
        return res.status(403).json({ message: `Access denied. Admin only. Current role: ${req.user?.role}` });
    }
    next();
};
