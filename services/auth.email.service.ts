import { ServiceSchema } from "../../../lib/types";

const Service: ServiceSchema = {
	name: "auth.email",
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
				},
				password: {
					type: "string",
					min: 6,
					max: 255,
				},
			},
			async handler(ctx) {
				try {
					const { firstname, lastname, fullname, email, password } = ctx.params;

					// check email exists or not
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

					// create user
					const resultUserCreate: any = await ctx.call("api.v1.user.create", {
						firstname,
						lastname,
						fullname,
						email,
						unique: "email",
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
				email: {
					type: "email",
				},
				password: {
					type: "string",
					min: 6,
					max: 255,
				},
			},
			async handler(ctx) {
				try {
					const { email, password } = ctx.params;

					// get user by email
					const resultUserByEmail = await this.getUserByEmail(ctx, email);

					if (resultUserByEmail.code != 200) {
						return {
							code: 400,
							i18n: "BAD_EMAIL",
						};
					}

					const resultPasswordByUserId: any = await ctx.call(
						"api.v1.password.compare",
						{
							user: resultUserByEmail.data.id,
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
							identity: resultUserByEmail.data.id,
							service: "auth",
						}
					);

					if (resultGenerateToken.code != 200) {
						return resultGenerateToken;
					}

					// @EVENT user.login
					ctx.emit("user.login", {
						user: resultUserByEmail.data,
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
	},

	/**
	 * Events
	 */
	events: {},

	/**
	 * Methods
	 */
	methods: {
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
