import { ServiceSchema } from "../../../lib/types";

const Service: ServiceSchema = {
	name: "auth.username",
	version: "api.v1",

	/**
	 * Service settings
	 */
	settings: {},

	/**
	 * Service dependencies
	 */
	// dependencies: [],

	/**
	 * Actions
	 */
	actions: {
		register: {
			rest: "POST /register",
			params: {
				firstname: {
					type: "string",
					max: 255,
					optional: true,
				},
				lastname: {
					type: "string",
					max: 255,
					optional: true,
				},
				fullname: {
					type: "string",
					max: 255,
					optional: true,
				},
				email: {
					type: "email",
					optional: true,
				},
				username: {
					type: "string",
					max: 255,
				},
				password: {
					type: "string",
					min: 6,
					max: 255,
				},
			},
			async handler(ctx) {
				try {
					const { firstname, lastname, fullname, email, username, password } =
						ctx.params;

					// check username exists or not
					const resultUserByUsername = await this.getUserByUsername(
						ctx,
						username
					);

					if (resultUserByUsername.code == 200) {
						return {
							code: 400,
							i18n: "USERNAME_EXISTS",
							data: {
								username,
							},
						};
					}

					// check email exists or not
					if (email != undefined && email.length > 0) {
						const resultUserByEmail = await this.getUserByEmail(ctx, email);

						if (resultUserByEmail.code == 200) {
							return {
								code: 400,
								i18n: "EMAIL_EXISTS",
								data: {
									email,
								},
							};
						}
					}

					// create user
					const resultUserCreate: any = await ctx.call("api.v1.user.create", {
						firstname,
						lastname,
						fullname,
						username,
						email,
						unique: "username",
					});

					if (resultUserCreate.status == false) {
						return {
							code: 400,
							i18n: "FAILED_TO_CREATE_USER",
						};
					}

					await ctx.call("api.v1.password.save", {
						user: resultUserCreate.data.id,
						password,
					});

					return {
						code: 200,
						i18n: "REGISTERED_SUCCESSFULLY",
					};
				} catch (error) {
					console.error(error);
					return {
						code: 500,
					};
				}
			},
		},
		login: {
			rest: "POST /login",
			params: {
				username: {
					type: "string",
					max: 255,
				},
				password: {
					type: "string",
					min: 6,
					max: 255,
				},
			},
			async handler(ctx) {
				try {
					const { username, password } = ctx.params;

					// get user by username
					const resultUserByUsername = await this.getUserByUsername(
						ctx,
						username
					);

					if (resultUserByUsername.code != 200) {
						return {
							code: 400,
							i18n: "BAD_USERNAME",
						};
					}

					const resultPasswordByUserId: any = await ctx.call(
						"api.v1.password.compare",
						{
							user: resultUserByUsername.data.id,
							password: password,
						}
					);

					if (resultPasswordByUserId.code != 200) {
						return {
							code: 400,
							i18n: "BAD_PASSWORD",
						};
					}

					const resultGenerateToken: any = await ctx.call(
						"api.v1.token.generate",
						{
							identity: resultUserByUsername.data.id,
							service: "auth",
						}
					);

					if (resultGenerateToken.code != 200) {
						return resultGenerateToken;
					}

					// @EVENT user.login
					ctx.emit("user.login", {
						user: resultUserByUsername.data,
						token: resultGenerateToken.data.token,
					});

					return {
						code: 200,
						i18n: "LOGGEDIN_SUCCESSFULLY",
						data: {
							token: resultGenerateToken.data.token,
						},
					};
				} catch (error) {
					console.error(error);

					return {
						code: 500,
					};
				}
			},
		},
		forget: {
			rest: "POST /forget",
			params: {
				username: {
					type: "string",
					max: 255,
				},
			},
			async handler(ctx) {
				try {
					const { username } = ctx.params;

					// get user by username
					const resultUserByUsername = await this.getUserByUsername(
						ctx,
						username
					);

					if (resultUserByUsername.code != 200) {
						return {
							code: 400,
							i18n: "BAD_USERNAME",
						};
					}

					const user = resultUserByUsername.data;

					// check user has email or not
					if (user.email == undefined || user.email.length == 0) {
						return {
							code: 400,
							i18n: "EMAIL_NOT_FOUND",
						};
					}

					const resultRequestForgetEmail: any = await ctx.call(
						"api.v1.auth.forget.request",
						{
							email: user.email,
						}
					);

					return resultRequestForgetEmail;
				} catch (error) {
					console.error(error);

					return {
						code: 500,
					};
				}
			},
		},
	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {
		async getUserByUsername(ctx, username: string) {
			return ctx.call("api.v1.user.getByUnique", {
				unique: "username",
				value: username,
			});
		},
		async getUserByEmail(ctx, email: string) {
			return ctx.call("api.v1.user.getByUnique", {
				unique: "email",
				value: email,
			});
		},
	},

	/**
	 * Service created lifecycle event handler
	 */
	// created() {},

	/**
	 * Service started lifecycle event handler
	 */
	// started() { },

	/**
	 * Service stopped lifecycle event handler
	 */
	// stopped() { }
};

export = Service;
