require("dotenv").config();
import { Response } from "express";
import { IUser } from "../models/user.model";
import { redis } from "./redis";

interface ITokenOptions {
	expires: Date;
	maxAge: number;
	httpOnly: boolean;
	sameSite: boolean | "lax" | "none" | "strict" | undefined;
	secure?: boolean;
}

const accessTokenExpire = parseInt(
	process.env.ACCESS_TOKEN_EXPIRE || "300",
	10
);
const refreshTokenExpire = parseInt(
	process.env.REFRESH_TOKEN_EXPIRE || "1200",
	10
);

// options for cookies 5 mins

export const accessTokenOptions: ITokenOptions = {
	expires: new Date(Date.now() + accessTokenExpire * 60 * 60 * 1000),
	maxAge: accessTokenExpire * 60 * 60 * 1000,
	httpOnly: true,
	sameSite: "lax",
	secure: true,
};

export const refreshTokenOptions: ITokenOptions = {
	expires: new Date(Date.now() + refreshTokenExpire * 24 * 60 * 60 * 1000),
	maxAge: refreshTokenExpire * 24 * 60 * 60 * 1000,
	httpOnly: true,
	sameSite: "lax",
	secure: true,
};

export const sendToken = async (
	user: IUser,
	statusCode: number,
	res: Response
) => {
	const accessToken = user.SignAccessToken();
	const refreshToken = user.SignRefreshToken();



	// upload session  to redis
	await redis.set(user._id, JSON.stringify(user) as any);

	// const redisUser = await redis.get(user._id);
	// console.log(redisUser);
	// parse environment variables to integrates with fallback values

	// only set secure to true in production

	// if (process.env.NODE_ENV !== "production") {
	// 	accessTokenOptions.secure = true;
	// }
	res.cookie("access_token", accessToken, accessTokenOptions);
	res.cookie("refresh_token", refreshToken, refreshTokenOptions);

	res.status(statusCode).json({
		success: true,
		user,
		accessToken,
	});
};

