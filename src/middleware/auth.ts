
import  jwt  from "jsonwebtoken";
import { NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import { Socket } from "socket.io";

const prisma = new PrismaClient()

export const protectRoute = async (req: Request, res: Response, next : NextFunction) => {
    try {
        const token = req.cookies.jwt

        if(!token) {
            res.status(401).json({
                success: false,
                message: 'Not authorized - No Token'
            });
            return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123') as {id: string};

        if(!decoded) {
            res.status(401).json({
                success: false,
                message: 'Not autorized - invalid token'
            });
            return;
        }

        const currentUser = await prisma.user.findUnique({
            where: { id: decoded.id}
        });

        req.user = currentUser;

        next();

    } catch (error) {
        console.log('Error while getting user details');
        if( error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({
                success: false,
                message: 'Not authorized - Invalid token'
            })
            return;
        } else{
            res.status(500).json({
                success: false,
                message: 'Error in server'
            })
            return;
        }
    }
}

export const authenticateSocket = async (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth.token;
  
    if (!token) {
      return next(new Error('Authentication error: No token'));
    }
  
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      
      const user = await prisma.user.findUnique({ 
        where: { id: decoded.userId } 
      });
  
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
  
      socket.data.user = user;
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
};