import { Response } from "express";
import userModel from "../models/user.model";
import { redis } from "../utils/redis";

export const getUserById = async (id: string, res: Response) => {
	// const user = await userModel.findById(id);
	const userData = await redis.get(id);
	console.log(userData)
	if (userData) {
		const user = JSON.parse(userData);
		res.status(200).json({
			success: true,
			user,
		});
	}
};
