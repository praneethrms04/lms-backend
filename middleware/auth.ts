import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";
import { catchAsyncError } from "./catchAsyncError";
import jwt, { JwtPayload } from "jsonwebtoken";
import { redis } from "../utils/redis";

export const isAuthenticated = catchAsyncError(
	async (req: Request, res: Response, next: NextFunction) => {
		console.log("access token from auth", req.cookies.access_token);

		const accessToken = req.cookies.access_token as string;

		if (!accessToken) {
			return next(
				new ErrorHandler("Please login to access this resource.", 400)
			);
		}

		try {
			const decoded = jwt.verify(
				accessToken,
				process.env.ACCESS_TOKEN as string
			) as JwtPayload;

			if (!decoded) {
				return next(new ErrorHandler("Access token is not valid", 400));
			}

			console.log("decoded in auth", decoded);

			const redisUser = await redis.get(decoded.id);

			if (!redisUser) {
				return next(new ErrorHandler("User is not found", 400));
			}

			req.user = JSON.parse(redisUser);
			next();
		} catch (error) {
			console.error("JWT Verification Error:", error);
			return next(new ErrorHandler("Access token is not valid", 400));
		}
	}
);

// validate user role

export const authourizedRole = (...roles: string[]) => {
	return (req: Request, res: Response, next: NextFunction) => {
		if (!roles.includes(req.user?.role || "")) {
			return next(
				new ErrorHandler(
					`Role : ${req?.user?.role} is not allowed to access this resource`,
					403
				)
			);
		}
		next();
	};
};
