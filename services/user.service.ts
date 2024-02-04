import { Response } from "express";
import userModel from "../models/user.model";

export const getUserById = async (id: string, res: Response) => {
	const user = await userModel.findById(id);
	console.log(user);
	res.status(200).json({
		success: true,
		user,
	});
};

