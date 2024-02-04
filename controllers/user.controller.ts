require("dotenv").config();
import { NextFunction, Request, Response } from "express";
import { catchAsyncError } from "../middleware/catchAsyncError";
import ErrorHandler from "../utils/ErrorHandler";
import userModel, { IUser } from "../models/user.model";
import jwt, { JwtPayload, Secret } from "jsonwebtoken";
import ejs from "ejs";
import path from "path";
import sendMail from "../utils/sendMail";
import {
	accessTokenOptions,
	refreshTokenOptions,
	sendToken,
} from "../utils/jwt";
import { redis } from "../utils/redis";
import { getUserById } from "../services/user.service";

interface IRegistrationBody {
	name: string;
	email: string;
	password: string;
}

export const registerUser = catchAsyncError(
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { name, email, password } = req.body;

			const isEmailExist = await userModel.findOne({ email });
			if (isEmailExist)
				return next(new ErrorHandler("email already exists", 400));
			const user: IRegistrationBody = {
				name,
				email,
				password,
			};
			const activationToken = createActivationToken(user);
			const activationCode = activationToken.activationCode;
			const data = { user: { name: user.name }, activationCode };

			const html = await ejs.renderFile(
				path.join(__dirname, "../mails/activation-email.ejs"),
				data
			);

			try {
				await sendMail({
					email: user.email,
					subject: "Activate your account",
					template: "activation-email.ejs",
					data,
				});
				res.status(201).json({
					success: true,
					message: `Please activate your email : ${user.email} to activate your account`,
					activationToken: activationToken.token,
					email: user.email,
				});
			} catch (error: any) {
				console.log(error.message);
				next(new ErrorHandler(error.message, 400));
			}
		} catch (error: any) {
			next(new ErrorHandler(error.message, 400));
		}
	}
);

interface IActivationToken {
	token: string;
	activationCode: string;
	user: IUser;
}

export const createActivationToken = (user: any): IActivationToken => {
	const activationCode = Math.floor(1000 + Math.random() * 9000).toString();

	let secretOrPrivateKey: Secret | undefined = process.env.ACTIVATION_SECRET;

	if (!secretOrPrivateKey) {
		throw new Error("ACTIVATION_SECRET is not defined");
	}

	const token = jwt.sign({ user, activationCode }, secretOrPrivateKey, {
		expiresIn: "5m",
	});

	return { token, activationCode, user };
};

//

interface IActivationRequest {
	activation_token: string;
	activation_code: string;
}

export const activationUser = catchAsyncError(
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { activation_token, activation_code } =
				req.body as IActivationRequest;

			// Verify the activation token
			const newUser: { user: IUser; activationCode: string } = jwt.verify(
				activation_token,
				process.env.ACTIVATION_SECRET as string
			) as { user: IUser; activationCode: string };

			// Check if the activation code matches
			if (newUser.activationCode !== activation_code) {
				return next(new ErrorHandler("Invalid OTP", 400));
			}

			const { name, email, password } = newUser.user;
			const existUser = await userModel.findOne({ email });

			if (existUser) {
				return next(new ErrorHandler("Email already exists", 400));
			}

			// Create the user if everything is valid
			const user = await userModel.create({
				name,
				email,
				password,
			});

			res.status(201).json({
				success: true,
			});
		} catch (error: any) {
			return next(new ErrorHandler(error.message, 400));
		}
	}
);

interface ILoginRequest {
	email: string;
	password: string;
}

export const loginUser = catchAsyncError(
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email, password } = req.body as ILoginRequest;

			if (!email || !password) {
				return next(
					new ErrorHandler("Please enter email and password", 400)
				);
			}

			const user = await userModel.findOne({ email }).select("+password");
			if (!user) {
				return next(new ErrorHandler("Invalid email or password", 400));
			}

			const isPasswordMatch = await user.comparePassword(password);

			if (!isPasswordMatch) {
				return next(new ErrorHandler("Invalid password", 400));
			}
			sendToken(user, 200, res);
		} catch (error: any) {
			return next(new ErrorHandler(error.message, 400));
		}
	}
);

export const logOutUser = catchAsyncError(
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			res.cookie("access_token", "", { maxAge: 1 });
			res.cookie("refresh_token", "", { maxAge: 1 });

			const userId = req.user?._id as string;
			console.log(req.user?._id);

			const deletedUser = await redis.del(userId);

			if (deletedUser) {
				console.log("deleted user");
			} else {
				console.log("de;user not found");
			}

			res.status(200).json({
				success: true,
				message: "Logged Out successfully",
			});
		} catch (error: any) {
			return next(new ErrorHandler(error.message, 400));
		}
	}
);

//update access token

export const updateAccessToken = catchAsyncError(
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const refresh_token = req.cookies.refresh_token as string;
			console.log("accesstoken from refresh", req.cookies.refresh_token)

			const decoded = jwt.verify(
				refresh_token,
				process.env.REFRESH_TOKEN as string
			) as JwtPayload;
			console.log("decode in update", decoded);

			const message = "Could not refresh token";
			if (!decoded) {
				return next(new ErrorHandler(message, 400));
			}

			const session = await redis.get(decoded.id as string);

			if (!session) {
				return next(new ErrorHandler(message, 400));
			}
			const user = JSON.parse(session);
			console.log("user", user);

			const accessToken = jwt.sign(
				{ id: user._id },
				process.env.ACCESS_TOKEN || "",
				{
					expiresIn: "5m",
				}
			);
			const refreshToken = jwt.sign(
				{ id: user._id },
				process.env.REFRESH_TOKEN || "",
				{
					expiresIn: "3d",
				}
			);

			res.cookie("access_token", accessToken, accessTokenOptions);
			res.cookie("refresh_token", refreshToken, refreshTokenOptions);

			res.status(200).json({
				success: true,
				accessToken,
				// refreshToken,
			});
		} catch (error: any) {
			console.log(error);
			return next(new ErrorHandler(error.message, 400));
		}
	}
);

// get user info

export const getUserInfo = catchAsyncError(
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const userId = req.user?._id;
			console.log(req.user);
			getUserById(userId, res);
		} catch (error: any) {
			return next(new ErrorHandler(error.message, 400));
		}
	}
);

//social -authentication
interface ISocialAuthBody {
	email: string;
	name: string;
	avatar: string;
}

export const socialAuthentication = catchAsyncError(
	async (req: Request, res: Response, next: NextFunction) => {
		try {
			const { email, name, avatar } = req.body as ISocialAuthBody;
			const user = await userModel.findOne({ email });
			console.log(user);

			if (!user) {
				const newUser = await userModel.create({
					name,
					avatar,
					email,
				});
				sendToken(newUser, 200, res);
			} else {
				sendToken(user, 200, res);
			}
		} catch (error: any) {
			return next(new ErrorHandler(error.message, 400));
		}
	}
);
