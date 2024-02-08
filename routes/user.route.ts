import express from "express";
import {
	activationUser,
	getUserInfo,
	logOutUser,
	loginUser,
	registerUser,
	socialAuthentication,
	updateAccessToken,
	updatePassword,
	updateProfilePicture,
	updateUserInfo,
} from "../controllers/user.controller";
import { authourizedRole, isAuthenticated } from "../middleware/auth";

const userRouter = express.Router();

userRouter.post("/register", registerUser);
userRouter.post("/activation-user", activationUser);
userRouter.post("/login", loginUser);
userRouter.get(
	"/logout",
	isAuthenticated,
	// authourizedRole("admin"),
	logOutUser
);
userRouter.get("/refresh", updateAccessToken);
userRouter.get("/me", isAuthenticated, getUserInfo);
userRouter.post("/social-auth", socialAuthentication);
userRouter.put("/update-user",isAuthenticated, updateUserInfo);
userRouter.put("/update-user-password",isAuthenticated, updatePassword);
userRouter.put("/update-user-avatar", isAuthenticated, updateProfilePicture);


export default userRouter;
